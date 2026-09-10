'use client';
import { accountIdentifier } from '@/lib/login-identity';

import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
  getDocsFromServer,
  runTransaction,
  waitForPendingWrites,
  writeBatch,
  type Unsubscribe,
  type Transaction,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';

import {
  FARM_HISTORY_CHANNELS,
  FARM_INBOX_STATUSES,
  FARM_PROJECT_DOCUMENT_CATEGORIES,
  FARM_PROJECT_DOCUMENT_STATUS_LABELS,
  FARM_PROJECT_DOCUMENT_STATUSES,
  FARM_PROJECT_STAGES,
  FARM_PROJECT_STATUSES,
  FARM_PROJECT_TYPES,
  FARM_PROJECT_UPDATE_KINDS,
  FARM_SETTLEMENT_STATUSES,
  FARM_SETTLEMENT_STATUS_LABELS,
  FARM_SUBSCRIPTION_EVENT_TYPES,
  FARM_VISIT_STATUSES,
  FARM_WORK_PRIORITIES,
  FARM_WORK_STATUSES,
  FARM_WORK_STATUS_LABELS,
  FARM_WORK_TYPES,
  SUBSCRIPTION_STATUSES,
  type AddFarmHistoryEntryInput,
  type Farm,
  type FarmBlockerEpisode,
  type FarmHistoryEntry,
  type FarmInboxItem,
  type FarmInboxItemInput,
  type FarmInitialHistoryEntryInput,
  type FarmInput,
  type FarmLedgerWorkspace,
  type FarmProject,
  type FarmProjectDocument,
  type FarmProjectDocumentInput,
  type FarmProjectInput,
  type FarmProjectUpdate,
  type FarmProjectUpdateInput,
  type FarmRecord,
  type FarmRecordInput,
  type FarmSubscriptionEvent,
  type FarmSubscriptionEventInput,
  type FarmSubscriptionExpiryCorrectionInput,
  type FarmWorkChecklistItem,
  type FarmWorkItem,
  type FarmWorkItemInput,
  type FarmWorkVisit,
  type FarmWorkVisitInput,
  type SubscriptionStatus,
} from '@/lib/farm-types';

import {
  firebaseWorkspaceId,
  getFirebaseServices,
  requireSignedInUser,
} from './client';
import { renewalCountBeforeEvent } from '@/lib/subscription-renewal-report';
import { parseReceivedImages, type ReceivedImage } from '@/lib/received-images';
import { writeReceivedImages } from './received-images-store';
import {
  parseFarmLocationChange,
  resolveFarmLocationImages,
  type FarmLocationChange,
} from '@/lib/farm-location-images';
import {
  isProjectTask,
  isInternalTask,
  isStandaloneWork,
  sameWorkContext,
} from '@/lib/project-work';
import { resolveTaskAssignment } from './organization-store';
import { projectLifecyclePatch } from '@/lib/project-lifecycle';
import {
  assertSettlementTransition,
  parseSettlementRounds,
  withSettlementRounds,
  settlementsEqual,
  normalizeProjectSettlement,
} from '@/lib/project-settlements';
import {
  assertWorkActive,
  canManageWorkDeletion,
  isActiveWork,
} from '@/lib/work-lifecycle';
import { readMember } from '@/lib/organization';
import {
  calculateSubscriptionPayment,
  type SubscriptionPaymentRequest,
} from '@/lib/subscription-payment';

const COLLECTIONS = {
  projects: 'projects',
  projectDocuments: 'projectDocuments',
  projectUpdates: 'projectUpdates',
  farms: 'farms',
  records: 'farmRecords',
  subscriptionEvents: 'subscriptionEvents',
  inboxItems: 'inboxItems',
  workItems: 'workItems',
  blockerEpisodes: 'blockerEpisodes',
  visits: 'visits',
  checklistItems: 'checklistItems',
  historyEntries: 'historyEntries',
} as const;

type WorkspaceKey = keyof typeof COLLECTIONS;
type LedgerWriter = {
  set: (reference: DocumentReference, data: DocumentData) => unknown;
  update: (reference: DocumentReference, data: DocumentData) => unknown;
};
type JsonObject = Record<string, unknown>;
type AuditFields = {
  createdByUid: string;
  updatedByUid: string;
};

const emptyWorkspace: FarmLedgerWorkspace = {
  projects: [],
  projectDocuments: [],
  projectUpdates: [],
  farms: [],
  records: [],
  subscriptionEvents: [],
  inboxItems: [],
  workItems: [],
  blockerEpisodes: [],
  visits: [],
  checklistItems: [],
  historyEntries: [],
};

let latestWorkspace: FarmLedgerWorkspace | null = null;

function collectionRef(key: WorkspaceKey) {
  const { db } = getFirebaseServices();
  return collection(db, 'workspaces', firebaseWorkspaceId, COLLECTIONS[key]);
}

function documentRef(key: WorkspaceKey, id: string) {
  const { db } = getFirebaseServices();
  return doc(db, 'workspaces', firebaseWorkspaceId, COLLECTIONS[key], id);
}

function internalDocumentRef(collectionName: string, id: string) {
  const { db } = getFirebaseServices();
  return doc(db, 'workspaces', firebaseWorkspaceId, collectionName, id);
}

function asObject(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as JsonObject;
}

function requiredId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
    throw new Error(`${label}을(를) 확인해 주세요.`);
  }
  return value.trim();
}

type Shape = Record<string, 'string' | 'number' | 'boolean'>;

function parseShape<T>(value: unknown, shape: Shape, message: string): T {
  const source = asObject(value, message);
  const result: JsonObject = {};
  for (const [key, type] of Object.entries(shape)) {
    const field = source[key];
    if (typeof field !== type) throw new Error(message);
    if (type === 'string') {
      const text = (field as string).trim();
      if (text.length > 5000) throw new Error(`${key} 입력값이 너무 깁니다.`);
      result[key] = text;
    } else if (type === 'number') {
      if (!Number.isSafeInteger(field) || Math.abs(field as number) > 1e15) {
        throw new Error(message);
      }
      result[key] = field;
    } else {
      result[key] = field;
    }
  }
  return result as T;
}

function assertEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  message: string,
): asserts value is T {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(message);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function localDateAt(timestamp = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

function parseProjectInput(value: unknown): FarmProjectInput {
  let input = parseShape<FarmProjectInput>(
    value,
    {
      name: 'string',
      projectType: 'string',
      year: 'number',
      institution: 'string',
      status: 'string',
      description: 'string',
      targetFarmCount: 'number',
      manager: 'string',
      startDate: 'string',
      endDate: 'string',
      currentStage: 'string',
      settlementStatus: 'string',
      settlementDueDate: 'string',
      contractAmount: 'number',
      settlementClaimAmount: 'number',
      settlementApprovedAmount: 'number',
      settlementPaidAmount: 'number',
      settledAt: 'string',
      settlementOwner: 'string',
      settlementEvidenceUrl: 'string',
      settlementNote: 'string',
    },
    '사업 입력값을 확인해 주세요.',
  );
  const rounds = asObject(
    value,
    '정산 입력값을 확인해 주세요.',
  ).settlementRounds;
  if (rounds !== undefined)
    input = withSettlementRounds(input, parseSettlementRounds(rounds));
  if (
    [
      input.contractAmount,
      input.settlementClaimAmount,
      input.settlementApprovedAmount,
      input.settlementPaidAmount,
    ].some((amount) => amount < 0)
  )
    throw new Error('정산 금액은 0 이상으로 입력해 주세요.');
  assertEnum(
    input.projectType,
    FARM_PROJECT_TYPES,
    '사업 유형을 확인해 주세요.',
  );
  assertEnum(input.status, FARM_PROJECT_STATUSES, '사업 상태를 확인해 주세요.');
  assertEnum(
    input.currentStage,
    FARM_PROJECT_STAGES,
    '사업 단계를 확인해 주세요.',
  );
  assertEnum(
    input.settlementStatus,
    FARM_SETTLEMENT_STATUSES,
    '정산 상태를 확인해 주세요.',
  );
  if (!input.name || !input.institution || !input.manager) {
    throw new Error('사업명, 주관기관, 담당자를 입력해 주세요.');
  }
  if (input.year < 2000 || input.year > 2100 || input.targetFarmCount < 0) {
    throw new Error('사업 연도와 목표 농가 수를 확인해 주세요.');
  }
  if (input.settlementPaidAmount > input.settlementApprovedAmount) {
    throw new Error('입금액은 승인액보다 클 수 없습니다.');
  }
  assertProjectState(input);
  return input;
}

function parseProjectDocumentInput(value: unknown): FarmProjectDocumentInput {
  const input = parseShape<FarmProjectDocumentInput>(
    value,
    {
      title: 'string',
      category: 'string',
      isRequired: 'boolean',
      status: 'string',
      owner: 'string',
      currentHandler: 'string',
      dueDate: 'string',
      submittedAt: 'string',
      approvedAt: 'string',
      referenceUrl: 'string',
      revision: 'number',
      note: 'string',
    },
    '제출서류 입력값을 확인해 주세요.',
  );
  assertEnum(
    input.category,
    FARM_PROJECT_DOCUMENT_CATEGORIES,
    '서류 구분을 확인해 주세요.',
  );
  assertEnum(
    input.status,
    FARM_PROJECT_DOCUMENT_STATUSES,
    '서류 상태를 확인해 주세요.',
  );
  if (
    !input.title ||
    !input.owner ||
    !input.currentHandler ||
    input.revision < 1
  ) {
    throw new Error('서류명, 책임자, 현재 처리자와 개정번호를 확인해 주세요.');
  }
  return input;
}

function parseProjectUpdateInput(value: unknown): FarmProjectUpdateInput {
  const input = parseShape<FarmProjectUpdateInput>(
    value,
    {
      kind: 'string',
      title: 'string',
      channel: 'string',
      sender: 'string',
      receivedContent: 'string',
      actionContent: 'string',
      recorder: 'string',
      occurredAt: 'number',
      referenceUrl: 'string',
      blockedReason: 'string',
      blockedBy: 'string',
      expectedUnblockDate: 'string',
    },
    '프로젝트 기록 입력값을 확인해 주세요.',
  );
  assertEnum(
    input.kind,
    FARM_PROJECT_UPDATE_KINDS,
    '기록 구분을 확인해 주세요.',
  );
  if ((input.kind as string) === 'system') {
    throw new Error('시스템 기록은 직접 등록할 수 없습니다.');
  }
  assertEnum(
    input.channel,
    FARM_HISTORY_CHANNELS,
    '수신 경로를 확인해 주세요.',
  );
  if (!input.title || !input.recorder)
    throw new Error('기록 제목과 담당자를 입력해 주세요.');
  if (input.kind === 'blocker' && (!input.blockedReason || !input.blockedBy)) {
    throw new Error('막힘 사유와 해결해 줄 사람·기관을 입력해 주세요.');
  }
  return input;
}

function parseFarmInput(value: unknown): FarmInput {
  const input = parseShape<FarmInput>(
    value,
    {
      farmCode: 'string',
      name: 'string',
      phone: 'string',
      address: 'string',
      region: 'string',
      businessNumber: 'string',
      folderUrl: 'string',
      locationUrl: 'string',
      specialNotes: 'string',
    },
    '농가 기본정보를 확인해 주세요.',
  );
  if (!input.farmCode || !input.name || !input.region) {
    throw new Error('농장번호, 농장명, 지역을 입력해 주세요.');
  }
  return input;
}

function parseRecordInput(value: unknown): FarmRecordInput {
  const input = parseShape<FarmRecordInput>(
    value,
    {
      projectId: 'string',
      crop: 'string',
      deviceType: 'string',
      productType: 'string',
      vendor: 'string',
      productionSetupDate: 'string',
      installationDate: 'string',
      commissioningDate: 'string',
      educationDate: 'string',
      internetType: 'string',
      warrantyYears: 'number',
      warrantyExpiresAt: 'string',
      subscriptionYears: 'number',
      initialSubscriptionExpiresAt: 'string',
      currentSubscriptionExpiresAt: 'string',
      lastPaymentDate: 'string',
      renewalCount: 'number',
      subscriptionStatus: 'string',
      notes: 'string',
    },
    '사업·설치 정보를 확인해 주세요.',
  );
  assertEnum(
    input.subscriptionStatus,
    SUBSCRIPTION_STATUSES,
    '구독 상태를 확인해 주세요.',
  );
  if (
    !input.projectId ||
    input.warrantyYears < 0 ||
    input.subscriptionYears < 0
  ) {
    throw new Error('참여 사업과 기간 정보를 확인해 주세요.');
  }
  return input;
}

function parseSubscriptionEventInput(
  value: unknown,
): FarmSubscriptionEventInput {
  const input = parseShape<FarmSubscriptionEventInput>(
    value,
    {
      farmRecordId: 'string',
      expectedCurrentExpiryDate: 'string',
      expectedUpdatedAt: 'number',
      eventType: 'string',
      basisExpiryDate: 'string',
      processedAt: 'string',
      newExpiryDate: 'string',
      recorder: 'string',
      note: 'string',
    },
    '구독 처리 입력값을 확인해 주세요.',
  );
  const basisRenewalCount = asObject(
    value,
    '구독 처리 입력값을 확인해 주세요.',
  ).basisRenewalCount;
  if (basisRenewalCount !== undefined && basisRenewalCount !== null) {
    if (
      typeof basisRenewalCount !== 'number' ||
      !Number.isSafeInteger(basisRenewalCount) ||
      basisRenewalCount < 0
    ) {
      throw new Error(
        '기준 만료 회차 이전의 갱신 횟수는 0 이상의 정수로 입력해 주세요.',
      );
    }
    input.basisRenewalCount = basisRenewalCount;
  }
  assertEnum(
    input.eventType,
    FARM_SUBSCRIPTION_EVENT_TYPES,
    '구독 처리 유형을 확인해 주세요.',
  );
  if (
    !input.farmRecordId ||
    (input.expectedCurrentExpiryDate !== '' &&
      !isValidIsoDate(input.expectedCurrentExpiryDate)) ||
    !Number.isFinite(input.expectedUpdatedAt) ||
    input.expectedUpdatedAt < 0 ||
    !input.basisExpiryDate ||
    !input.processedAt ||
    !input.recorder
  ) {
    throw new Error('구독 기준일, 처리일과 담당자를 입력해 주세요.');
  }
  if (
    !isValidIsoDate(input.basisExpiryDate) ||
    !isValidIsoDate(input.processedAt) ||
    (input.eventType !== 'churned' &&
      (!isValidIsoDate(input.newExpiryDate) ||
        input.newExpiryDate <= input.basisExpiryDate)) ||
    (input.eventType === 'churned' && input.newExpiryDate)
  ) {
    throw new Error('구독 기준일, 처리일과 새 만료일을 확인해 주세요.');
  }
  return input;
}

function parseSubscriptionExpiryCorrectionInput(
  value: unknown,
): FarmSubscriptionExpiryCorrectionInput {
  const input = parseShape<FarmSubscriptionExpiryCorrectionInput>(
    value,
    {
      farmRecordId: 'string',
      expectedCurrentExpiryDate: 'string',
      expectedUpdatedAt: 'number',
      expiryDate: 'string',
      recorder: 'string',
      note: 'string',
    },
    '구독 만료일 입력값을 확인해 주세요.',
  );
  if (
    !input.farmRecordId ||
    (input.expectedCurrentExpiryDate !== '' &&
      !isValidIsoDate(input.expectedCurrentExpiryDate)) ||
    !Number.isFinite(input.expectedUpdatedAt) ||
    input.expectedUpdatedAt < 0 ||
    !isValidIsoDate(input.expiryDate) ||
    !input.recorder ||
    input.recorder.length > 100 ||
    input.note.length > 1000
  ) {
    throw new Error('만료일, 변경 담당자와 메모를 확인해 주세요.');
  }
  return input;
}

function parseInboxInput(value: unknown): FarmInboxItemInput {
  const source = asObject(value, '수신 내용을 확인해 주세요.');
  const input = parseShape<FarmInboxItemInput>(
    value,
    {
      channel: 'string',
      sender: 'string',
      content: 'string',
      capturedBy: 'string',
      receivedAt: 'number',
      referenceUrl: 'string',
    },
    '수신 내용 입력값을 확인해 주세요.',
  );
  assertEnum(
    input.channel,
    FARM_HISTORY_CHANNELS,
    '수신 경로를 확인해 주세요.',
  );
  if (
    !Number.isSafeInteger(input.receivedAt) ||
    input.receivedAt <= 0 ||
    input.receivedAt > Date.now()
  )
    throw new Error('받은 일시는 현재 또는 이전 시각으로 입력해 주세요.');
  input.projectId = source.projectId
    ? requiredId(source.projectId, '프로젝트')
    : '';
  input.taskTitle =
    typeof source.taskTitle === 'string'
      ? source.taskTitle.trim().slice(0, 160)
      : '';
  if (source.operationId) {
    if (
      typeof source.operationId !== 'string' ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(source.operationId)
    )
      throw new Error('수신 등록 정보를 다시 열어 주세요.');
    input.operationId = source.operationId;
  }
  if (
    (!input.content && !parseReceivedImages(source.images).length) ||
    !input.capturedBy
  )
    throw new Error('받은 내용과 기록 담당자를 입력해 주세요.');
  return input;
}

function parseWorkItemInput(value: unknown): FarmWorkItemInput {
  const source = asObject(value, '업무 입력값을 확인해 주세요.');
  const input = parseShape<FarmWorkItemInput>(
    value,
    {
      farmRecordId: 'string',
      workType: 'string',
      title: 'string',
      status: 'string',
      owner: 'string',
      dueDate: 'string',
      description: 'string',
      expectedOutcome: 'string',
      nextAction: 'string',
      priority: 'string',
      reviewDate: 'string',
      responseDueAt: 'number',
      blockedReason: 'string',
      blockedBy: 'string',
      expectedUnblockDate: 'string',
    },
    '업무 입력값을 확인해 주세요.',
  );
  assertEnum(input.workType, FARM_WORK_TYPES, '업무 유형을 확인해 주세요.');
  assertEnum(input.status, FARM_WORK_STATUSES, '업무 상태를 확인해 주세요.');
  assertEnum(
    input.priority,
    FARM_WORK_PRIORITIES,
    '업무 우선순위를 확인해 주세요.',
  );
  input.parentWorkItemId = source.parentWorkItemId
    ? requiredId(source.parentWorkItemId, '상위 업무')
    : '';
  if (source.scope !== undefined) {
    if (source.scope !== 'internal')
      throw new Error('업무 구분을 확인해 주세요.');
    input.scope = 'internal';
  }
  if (source.assigneeUid)
    input.assigneeUid = requiredId(source.assigneeUid, '담당 계정');
  if (
    input.scope === 'internal' &&
    (input.farmRecordId || source.projectId || !input.assigneeUid)
  )
    throw new Error(
      '내부 업무는 프로젝트 없이 승인된 담당 계정에 배정해 주세요.',
    );
  if (
    input.parentWorkItemId &&
    (input.farmRecordId ||
      (!source.projectId && input.scope !== 'internal') ||
      ['payment', 'subscription'].includes(input.workType))
  )
    throw new Error(
      '세부 업무는 같은 프로젝트의 실행 업무 아래에 등록해 주세요.',
    );
  input.projectId = source.projectId
    ? requiredId(source.projectId, '프로젝트')
    : '';
  if (
    (!input.farmRecordId && !input.projectId && input.scope !== 'internal') ||
    !input.title ||
    !input.owner
  ) {
    throw new Error(
      '대상 프로젝트 또는 농가, 업무명과 담당자를 입력해 주세요.',
    );
  }
  if (
    !input.farmRecordId &&
    ['payment', 'subscription'].includes(input.workType)
  )
    throw new Error('구독·입금은 농가를 선택해 등록해 주세요.');
  if (
    input.status === 'waiting' &&
    (!input.blockedReason || !input.blockedBy)
  ) {
    throw new Error('대기 업무의 막힘 사유와 해제 주체를 입력해 주세요.');
  }
  return input;
}

function parseInitialHistory(value: unknown): FarmInitialHistoryEntryInput {
  const input = parseShape<FarmInitialHistoryEntryInput>(
    value,
    {
      channel: 'string',
      sender: 'string',
      receivedContent: 'string',
      actionContent: 'string',
      amount: 'number',
      recorder: 'string',
      occurredAt: 'number',
      referenceUrl: 'string',
    },
    '최초 진행 기록을 확인해 주세요.',
  );
  assertEnum(
    input.channel,
    FARM_HISTORY_CHANNELS,
    '기록 경로를 확인해 주세요.',
  );
  if (!input.recorder) throw new Error('기록 담당자를 입력해 주세요.');
  return input;
}

function parseHistoryInput(value: unknown): AddFarmHistoryEntryInput {
  const source = asObject(value, '진행 기록 입력값을 확인해 주세요.');
  const base = parseShape<AddFarmHistoryEntryInput>(
    source,
    {
      workItemId: 'string',
      channel: 'string',
      sender: 'string',
      receivedContent: 'string',
      actionContent: 'string',
      amount: 'number',
      recorder: 'string',
      occurredAt: 'number',
      referenceUrl: 'string',
    },
    '진행 기록 입력값을 확인해 주세요.',
  );
  assertEnum(base.channel, FARM_HISTORY_CHANNELS, '기록 경로를 확인해 주세요.');
  const optionalShape: Shape = {
    expectedUpdatedAt: 'number',
    operationId: 'string',
    newStatus: 'string',
    nextAction: 'string',
    reviewDate: 'string',
    priority: 'string',
    owner: 'string',
    dueDate: 'string',
    expectedOutcome: 'string',
    responseDueAt: 'number',
    markResponded: 'boolean',
    blockedReason: 'string',
    blockedBy: 'string',
    expectedUnblockDate: 'string',
  };
  for (const [key, type] of Object.entries(optionalShape)) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== type)
      throw new Error('업무 변경값을 확인해 주세요.');
    (base as unknown as JsonObject)[key] =
      type === 'string' ? (source[key] as string).trim() : source[key];
  }
  if (base.newStatus)
    assertEnum(
      base.newStatus,
      FARM_WORK_STATUSES,
      '업무 상태를 확인해 주세요.',
    );
  if (base.priority)
    assertEnum(
      base.priority,
      FARM_WORK_PRIORITIES,
      '업무 우선순위를 확인해 주세요.',
    );
  if (!base.workItemId || !base.recorder)
    throw new Error('업무와 기록 담당자를 확인해 주세요.');
  if (
    base.expectedUpdatedAt !== undefined &&
    (!Number.isSafeInteger(base.expectedUpdatedAt) ||
      base.expectedUpdatedAt <= 0)
  )
    throw new Error('업무의 최신 버전을 다시 확인해 주세요.');
  if (base.operationId && !/^[a-zA-Z0-9-]{16,80}$/.test(base.operationId))
    throw new Error('빠른 수정 창을 다시 열어 주세요.');
  return base;
}

function parseVisitInput(value: unknown): FarmWorkVisitInput {
  const source = asObject(value, '현장 방문 입력값을 확인해 주세요.');
  const input = parseShape<FarmWorkVisitInput>(
    source,
    {
      workItemId: 'string',
      scheduledAt: 'number',
      assignedTo: 'string',
      status: 'string',
      actualStartedAt: 'number',
      actualEndedAt: 'number',
      preparationNote: 'string',
      result: 'string',
      nextVisitAt: 'number',
      recordedBy: 'string',
    },
    '현장 방문 입력값을 확인해 주세요.',
  );
  if (source.id !== undefined) input.id = requiredId(source.id, '방문 ID');
  assertEnum(input.status, FARM_VISIT_STATUSES, '방문 상태를 확인해 주세요.');
  if (!input.workItemId || !input.assignedTo || !input.recordedBy) {
    throw new Error('대상 업무, 방문 담당자와 기록자를 입력해 주세요.');
  }
  return input;
}

function currentWorkspace() {
  if (!latestWorkspace) {
    throw new Error(
      '관리대장을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  return latestWorkspace;
}

function sortWorkspace(workspace: FarmLedgerWorkspace): FarmLedgerWorkspace {
  return {
    projects: workspace.projects
      .map(normalizeProjectSettlement)
      .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'ko')),
    projectDocuments: [...workspace.projectDocuments].sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) ||
        a.dueDate.localeCompare(b.dueDate),
    ),
    projectUpdates: [...workspace.projectUpdates].sort(
      (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
    ),
    farms: [...workspace.farms].sort((a, b) => b.updatedAt - a.updatedAt),
    records: [...workspace.records].sort(
      (a, b) => b.lastActivityAt - a.lastActivityAt,
    ),
    subscriptionEvents: [...workspace.subscriptionEvents].sort(
      (a, b) =>
        b.processedAt.localeCompare(a.processedAt) || b.createdAt - a.createdAt,
    ),
    inboxItems: [...workspace.inboxItems].sort(
      (a, b) => b.receivedAt - a.receivedAt || b.createdAt - a.createdAt,
    ),
    workItems: [...workspace.workItems].sort(
      (a, b) =>
        b.lastActivityAt - a.lastActivityAt || b.createdAt - a.createdAt,
    ),
    blockerEpisodes: [...workspace.blockerEpisodes].sort(
      (a, b) => b.openedAt - a.openedAt || b.createdAt - a.createdAt,
    ),
    visits: [...workspace.visits].sort(
      (a, b) => b.scheduledAt - a.scheduledAt || b.createdAt - a.createdAt,
    ),
    checklistItems: [...workspace.checklistItems].sort(
      (a, b) =>
        a.workItemId.localeCompare(b.workItemId) || a.sortOrder - b.sortOrder,
    ),
    historyEntries: [...workspace.historyEntries].sort(
      (a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt,
    ),
  };
}

export function subscribeFarmLedgerWorkspace(
  onValue: (workspace: FarmLedgerWorkspace) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  requireSignedInUser();
  const state = structuredClone(emptyWorkspace) as FarmLedgerWorkspace;
  const ready = new Set<WorkspaceKey>();
  let closed = false;

  const subscriptions = (Object.keys(COLLECTIONS) as WorkspaceKey[]).map(
    (key) =>
      onSnapshot(
        query(collectionRef(key), limit(5000)),
        (snapshot) => {
          const documents = snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
          }));
          (state[key] as unknown[]) = documents;
          ready.add(key);
          if (ready.size === Object.keys(COLLECTIONS).length && !closed) {
            latestWorkspace = sortWorkspace(state);
            onValue(latestWorkspace);
          }
        },
        (error) => {
          if (!closed) onError(toError(error));
        },
      ),
  );

  return () => {
    closed = true;
    latestWorkspace = null;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

function createAudit() {
  const uid = requireSignedInUser().uid;
  return { createdByUid: uid, updatedByUid: uid } satisfies AuditFields;
}

function updateAudit(existing: unknown) {
  const uid = requireSignedInUser().uid;
  const source = existing as Partial<AuditFields>;
  return {
    createdByUid: source.createdByUid || uid,
    updatedByUid: uid,
  } satisfies AuditFields;
}

function createdData<T extends { id: string; createdAt: number }>(entity: T) {
  const possibleUpdatedAt = (entity as T & { updatedAt?: number }).updatedAt;
  return {
    ...entity,
    updatedAt: possibleUpdatedAt ?? entity.createdAt,
    ...createAudit(),
  };
}

function updatedData<T extends { id: string }>(entity: T) {
  return { ...entity, ...updateAudit(entity) };
}

function setCreated<T extends { id: string; createdAt: number }>(
  batch: LedgerWriter,
  key: WorkspaceKey,
  entity: T,
) {
  batch.set(documentRef(key, entity.id), createdData(entity));
}

function setUpdated<T extends { id: string }>(
  batch: LedgerWriter,
  key: WorkspaceKey,
  entity: T,
) {
  batch.set(documentRef(key, entity.id), updatedData(entity));
}

function touch(
  batch: LedgerWriter,
  key: WorkspaceKey,
  id: string,
  updatedAt: number,
) {
  batch.update(documentRef(key, id), {
    updatedAt,
    updatedByUid: requireSignedInUser().uid,
  });
}

function touchActivity(
  batch: LedgerWriter,
  key: 'records' | 'workItems',
  id: string,
  activityAt: number,
  updatedAt = Date.now(),
) {
  batch.update(documentRef(key, id), {
    lastActivityAt: activityAt,
    updatedAt,
    updatedByUid: requireSignedInUser().uid,
  });
}

function assertProjectState(input: FarmProjectInput) {
  if (
    (input.status === 'completed' && input.currentStage !== 'closed') ||
    (input.status !== 'completed' && input.currentStage === 'closed')
  ) {
    throw new Error('사업 완료 상태와 현재 단계가 맞지 않습니다.');
  }
}

function assertProjectEditable(
  project: FarmProject | undefined,
  allowDeleted = false,
) {
  if (!project) throw new Error('선택한 사업을 찾을 수 없습니다.');
  if (project.deletedAt && !allowDeleted)
    throw new Error(
      '삭제된 프로젝트입니다. 프로젝트 관리에서 먼저 복구해 주세요.',
    );
  if (project.status === 'completed') {
    throw new Error('완료된 사업은 먼저 다시 진행 상태로 열어 주세요.');
  }
  return project;
}

function systemProjectUpdate(
  projectId: string,
  title: string,
  actionContent: string,
  recorder: string,
  occurredAt = Date.now(),
): FarmProjectUpdate {
  return {
    id: crypto.randomUUID(),
    projectId,
    kind: 'system',
    title,
    channel: 'system',
    sender: '',
    receivedContent: '',
    actionContent,
    recorder: recorder || '담당자 미지정',
    occurredAt,
    referenceUrl: '',
    blockedReason: '',
    blockedBy: '',
    expectedUnblockDate: '',
    resolvedAt: 0,
    resolution: '',
    resolvedBy: '',
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function auditArtifacts(
  farmId: string,
  farmRecordId: string,
  owner: string,
  title: string,
  actionContent: string,
  occurredAt: number,
) {
  const workItem: FarmWorkItem = {
    id: crypto.randomUUID(),
    farmRecordId,
    farmId,
    workType: 'note',
    title,
    status: 'completed',
    owner,
    dueDate: '',
    description: actionContent,
    expectedOutcome: actionContent,
    nextAction: '',
    priority: 'medium',
    reviewDate: '',
    responseDueAt: 0,
    respondedAt: 0,
    blockedAt: 0,
    blockedReason: '',
    blockedBy: '',
    expectedUnblockDate: '',
    completedAt: occurredAt,
    lastActivityAt: occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(),
    workItemId: workItem.id,
    channel: 'system',
    sender: '',
    receivedContent: '',
    actionContent,
    amount: 0,
    recorder: owner,
    occurredAt,
    referenceUrl: '',
    createdAt: occurredAt,
  };
  return { workItem, historyEntry };
}

function farmCodeKey(value: string) {
  return encodeURIComponent(
    value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR'),
  );
}

function recordKey(farmId: string, projectId: string) {
  return `${farmId}__${projectId}`;
}

function toError(error: unknown) {
  if (error instanceof Error) {
    const code =
      'code' in error ? String((error as Error & { code?: string }).code) : '';
    if (code.includes('permission-denied')) {
      return new Error(
        '이 관리대장을 읽거나 수정할 권한이 없습니다. 관리자 승인을 확인해 주세요.',
      );
    }
    if (code.includes('resource-exhausted')) {
      return new Error(
        'Firebase 무료 사용량을 모두 사용했습니다. 다음 할당량 갱신 후 다시 시도해 주세요.',
      );
    }
    if (code.includes('unavailable')) {
      return new Error(
        '네트워크 연결이 불안정합니다. 연결을 확인한 뒤 다시 시도해 주세요.',
      );
    }
    return error;
  }
  return new Error('요청을 처리하지 못했습니다.');
}

export async function waitForFarmLedgerSync() {
  await waitForPendingWrites(getFirebaseServices().db);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

function projectChangeSummary(existing: FarmProject, input: FarmProjectInput) {
  const changed: string[] = [];
  if (input.settlementRounds) {
    for (const [key, label] of [
      ['first', '1차 정산'],
      ['second', '2차 정산'],
      ['unassigned', '회차 미지정 정산'],
    ] as const) {
      const before = existing.settlementRounds?.[key];
      const after = input.settlementRounds[key];
      if (!settlementsEqual(before, after)) {
        changed.push(
          after
            ? `${label} (상태 ${FARM_SETTLEMENT_STATUS_LABELS[after.status]}, 청구 ${after.claimAmount.toLocaleString('ko-KR')}원, 승인 ${after.approvedAmount.toLocaleString('ko-KR')}원, 입금 ${after.paidAmount.toLocaleString('ko-KR')}원)`
            : `${label} 회차 지정`,
        );
      }
    }
  }
  if (existing.currentStage !== input.currentStage) changed.push('진행 단계');
  if (existing.status !== input.status) changed.push('사업 상태');
  if (existing.settlementStatus !== input.settlementStatus)
    changed.push('정산 상태');
  if (
    existing.settlementClaimAmount !== input.settlementClaimAmount ||
    existing.settlementApprovedAmount !== input.settlementApprovedAmount ||
    existing.settlementPaidAmount !== input.settlementPaidAmount
  ) {
    changed.push('정산 금액');
  }
  if (
    existing.targetFarmCount !== input.targetFarmCount ||
    existing.manager !== input.manager ||
    existing.startDate !== input.startDate ||
    existing.endDate !== input.endDate
  ) {
    changed.push('운영 기본정보');
  }
  return changed.length
    ? `${changed.join(', ')}을(를) 수정했습니다.`
    : '프로젝트 정보를 다시 확인하고 저장했습니다.';
}

async function createProject(input: FarmProjectInput) {
  if (input.status === 'completed') {
    throw new Error('새 사업은 진행 또는 보류 상태로 등록해 주세요.');
  }
  const now = Date.now();
  const project: FarmProject = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const update = systemProjectUpdate(
    project.id,
    '프로젝트 등록',
    `${project.name} 프로젝트를 등록했습니다.`,
    project.manager,
    now,
  );
  const templates: Array<Pick<FarmProjectDocumentInput, 'title' | 'category'>> =
    [
      { title: '협약서·계약서', category: 'agreement' },
      { title: '참여농가 확정 명단', category: 'farm' },
      { title: '설치·시운전 확인서', category: 'installation' },
      { title: '검수·교육 확인서', category: 'inspection' },
      { title: '정산보고서·증빙', category: 'settlement' },
    ];
  const batch = writeBatch(getFirebaseServices().db);
  setCreated(batch, 'projects', project);
  setCreated(batch, 'projectUpdates', update);
  for (const template of templates) {
    const owner =
      template.category === 'settlement'
        ? project.settlementOwner || project.manager
        : project.manager;
    const document: FarmProjectDocument = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: template.title,
      category: template.category,
      isRequired: true,
      status: 'not_started',
      owner,
      currentHandler: owner,
      dueDate: '',
      submittedAt: '',
      approvedAt: '',
      referenceUrl: '',
      revision: 1,
      note: '',
      createdAt: now,
      updatedAt: now,
    };
    setCreated(batch, 'projectDocuments', document);
  }
  await batch.commit();
  return { project };
}

async function updateProject(
  projectId: string,
  input: FarmProjectInput,
  expectedUpdatedAt?: number,
) {
  const workspace = currentWorkspace();
  const existing = workspace.projects.find(
    (project) => project.id === projectId,
  );
  if (!existing) throw new Error('선택한 사업을 찾을 수 없습니다.');
  if (
    expectedUpdatedAt !== undefined &&
    expectedUpdatedAt !== existing.updatedAt
  )
    throw new Error(
      '다른 변경이 먼저 저장됐습니다. 프로젝트를 다시 열어 주세요.',
    );
  assertSettlementTransition(existing, input);
  if (existing.deletedAt)
    throw new Error(
      '삭제된 프로젝트입니다. 프로젝트 관리에서 먼저 복구해 주세요.',
    );

  if (
    existing.status === 'completed' &&
    input.status === 'completed' &&
    (existing.targetFarmCount !== input.targetFarmCount ||
      existing.startDate !== input.startDate ||
      existing.endDate !== input.endDate ||
      existing.settlementStatus !== input.settlementStatus ||
      existing.settlementDueDate !== input.settlementDueDate ||
      existing.contractAmount !== input.contractAmount ||
      existing.settlementClaimAmount !== input.settlementClaimAmount ||
      existing.settlementApprovedAmount !== input.settlementApprovedAmount ||
      existing.settlementPaidAmount !== input.settlementPaidAmount ||
      existing.settledAt !== input.settledAt ||
      !settlementsEqual(existing.settlementRounds, input.settlementRounds) ||
      existing.settlementEvidenceUrl !== input.settlementEvidenceUrl)
  ) {
    throw new Error(
      '완료된 사업의 완료 근거를 바꾸려면 사업을 먼저 다시 진행 상태로 열어 주세요.',
    );
  }

  if (existing.status !== 'completed' && input.status === 'completed') {
    const requiredDocuments = workspace.projectDocuments.filter(
      (item) => item.projectId === projectId && item.isRequired,
    );
    const openBlockers = workspace.projectUpdates.some(
      (item) =>
        item.projectId === projectId &&
        item.kind === 'blocker' &&
        item.resolvedAt === 0,
    );
    const recordIds = new Set(
      workspace.records
        .filter((record) => record.projectId === projectId)
        .map((record) => record.id),
    );
    const farmCount = new Set(
      workspace.records
        .filter((record) => record.projectId === projectId)
        .map((record) => record.farmId),
    ).size;
    const openWork = workspace.workItems.some(
      (item) =>
        isActiveWork(item) &&
        (recordIds.has(item.farmRecordId) ||
          (isProjectTask(item) && item.projectId === projectId)) &&
        item.status !== 'completed',
    );
    if (
      requiredDocuments.length === 0 ||
      requiredDocuments.some((item) => item.status !== 'approved') ||
      !['paid', 'closed'].includes(input.settlementStatus) ||
      openBlockers ||
      openWork ||
      (input.targetFarmCount > 0 && farmCount < input.targetFarmCount)
    ) {
      throw new Error(
        '필수서류 승인, 정산 완료, 목표 농가, 열린 업무와 막힘을 모두 확인한 뒤 사업을 완료해 주세요.',
      );
    }
  }

  const now = Math.max(Date.now(), existing.updatedAt + 1);
  const project: FarmProject = {
    ...existing,
    ...input,
    updatedAt: now,
  };
  const auditUpdate = systemProjectUpdate(
    projectId,
    '프로젝트 정보 수정',
    projectChangeSummary(existing, input),
    input.manager,
    now,
  );
  await runTransaction(getFirebaseServices().db, async (transaction) => {
    const latest = await transaction.get(documentRef('projects', projectId));
    if (!latest.exists() || latest.data().updatedAt !== existing.updatedAt)
      throw new Error(
        '다른 변경이 먼저 저장됐습니다. 프로젝트를 다시 열어 주세요.',
      );
    setUpdated(transaction, 'projects', project);
    setCreated(transaction, 'projectUpdates', auditUpdate);
  });
  return { project };
}

async function changeProjectDeletion(
  projectId: string,
  expectedUpdatedAt: number,
  deleted: boolean,
) {
  const user = requireSignedInUser();
  const reference = documentRef('projects', projectId);
  const updateId = crypto.randomUUID();
  return runTransaction(getFirebaseServices().db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('선택한 사업을 찾을 수 없습니다.');
    const existing = snapshot.data() as FarmProject;
    const patch = projectLifecyclePatch(
      existing,
      expectedUpdatedAt,
      deleted,
      Date.now(),
      user.uid,
      updateId,
    );
    if (!patch) return { project: existing };
    const audit = {
      ...systemProjectUpdate(
        projectId,
        deleted ? '프로젝트 삭제' : '프로젝트 복구',
        deleted
          ? '프로젝트를 목록·사업 집계에서 제외했습니다. 연결된 농가·입금·업무·서류 기록은 보존했습니다.'
          : '프로젝트를 목록·사업 집계에 복구했습니다.',
        user.displayName || accountIdentifier(user.email) || '담당자',
        patch.updatedAt,
      ),
      id: updateId,
      projectLifecycleAction: deleted ? 'delete' : 'restore',
    };
    transaction.update(reference, patch);
    setCreated(transaction, 'projectUpdates', audit);
    return { project: { ...existing, ...patch } };
  });
}

async function changeWorkDeletion(
  workItemId: string,
  expectedUpdatedAt: number,
  deleted: boolean,
  operationId: string,
) {
  const user = requireSignedInUser();
  const { db } = getFirebaseServices();
  return runTransaction(db, async (transaction) => {
    const reference = documentRef('workItems', workItemId);
    const snapshot = await transaction.get(reference);
    const actor = await transaction.get(doc(db, 'appMembers', user.uid));
    const auditRef = documentRef('historyEntries', operationId);
    const replay = await transaction.get(auditRef);
    if (!snapshot.exists()) throw new Error('업무를 찾을 수 없습니다.');
    const existing = snapshot.data() as FarmWorkItem;
    if (
      !actor.exists() ||
      !canManageWorkDeletion(
        existing,
        readMember(user.uid, actor.data()),
        firebaseWorkspaceId,
      )
    )
      throw new Error(
        '관리자 또는 해당 업무 등록자만 삭제·복원할 수 있습니다. 입금·구독 증빙은 삭제할 수 없습니다.',
      );
    const action = deleted ? 'delete' : 'restore';
    if (replay.exists()) {
      const saved = replay.data();
      if (
        saved.workItemId !== workItemId ||
        saved.workLifecycleAction !== action ||
        saved.createdByUid !== user.uid
      )
        throw new Error(
          '다른 요청에 사용된 번호입니다. 창을 다시 열어 주세요.',
        );
      return { workItem: existing };
    }
    if (existing.updatedAt !== expectedUpdatedAt)
      throw new Error(
        '다른 변경이 먼저 저장되었습니다. 최신 업무를 확인한 뒤 다시 시도해 주세요.',
      );
    if (deleted === Boolean(existing.deletedAt))
      throw new Error(
        deleted ? '이미 삭제된 업무입니다.' : '이미 복원된 업무입니다.',
      );
    if (existing.childWorkItemIds?.length || existing.openChildCount)
      throw new Error(
        '세부 업무가 남아 있습니다. 완료된 세부 업무도 먼저 삭제한 뒤 상위 업무를 삭제해 주세요.',
      );
    let parent: FarmWorkItem | undefined;
    if (existing.parentWorkItemId) {
      const parentSnapshot = await transaction.get(
        documentRef('workItems', existing.parentWorkItemId),
      );
      if (!parentSnapshot.exists())
        throw new Error('상위 업무를 찾을 수 없습니다.');
      parent = parentSnapshot.data() as FarmWorkItem;
      if (!isActiveWork(parent))
        throw new Error('상위 업무를 먼저 복원해 주세요.');
      if (!sameWorkContext(parent, existing) || !isStandaloneWork(parent))
        throw new Error('상위·세부 업무 연결을 확인해 주세요.');
      if (Boolean(parent.childWorkItemIds?.includes(workItemId)) !== deleted)
        throw new Error(
          '상위·세부 업무 연결이 변경되었습니다. 새로고침 후 확인해 주세요.',
        );
      if (
        !deleted &&
        parent.status === 'completed' &&
        existing.status !== 'completed'
      )
        throw new Error('완료된 상위 업무를 먼저 다시 열어 주세요.');
    }
    if (!deleted) {
      let projectId = existing.projectId || '';
      if (existing.farmRecordId) {
        const record = await transaction.get(
          documentRef('records', existing.farmRecordId),
        );
        if (!record.exists())
          throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
        projectId = record.data().projectId;
      }
      if (projectId) {
        const project = await transaction.get(
          documentRef('projects', projectId),
        );
        if (!project.exists() || project.data().deletedAt)
          throw new Error('프로젝트를 먼저 복구해 주세요.');
        if (
          project.data().status === 'completed' &&
          existing.status !== 'completed'
        )
          throw new Error('완료된 프로젝트를 먼저 다시 열어 주세요.');
      }
    }
    const now = Math.max(
      Date.now(),
      existing.updatedAt + 1,
      (parent?.updatedAt || 0) + 1,
    );
    const patch = {
      deletedAt: deleted ? now : 0,
      deletedByUid: deleted ? user.uid : '',
      workLifecycleEntryId: operationId,
      updatedAt: now,
      updatedByUid: user.uid,
      lastActivityAt: now,
    };
    if (parent) {
      const ids = parent.childWorkItemIds || [];
      const nextIds = deleted
        ? ids.filter((id) => id !== workItemId)
        : [...ids, workItemId];
      const count =
        (parent.openChildCount || 0) +
        (existing.status === 'completed' ? 0 : deleted ? -1 : 1);
      if (nextIds.length > 500 || count < 0 || count > nextIds.length)
        throw new Error('세부 업무 연결 수를 확인해 주세요.');
      transaction.update(documentRef('workItems', parent.id), {
        childWorkItemIds: nextIds,
        openChildCount: count,
        lastChildMutationId: workItemId,
        updatedAt: now,
        lastActivityAt: now,
        updatedByUid: user.uid,
      });
    }
    transaction.update(reference, patch);
    setCreated(transaction, 'historyEntries', {
      id: operationId,
      workItemId,
      workLifecycleAction: action,
      channel: 'system',
      sender: '',
      receivedContent: '',
      amount: 0,
      actionContent: deleted
        ? '업무를 삭제했습니다. 처리 이력과 첨부파일은 보존되며 삭제된 업무에서 복원할 수 있습니다.'
        : '업무를 원래 상태와 연결로 복원했습니다.',
      recorder: readMember(user.uid, actor.data()).displayName,
      occurredAt: now,
      referenceUrl: '',
      createdAt: now,
    });
    return { workItem: { ...existing, ...patch } };
  });
}

async function createProjectDocument(
  projectId: string,
  input: FarmProjectDocumentInput,
) {
  const project = assertProjectEditable(
    currentWorkspace().projects.find((item) => item.id === projectId),
  );
  const now = Date.now();
  const document: FarmProjectDocument = {
    id: crypto.randomUUID(),
    projectId,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const auditUpdate = systemProjectUpdate(
    projectId,
    '제출서류 등록',
    `${document.title} 서류를 등록했습니다.`,
    document.owner || project.manager,
    now,
  );
  const batch = writeBatch(getFirebaseServices().db);
  setCreated(batch, 'projectDocuments', document);
  setCreated(batch, 'projectUpdates', auditUpdate);
  touch(batch, 'projects', projectId, now);
  await batch.commit();
  return { document };
}

async function updateProjectDocument(
  documentId: string,
  input: FarmProjectDocumentInput,
) {
  const workspace = currentWorkspace();
  const existing = workspace.projectDocuments.find(
    (item) => item.id === documentId,
  );
  if (!existing) throw new Error('제출서류 항목을 찾을 수 없습니다.');
  const project = assertProjectEditable(
    workspace.projects.find((item) => item.id === existing.projectId),
    true,
  );
  const statusRank = {
    not_started: 0,
    preparing: 1,
    submitted: 2,
    reviewing: 3,
    revision: 4,
    rejected: 4,
    approved: 5,
  } as const;
  if (
    input.revision < existing.revision ||
    (statusRank[input.status] < statusRank[existing.status] &&
      input.revision <= existing.revision)
  ) {
    throw new Error(
      '서류 상태를 되돌리려면 개정번호를 올려 새 개정으로 기록해 주세요.',
    );
  }
  const isNewRevision = input.revision > existing.revision;
  if (
    !isNewRevision &&
    ((existing.submittedAt && !input.submittedAt) ||
      (existing.approvedAt && !input.approvedAt) ||
      (existing.referenceUrl && !input.referenceUrl))
  ) {
    throw new Error('이미 남긴 제출일·승인일·증빙 링크는 지울 수 없습니다.');
  }
  const now = Date.now();
  const document: FarmProjectDocument = {
    ...existing,
    ...input,
    updatedAt: now,
  };
  const auditUpdate = systemProjectUpdate(
    existing.projectId,
    '제출서류 수정',
    `${input.title}: 상태 ${FARM_PROJECT_DOCUMENT_STATUS_LABELS[existing.status]} → ${FARM_PROJECT_DOCUMENT_STATUS_LABELS[input.status]}, 개정 ${existing.revision} → ${input.revision}`,
    input.owner || input.currentHandler || project.manager,
    now,
  );
  auditUpdate.referenceUrl = existing.referenceUrl;
  const batch = writeBatch(getFirebaseServices().db);
  setUpdated(batch, 'projectDocuments', document);
  setCreated(batch, 'projectUpdates', auditUpdate);
  touch(batch, 'projects', existing.projectId, now);
  await batch.commit();
  return { document };
}

async function createProjectUpdate(
  projectId: string,
  input: FarmProjectUpdateInput,
) {
  const project = currentWorkspace().projects.find(
    (item) => item.id === projectId,
  );
  if (!project) throw new Error('선택한 사업을 찾을 수 없습니다.');
  if (project.status === 'completed' && input.kind === 'blocker') {
    throw new Error('완료된 사업에는 새 막힘을 등록할 수 없습니다.');
  }
  const now = Date.now();
  const update: FarmProjectUpdate = {
    id: crypto.randomUUID(),
    projectId,
    ...input,
    blockedReason: input.kind === 'blocker' ? input.blockedReason : '',
    blockedBy: input.kind === 'blocker' ? input.blockedBy : '',
    expectedUnblockDate:
      input.kind === 'blocker' ? input.expectedUnblockDate : '',
    resolvedAt: 0,
    resolution: '',
    resolvedBy: '',
    createdAt: now,
    updatedAt: now,
  };
  const batch = writeBatch(getFirebaseServices().db);
  setCreated(batch, 'projectUpdates', update);
  touch(batch, 'projects', projectId, Math.max(now, input.occurredAt));
  await batch.commit();
  return { update };
}

async function resolveProjectBlocker(
  updateId: string,
  resolution: string,
  resolvedBy: string,
) {
  const existing = currentWorkspace().projectUpdates.find(
    (item) => item.id === updateId,
  );
  if (!existing) throw new Error('프로젝트 기록을 찾을 수 없습니다.');
  if (existing.kind !== 'blocker')
    throw new Error('막힘 기록만 해결 처리할 수 있습니다.');
  if (existing.resolvedAt)
    throw new Error('이미 해결 처리된 프로젝트 막힘입니다.');
  if (!resolution || !resolvedBy)
    throw new Error('해결 내용과 처리 담당자를 입력해 주세요.');
  const now = Date.now();
  const update: FarmProjectUpdate = {
    ...existing,
    resolvedAt: now,
    resolution,
    resolvedBy,
    updatedAt: now,
  };
  const resolutionUpdate = systemProjectUpdate(
    existing.projectId,
    `${existing.title} 해결`,
    resolution,
    resolvedBy,
    now,
  );
  resolutionUpdate.referenceUrl = existing.referenceUrl;
  const batch = writeBatch(getFirebaseServices().db);
  setUpdated(batch, 'projectUpdates', update);
  setCreated(batch, 'projectUpdates', resolutionUpdate);
  touch(batch, 'projects', existing.projectId, now);
  await batch.commit();
  return { update };
}

const RECORD_FIELD_LABELS: Array<[keyof FarmRecordInput, string]> = [
  ['projectId', '참여 사업'],
  ['crop', '작물'],
  ['deviceType', '장비 종류'],
  ['productType', '제품 종류'],
  ['vendor', '장비업체'],
  ['productionSetupDate', '제작·세팅일'],
  ['installationDate', '설치일'],
  ['commissioningDate', '시운전일'],
  ['educationDate', '교육일'],
  ['internetType', '인터넷 유형'],
  ['warrantyYears', '보증기간'],
  ['warrantyExpiresAt', '보증 만료일'],
  ['subscriptionYears', '구독기간'],
  ['initialSubscriptionExpiresAt', '최초 구독 만료일'],
  ['currentSubscriptionExpiresAt', '현재 구독 만료일'],
  ['lastPaymentDate', '최근 입금일'],
  ['renewalCount', '갱신횟수'],
  ['subscriptionStatus', '구독 상태'],
  ['notes', '비고'],
];

function recordChangeSummary(existing: FarmRecord, input: FarmRecordInput) {
  const changed = RECORD_FIELD_LABELS.filter(
    ([key]) => existing[key] !== input[key],
  ).map(([, label]) => label);
  return changed.length
    ? `${changed.join(', ')} 항목을 수정했습니다.`
    : '사업·설치 정보를 다시 확인하고 저장했습니다.';
}

async function createFarmWithRecord(
  farmInput: FarmInput,
  recordInput: FarmRecordInput,
  recorder: string,
  locationChange?: FarmLocationChange,
) {
  const workspace = currentWorkspace();
  const project = assertProjectEditable(
    workspace.projects.find((item) => item.id === recordInput.projectId),
  );
  if (
    workspace.farms.some(
      (item) => farmCodeKey(item.farmCode) === farmCodeKey(farmInput.farmCode),
    )
  ) {
    throw new Error('이미 사용 중인 농장번호입니다.');
  }
  const now = Date.now();
  const farm: Farm = {
    id: crypto.randomUUID(),
    ...farmInput,
    locationImageIds: resolveFarmLocationImages([], locationChange),
    createdAt: now,
    updatedAt: now,
  };
  const record: FarmRecord = {
    id: crypto.randomUUID(),
    farmId: farm.id,
    ...recordInput,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const { workItem, historyEntry } = auditArtifacts(
    farm.id,
    record.id,
    recorder,
    '농가 관리대장 등록',
    `${project.name} 참여 농가로 등록했습니다.`,
    now,
  );
  const farmClaimId = farmCodeKey(farm.farmCode);
  const recordClaimId = recordKey(farm.id, project.id);
  const { db } = getFirebaseServices();

  await runTransaction(db, async (transaction) => {
    const farmClaimRef = internalDocumentRef(
      'farmCodeReservations',
      farmClaimId,
    );
    const recordClaimRef = internalDocumentRef(
      'farmRecordReservations',
      recordClaimId,
    );
    const latestProject = await transaction.get(
      documentRef('projects', project.id),
    );
    assertProjectEditable(
      latestProject.exists()
        ? (latestProject.data() as FarmProject)
        : undefined,
    );
    const [farmClaim, recordClaim] = await Promise.all([
      transaction.get(farmClaimRef),
      transaction.get(recordClaimRef),
    ]);
    if (farmClaim.exists() && farmClaim.data().active === true) {
      throw new Error('이미 사용 중인 농장번호입니다.');
    }
    if (recordClaim.exists() && recordClaim.data().active === true) {
      throw new Error('이 농가는 이미 같은 프로젝트에 등록되어 있습니다.');
    }
    transaction.set(documentRef('farms', farm.id), createdData(farm));
    writeReceivedImages(
      transaction,
      locationChange?.images ?? [],
      'farms',
      farm.id,
    );
    transaction.set(documentRef('records', record.id), createdData(record));
    transaction.set(
      documentRef('workItems', workItem.id),
      createdData(workItem),
    );
    transaction.set(
      documentRef('historyEntries', historyEntry.id),
      createdData(historyEntry),
    );
    transaction.set(
      farmClaimRef,
      farmClaim.exists()
        ? updatedData({
            ...farmClaim.data(),
            id: farmClaimId,
            entityId: farm.id,
            active: true,
            createdAt: farmClaim.data().createdAt,
            updatedAt: now,
          })
        : createdData({
            id: farmClaimId,
            entityId: farm.id,
            active: true,
            createdAt: now,
            updatedAt: now,
          }),
    );
    transaction.set(
      recordClaimRef,
      recordClaim.exists()
        ? updatedData({
            ...recordClaim.data(),
            id: recordClaimId,
            entityId: record.id,
            active: true,
            createdAt: recordClaim.data().createdAt,
            updatedAt: now,
          })
        : createdData({
            id: recordClaimId,
            entityId: record.id,
            active: true,
            createdAt: now,
            updatedAt: now,
          }),
    );
    transaction.update(documentRef('projects', project.id), {
      updatedAt: now,
      updatedByUid: requireSignedInUser().uid,
    });
  });

  return { farm, record, workItem, historyEntry };
}

async function createRecord(
  farmId: string,
  input: FarmRecordInput,
  recorder: string,
) {
  const workspace = currentWorkspace();
  const farm = workspace.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error('농가를 찾을 수 없습니다.');
  const project = assertProjectEditable(
    workspace.projects.find((item) => item.id === input.projectId),
  );
  if (
    workspace.records.some(
      (record) =>
        record.farmId === farmId && record.projectId === input.projectId,
    )
  ) {
    throw new Error('이 농가는 이미 같은 프로젝트에 등록되어 있습니다.');
  }
  const now = Date.now();
  const record: FarmRecord = {
    id: crypto.randomUUID(),
    farmId,
    ...input,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const { workItem, historyEntry } = auditArtifacts(
    farmId,
    record.id,
    recorder,
    '사업 참여 등록',
    `${farm.name} 농가를 ${project.name} 사업에 연결했습니다.`,
    now,
  );
  const claimId = recordKey(farmId, project.id);
  const { db } = getFirebaseServices();
  await runTransaction(db, async (transaction) => {
    const latestProject = await transaction.get(
      documentRef('projects', project.id),
    );
    assertProjectEditable(
      latestProject.exists()
        ? (latestProject.data() as FarmProject)
        : undefined,
    );
    const claimRef = internalDocumentRef('farmRecordReservations', claimId);
    const claim = await transaction.get(claimRef);
    if (claim.exists() && claim.data().active === true) {
      throw new Error('이 농가는 이미 같은 프로젝트에 등록되어 있습니다.');
    }
    transaction.set(documentRef('records', record.id), createdData(record));
    transaction.set(
      documentRef('workItems', workItem.id),
      createdData(workItem),
    );
    transaction.set(
      documentRef('historyEntries', historyEntry.id),
      createdData(historyEntry),
    );
    transaction.set(
      claimRef,
      claim.exists()
        ? updatedData({
            ...claim.data(),
            id: claimId,
            entityId: record.id,
            active: true,
            createdAt: claim.data().createdAt,
            updatedAt: now,
          })
        : createdData({
            id: claimId,
            entityId: record.id,
            active: true,
            createdAt: now,
            updatedAt: now,
          }),
    );
    for (const [key, id] of [
      ['farms', farmId],
      ['projects', project.id],
    ] as const) {
      transaction.update(documentRef(key, id), {
        updatedAt: now,
        updatedByUid: requireSignedInUser().uid,
      });
    }
  });
  return { record, workItem, historyEntry };
}

async function updateFarm(
  farmId: string,
  input: FarmInput,
  locationChange?: FarmLocationChange,
  expectedUpdatedAt?: number,
) {
  const workspace = currentWorkspace();
  const existing = workspace.farms.find((item) => item.id === farmId);
  if (!existing) throw new Error('농가를 찾을 수 없습니다.');
  const duplicate = workspace.farms.some(
    (item) =>
      item.id !== farmId &&
      farmCodeKey(item.farmCode) === farmCodeKey(input.farmCode),
  );
  if (duplicate) throw new Error('이미 사용 중인 농장번호입니다.');
  const now = Date.now();
  let farm: Farm;
  const newClaimId = farmCodeKey(input.farmCode);
  const { db } = getFirebaseServices();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(documentRef('farms', farmId));
    if (!snapshot.exists()) throw new Error('농가를 찾을 수 없습니다.');
    const latest = snapshot.data() as Farm;
    if (
      expectedUpdatedAt !== undefined &&
      latest.updatedAt !== expectedUpdatedAt
    )
      throw new Error(
        '농가 정보가 다른 곳에서 변경되었습니다. 입력 내용은 유지됩니다. 창을 다시 열어 최신 정보를 확인해 주세요.',
      );
    farm = {
      ...latest,
      ...input,
      locationImageIds: resolveFarmLocationImages(
        latest.locationImageIds,
        locationChange,
      ),
      updatedAt: Math.max(now, latest.updatedAt + 1),
    };
    const oldClaimId = farmCodeKey(latest.farmCode);
    if (oldClaimId !== newClaimId) {
      const oldClaimRef = internalDocumentRef(
        'farmCodeReservations',
        oldClaimId,
      );
      const newClaimRef = internalDocumentRef(
        'farmCodeReservations',
        newClaimId,
      );
      const [oldClaim, newClaim] = await Promise.all([
        transaction.get(oldClaimRef),
        transaction.get(newClaimRef),
      ]);
      if (
        newClaim.exists() &&
        newClaim.data().active === true &&
        newClaim.data().entityId !== farmId
      ) {
        throw new Error('이미 사용 중인 농장번호입니다.');
      }
      if (oldClaim.exists()) {
        transaction.update(oldClaimRef, {
          active: false,
          updatedAt: now,
          updatedByUid: requireSignedInUser().uid,
        });
      }
      transaction.set(
        newClaimRef,
        newClaim.exists()
          ? updatedData({
              ...newClaim.data(),
              id: newClaimId,
              entityId: farmId,
              active: true,
              createdAt: newClaim.data().createdAt,
              updatedAt: now,
            })
          : createdData({
              id: newClaimId,
              entityId: farmId,
              active: true,
              createdAt: now,
              updatedAt: now,
            }),
      );
    }
    transaction.set(documentRef('farms', farm.id), updatedData(farm));
    writeReceivedImages(
      transaction,
      locationChange?.images ?? [],
      'farms',
      farm.id,
    );
  });
  return { farm: farm! };
}

async function updateRecord(
  recordId: string,
  input: FarmRecordInput,
  recorder: string,
) {
  const workspace = currentWorkspace();
  const cachedRecord = workspace.records.find((item) => item.id === recordId);
  if (!cachedRecord)
    throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  const nextProject = workspace.projects.find(
    (item) => item.id === input.projectId,
  );
  if (!nextProject) throw new Error('선택한 사업을 찾을 수 없습니다.');
  if (
    workspace.records.some(
      (item) =>
        item.id !== recordId &&
        item.farmId === cachedRecord.farmId &&
        item.projectId === input.projectId,
    )
  ) {
    throw new Error('이 농가는 이미 같은 프로젝트에 등록되어 있습니다.');
  }
  if (
    cachedRecord.currentSubscriptionExpiresAt !==
      input.currentSubscriptionExpiresAt ||
    cachedRecord.renewalCount !== input.renewalCount ||
    cachedRecord.subscriptionStatus !== input.subscriptionStatus
  ) {
    throw new Error(
      '현재 만료일, 구독 상태와 갱신횟수는 전용 구독 관리에서 변경해 주세요.',
    );
  }
  const now = Date.now();
  const { db } = getFirebaseServices();
  const recordRef = documentRef('records', recordId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(recordRef);
    if (!snapshot.exists()) {
      throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
    }
    const existing = snapshot.data() as FarmRecord;
    const previousProject = workspace.projects.find(
      (item) => item.id === existing.projectId,
    );
    if (
      existing.projectId !== input.projectId &&
      (nextProject.status === 'completed' ||
        previousProject?.status === 'completed')
    ) {
      throw new Error('완료된 사업의 농가 연결은 변경할 수 없습니다.');
    }
    if (
      existing.currentSubscriptionExpiresAt !==
        input.currentSubscriptionExpiresAt ||
      existing.renewalCount !== input.renewalCount ||
      existing.subscriptionStatus !== input.subscriptionStatus
    ) {
      throw new Error(
        '구독 정보가 변경되었습니다. 최신 내용을 확인한 뒤 다시 수정해 주세요.',
      );
    }
    const oldClaimId = recordKey(existing.farmId, existing.projectId);
    const newClaimId = recordKey(existing.farmId, input.projectId);
    if (oldClaimId !== newClaimId) {
      const oldClaimRef = internalDocumentRef(
        'farmRecordReservations',
        oldClaimId,
      );
      const newClaimRef = internalDocumentRef(
        'farmRecordReservations',
        newClaimId,
      );
      const [oldClaim, newClaim] = await Promise.all([
        transaction.get(oldClaimRef),
        transaction.get(newClaimRef),
      ]);
      if (
        newClaim.exists() &&
        newClaim.data().active === true &&
        newClaim.data().entityId !== recordId
      ) {
        throw new Error('이 농가는 이미 같은 프로젝트에 등록되어 있습니다.');
      }
      if (oldClaim.exists()) {
        transaction.update(oldClaimRef, {
          active: false,
          updatedAt: now,
          updatedByUid: requireSignedInUser().uid,
        });
      }
      transaction.set(
        newClaimRef,
        newClaim.exists()
          ? updatedData({
              ...newClaim.data(),
              id: newClaimId,
              entityId: existing.id,
              active: true,
              createdAt: newClaim.data().createdAt,
              updatedAt: now,
            })
          : createdData({
              id: newClaimId,
              entityId: existing.id,
              active: true,
              createdAt: now,
              updatedAt: now,
            }),
      );
    }
    const record: FarmRecord = {
      ...existing,
      ...input,
      lastActivityAt: Math.max(existing.lastActivityAt, now),
      updatedAt: now,
    };
    const { workItem, historyEntry } = auditArtifacts(
      record.farmId,
      record.id,
      recorder,
      '사업 참여 정보 수정',
      recordChangeSummary(existing, input),
      now,
    );
    transaction.set(recordRef, updatedData(record));
    transaction.set(
      documentRef('workItems', workItem.id),
      createdData(workItem),
    );
    transaction.set(
      documentRef('historyEntries', historyEntry.id),
      createdData(historyEntry),
    );
    transaction.update(documentRef('farms', record.farmId), {
      updatedAt: now,
      updatedByUid: requireSignedInUser().uid,
    });
    for (const projectId of new Set([existing.projectId, input.projectId])) {
      transaction.update(documentRef('projects', projectId), {
        updatedAt: now,
        updatedByUid: requireSignedInUser().uid,
      });
    }
    return { record, workItem, historyEntry };
  });
}

async function createSubscriptionEvent(input: FarmSubscriptionEventInput) {
  const workspace = currentWorkspace();
  const cachedRecord = workspace.records.find(
    (item) => item.id === input.farmRecordId,
  );
  if (!cachedRecord)
    throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  if (
    workspace.subscriptionEvents.some(
      (item) =>
        item.farmRecordId === cachedRecord.id &&
        item.basisExpiryDate === input.basisExpiryDate,
    )
  ) {
    throw new Error(
      '이 만료 회차의 갱신 또는 이탈 결과가 이미 등록되어 있습니다.',
    );
  }
  const priorChurn = workspace.subscriptionEvents.some(
    (item) =>
      item.farmRecordId === cachedRecord.id && item.eventType === 'churned',
  );
  const now = Date.now();
  const { db } = getFirebaseServices();
  const recordRef = documentRef('records', input.farmRecordId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(recordRef);
    if (!snapshot.exists()) {
      throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
    }
    const record = snapshot.data() as FarmRecord;
    if (
      record.currentSubscriptionExpiresAt !== input.expectedCurrentExpiryDate ||
      record.updatedAt !== input.expectedUpdatedAt
    ) {
      throw new Error(
        '다른 사용자가 이 구독 정보를 변경했습니다. 최신 내용을 확인한 뒤 다시 처리해 주세요.',
      );
    }
    const farm = workspace.farms.find((item) => item.id === record.farmId);
    const project = workspace.projects.find(
      (item) => item.id === record.projectId,
    );
    if (!farm || !project) {
      throw new Error(
        '연결된 농가 또는 사업이 변경되었습니다. 최신 내용을 확인해 주세요.',
      );
    }
    if (
      input.eventType !== 'rejoined' &&
      record.currentSubscriptionExpiresAt &&
      input.basisExpiryDate > record.currentSubscriptionExpiresAt
    ) {
      throw new Error('기준 만료일이 현재 구독 만료일보다 늦습니다.');
    }
    if (
      input.eventType === 'rejoined' &&
      record.subscriptionStatus !== 'expired' &&
      !priorChurn
    ) {
      throw new Error(
        '재가입은 만료 또는 이탈 이력이 있는 구독에만 등록할 수 있습니다.',
      );
    }
    if (
      input.basisRenewalCount != null &&
      input.basisExpiryDate === record.currentSubscriptionExpiresAt &&
      input.basisRenewalCount !== record.renewalCount
    ) {
      throw new Error(
        '현재 회차의 갱신 전 횟수가 관리대장과 다릅니다. 최신 내용을 확인해 주세요.',
      );
    }
    const subscriptionEvent: FarmSubscriptionEvent = {
      id: crypto.randomUUID(),
      farmRecordId: input.farmRecordId,
      projectId: record.projectId,
      eventType: input.eventType,
      basisExpiryDate: input.basisExpiryDate,
      basisRenewalCount: renewalCountBeforeEvent(
        record,
        input.basisExpiryDate,
        input.basisRenewalCount,
      ),
      processedAt: input.processedAt,
      newExpiryDate: input.newExpiryDate,
      recorder: input.recorder,
      note: input.note,
      createdAt: now,
    };
    let nextExpiry = record.currentSubscriptionExpiresAt;
    let nextStatus = record.subscriptionStatus;
    let nextRenewalCount = record.renewalCount;
    if (
      ['renewed', 'rejoined'].includes(subscriptionEvent.eventType) &&
      subscriptionEvent.newExpiryDate > nextExpiry
    ) {
      nextExpiry = subscriptionEvent.newExpiryDate;
      nextStatus = 'active';
      if (subscriptionEvent.eventType === 'renewed') nextRenewalCount += 1;
    } else if (
      subscriptionEvent.eventType === 'churned' &&
      (!nextExpiry || subscriptionEvent.basisExpiryDate >= nextExpiry)
    ) {
      nextExpiry ||= subscriptionEvent.basisExpiryDate;
      nextStatus = 'expired';
    }
    const label = {
      renewed: '갱신',
      churned: '이탈',
      rejoined: '재가입',
    }[subscriptionEvent.eventType];
    const resultText = subscriptionEvent.newExpiryDate
      ? `${subscriptionEvent.basisExpiryDate} 만료 구독을 ${subscriptionEvent.newExpiryDate}까지 ${label} 처리했습니다.`
      : `${subscriptionEvent.basisExpiryDate} 만료 구독을 ${label} 처리했습니다.`;
    const occurredAt = Date.parse(
      `${subscriptionEvent.processedAt}T00:00:00+09:00`,
    );
    const { workItem, historyEntry } = auditArtifacts(
      farm.id,
      record.id,
      subscriptionEvent.recorder,
      `구독 ${label} 처리`,
      subscriptionEvent.note
        ? `${resultText}\n메모: ${subscriptionEvent.note}`
        : resultText,
      Number.isFinite(occurredAt) ? occurredAt : now,
    );
    workItem.workType = 'subscription';
    transaction.set(
      documentRef('subscriptionEvents', subscriptionEvent.id),
      createdData(subscriptionEvent),
    );
    transaction.update(recordRef, {
      currentSubscriptionExpiresAt: nextExpiry,
      renewalCount: nextRenewalCount,
      subscriptionStatus: nextStatus,
      lastActivityAt: Math.max(record.lastActivityAt, now),
      updatedAt: Math.max(now, record.updatedAt + 1),
      updatedByUid: requireSignedInUser().uid,
    });
    transaction.set(
      documentRef('workItems', workItem.id),
      createdData(workItem),
    );
    transaction.set(
      documentRef('historyEntries', historyEntry.id),
      createdData(historyEntry),
    );
    transaction.update(documentRef('farms', farm.id), {
      updatedAt: now,
      updatedByUid: requireSignedInUser().uid,
    });
    transaction.update(documentRef('projects', project.id), {
      updatedAt: now,
      updatedByUid: requireSignedInUser().uid,
    });
    return { subscriptionEvent };
  });
}

async function correctSubscriptionExpiry(
  input: FarmSubscriptionExpiryCorrectionInput,
) {
  const { db } = getFirebaseServices();
  const recordRef = documentRef('records', input.farmRecordId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(recordRef);
    if (!snapshot.exists()) {
      throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
    }
    const existing = snapshot.data() as FarmRecord;
    if (
      existing.currentSubscriptionExpiresAt !==
        input.expectedCurrentExpiryDate ||
      existing.updatedAt !== input.expectedUpdatedAt
    ) {
      throw new Error(
        '다른 사용자가 이 농가 정보를 변경했습니다. 최신 내용을 확인한 뒤 다시 입력해 주세요.',
      );
    }
    if (existing.currentSubscriptionExpiresAt === input.expiryDate) {
      throw new Error('현재 만료일과 같은 날짜입니다.');
    }
    const now = Date.now();
    const subscriptionStatus: SubscriptionStatus =
      input.expiryDate >= localDateAt(now) ? 'active' : 'expired';
    const initialSubscriptionExpiresAt =
      existing.initialSubscriptionExpiresAt || input.expiryDate;
    const before = existing.currentSubscriptionExpiresAt || '미입력';
    const actionContent = [
      `구독 만료일을 ${before}에서 ${input.expiryDate}(으)로 입력·정정했습니다.`,
      `구독 상태: ${subscriptionStatus === 'active' ? '사용중' : '만료'}`,
      input.note ? `메모: ${input.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const { workItem, historyEntry } = auditArtifacts(
      existing.farmId,
      existing.id,
      input.recorder,
      existing.currentSubscriptionExpiresAt
        ? '구독 만료일 정정'
        : '구독 만료일 입력',
      actionContent,
      now,
    );
    workItem.workType = 'subscription';
    const record: FarmRecord = {
      ...existing,
      initialSubscriptionExpiresAt,
      currentSubscriptionExpiresAt: input.expiryDate,
      subscriptionStatus,
      lastActivityAt: Math.max(existing.lastActivityAt, now),
      updatedAt: now,
    };
    transaction.update(recordRef, {
      initialSubscriptionExpiresAt,
      currentSubscriptionExpiresAt: input.expiryDate,
      subscriptionStatus,
      lastActivityAt: record.lastActivityAt,
      updatedAt: Math.max(now, existing.updatedAt + 1),
      updatedByUid: requireSignedInUser().uid,
    });
    transaction.set(
      documentRef('workItems', workItem.id),
      createdData(workItem),
    );
    transaction.set(
      documentRef('historyEntries', historyEntry.id),
      createdData(historyEntry),
    );
    for (const [key, id] of [
      ['farms', existing.farmId],
      ['projects', existing.projectId],
    ] as const) {
      transaction.update(documentRef(key, id), {
        updatedAt: now,
        updatedByUid: requireSignedInUser().uid,
      });
    }
    return { record, workItem, historyEntry };
  });
}

async function createInboxItem(
  input: FarmInboxItemInput,
  images: ReceivedImage[] = [],
) {
  const now = Date.now();
  const { operationId, taskTitle, ...captured } = input;
  const id = operationId || crypto.randomUUID();
  const inboxItem: FarmInboxItem = {
    id,
    ...captured,
    imageIds: images.map((image) => image.id),
    status: input.projectId ? 'converted' : 'unprocessed',
    convertedWorkItemId: input.projectId ? `${id}-work` : '',
    createdAt: now,
    updatedAt: now,
  };
  return runTransaction(getFirebaseServices().db, async (transaction) => {
    const existing = await transaction.get(documentRef('inboxItems', id));
    if (existing.exists()) {
      const saved = existing.data() as FarmInboxItem;
      if (
        saved.content !== inboxItem.content ||
        saved.projectId !== inboxItem.projectId ||
        saved.receivedAt !== inboxItem.receivedAt ||
        saved.capturedBy !== inboxItem.capturedBy ||
        saved.channel !== inboxItem.channel ||
        saved.sender !== inboxItem.sender ||
        saved.referenceUrl !== inboxItem.referenceUrl ||
        JSON.stringify(saved.imageIds || []) !==
          JSON.stringify(inboxItem.imageIds)
      )
        throw new Error(
          '이미 저장된 수신입니다. 새 수신 창에서 등록해 주세요.',
        );
      return { inboxItem: saved };
    }
    if (input.projectId) {
      const projectDoc = await transaction.get(
        documentRef('projects', input.projectId),
      );
      if (!projectDoc.exists()) throw new Error('프로젝트를 찾을 수 없습니다.');
      assertProjectEditable(projectDoc.data() as FarmProject);
    }
    setCreated(transaction, 'inboxItems', inboxItem);
    writeReceivedImages(transaction, images, 'inboxItems', id);
    if (input.projectId) {
      const workItem: FarmWorkItem = {
        id: inboxItem.convertedWorkItemId,
        projectId: input.projectId,
        farmRecordId: '',
        farmId: '',
        workType: 'communication',
        title:
          taskTitle ||
          input.content.replace(/\s+/g, ' ').slice(0, 100) ||
          '첨부 이미지 확인 및 처리',
        status: 'open',
        owner: input.capturedBy,
        dueDate: '',
        description: '',
        expectedOutcome: '',
        nextAction: '',
        priority: 'medium',
        reviewDate: '',
        responseDueAt: 0,
        respondedAt: 0,
        blockedAt: 0,
        blockedReason: '',
        blockedBy: '',
        expectedUnblockDate: '',
        completedAt: 0,
        lastActivityAt: input.receivedAt,
        createdAt: now,
        updatedAt: now,
      };
      const historyEntry: FarmHistoryEntry = {
        id: `${id}-history`,
        workItemId: workItem.id,
        channel: input.channel,
        sender: input.sender,
        receivedContent: input.content,
        actionContent: '',
        amount: 0,
        recorder: input.capturedBy,
        occurredAt: input.receivedAt,
        referenceUrl: input.referenceUrl,
        imageIds: inboxItem.imageIds,
        createdAt: now,
      };
      setCreated(transaction, 'workItems', workItem);
      setCreated(transaction, 'historyEntries', historyEntry);
      touch(transaction, 'projects', input.projectId, now);
    }
    return { inboxItem };
  });
}

async function updateInboxStatus(
  inboxItemId: string,
  status: 'reference' | 'discarded',
) {
  const existing = currentWorkspace().inboxItems.find(
    (item) => item.id === inboxItemId,
  );
  if (!existing) throw new Error('수신함 항목을 찾을 수 없습니다.');
  if (existing.status !== 'unprocessed')
    throw new Error('이미 정리된 수신함 항목입니다.');
  const inboxItem: FarmInboxItem = {
    ...existing,
    status,
    updatedAt: Date.now(),
  };
  const batch = writeBatch(getFirebaseServices().db);
  setUpdated(batch, 'inboxItems', inboxItem);
  await batch.commit();
  return { inboxItem };
}

function parsePaymentRequest(
  value: unknown,
): SubscriptionPaymentRequest | undefined {
  if (value == null) return undefined;
  const request = parseShape<SubscriptionPaymentRequest>(
    value,
    {
      operationId: 'string',
      expectedCurrentExpiryDate: 'string',
      expectedUpdatedAt: 'number',
    },
    '구독 입금 확인 정보를 다시 불러와 주세요.',
  );
  if (
    !/^[a-zA-Z0-9-]{16,80}$/.test(request.operationId) ||
    !Number.isSafeInteger(request.expectedUpdatedAt) ||
    request.expectedUpdatedAt < 0
  ) {
    throw new Error('구독 입금 확인 정보를 다시 불러와 주세요.');
  }
  return request;
}

async function paymentFingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function readPaymentReplay(
  transaction: Transaction,
  request: SubscriptionPaymentRequest,
  fingerprint: string,
) {
  const prior = await transaction.get(
    documentRef('historyEntries', request.operationId),
  );
  if (!prior.exists()) return null;
  const historyEntry = prior.data() as FarmHistoryEntry;
  if (historyEntry.paymentRequestFingerprint !== fingerprint) {
    throw new Error(
      '이미 저장된 입금 요청의 내용이 변경되었습니다. 기존 입금과 연장 내역을 먼저 확인해 주세요.',
    );
  }
  const work = await transaction.get(
    documentRef('workItems', historyEntry.workItemId),
  );
  if (!work.exists())
    throw new Error('저장된 입금의 연결 업무를 확인해 주세요.');
  return { workItem: work.data() as FarmWorkItem, historyEntry };
}

async function savePaymentMutation(options: {
  request: SubscriptionPaymentRequest;
  fingerprint: string;
  record: FarmRecord;
  workItem: FarmWorkItem;
  historyEntry: FarmHistoryEntry;
  paymentHistory: FarmHistoryEntry;
  existingWork?: FarmWorkItem;
  sourceInbox?: FarmInboxItem;
  write: (transaction: Transaction) => void;
}) {
  const {
    request,
    fingerprint,
    record,
    workItem,
    historyEntry,
    paymentHistory,
    existingWork,
    sourceInbox,
    write,
  } = options;
  // Independent listeners can arrive out of order; payment ordinals use server evidence.
  const [eventSnapshot, paymentWorkSnapshot] = await Promise.all([
    getDocsFromServer(
      query(
        collectionRef('subscriptionEvents'),
        where('farmRecordId', '==', record.id),
        limit(5000),
      ),
    ),
    getDocsFromServer(
      query(
        collectionRef('workItems'),
        where('farmRecordId', '==', record.id),
        limit(5000),
      ),
    ),
  ]);
  if (eventSnapshot.size >= 5000 || paymentWorkSnapshot.size >= 5000)
    throw new Error(
      '기록이 조회 한도에 도달했습니다. 입금 회차 확인 후 처리해 주세요.',
    );
  const serverPriorEvents = eventSnapshot.docs
    .map((snapshot) => snapshot.data() as FarmSubscriptionEvent)
    .filter(
      (event) => event.basisExpiryDate === request.expectedCurrentExpiryDate,
    );
  const paymentWorkIds = paymentWorkSnapshot.docs
    .filter((snapshot) => snapshot.data().workType === 'payment')
    .map((snapshot) => snapshot.id);
  const serverPayments: FarmHistoryEntry[] = [];
  for (let offset = 0; offset < paymentWorkIds.length; offset += 30) {
    const payments = await getDocsFromServer(
      query(
        collectionRef('historyEntries'),
        where('workItemId', 'in', paymentWorkIds.slice(offset, offset + 30)),
        limit(5000),
      ),
    );
    if (payments.size >= 5000)
      throw new Error(
        '입금 기록이 조회 한도에 도달했습니다. 회차 확인 후 처리해 주세요.',
      );
    serverPayments.push(
      ...payments.docs.map((snapshot) => snapshot.data() as FarmHistoryEntry),
    );
  }
  return runTransaction(getFirebaseServices().db, async (transaction) => {
    const replay = await readPaymentReplay(transaction, request, fingerprint);
    if (replay) return replay;
    const [recordSnapshot, workSnapshot, inboxSnapshot, projectSnapshot] =
      await Promise.all([
        transaction.get(documentRef('records', record.id)),
        transaction.get(documentRef('workItems', workItem.id)),
        sourceInbox
          ? transaction.get(documentRef('inboxItems', sourceInbox.id))
          : Promise.resolve(null),
        transaction.get(documentRef('projects', record.projectId)),
      ]);
    if (!recordSnapshot.exists() || !projectSnapshot.exists())
      throw new Error('농가와 사업 정보를 다시 확인해 주세요.');
    const current = recordSnapshot.data() as FarmRecord;
    if (
      current.updatedAt !== request.expectedUpdatedAt ||
      current.currentSubscriptionExpiresAt !==
        request.expectedCurrentExpiryDate ||
      current.projectId !== record.projectId ||
      current.farmId !== record.farmId
    ) {
      throw new Error(
        '구독 정보가 변경되어 입금을 저장하지 않았습니다. 창을 닫고 최신 만료일을 확인한 뒤 다시 등록해 주세요.',
      );
    }
    if (
      existingWork
        ? !workSnapshot.exists() ||
          workSnapshot.data().updatedAt !== existingWork.updatedAt
        : workSnapshot.exists()
    ) {
      throw new Error(
        '업무가 변경되어 입금을 저장하지 않았습니다. 최신 내용을 확인해 주세요.',
      );
    }
    if (
      sourceInbox &&
      (!inboxSnapshot?.exists() ||
        inboxSnapshot.data().status !== 'unprocessed')
    ) {
      throw new Error(
        '수신함 항목이 이미 처리되었습니다. 연결된 입금 내역을 확인해 주세요.',
      );
    }
    if (!existingWork)
      assertProjectEditable(projectSnapshot.data() as FarmProject, true);
    if (
      existingWork &&
      projectSnapshot.data().status === 'completed' &&
      workItem.status !== 'completed'
    ) {
      throw new Error('완료된 사업의 업무는 다시 열 수 없습니다.');
    }
    const now = Date.now();
    if (paymentHistory.occurredAt > now)
      throw new Error(
        '미래 시각의 입금으로 구독을 연장할 수 없습니다. 실제 입금 시각을 확인해 주세요.',
      );
    const plan = calculateSubscriptionPayment({
      amount: paymentHistory.amount,
      currentExpiryDate: current.currentSubscriptionExpiresAt,
      paymentDate: localDateAt(paymentHistory.occurredAt),
      today: localDateAt(now),
    });
    const ledgerPaymentCount = new Set(
      serverPayments
        .filter(
          (entry) =>
            Number.isFinite(entry.amount) &&
            entry.amount > 0 &&
            Number.isFinite(entry.occurredAt) &&
            entry.occurredAt > 0 &&
            entry.occurredAt <= now,
        )
        .map((entry) => entry.id),
    ).size;
    const previousPaymentCount = Math.max(
      ledgerPaymentCount,
      Number.isSafeInteger(current.subscriptionPaymentCount) &&
        current.subscriptionPaymentCount! >= 0
        ? current.subscriptionPaymentCount!
        : 0,
    );
    if (current.lastPaymentDate && plan.paymentDate < current.lastPaymentDate) {
      throw new Error(
        '마지막 입금일보다 이전인 입금은 자동 연장할 수 없습니다. 기존 입금과 만료일을 먼저 확인해 주세요.',
      );
    }
    const priorSnapshots = await Promise.all(
      serverPriorEvents.map((event) =>
        transaction.get(documentRef('subscriptionEvents', event.id)),
      ),
    );
    const confirmedPrior = priorSnapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => snapshot.data() as FarmSubscriptionEvent);
    if (
      confirmedPrior.some(
        (event) =>
          event.eventType !== 'churned' || event.processedAt > plan.paymentDate,
      )
    ) {
      throw new Error(
        '이 만료 회차에 처리 이력이 있습니다. 중복 연장을 막기 위해 기존 기록을 먼저 확인해 주세요.',
      );
    }
    const subscriptionEvent: FarmSubscriptionEvent = {
      id: `payment-${request.operationId}`,
      farmRecordId: current.id,
      projectId: current.projectId,
      eventType: 'renewed',
      basisExpiryDate: plan.basisExpiryDate,
      basisRenewalCount: renewalCountBeforeEvent(
        current,
        current.currentSubscriptionExpiresAt,
      ),
      basisPaymentCount: previousPaymentCount,
      paymentOrdinal: previousPaymentCount + 1,
      processedAt: plan.paymentDate,
      newExpiryDate: plan.newExpiryDate,
      recorder: paymentHistory.recorder,
      note: `${plan.amount.toLocaleString('ko-KR')}원 입금으로 ${plan.years}년 자동 갱신 · ${plan.withinGrace ? '기존 만료일 기준(만료 전 또는 만료 후 2개월 이내)' : '결제일 기준 연장 후 해당 월 말일'}`,
      createdAt: now,
      paymentHistoryEntryId: paymentHistory.id,
      paymentAmount: plan.amount,
      yearsAdded: plan.years,
      paymentPolicy: plan.policy,
      supersedesEventIds: confirmedPrior.map((event) => event.id),
    };
    Object.assign(paymentHistory, {
      paymentRequestFingerprint: fingerprint,
      subscriptionEventId: subscriptionEvent.id,
      subscriptionPreviousExpiryDate: plan.basisExpiryDate,
      subscriptionNewExpiryDate: plan.newExpiryDate,
      subscriptionYearsAdded: plan.years,
      subscriptionPaymentOrdinal: previousPaymentCount + 1,
    });
    write(transaction);
    setCreated(transaction, 'subscriptionEvents', subscriptionEvent);
    transaction.update(documentRef('records', current.id), {
      currentSubscriptionExpiresAt: plan.newExpiryDate,
      initialSubscriptionExpiresAt:
        current.initialSubscriptionExpiresAt || plan.basisExpiryDate,
      subscriptionStatus:
        plan.newExpiryDate >= localDateAt(now) ? 'active' : 'expired',
      renewalCount: previousPaymentCount + 1,
      subscriptionPaymentCount: previousPaymentCount + 1,
      lastPaymentDate:
        plan.paymentDate > current.lastPaymentDate
          ? plan.paymentDate
          : current.lastPaymentDate,
      lastActivityAt: Math.max(
        current.lastActivityAt,
        paymentHistory.occurredAt,
        now,
      ),
      updatedAt: Math.max(now, current.updatedAt + 1),
      updatedByUid: requireSignedInUser().uid,
    });
    return { workItem, historyEntry };
  });
}

/** Reads all hierarchy dependencies before returning a write-only closure. */
async function prepareParentMutation(
  transaction: Transaction,
  workItem: FarmWorkItem,
  previous?: FarmWorkItem,
) {
  const parentId = workItem.parentWorkItemId;
  if (!parentId) return () => {};
  if (!isStandaloneWork(workItem))
    throw new Error('입금·농가 업무는 세부 업무로 등록할 수 없습니다.');
  const visited = new Set([workItem.id]);
  let ancestorId: string | undefined = parentId;
  let directParent: FarmWorkItem | undefined;
  while (ancestorId) {
    if (visited.has(ancestorId))
      throw new Error(
        '업무 연결에 순환이 있습니다. 상위 업무를 확인해 주세요.',
      );
    visited.add(ancestorId);
    const snapshot = await transaction.get(
      documentRef('workItems', ancestorId),
    );
    if (!snapshot.exists()) throw new Error('상위 업무를 찾을 수 없습니다.');
    const ancestor = snapshot.data() as FarmWorkItem;
    assertWorkActive(ancestor);
    if (!isStandaloneWork(ancestor) || !sameWorkContext(ancestor, workItem))
      throw new Error(
        '같은 프로젝트 또는 내부 부서의 업무 아래에만 등록할 수 있습니다.',
      );
    if (
      ancestor.status === 'completed' &&
      (!previous || workItem.status !== 'completed')
    )
      throw new Error('완료된 상위 업무를 먼저 다시 열어 주세요.');
    directParent ??= ancestor;
    ancestorId = ancestor.parentWorkItemId;
  }
  const parent = directParent!;
  const ids = parent.childWorkItemIds || [];
  if (previous && !ids.includes(workItem.id))
    throw new Error('상위·세부 업무 연결을 확인해 주세요.');
  if (!previous && ids.includes(workItem.id))
    throw new Error('이미 연결된 세부 업무입니다.');
  const delta =
    Number(workItem.status !== 'completed') -
    (previous ? Number(previous.status !== 'completed') : 0);
  if (previous && delta === 0) return () => {};
  const openChildCount = (parent.openChildCount || 0) + delta;
  const nextIds = previous ? ids : [...ids, workItem.id];
  if (
    openChildCount < 0 ||
    openChildCount > nextIds.length ||
    nextIds.length > 500
  )
    throw new Error(
      '세부 업무 연결 수를 확인해 주세요. 한 업무의 직접 세부 업무는 최대 500개입니다.',
    );
  const now = Date.now();
  return () => {
    setUpdated(transaction, 'workItems', {
      ...parent,
      childWorkItemIds: nextIds,
      openChildCount,
      lastChildMutationId: workItem.id,
      updatedAt: Math.max(now, parent.updatedAt + 1),
      lastActivityAt: Math.max(now, parent.lastActivityAt),
    });
    setCreated(transaction, 'historyEntries', {
      id: crypto.randomUUID(),
      workItemId: parent.id,
      channel: 'system',
      sender: '',
      receivedContent: '',
      amount: 0,
      actionContent: previous
        ? `세부 업무 ‘${workItem.title}’: ${FARM_WORK_STATUS_LABELS[previous.status]} → ${FARM_WORK_STATUS_LABELS[workItem.status]}`
        : `세부 업무 ‘${workItem.title}’을(를) 추가했습니다.`,
      recorder:
        requireSignedInUser().displayName ||
        accountIdentifier(requireSignedInUser().email) ||
        workItem.owner,
      occurredAt: now,
      referenceUrl: '',
      createdAt: now,
    });
  };
}

async function assertChildrenCompleted(
  transaction: Transaction,
  workItem: FarmWorkItem,
) {
  for (const id of workItem.childWorkItemIds || []) {
    const child = await transaction.get(documentRef('workItems', id));
    if (
      !child.exists() ||
      child.data().parentWorkItemId !== workItem.id ||
      !sameWorkContext(child.data() as FarmWorkItem, workItem)
    )
      throw new Error('세부 업무 연결을 확인할 수 없어 완료할 수 없습니다.');
    if (child.data().status !== 'completed')
      throw new Error(
        '미완료 세부 업무가 있습니다. 모두 완료한 뒤 상위 업무를 완료해 주세요.',
      );
  }
  if (workItem.openChildCount) throw new Error('미완료 세부 업무가 있습니다.');
}

async function createWorkItem(
  input: FarmWorkItemInput,
  initialHistory: FarmInitialHistoryEntryInput,
  checklistContents: string[],
  sourceInboxId: string,
  paymentRequest?: SubscriptionPaymentRequest,
  images: ReceivedImage[] = [],
  operationId = '',
) {
  if (
    operationId &&
    (!/^[a-zA-Z0-9-]{16,80}$/.test(operationId) ||
      (!input.parentWorkItemId && !input.assigneeUid))
  )
    throw new Error('세부 업무 생성 요청을 확인해 주세요.');
  const createFingerprint = operationId
    ? await paymentFingerprint({
        input,
        initialHistory,
        checklistContents,
        sourceInboxId,
        images,
      })
    : '';
  async function readCreateReplay(transaction: Transaction) {
    if (!operationId) return null;
    const history = await transaction.get(
      documentRef('historyEntries', operationId),
    );
    if (!history.exists()) return null;
    if (
      history.data().workRequestFingerprint !== createFingerprint ||
      history.data().workItemId !== `${operationId}-work`
    )
      throw new Error(
        '이미 저장된 요청과 내용이 다릅니다. 등록 창을 다시 열어 주세요.',
      );
    const work = await transaction.get(
      documentRef('workItems', `${operationId}-work`),
    );
    return {
      workItem: work.data() as FarmWorkItem,
      historyEntry: history.data() as FarmHistoryEntry,
    };
  }
  if (operationId) {
    const replay = await runTransaction(
      getFirebaseServices().db,
      readCreateReplay,
    );
    if (replay) return replay;
  }
  const isPayment = input.workType === 'payment' && initialHistory.amount !== 0;
  if (isPayment && !paymentRequest)
    throw new Error(
      '구독 자동 연장 정보를 확인하려면 최신 화면에서 입금을 등록해 주세요.',
    );
  const fingerprint = isPayment
    ? await paymentFingerprint({
        input,
        initialHistory,
        checklistContents,
        sourceInboxId,
      })
    : '';
  if (isPayment && paymentRequest) {
    const replay = await runTransaction(
      getFirebaseServices().db,
      (transaction) =>
        readPaymentReplay(transaction, paymentRequest, fingerprint),
    );
    if (replay) return replay;
  }
  const workspace = currentWorkspace();
  const record = workspace.records.find(
    (item) => item.id === input.farmRecordId,
  );
  const internal = isInternalTask(input);
  if (!record && (input.farmRecordId || (!input.projectId && !internal)))
    throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  const projectId = record?.projectId || input.projectId || '';
  if (!record && initialHistory.amount !== 0)
    throw new Error('프로젝트 업무에는 구독 입금을 기록할 수 없습니다.');
  if (!internal)
    assertProjectEditable(
      workspace.projects.find((item) => item.id === projectId),
      Boolean(record),
    );
  const sourceInbox = sourceInboxId
    ? workspace.inboxItems.find((item) => item.id === sourceInboxId)
    : undefined;
  if (sourceInboxId && !sourceInbox)
    throw new Error('수신함 항목을 찾을 수 없습니다.');
  if (sourceInbox && sourceInbox.status !== 'unprocessed') {
    throw new Error('이미 정리된 수신함 항목입니다.');
  }
  if (input.status === 'completed' && checklistContents.length > 0) {
    throw new Error('체크리스트를 모두 확인한 뒤 업무를 완료해 주세요.');
  }
  const now = Date.now();
  const initialActionAt = sourceInbox ? now : initialHistory.occurredAt;
  const workItem: FarmWorkItem = {
    id:
      isPayment && paymentRequest
        ? `${paymentRequest.operationId}-work`
        : operationId
          ? `${operationId}-work`
          : crypto.randomUUID(),
    ...input,
    childWorkItemIds: [],
    openChildCount: 0,
    nextAction: input.status === 'completed' ? '' : input.nextAction,
    reviewDate: input.status === 'completed' ? '' : input.reviewDate,
    respondedAt:
      input.status === 'completed' || initialHistory.actionContent.trim()
        ? initialActionAt
        : 0,
    blockedAt: input.status === 'waiting' ? initialActionAt : 0,
    blockedReason: input.status === 'waiting' ? input.blockedReason : '',
    blockedBy: input.status === 'waiting' ? input.blockedBy : '',
    expectedUnblockDate:
      input.status === 'waiting' ? input.expectedUnblockDate : '',
    completedAt: input.status === 'completed' ? initialActionAt : 0,
    farmId: record?.farmId || '',
    lastActivityAt: sourceInbox ? now : initialHistory.occurredAt,
    createdAt: now,
    updatedAt: now,
  };
  const historyEntry: FarmHistoryEntry = {
    id:
      isPayment && paymentRequest && !sourceInbox
        ? paymentRequest.operationId
        : operationId || crypto.randomUUID(),
    ...(operationId ? { workRequestFingerprint: createFingerprint } : {}),
    workItemId: workItem.id,
    imageIds: images.map((image) => image.id),
    ...(sourceInbox
      ? {
          channel: sourceInbox.channel,
          sender: sourceInbox.sender || '발신자 미상',
          receivedContent: sourceInbox.content,
          actionContent: '',
          amount: 0,
          recorder: sourceInbox.capturedBy || initialHistory.recorder,
          occurredAt: sourceInbox.receivedAt,
          referenceUrl: sourceInbox.referenceUrl,
          imageIds: sourceInbox.imageIds || [],
        }
      : initialHistory),
    createdAt: now,
  };
  const transitionHistory: FarmHistoryEntry | null = sourceInbox
    ? {
        id:
          isPayment && paymentRequest
            ? paymentRequest.operationId
            : crypto.randomUUID(),
        workItemId: workItem.id,
        channel: 'system',
        sender: '',
        receivedContent: '',
        actionContent:
          initialHistory.actionContent.trim() ||
          '수신함 내용을 업무로 정리하고 다음 행동을 설정했습니다.',
        amount: initialHistory.amount,
        recorder: initialHistory.recorder,
        occurredAt: isPayment ? initialHistory.occurredAt : now,
        referenceUrl: '',
        createdAt: now,
      }
    : null;
  const checklistItems: FarmWorkChecklistItem[] = checklistContents.map(
    (content, index) => ({
      id: crypto.randomUUID(),
      workItemId: workItem.id,
      content,
      isCompleted: false,
      sortOrder: index,
      completedBy: '',
      completedAt: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const blockerEpisode: FarmBlockerEpisode | null =
    workItem.status === 'waiting'
      ? {
          id: crypto.randomUUID(),
          workItemId: workItem.id,
          reason: workItem.blockedReason,
          blockedBy: workItem.blockedBy,
          expectedUnblockDate: workItem.expectedUnblockDate,
          openedAt: workItem.blockedAt,
          closedAt: 0,
          resolution: '',
          createdAt: now,
          updatedAt: now,
        }
      : null;
  const write = (batch: LedgerWriter) => {
    setCreated(batch, 'workItems', workItem);
    setCreated(batch, 'historyEntries', historyEntry);
    if (!sourceInbox)
      writeReceivedImages(batch, images, 'historyEntries', historyEntry.id);
    if (transitionHistory)
      setCreated(batch, 'historyEntries', transitionHistory);
    if (blockerEpisode) setCreated(batch, 'blockerEpisodes', blockerEpisode);
    checklistItems.forEach((item) => setCreated(batch, 'checklistItems', item));
    if (sourceInbox) {
      setUpdated(batch, 'inboxItems', {
        ...sourceInbox,
        status: 'converted',
        convertedWorkItemId: workItem.id,
        updatedAt: now,
      });
    }
    if (!isPayment && record) {
      touchActivity(batch, 'records', record.id, now, now);
    }
    if (record) touch(batch, 'farms', record.farmId, now);
    if (projectId) touch(batch, 'projects', projectId, now);
  };
  if (isPayment && paymentRequest && record) {
    return savePaymentMutation({
      request: paymentRequest,
      fingerprint,
      record,
      workItem,
      historyEntry,
      paymentHistory: transitionHistory ?? historyEntry,
      sourceInbox,
      write,
    });
  }
  return runTransaction(getFirebaseServices().db, async (transaction) => {
    const replay = await readCreateReplay(transaction);
    if (replay) return replay;
    if (!internal) {
      const project = await transaction.get(documentRef('projects', projectId));
      if (!project.exists()) throw new Error('프로젝트를 찾을 수 없습니다.');
      assertProjectEditable(project.data() as FarmProject, Boolean(record));
    }
    if (input.assigneeUid)
      Object.assign(
        workItem,
        await resolveTaskAssignment(transaction, input.assigneeUid, now),
      );
    const writeParent = await prepareParentMutation(transaction, workItem);
    if (sourceInbox) {
      const latest = await transaction.get(
        documentRef('inboxItems', sourceInbox.id),
      );
      if (!latest.exists() || latest.data().status !== 'unprocessed')
        throw new Error('이미 정리된 수신함 항목입니다.');
    }
    write(transaction);
    writeParent();
    return { workItem, historyEntry };
  });
}

async function addHistoryEntry(
  input: AddFarmHistoryEntryInput,
  paymentRequest?: SubscriptionPaymentRequest,
  images: ReceivedImage[] = [],
) {
  const workFingerprint = input.operationId
    ? await paymentFingerprint({ input, images })
    : '';
  if (input.operationId) {
    const replay = await runTransaction(
      getFirebaseServices().db,
      async (transaction) => {
        const saved = await transaction.get(
          documentRef('historyEntries', input.operationId!),
        );
        if (!saved.exists()) return null;
        if (
          saved.data().workRequestFingerprint !== workFingerprint ||
          saved.data().workItemId !== input.workItemId
        )
          throw new Error(
            '이미 처리된 요청입니다. 빠른 수정 창을 다시 열어 주세요.',
          );
        const work = await transaction.get(
          documentRef('workItems', input.workItemId),
        );
        return {
          workItem: work.data() as FarmWorkItem,
          historyEntry: saved.data() as FarmHistoryEntry,
        };
      },
    );
    if (replay) return replay;
  }
  const fingerprint = paymentRequest ? await paymentFingerprint(input) : '';
  if (paymentRequest) {
    const replay = await runTransaction(
      getFirebaseServices().db,
      (transaction) =>
        readPaymentReplay(transaction, paymentRequest, fingerprint),
    );
    if (replay) return replay;
  }
  const workspace = currentWorkspace();
  const existing = workspace.workItems.find(
    (item) => item.id === input.workItemId,
  );
  if (!existing) throw new Error('업무를 찾을 수 없습니다.');
  assertWorkActive(existing);
  if (
    input.expectedUpdatedAt !== undefined &&
    input.expectedUpdatedAt !== existing.updatedAt
  )
    throw new Error(
      '다른 변경이 먼저 저장되었습니다. 입력 내용은 유지되며, 최신 업무를 확인한 뒤 다시 열어 주세요.',
    );
  const isPayment = existing.workType === 'payment' && input.amount !== 0;
  if (isPayment && !paymentRequest)
    throw new Error(
      '구독 자동 연장 정보를 확인하려면 최신 화면에서 입금을 등록해 주세요.',
    );
  const record = workspace.records.find(
    (item) => item.id === existing.farmRecordId,
  );
  if (!record && !isStandaloneWork(existing))
    throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  if (!record && input.amount !== 0)
    throw new Error('프로젝트 업무에는 구독 입금을 기록할 수 없습니다.');
  const projectId = record?.projectId || existing.projectId || '';
  const project = workspace.projects.find((item) => item.id === projectId);
  if (
    project?.status === 'completed' &&
    input.newStatus !== undefined &&
    input.newStatus !== 'completed'
  ) {
    throw new Error('완료된 사업의 업무는 다시 열 수 없습니다.');
  }
  if (input.newStatus === 'completed' && existing.status !== 'completed') {
    const incompleteChecklist = workspace.checklistItems.some(
      (item) => item.workItemId === existing.id && !item.isCompleted,
    );
    const pendingVisit = workspace.visits.some(
      (item) => item.workItemId === existing.id && item.status === 'scheduled',
    );
    if (incompleteChecklist) {
      throw new Error('체크리스트를 모두 확인한 뒤 업무를 완료해 주세요.');
    }
    if (pendingVisit) {
      throw new Error(
        '예정된 현장 방문을 완료하거나 취소한 뒤 업무를 완료해 주세요.',
      );
    }
  }
  const now = Date.now();
  const {
    newStatus,
    nextAction,
    reviewDate,
    priority,
    owner,
    dueDate,
    expectedOutcome,
    responseDueAt,
    markResponded,
    blockedReason,
    blockedBy,
    expectedUnblockDate,
    expectedUpdatedAt: _expectedUpdatedAt,
    operationId,
    ...historyInput
  } = input;
  const resolvedStatus = newStatus ?? existing.status;
  if (
    existing.status === 'waiting' &&
    resolvedStatus !== 'waiting' &&
    !historyInput.actionContent.trim()
  ) {
    throw new Error('대기를 해제할 때는 해결 내용을 남겨 주세요.');
  }
  if (
    (existing.respondedAt || markResponded || resolvedStatus === 'completed') &&
    responseDueAt !== undefined &&
    responseDueAt !== existing.responseDueAt
  ) {
    throw new Error(
      '최초 대응을 기록한 뒤에는 기존 대응 목표를 바꿀 수 없습니다.',
    );
  }
  const resolvedRespondedAt = existing.respondedAt
    ? existing.respondedAt
    : markResponded || resolvedStatus === 'completed'
      ? input.occurredAt
      : 0;
  const workItem: FarmWorkItem = {
    ...existing,
    status: resolvedStatus,
    owner: owner ?? existing.owner,
    dueDate: dueDate ?? existing.dueDate,
    expectedOutcome: expectedOutcome ?? existing.expectedOutcome,
    nextAction:
      resolvedStatus === 'completed' ? '' : (nextAction ?? existing.nextAction),
    reviewDate:
      resolvedStatus === 'completed' ? '' : (reviewDate ?? existing.reviewDate),
    priority: priority ?? existing.priority,
    responseDueAt: existing.respondedAt
      ? existing.responseDueAt
      : (responseDueAt ?? existing.responseDueAt),
    respondedAt: resolvedRespondedAt,
    blockedAt:
      resolvedStatus === 'waiting' ? existing.blockedAt || input.occurredAt : 0,
    blockedReason:
      resolvedStatus === 'waiting'
        ? (blockedReason ?? existing.blockedReason)
        : '',
    blockedBy:
      resolvedStatus === 'waiting' ? (blockedBy ?? existing.blockedBy) : '',
    expectedUnblockDate:
      resolvedStatus === 'waiting'
        ? (expectedUnblockDate ?? existing.expectedUnblockDate)
        : '',
    completedAt:
      resolvedStatus === 'completed'
        ? existing.completedAt || input.occurredAt
        : 0,
    lastActivityAt: Math.max(existing.lastActivityAt, input.occurredAt),
    updatedAt: Math.max(now, existing.updatedAt + 1),
  };
  if (existing.assigneeUid && workItem.owner !== existing.owner)
    throw new Error('계정으로 배정된 담당자는 이름 입력으로 바꿀 수 없습니다.');
  if (
    resolvedStatus === 'waiting' &&
    (!workItem.blockedReason || !workItem.blockedBy)
  ) {
    throw new Error('대기 업무의 막힘 사유와 해제 주체를 입력해 주세요.');
  }
  const planningChanges = [
    workItem.status !== existing.status ? '상태' : '',
    workItem.owner !== existing.owner ? '담당자' : '',
    workItem.dueDate !== existing.dueDate ? '처리 기한' : '',
    workItem.expectedOutcome !== existing.expectedOutcome ? '완료 기준' : '',
    workItem.nextAction !== existing.nextAction ? '다음 행동' : '',
    workItem.reviewDate !== existing.reviewDate ? '검토일' : '',
    workItem.priority !== existing.priority ? '우선순위' : '',
    workItem.responseDueAt !== existing.responseDueAt ? '최초 대응 목표' : '',
    workItem.respondedAt !== existing.respondedAt ? '최초 대응 완료' : '',
    workItem.blockedReason !== existing.blockedReason ? '막힘 사유' : '',
    workItem.blockedBy !== existing.blockedBy ? '확인 주체' : '',
  ].filter(Boolean);
  const isPlanningOnly =
    !historyInput.receivedContent.trim() &&
    !historyInput.actionContent.trim() &&
    !images.length;
  const historyEntry: FarmHistoryEntry = {
    id:
      isPayment && paymentRequest
        ? paymentRequest.operationId
        : operationId || crypto.randomUUID(),
    ...historyInput,
    imageIds: images.map((image) => image.id),
    ...(operationId ? { workRequestFingerprint: workFingerprint } : {}),
    previousWorkStatus: existing.status,
    newWorkStatus: resolvedStatus,
    channel: isPlanningOnly ? 'system' : historyInput.channel,
    sender: isPlanningOnly ? '' : historyInput.sender,
    actionContent: isPlanningOnly
      ? planningChanges.length
        ? `${existing.status !== resolvedStatus ? `상태: ${FARM_WORK_STATUS_LABELS[existing.status]} → ${FARM_WORK_STATUS_LABELS[resolvedStatus]}. ` : ''}${planningChanges.filter((field) => field !== '상태').join(', ')}${planningChanges.some((field) => field !== '상태') ? ' 변경' : ''}`.trim()
        : '업무 계획을 검토했습니다.'
      : historyInput.actionContent,
    createdAt: now,
  };
  const openEpisode = workspace.blockerEpisodes.find(
    (item) => item.workItemId === existing.id && item.closedAt === 0,
  );
  let nextEpisode: FarmBlockerEpisode | null = null;
  if (existing.status !== 'waiting' && resolvedStatus === 'waiting') {
    nextEpisode = {
      id: crypto.randomUUID(),
      workItemId: workItem.id,
      reason: workItem.blockedReason,
      blockedBy: workItem.blockedBy,
      expectedUnblockDate: workItem.expectedUnblockDate,
      openedAt: workItem.blockedAt,
      closedAt: 0,
      resolution: '',
      createdAt: now,
      updatedAt: now,
    };
  } else if (existing.status === 'waiting' && resolvedStatus === 'waiting') {
    if (!openEpisode) throw new Error('열린 막힘 이력을 찾을 수 없습니다.');
    nextEpisode = {
      ...openEpisode,
      reason: workItem.blockedReason,
      blockedBy: workItem.blockedBy,
      expectedUnblockDate: workItem.expectedUnblockDate,
      updatedAt: now,
    };
  } else if (existing.status === 'waiting' && resolvedStatus !== 'waiting') {
    if (!openEpisode) throw new Error('열린 막힘 이력을 찾을 수 없습니다.');
    nextEpisode = {
      ...openEpisode,
      closedAt: input.occurredAt,
      resolution: historyInput.actionContent,
      updatedAt: now,
    };
  }
  const write = (batch: LedgerWriter) => {
    setCreated(batch, 'historyEntries', historyEntry);
    writeReceivedImages(batch, images, 'historyEntries', historyEntry.id);
    setUpdated(batch, 'workItems', workItem);
    if (nextEpisode) {
      if (nextEpisode.createdAt === now)
        setCreated(batch, 'blockerEpisodes', nextEpisode);
      else setUpdated(batch, 'blockerEpisodes', nextEpisode);
    }
    if (!isPayment && record) {
      touchActivity(
        batch,
        'records',
        record.id,
        Math.max(record.lastActivityAt, input.occurredAt),
        now,
      );
    }
    if (record) touch(batch, 'farms', record.farmId, now);
    if (projectId) touch(batch, 'projects', projectId, now);
  };
  if (isPayment && paymentRequest && record) {
    return savePaymentMutation({
      request: paymentRequest,
      fingerprint,
      record,
      workItem,
      historyEntry,
      paymentHistory: historyEntry,
      existingWork: existing,
      write,
    });
  }
  const completionChecks =
    resolvedStatus === 'completed'
      ? await Promise.all(
          (['checklistItems', 'visits'] as const).map(async (key) => {
            const result = await getDocsFromServer(
              query(
                collectionRef(key),
                where('workItemId', '==', existing.id),
                limit(5000),
              ),
            );
            if (result.size >= 5000)
              throw new Error(
                '완료 근거가 조회 한도를 초과했습니다. 관리자 확인이 필요합니다.',
              );
            return result.docs.map((item) => ({ key, id: item.id }));
          }),
        )
      : [];
  await runTransaction(getFirebaseServices().db, async (transaction) => {
    if (operationId) {
      const replay = await transaction.get(
        documentRef('historyEntries', operationId),
      );
      if (replay.exists()) {
        if (replay.data().workRequestFingerprint !== workFingerprint)
          throw new Error('이미 처리된 요청입니다.');
        return;
      }
    }
    const latest = await transaction.get(documentRef('workItems', existing.id));
    if (latest.exists()) assertWorkActive(latest.data() as FarmWorkItem);
    if (
      !latest.exists() ||
      latest.data().updatedAt !== existing.updatedAt ||
      latest.data().status !== existing.status
    )
      throw new Error(
        '다른 변경이 먼저 저장되었습니다. 최신 업무를 확인한 뒤 다시 적용해 주세요.',
      );
    if (!isInternalTask(existing)) {
      const projectSnapshot = await transaction.get(
        documentRef('projects', projectId),
      );
      if (!projectSnapshot.exists())
        throw new Error('프로젝트를 찾을 수 없습니다.');
      if (
        projectSnapshot.data().status === 'completed' &&
        resolvedStatus !== 'completed'
      )
        throw new Error('완료된 사업의 업무는 다시 열 수 없습니다.');
    }
    if (resolvedStatus === 'completed') {
      await assertChildrenCompleted(transaction, latest.data() as FarmWorkItem);
      for (const check of completionChecks.flat()) {
        const item = await transaction.get(documentRef(check.key, check.id));
        if (
          item.exists() &&
          (check.key === 'checklistItems'
            ? !item.data().isCompleted
            : item.data().status === 'scheduled')
        )
          throw new Error(
            '미완료 체크리스트 또는 예정된 현장 방문을 먼저 처리해 주세요.',
          );
      }
    }
    const writeParent = await prepareParentMutation(
      transaction,
      workItem,
      existing,
    );
    write(transaction);
    writeParent();
  });
  return { workItem, historyEntry };
}

async function saveVisit(input: FarmWorkVisitInput) {
  const workspace = currentWorkspace();
  const workItem = workspace.workItems.find(
    (item) => item.id === input.workItemId,
  );
  if (!workItem) throw new Error('업무를 찾을 수 없습니다.');
  assertWorkActive(workItem);
  if (workItem.status === 'completed') {
    throw new Error(
      '완료된 업무에는 현장 방문을 추가하거나 수정할 수 없습니다.',
    );
  }
  const record = workspace.records.find(
    (item) => item.id === workItem.farmRecordId,
  );
  if (!record) throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  const existing = input.id
    ? workspace.visits.find(
        (item) => item.id === input.id && item.workItemId === input.workItemId,
      )
    : undefined;
  if (input.id && !existing)
    throw new Error('현장 방문 기록을 찾을 수 없습니다.');
  if (existing && ['completed', 'canceled'].includes(existing.status)) {
    throw new Error(
      '완료·취소된 방문 기록은 증빙 보존을 위해 수정할 수 없습니다.',
    );
  }
  if (
    input.status === 'completed' &&
    (!input.actualStartedAt || !input.actualEndedAt || !input.result)
  ) {
    throw new Error('완료 방문에는 실제 작업 시간과 결과가 필요합니다.');
  }
  if (input.status === 'canceled' && !input.result) {
    throw new Error('취소 방문에는 취소 사유가 필요합니다.');
  }
  const now = Date.now();
  const visit: FarmWorkVisit = {
    id: input.id || crypto.randomUUID(),
    workItemId: input.workItemId,
    scheduledAt: input.scheduledAt,
    assignedTo: input.assignedTo,
    status: input.status,
    actualStartedAt: input.actualStartedAt,
    actualEndedAt: input.actualEndedAt,
    preparationNote: input.preparationNote,
    result: input.result,
    nextVisitAt: input.nextVisitAt,
    recordedBy: input.recordedBy,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const followUpVisit: FarmWorkVisit | null =
    visit.status !== 'scheduled' && visit.nextVisitAt > 0
      ? {
          id: crypto.randomUUID(),
          workItemId: visit.workItemId,
          scheduledAt: visit.nextVisitAt,
          assignedTo: visit.assignedTo,
          status: 'scheduled',
          actualStartedAt: 0,
          actualEndedAt: 0,
          preparationNote: '이전 방문 결과에 따라 등록된 후속 방문입니다.',
          result: '',
          nextVisitAt: 0,
          recordedBy: visit.recordedBy,
          createdAt: now,
          updatedAt: now,
        }
      : null;
  const scheduledLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(visit.scheduledAt));
  const actionContent =
    visit.status === 'completed'
      ? `현장 방문 완료: ${scheduledLabel} · ${visit.result}`
      : visit.status === 'canceled'
        ? `현장 방문 취소: ${scheduledLabel} · ${visit.result}`
        : `${input.id ? '현장 방문 일정 변경' : '현장 방문 일정 등록'}: ${scheduledLabel} · ${visit.assignedTo}`;
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(),
    workItemId: visit.workItemId,
    channel: 'system',
    sender: '',
    receivedContent: '',
    actionContent,
    amount: 0,
    recorder: visit.recordedBy,
    occurredAt: visit.status === 'completed' ? visit.actualEndedAt : now,
    referenceUrl: '',
    createdAt: now,
  };
  await runTransaction(getFirebaseServices().db, async (batch) => {
    const latestWork = await batch.get(documentRef('workItems', workItem.id));
    if (!latestWork.exists() || latestWork.data().status === 'completed')
      throw new Error(
        '완료된 업무는 수정할 수 없습니다. 업무를 다시 열어 주세요.',
      );
    const latestProject = await batch.get(
      documentRef('projects', record?.projectId || workItem.projectId || ''),
    );
    assertProjectEditable(
      latestProject.exists()
        ? (latestProject.data() as FarmProject)
        : undefined,
      true,
    );
    if (existing) {
      const latestVisit = await batch.get(documentRef('visits', existing.id));
      if (
        !latestVisit.exists() ||
        latestVisit.data().updatedAt !== existing.updatedAt ||
        latestVisit.data().status !== 'scheduled'
      )
        throw new Error(
          '방문 기록이 변경되었습니다. 최신 내용을 확인해 주세요.',
        );
    }
    if (existing) setUpdated(batch, 'visits', visit);
    else setCreated(batch, 'visits', visit);
    if (followUpVisit) setCreated(batch, 'visits', followUpVisit);
    setCreated(batch, 'historyEntries', historyEntry);
    touchActivity(
      batch,
      'workItems',
      workItem.id,
      now,
      Math.max(now, latestWork.data().updatedAt + 1),
    );
    touchActivity(batch, 'records', record.id, now, now);
    touch(batch, 'farms', record.farmId, now);
    touch(batch, 'projects', record.projectId, now);
  });
  return { visit, historyEntry, followUpVisit };
}

async function toggleChecklist(
  workItemId: string,
  checklistItemId: string,
  isCompleted: boolean,
  completedBy: string,
) {
  const workspace = currentWorkspace();
  const existing = workspace.checklistItems.find(
    (item) => item.id === checklistItemId && item.workItemId === workItemId,
  );
  if (!existing) throw new Error('체크리스트 항목을 찾을 수 없습니다.');
  const workItem = workspace.workItems.find((item) => item.id === workItemId);
  if (!workItem) throw new Error('업무를 찾을 수 없습니다.');
  assertWorkActive(workItem);
  if (workItem.status === 'completed') {
    throw new Error('완료된 업무의 체크리스트는 변경할 수 없습니다.');
  }
  const record = workspace.records.find(
    (item) => item.id === workItem.farmRecordId,
  );
  if (!record && !isStandaloneWork(workItem))
    throw new Error('농가의 사업 참여 정보를 찾을 수 없습니다.');
  const now = Date.now();
  const checklistItem: FarmWorkChecklistItem = {
    ...existing,
    isCompleted,
    completedBy: isCompleted ? completedBy : '',
    completedAt: isCompleted ? now : 0,
    updatedAt: now,
  };
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(),
    workItemId,
    channel: 'system',
    sender: '',
    receivedContent: '',
    actionContent: `${isCompleted ? '체크리스트 완료' : '체크리스트 확인 취소'}: ${checklistItem.content}`,
    amount: 0,
    recorder: completedBy,
    occurredAt: now,
    referenceUrl: '',
    createdAt: now,
  };
  await runTransaction(getFirebaseServices().db, async (batch) => {
    const latestWork = await batch.get(documentRef('workItems', workItem.id));
    if (!latestWork.exists() || latestWork.data().status === 'completed')
      throw new Error(
        '완료된 업무는 수정할 수 없습니다. 업무를 다시 열어 주세요.',
      );
    if (!isInternalTask(workItem)) {
      const latestProject = await batch.get(
        documentRef('projects', record?.projectId || workItem.projectId || ''),
      );
      assertProjectEditable(
        latestProject.exists()
          ? (latestProject.data() as FarmProject)
          : undefined,
        true,
      );
    }
    const latestCheck = await batch.get(
      documentRef('checklistItems', existing.id),
    );
    if (
      !latestCheck.exists() ||
      latestCheck.data().updatedAt !== existing.updatedAt
    )
      throw new Error(
        '체크리스트가 변경되었습니다. 최신 내용을 확인해 주세요.',
      );
    setUpdated(batch, 'checklistItems', checklistItem);
    setCreated(batch, 'historyEntries', historyEntry);
    touchActivity(
      batch,
      'workItems',
      workItem.id,
      now,
      Math.max(now, latestWork.data().updatedAt + 1),
    );
    if (record) {
      touchActivity(batch, 'records', record.id, now, now);
      touch(batch, 'farms', record.farmId, now);
    }
    if (!isInternalTask(workItem))
      touch(
        batch,
        'projects',
        record?.projectId || workItem.projectId || '',
        now,
      );
  });
  return { checklistItem };
}

function parseChecklist(value: unknown) {
  if (!Array.isArray(value) || value.length > 30) {
    throw new Error('체크리스트는 최대 30개까지 등록할 수 있습니다.');
  }
  const items = value.map((item) =>
    typeof item === 'string' ? item.trim() : '',
  );
  if (items.some((item) => !item || item.length > 300)) {
    throw new Error('체크리스트 항목을 1~300자로 입력해 주세요.');
  }
  return [...new Set(items)];
}

async function mutateFarmLedger(method: string, body: JsonObject) {
  const kind = typeof body.kind === 'string' ? body.kind : '';
  if (!kind) throw new Error('저장할 정보 종류를 확인해 주세요.');

  if (kind === 'work_lifecycle' && method === 'PATCH') {
    if (
      typeof body.deleted !== 'boolean' ||
      !Number.isSafeInteger(body.expectedUpdatedAt) ||
      Number(body.expectedUpdatedAt) <= 0
    )
      throw new Error('업무 삭제·복원 요청을 확인해 주세요.');
    return changeWorkDeletion(
      requiredId(body.workItemId, '업무 ID'),
      Number(body.expectedUpdatedAt),
      body.deleted,
      requiredId(body.operationId, '요청 ID'),
    );
  }

  if (kind === 'project_lifecycle' && method === 'PATCH') {
    if (
      typeof body.deleted !== 'boolean' ||
      typeof body.expectedUpdatedAt !== 'number'
    )
      throw new Error('프로젝트 삭제·복구 요청을 확인해 주세요.');
    return changeProjectDeletion(
      requiredId(body.projectId, '사업 ID'),
      body.expectedUpdatedAt,
      body.deleted,
    );
  }

  if (kind === 'project') {
    const input = parseProjectInput(body.project);
    return method === 'PATCH'
      ? updateProject(
          requiredId(body.projectId, '사업 ID'),
          input,
          body.expectedUpdatedAt as number | undefined,
        )
      : createProject(input);
  }

  if (kind === 'project_document') {
    const input = parseProjectDocumentInput(body.document);
    return method === 'PATCH'
      ? updateProjectDocument(requiredId(body.documentId, '제출서류 ID'), input)
      : createProjectDocument(requiredId(body.projectId, '사업 ID'), input);
  }

  if (kind === 'project_update' && method === 'POST') {
    return createProjectUpdate(
      requiredId(body.projectId, '사업 ID'),
      parseProjectUpdateInput(body.update),
    );
  }

  if (kind === 'project_blocker_resolve' && method === 'PATCH') {
    const resolution =
      typeof body.resolution === 'string' ? body.resolution.trim() : '';
    const resolvedBy =
      typeof body.resolvedBy === 'string' ? body.resolvedBy.trim() : '';
    return resolveProjectBlocker(
      requiredId(body.updateId, '프로젝트 막힘 ID'),
      resolution,
      resolvedBy,
    );
  }

  if (kind === 'farm') {
    const input = parseFarmInput(body.farm);
    const locationChange = parseFarmLocationChange(body);
    if (method === 'PATCH') {
      if (
        body.expectedFarmUpdatedAt !== undefined &&
        (!Number.isSafeInteger(body.expectedFarmUpdatedAt) ||
          Number(body.expectedFarmUpdatedAt) <= 0)
      )
        throw new Error('농가 정보 버전을 확인해 주세요.');
      return updateFarm(
        requiredId(body.farmId, '농가 ID'),
        input,
        locationChange,
        body.expectedFarmUpdatedAt as number | undefined,
      );
    }
    const recorder = requiredId(body.recorder, '담당자');
    return createFarmWithRecord(
      input,
      parseRecordInput(body.record),
      recorder,
      locationChange,
    );
  }

  if (kind === 'record') {
    const input = parseRecordInput(body.record);
    const recorder = requiredId(body.recorder, '담당자');
    return method === 'PATCH'
      ? updateRecord(requiredId(body.recordId, '사업 참여 ID'), input, recorder)
      : createRecord(requiredId(body.farmId, '농가 ID'), input, recorder);
  }

  if (kind === 'subscription_event' && method === 'POST') {
    return createSubscriptionEvent(
      parseSubscriptionEventInput(body.subscriptionEvent),
    );
  }

  if (kind === 'subscription_expiry_correction' && method === 'PATCH') {
    return correctSubscriptionExpiry(
      parseSubscriptionExpiryCorrectionInput(body.correction),
    );
  }

  if (kind === 'inbox' && method === 'POST') {
    const source = asObject(body.inboxItem, '수신 내용을 확인해 주세요.');
    return createInboxItem(
      parseInboxInput(source),
      parseReceivedImages(source.images),
    );
  }

  if (kind === 'inbox_status' && method === 'PATCH') {
    const status = typeof body.status === 'string' ? body.status : '';
    assertEnum(
      status,
      FARM_INBOX_STATUSES,
      '수신함 처리 상태를 확인해 주세요.',
    );
    if (status !== 'reference' && status !== 'discarded') {
      throw new Error('수신함 처리 상태를 확인해 주세요.');
    }
    return updateInboxStatus(requiredId(body.inboxItemId, '수신함 ID'), status);
  }

  if (kind === 'work_item' && method === 'POST') {
    const sourceInboxId =
      typeof body.sourceInboxId === 'string' ? body.sourceInboxId.trim() : '';
    return createWorkItem(
      parseWorkItemInput(body.workItem),
      parseInitialHistory(body.history),
      parseChecklist(body.checklist),
      sourceInboxId,
      parsePaymentRequest(body.paymentRequest),
      parseReceivedImages(body.images),
      typeof body.operationId === 'string' ? body.operationId : '',
    );
  }

  if (kind === 'history' && method === 'POST') {
    return addHistoryEntry(
      parseHistoryInput(body.history),
      parsePaymentRequest(body.paymentRequest),
      parseReceivedImages(body.images),
    );
  }

  if (kind === 'visit' && method === 'POST') {
    return saveVisit(parseVisitInput(body.visit));
  }

  if (kind === 'checklist' && method === 'PATCH') {
    if (typeof body.isCompleted !== 'boolean') {
      throw new Error('체크 여부를 확인해 주세요.');
    }
    return toggleChecklist(
      requiredId(body.workItemId, '업무 ID'),
      requiredId(body.checklistItemId, '체크리스트 ID'),
      body.isCompleted,
      requiredId(body.completedBy, '확인 담당자'),
    );
  }

  throw new Error('저장할 정보 종류를 확인해 주세요.');
}

export async function farmLedgerFetch(
  _input: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    requireSignedInUser();
    const method = (init.method || 'GET').toUpperCase();
    if (method === 'GET') {
      return Response.json(currentWorkspace(), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (method !== 'POST' && method !== 'PATCH') {
      throw new Error('지원하지 않는 요청입니다.');
    }
    const body = asObject(
      typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
      '저장할 정보를 확인해 주세요.',
    );
    const result = await mutateFarmLedger(method, body);
    return Response.json(result, { status: method === 'POST' ? 201 : 200 });
  } catch (error) {
    const known = toError(error);
    console.error('Firebase farm ledger mutation failed', known);
    return Response.json(
      { error: known.message },
      { status: known.message.includes('찾을 수 없습니다') ? 404 : 400 },
    );
  }
}
