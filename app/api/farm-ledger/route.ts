import {
  addFarmHistoryEntry,
  createFarmInboxItem,
  createFarmProject,
  createFarmProjectDocument,
  createFarmProjectUpdate,
  createFarmRecord,
  createFarmSubscriptionEvent,
  createFarmWithRecord,
  createFarmWorkItem,
  listFarmLedgerWorkspace,
  resolveFarmProjectBlocker,
  saveFarmWorkVisit,
  toggleFarmChecklistItem,
  updateFarm,
  updateFarmProject,
  updateFarmProjectDocument,
  updateFarmInboxStatus,
  updateFarmRecord,
} from '@/db/farm-ledger';
import {
  FARM_HISTORY_CHANNELS,
  FARM_INBOX_STATUSES,
  FARM_PROJECT_DOCUMENT_CATEGORIES,
  FARM_PROJECT_DOCUMENT_STATUSES,
  FARM_PROJECT_STATUSES,
  FARM_PROJECT_STAGES,
  FARM_PROJECT_TYPES,
  FARM_PROJECT_UPDATE_KINDS,
  FARM_SETTLEMENT_STATUSES,
  FARM_SUBSCRIPTION_EVENT_TYPES,
  FARM_VISIT_STATUSES,
  FARM_WORK_PRIORITIES,
  FARM_WORK_STATUSES,
  FARM_WORK_TYPES,
  SUBSCRIPTION_STATUSES,
  type AddFarmHistoryEntryInput,
  type FarmInboxItemInput,
  type FarmInboxStatus,
  type FarmInitialHistoryEntryInput,
  type FarmInput,
  type FarmProjectInput,
  type FarmProjectDocumentInput,
  type FarmProjectUpdateInput,
  type FarmRecordInput,
  type FarmSubscriptionEventInput,
  type FarmWorkVisitInput,
  type FarmWorkItemInput,
  type FarmWorkPriority,
  type FarmWorkStatus,
} from '@/lib/farm-types';
import {
  authenticateRequest,
  authenticationResponse,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function objectValue(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function hasStringFields(body: JsonObject, fields: readonly string[]) {
  return fields.every((field) => typeof body[field] === 'string');
}

function trimmed(body: JsonObject, field: string) {
  return (body[field] as string).trim();
}

function integerValue(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : Number.NaN;
}

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

function validUrl(value: string) {
  if (!value) return true;
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function parseId(value: unknown, label: string): string {
  if (typeof value !== 'string')
    throw new Error(`${label}을(를) 문자열로 입력해 주세요.`);
  const id = value.trim();
  if (!id || id.length > 100) throw new Error(`${label}을(를) 확인해 주세요.`);
  return id;
}

function parseRecorder(value: unknown) {
  if (typeof value !== 'string') return '담당자를 1~50자로 입력해 주세요.';
  const recorder = value.trim();
  return !recorder || recorder.length > 50
    ? '담당자를 1~50자로 입력해 주세요.'
    : recorder;
}

function parseProjectInput(value: unknown): FarmProjectInput | string {
  const body = objectValue(value);
  if (!body) return '사업 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'name',
      'institution',
      'description',
      'manager',
      'startDate',
      'endDate',
      'settlementDueDate',
      'settledAt',
      'settlementOwner',
      'settlementEvidenceUrl',
      'settlementNote',
    ])
  ) {
    return '사업 기본정보와 정산 정보는 문자열로 입력해 주세요.';
  }

  const name = trimmed(body, 'name');
  const institution = trimmed(body, 'institution');
  const description = trimmed(body, 'description');
  const manager = trimmed(body, 'manager');
  const startDate = trimmed(body, 'startDate');
  const endDate = trimmed(body, 'endDate');
  const settlementDueDate = trimmed(body, 'settlementDueDate');
  const settledAt = trimmed(body, 'settledAt');
  const settlementOwner = trimmed(body, 'settlementOwner');
  const settlementEvidenceUrl = trimmed(body, 'settlementEvidenceUrl');
  const settlementNote = trimmed(body, 'settlementNote');
  const projectType = body.projectType;
  const status = body.status;
  const currentStage = body.currentStage;
  const settlementStatus = body.settlementStatus;
  const year = integerValue(body.year);
  const targetFarmCount = integerValue(body.targetFarmCount);
  const contractAmount = integerValue(body.contractAmount);
  const settlementClaimAmount = integerValue(body.settlementClaimAmount);
  const settlementApprovedAmount = integerValue(body.settlementApprovedAmount);
  const settlementPaidAmount = integerValue(body.settlementPaidAmount);

  if (!name || name.length > 140) return '사업명은 1~140자로 입력해 주세요.';
  if (!institution || institution.length > 100)
    return '주관기관은 1~100자로 입력해 주세요.';
  if (description.length > 1500)
    return '사업 설명은 1,500자 이내로 입력해 주세요.';
  if (!manager || manager.length > 50)
    return '사업 담당자는 1~50자로 입력해 주세요.';
  if (settlementOwner.length > 50)
    return '정산 담당자는 50자 이내로 입력해 주세요.';
  if (settlementNote.length > 1500)
    return '정산 메모는 1,500자 이내로 입력해 주세요.';
  if (
    !validDate(startDate) ||
    !validDate(endDate) ||
    !validDate(settlementDueDate) ||
    !validDate(settledAt)
  ) {
    return '사업기간과 정산 날짜를 확인해 주세요.';
  }
  if (startDate && endDate && endDate < startDate)
    return '사업 종료예정일은 시작일 이후여야 합니다.';
  if (!validUrl(settlementEvidenceUrl))
    return '정산 증빙 링크는 올바른 http 또는 https 주소여야 합니다.';
  if (
    !FARM_PROJECT_TYPES.includes(projectType as FarmProjectInput['projectType'])
  ) {
    return '사업 유형을 확인해 주세요.';
  }
  if (!FARM_PROJECT_STATUSES.includes(status as FarmProjectInput['status'])) {
    return '사업 상태를 확인해 주세요.';
  }
  if (
    !FARM_PROJECT_STAGES.includes(
      currentStage as FarmProjectInput['currentStage'],
    )
  ) {
    return '현재 사업 단계를 확인해 주세요.';
  }
  if (
    !FARM_SETTLEMENT_STATUSES.includes(
      settlementStatus as FarmProjectInput['settlementStatus'],
    )
  ) {
    return '정산 상태를 확인해 주세요.';
  }
  if (
    (status === 'completed' && currentStage !== 'closed') ||
    (status !== 'completed' && currentStage === 'closed')
  ) {
    return '사업 완료 상태와 현재 단계가 맞지 않습니다. 완료 사업은 사업 마감 단계로 설정해 주세요.';
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return '사업 연도를 확인해 주세요.';
  if (
    !Number.isInteger(targetFarmCount) ||
    targetFarmCount < 0 ||
    targetFarmCount > 100000
  ) {
    return '목표 농가 수를 확인해 주세요.';
  }
  for (const amount of [
    contractAmount,
    settlementClaimAmount,
    settlementApprovedAmount,
    settlementPaidAmount,
  ]) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000000)
      return '계약·정산 금액은 0~1,000억원 사이의 정수로 입력해 주세요.';
  }
  if (settlementPaidAmount > settlementApprovedAmount) {
    return '입금액은 승인액보다 클 수 없습니다.';
  }
  if (
    (settlementStatus === 'paid' || settlementStatus === 'closed') &&
    !settledAt
  ) {
    return '입금 완료 또는 정산 마감일을 입력해 주세요.';
  }

  return {
    name,
    institution,
    description,
    projectType: projectType as FarmProjectInput['projectType'],
    status: status as FarmProjectInput['status'],
    year,
    targetFarmCount,
    manager,
    startDate,
    endDate,
    currentStage: currentStage as FarmProjectInput['currentStage'],
    settlementStatus: settlementStatus as FarmProjectInput['settlementStatus'],
    settlementDueDate,
    contractAmount,
    settlementClaimAmount,
    settlementApprovedAmount,
    settlementPaidAmount,
    settledAt,
    settlementOwner,
    settlementEvidenceUrl,
    settlementNote,
  };
}

function parseProjectDocumentInput(
  value: unknown,
): FarmProjectDocumentInput | string {
  const body = objectValue(value);
  if (!body) return '제출서류 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'title',
      'owner',
      'currentHandler',
      'dueDate',
      'submittedAt',
      'approvedAt',
      'referenceUrl',
      'note',
    ])
  ) {
    return '제출서류 입력값을 확인해 주세요.';
  }
  const title = trimmed(body, 'title');
  const owner = trimmed(body, 'owner');
  const currentHandler = trimmed(body, 'currentHandler');
  const dueDate = trimmed(body, 'dueDate');
  const submittedAt = trimmed(body, 'submittedAt');
  const approvedAt = trimmed(body, 'approvedAt');
  const referenceUrl = trimmed(body, 'referenceUrl');
  const note = trimmed(body, 'note');
  const category = body.category;
  const status = body.status;
  const revision = integerValue(body.revision);

  if (!title || title.length > 160) return '서류명은 1~160자로 입력해 주세요.';
  if (!owner || owner.length > 50)
    return '제출 책임자는 1~50자로 입력해 주세요.';
  if (!currentHandler || currentHandler.length > 50)
    return '현재 처리자는 1~50자로 입력해 주세요.';
  if (note.length > 1500) return '서류 메모는 1,500자 이내로 입력해 주세요.';
  if (!validDate(dueDate) || !validDate(submittedAt) || !validDate(approvedAt))
    return '서류 날짜를 확인해 주세요.';
  if (!validUrl(referenceUrl))
    return '서류 링크는 올바른 http 또는 https 주소여야 합니다.';
  if (typeof body.isRequired !== 'boolean')
    return '필수서류 여부를 확인해 주세요.';
  if (
    !FARM_PROJECT_DOCUMENT_CATEGORIES.includes(
      category as FarmProjectDocumentInput['category'],
    )
  ) {
    return '서류 구분을 확인해 주세요.';
  }
  if (
    !FARM_PROJECT_DOCUMENT_STATUSES.includes(
      status as FarmProjectDocumentInput['status'],
    )
  ) {
    return '서류 상태를 확인해 주세요.';
  }
  if (!Number.isInteger(revision) || revision < 1 || revision > 1000)
    return '서류 개정번호를 확인해 주세요.';
  if (
    ['submitted', 'reviewing', 'revision', 'approved', 'rejected'].includes(
      String(status),
    ) &&
    !submittedAt
  ) {
    return '제출 이후 상태에는 제출일이 필요합니다.';
  }
  if (status === 'approved' && !approvedAt)
    return '승인된 서류는 승인일을 입력해 주세요.';
  if (approvedAt && submittedAt && approvedAt < submittedAt)
    return '승인일은 제출일 이후여야 합니다.';

  return {
    title,
    category: category as FarmProjectDocumentInput['category'],
    isRequired: body.isRequired,
    status: status as FarmProjectDocumentInput['status'],
    owner,
    currentHandler,
    dueDate,
    submittedAt,
    approvedAt,
    referenceUrl,
    revision,
    note,
  };
}

function parseProjectUpdateInput(
  value: unknown,
): FarmProjectUpdateInput | string {
  const body = objectValue(value);
  if (!body) return '프로젝트 기록을 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'title',
      'sender',
      'receivedContent',
      'actionContent',
      'recorder',
      'referenceUrl',
      'blockedReason',
      'blockedBy',
      'expectedUnblockDate',
    ])
  ) {
    return '프로젝트 기록 입력값을 확인해 주세요.';
  }
  const kind = body.kind;
  const channel = body.channel;
  const title = trimmed(body, 'title');
  const sender = trimmed(body, 'sender');
  const receivedContent = trimmed(body, 'receivedContent');
  const actionContent = trimmed(body, 'actionContent');
  const recorder = trimmed(body, 'recorder');
  const referenceUrl = trimmed(body, 'referenceUrl');
  const blockedReason = trimmed(body, 'blockedReason');
  const blockedBy = trimmed(body, 'blockedBy');
  const expectedUnblockDate = trimmed(body, 'expectedUnblockDate');
  const occurredAt = integerValue(body.occurredAt);

  if (
    !FARM_PROJECT_UPDATE_KINDS.includes(
      kind as (typeof FARM_PROJECT_UPDATE_KINDS)[number],
    ) ||
    kind === 'system'
  ) {
    return '프로젝트 기록 구분을 확인해 주세요.';
  }
  if (
    !FARM_HISTORY_CHANNELS.includes(
      channel as FarmProjectUpdateInput['channel'],
    ) ||
    channel === 'system'
  )
    return '프로젝트 기록의 수신 경로를 확인해 주세요.';
  if (!title || title.length > 160)
    return '프로젝트 기록 제목은 1~160자로 입력해 주세요.';
  if (sender.length > 100) return '발신자는 100자 이내로 입력해 주세요.';
  if (receivedContent && !sender)
    return '받은 내용을 기록할 때는 발신자를 입력해 주세요.';
  if (receivedContent.length > 3000 || actionContent.length > 3000)
    return '받은 내용과 처리 내용은 각각 3,000자 이내로 입력해 주세요.';
  if (!recorder || recorder.length > 50)
    return '기록 담당자는 1~50자로 입력해 주세요.';
  if (!validUrl(referenceUrl))
    return '참고 링크는 올바른 http 또는 https 주소여야 합니다.';
  if (!validDate(expectedUnblockDate)) return '해결 예상일을 확인해 주세요.';
  if (
    !Number.isSafeInteger(occurredAt) ||
    occurredAt < Date.UTC(2000, 0, 1) ||
    occurredAt > Date.now() + 5 * 60 * 1000
  ) {
    return '프로젝트 기록 일시를 확인해 주세요.';
  }
  if (kind === 'blocker') {
    if (!blockedReason || blockedReason.length > 1500)
      return '프로젝트 막힘 사유는 1~1,500자로 입력해 주세요.';
    if (!blockedBy || blockedBy.length > 100)
      return '해결해 줄 사람·기관은 1~100자로 입력해 주세요.';
  } else if (!receivedContent && !actionContent) {
    return '받은 내용이나 처리 내용 중 하나를 입력해 주세요.';
  }

  return {
    kind: kind as FarmProjectUpdateInput['kind'],
    title,
    channel: channel as FarmProjectUpdateInput['channel'],
    sender,
    receivedContent,
    actionContent,
    recorder,
    occurredAt,
    referenceUrl,
    blockedReason: kind === 'blocker' ? blockedReason : '',
    blockedBy: kind === 'blocker' ? blockedBy : '',
    expectedUnblockDate: kind === 'blocker' ? expectedUnblockDate : '',
  };
}

function parseFarmInput(value: unknown): FarmInput | string {
  const body = objectValue(value);
  if (!body) return '농가 기본정보를 확인해 주세요.';
  const fields = [
    'farmCode',
    'name',
    'phone',
    'address',
    'region',
    'businessNumber',
    'folderUrl',
    'locationUrl',
    'specialNotes',
  ] as const;
  if (!hasStringFields(body, fields))
    return '농가 기본정보는 문자열로 입력해 주세요.';

  const farmCode = trimmed(body, 'farmCode');
  const name = trimmed(body, 'name');
  const phone = trimmed(body, 'phone');
  const address = trimmed(body, 'address');
  const region = trimmed(body, 'region');
  const businessNumber = trimmed(body, 'businessNumber');
  const folderUrl = trimmed(body, 'folderUrl');
  const locationUrl = trimmed(body, 'locationUrl');
  const specialNotes = trimmed(body, 'specialNotes');

  if (!farmCode || farmCode.length > 40)
    return '농장번호는 1~40자로 입력해 주세요.';
  if (!name || name.length > 100) return '농장명은 1~100자로 입력해 주세요.';
  if (phone.length > 30) return '연락처는 30자 이내로 입력해 주세요.';
  if (address.length > 300) return '주소는 300자 이내로 입력해 주세요.';
  if (!region || region.length > 50) return '지역은 1~50자로 입력해 주세요.';
  if (businessNumber.length > 60)
    return '경영체번호는 60자 이내로 입력해 주세요.';
  if (!validUrl(folderUrl) || !validUrl(locationUrl)) {
    return '농장 폴더와 위치도 링크는 2,000자 이내의 http:// 또는 https:// 주소로 입력해 주세요.';
  }
  if (specialNotes.length > 3000)
    return '특이사항은 3,000자 이내로 입력해 주세요.';

  return {
    farmCode,
    name,
    phone,
    address,
    region,
    businessNumber,
    folderUrl,
    locationUrl,
    specialNotes,
  };
}

function parseRecordInput(value: unknown): FarmRecordInput | string {
  const body = objectValue(value);
  if (!body) return '사업·설치 정보를 확인해 주세요.';
  const stringFields = [
    'projectId',
    'crop',
    'deviceType',
    'productType',
    'vendor',
    'productionSetupDate',
    'installationDate',
    'commissioningDate',
    'educationDate',
    'internetType',
    'warrantyExpiresAt',
    'initialSubscriptionExpiresAt',
    'currentSubscriptionExpiresAt',
    'lastPaymentDate',
    'notes',
  ] as const;
  if (!hasStringFields(body, stringFields))
    return '사업·설치 정보의 문자 항목을 확인해 주세요.';

  const projectId = trimmed(body, 'projectId');
  const crop = trimmed(body, 'crop');
  const deviceType = trimmed(body, 'deviceType');
  const productType = trimmed(body, 'productType');
  const vendor = trimmed(body, 'vendor');
  const productionSetupDate = trimmed(body, 'productionSetupDate');
  const installationDate = trimmed(body, 'installationDate');
  const commissioningDate = trimmed(body, 'commissioningDate');
  const educationDate = trimmed(body, 'educationDate');
  const internetType = trimmed(body, 'internetType');
  const warrantyExpiresAt = trimmed(body, 'warrantyExpiresAt');
  const initialSubscriptionExpiresAt = trimmed(
    body,
    'initialSubscriptionExpiresAt',
  );
  const currentSubscriptionExpiresAt = trimmed(
    body,
    'currentSubscriptionExpiresAt',
  );
  const lastPaymentDate = trimmed(body, 'lastPaymentDate');
  const notes = trimmed(body, 'notes');
  const warrantyYears = integerValue(body.warrantyYears);
  const subscriptionYears = integerValue(body.subscriptionYears);
  const renewalCount = integerValue(body.renewalCount);
  const subscriptionStatus = body.subscriptionStatus;

  if (!projectId || projectId.length > 100) return '참여 사업을 선택해 주세요.';
  for (const [label, text, max] of [
    ['작물', crop, 60],
    ['장비 종류', deviceType, 80],
    ['제품 종류', productType, 80],
    ['장비업체', vendor, 100],
    ['인터넷 유형', internetType, 60],
  ] as const) {
    if (text.length > max) return `${label}은 ${max}자 이내로 입력해 주세요.`;
  }

  const dates = [
    productionSetupDate,
    installationDate,
    commissioningDate,
    educationDate,
    warrantyExpiresAt,
    initialSubscriptionExpiresAt,
    currentSubscriptionExpiresAt,
    lastPaymentDate,
  ];
  if (dates.some((date) => !validDate(date)))
    return '날짜를 YYYY-MM-DD 형식으로 올바르게 입력해 주세요.';

  const installStages = [
    ['제작·세팅일', productionSetupDate],
    ['설치일', installationDate],
    ['시운전일', commissioningDate],
    ['교육일', educationDate],
  ].filter((stage): stage is [string, string] => Boolean(stage[1]));
  for (let index = 1; index < installStages.length; index += 1) {
    if (installStages[index - 1][1] > installStages[index][1]) {
      return `${installStages[index][0]}은 ${installStages[index - 1][0]}보다 빠를 수 없습니다.`;
    }
  }

  if (
    !Number.isInteger(warrantyYears) ||
    warrantyYears < 0 ||
    warrantyYears > 20
  ) {
    return '보증기간은 0~20년으로 입력해 주세요.';
  }
  if (
    !Number.isInteger(subscriptionYears) ||
    subscriptionYears < 0 ||
    subscriptionYears > 20
  ) {
    return '구독기간은 0~20년으로 입력해 주세요.';
  }
  if (
    !Number.isInteger(renewalCount) ||
    renewalCount < 0 ||
    renewalCount > 100
  ) {
    return '갱신횟수는 0~100회로 입력해 주세요.';
  }
  if (
    !SUBSCRIPTION_STATUSES.includes(
      subscriptionStatus as FarmRecordInput['subscriptionStatus'],
    )
  ) {
    return '구독 상태를 확인해 주세요.';
  }
  if (installationDate && warrantyYears > 0 && !warrantyExpiresAt) {
    return '설치일과 보증기간이 있으면 보증 만료일을 입력해 주세요.';
  }
  if (
    installationDate &&
    warrantyExpiresAt &&
    warrantyExpiresAt < installationDate
  ) {
    return '보증 만료일은 설치일보다 빠를 수 없습니다.';
  }
  if (
    initialSubscriptionExpiresAt &&
    currentSubscriptionExpiresAt &&
    initialSubscriptionExpiresAt > currentSubscriptionExpiresAt
  ) {
    return '현재 구독 만료일은 최초 구독 만료일보다 빠를 수 없습니다.';
  }

  const today = todayInSeoul();
  if (
    subscriptionStatus === 'active' &&
    (!currentSubscriptionExpiresAt || currentSubscriptionExpiresAt < today)
  ) {
    return '사용중 구독은 오늘 이후(오늘 포함)의 현재 만료일이 필요합니다.';
  }
  if (
    subscriptionStatus === 'expired' &&
    (!currentSubscriptionExpiresAt || currentSubscriptionExpiresAt >= today)
  ) {
    return '만료 구독은 오늘보다 이전인 현재 만료일이 필요합니다.';
  }
  if (subscriptionStatus === 'unregistered' && currentSubscriptionExpiresAt) {
    return '미등록 구독에는 현재 구독 만료일을 입력할 수 없습니다.';
  }
  if (lastPaymentDate && lastPaymentDate > today)
    return '최근 입금일은 미래 날짜일 수 없습니다.';
  if (notes.length > 3000) return '사업 비고는 3,000자 이내로 입력해 주세요.';

  return {
    projectId,
    crop,
    deviceType,
    productType,
    vendor,
    productionSetupDate,
    installationDate,
    commissioningDate,
    educationDate,
    internetType,
    warrantyYears,
    warrantyExpiresAt,
    subscriptionYears,
    initialSubscriptionExpiresAt,
    currentSubscriptionExpiresAt,
    lastPaymentDate,
    renewalCount,
    subscriptionStatus:
      subscriptionStatus as FarmRecordInput['subscriptionStatus'],
    notes,
  };
}

function parseSubscriptionEventInput(
  value: unknown,
): FarmSubscriptionEventInput | string {
  const body = objectValue(value);
  if (!body) return '구독 처리 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'farmRecordId',
      'basisExpiryDate',
      'processedAt',
      'newExpiryDate',
      'recorder',
      'note',
    ])
  ) {
    return '구독 처리의 문자 항목을 확인해 주세요.';
  }

  const farmRecordId = trimmed(body, 'farmRecordId');
  const basisExpiryDate = trimmed(body, 'basisExpiryDate');
  const processedAt = trimmed(body, 'processedAt');
  const newExpiryDate = trimmed(body, 'newExpiryDate');
  const recorder = trimmed(body, 'recorder');
  const note = trimmed(body, 'note');
  const eventType = body.eventType;

  if (!farmRecordId || farmRecordId.length > 100)
    return '농가·사업 구독을 선택해 주세요.';
  if (
    !FARM_SUBSCRIPTION_EVENT_TYPES.includes(
      eventType as FarmSubscriptionEventInput['eventType'],
    )
  ) {
    return '구독 처리 구분을 확인해 주세요.';
  }
  if (
    !basisExpiryDate ||
    !processedAt ||
    !validDate(basisExpiryDate) ||
    !validDate(processedAt)
  ) {
    return '기준 만료일과 처리일을 확인해 주세요.';
  }
  if (processedAt > todayInSeoul())
    return '구독 처리일은 미래 날짜일 수 없습니다.';
  if (eventType === 'churned' && newExpiryDate)
    return '이탈 처리에는 새 만료일을 입력하지 않습니다.';
  if (
    (eventType === 'renewed' || eventType === 'rejoined') &&
    (!newExpiryDate ||
      !validDate(newExpiryDate) ||
      newExpiryDate <= basisExpiryDate)
  ) {
    return '갱신·재가입의 새 만료일은 기준 만료일보다 이후여야 합니다.';
  }
  if (!recorder || recorder.length > 50)
    return '처리 담당자는 1~50자로 입력해 주세요.';
  if (note.length > 1500) return '처리 메모는 1,500자 이내로 입력해 주세요.';

  return {
    farmRecordId,
    eventType: eventType as FarmSubscriptionEventInput['eventType'],
    basisExpiryDate,
    processedAt,
    newExpiryDate,
    recorder,
    note,
  };
}

function parseWorkItemInput(value: unknown): FarmWorkItemInput | string {
  const body = objectValue(value);
  if (!body) return '업무 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'farmRecordId',
      'title',
      'owner',
      'dueDate',
      'description',
    ])
  ) {
    return '업무의 문자 항목을 확인해 주세요.';
  }

  const farmRecordId = trimmed(body, 'farmRecordId');
  const title = trimmed(body, 'title');
  const owner = trimmed(body, 'owner');
  const dueDate = trimmed(body, 'dueDate');
  const description = trimmed(body, 'description');
  const expectedOutcomeValue = body.expectedOutcome ?? '';
  const nextActionValue = body.nextAction ?? '';
  const reviewDateValue = body.reviewDate ?? '';
  const blockedReasonValue = body.blockedReason ?? '';
  const blockedByValue = body.blockedBy ?? '';
  const expectedUnblockDateValue = body.expectedUnblockDate ?? '';
  const responseDueAt = integerValue(body.responseDueAt ?? 0);
  if (
    typeof expectedOutcomeValue !== 'string' ||
    typeof nextActionValue !== 'string' ||
    typeof reviewDateValue !== 'string' ||
    typeof blockedReasonValue !== 'string' ||
    typeof blockedByValue !== 'string' ||
    typeof expectedUnblockDateValue !== 'string'
  ) {
    return '업무 계획과 막힘 정보는 문자 항목으로 입력해 주세요.';
  }
  const expectedOutcome = expectedOutcomeValue.trim();
  const nextAction = nextActionValue.trim();
  const reviewDate = reviewDateValue.trim();
  const blockedReason = blockedReasonValue.trim();
  const blockedBy = blockedByValue.trim();
  const expectedUnblockDate = expectedUnblockDateValue.trim();
  const workType = body.workType;
  const status = body.status;
  const priority = body.priority ?? 'medium';

  if (!farmRecordId || farmRecordId.length > 100)
    return '업무의 농가 사업 정보를 확인해 주세요.';
  if (!FARM_WORK_TYPES.includes(workType as FarmWorkItemInput['workType']))
    return '업무 유형을 확인해 주세요.';
  if (!title || title.length > 140)
    return '업무 제목은 1~140자로 입력해 주세요.';
  if (!FARM_WORK_STATUSES.includes(status as FarmWorkItemInput['status']))
    return '업무 상태를 확인해 주세요.';
  if (!owner || owner.length > 50) return '담당자는 1~50자로 입력해 주세요.';
  if (!validDate(dueDate)) return '마감일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  if (description.length > 3000)
    return '업무 설명은 3,000자 이내로 입력해 주세요.';
  if (expectedOutcome.length > 1000)
    return '완료 기준은 1,000자 이내로 입력해 주세요.';
  if (nextAction.length > 500) return '다음 행동은 500자 이내로 입력해 주세요.';
  if (!FARM_WORK_PRIORITIES.includes(priority as FarmWorkPriority))
    return '업무 우선순위를 확인해 주세요.';
  if (!validDate(reviewDate))
    return '검토일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  if (
    !Number.isSafeInteger(responseDueAt) ||
    (responseDueAt !== 0 &&
      (responseDueAt < 946684800000 ||
        responseDueAt > Date.now() + 5 * 365 * 86400000))
  ) {
    return '최초 대응 목표 일시를 확인해 주세요.';
  }
  if (blockedReason.length > 1000)
    return '막힘 사유는 1,000자 이내로 입력해 주세요.';
  if (blockedBy.length > 100) return '해제 주체는 100자 이내로 입력해 주세요.';
  if (!validDate(expectedUnblockDate))
    return '예상 해제일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  if (status === 'waiting' && (!blockedReason || !blockedBy)) {
    return '대기 업무에는 막힘 사유와 해결해 줄 사람·기관을 입력해 주세요.';
  }

  return {
    farmRecordId,
    workType: workType as FarmWorkItemInput['workType'],
    title,
    status: status as FarmWorkItemInput['status'],
    owner,
    dueDate,
    description,
    expectedOutcome,
    nextAction,
    priority: priority as FarmWorkPriority,
    reviewDate,
    responseDueAt,
    blockedReason,
    blockedBy,
    expectedUnblockDate,
  };
}

function parseChecklistContents(value: unknown): string[] | string {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return '체크리스트를 목록으로 입력해 주세요.';
  if (value.length > 50)
    return '체크리스트는 최대 50개까지 입력할 수 있습니다.';
  const contents: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string')
      return '체크리스트 항목은 문자로 입력해 주세요.';
    const content = item.trim();
    if (!content || content.length > 200)
      return '체크리스트 항목은 1~200자로 입력해 주세요.';
    contents.push(content);
  }
  return contents;
}

function parseInboxInput(value: unknown): FarmInboxItemInput | string {
  const body = objectValue(value);
  if (!body) return '수신 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, ['sender', 'content', 'capturedBy', 'referenceUrl'])
  ) {
    return '수신 정보의 문자 항목을 확인해 주세요.';
  }
  const channel = body.channel;
  const sender = trimmed(body, 'sender') || '발신자 미상';
  const content = trimmed(body, 'content');
  const capturedBy = trimmed(body, 'capturedBy');
  const referenceUrl = trimmed(body, 'referenceUrl');
  const receivedAt = integerValue(body.receivedAt);
  if (
    !FARM_HISTORY_CHANNELS.includes(channel as FarmInboxItemInput['channel'])
  ) {
    return '수신 경로를 확인해 주세요.';
  }
  if (sender.length > 100) return '전달자는 100자 이내로 입력해 주세요.';
  if (!content || content.length > 3000)
    return '받은 내용은 1~3,000자로 입력해 주세요.';
  if (!capturedBy || capturedBy.length > 50)
    return '기록자는 1~50자로 입력해 주세요.';
  if (
    !Number.isSafeInteger(receivedAt) ||
    receivedAt < 946684800000 ||
    receivedAt > Date.now() + 365 * 86400000
  )
    return '수신 일시를 확인해 주세요.';
  if (!validUrl(referenceUrl))
    return '참고 링크는 2,000자 이내의 http:// 또는 https:// 주소로 입력해 주세요.';
  return {
    channel: channel as FarmInboxItemInput['channel'],
    sender,
    content,
    capturedBy,
    receivedAt,
    referenceUrl,
  };
}

function parseInitialHistoryInput(
  value: unknown,
  allowEmpty = false,
): FarmInitialHistoryEntryInput | string {
  const body = objectValue(value);
  if (!body) return '히스토리 정보를 확인해 주세요.';
  if (
    !hasStringFields(body, [
      'sender',
      'receivedContent',
      'actionContent',
      'recorder',
      'referenceUrl',
    ])
  )
    return '히스토리의 문자 항목을 확인해 주세요.';

  const channel = body.channel;
  const sender = trimmed(body, 'sender');
  const receivedContent = trimmed(body, 'receivedContent');
  const actionContent = trimmed(body, 'actionContent');
  const recorder = trimmed(body, 'recorder');
  const referenceUrl = trimmed(body, 'referenceUrl');
  const amount = integerValue(body.amount);
  const occurredAt = integerValue(body.occurredAt);

  if (
    !FARM_HISTORY_CHANNELS.includes(
      channel as FarmInitialHistoryEntryInput['channel'],
    )
  ) {
    return '수신 경로를 확인해 주세요.';
  }
  if (!allowEmpty && !receivedContent && !actionContent)
    return '받은 내용 또는 처리 내용을 입력해 주세요.';
  if (receivedContent && !sender)
    return '받은 내용의 전달자나 기관을 입력해 주세요.';
  if (sender.length > 100) return '전달자는 100자 이내로 입력해 주세요.';
  if (receivedContent.length > 3000 || actionContent.length > 3000) {
    return '히스토리 내용은 각각 3,000자 이내로 입력해 주세요.';
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000000000)
    return '금액을 확인해 주세요.';
  if (!recorder || recorder.length > 50)
    return '기록자는 1~50자로 입력해 주세요.';
  if (
    !Number.isSafeInteger(occurredAt) ||
    occurredAt < 946684800000 ||
    occurredAt > Date.now() + 5 * 60000
  )
    return '발생 일시는 현재보다 미래로 기록할 수 없습니다.';
  if (!validUrl(referenceUrl))
    return '참고 링크는 2,000자 이내의 http:// 또는 https:// 주소로 입력해 주세요.';

  return {
    channel: channel as FarmInitialHistoryEntryInput['channel'],
    sender,
    receivedContent,
    actionContent,
    amount,
    recorder,
    occurredAt,
    referenceUrl,
  };
}

function parseHistoryInput(value: unknown): AddFarmHistoryEntryInput | string {
  const body = objectValue(value);
  if (!body) return '히스토리 정보를 확인해 주세요.';
  let workItemId: string;
  try {
    workItemId = parseId(body.workItemId, '업무 ID');
  } catch (error) {
    return error instanceof Error ? error.message : '업무 ID를 확인해 주세요.';
  }
  const fields = parseInitialHistoryInput(body, true);
  if (typeof fields === 'string') return fields;
  let newStatus: FarmWorkStatus | undefined;
  if (body.newStatus !== undefined) {
    if (!FARM_WORK_STATUSES.includes(body.newStatus as FarmWorkStatus)) {
      return '변경할 업무 상태를 확인해 주세요.';
    }
    newStatus = body.newStatus as FarmWorkStatus;
  }
  let nextAction: string | undefined;
  if (body.nextAction !== undefined) {
    if (typeof body.nextAction !== 'string')
      return '다음 행동을 문자로 입력해 주세요.';
    nextAction = body.nextAction.trim();
    if (nextAction.length > 500)
      return '다음 행동은 500자 이내로 입력해 주세요.';
  }
  let reviewDate: string | undefined;
  if (body.reviewDate !== undefined) {
    if (typeof body.reviewDate !== 'string')
      return '검토일을 문자로 입력해 주세요.';
    reviewDate = body.reviewDate.trim();
    if (!validDate(reviewDate))
      return '검토일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  }
  let priority: FarmWorkPriority | undefined;
  if (body.priority !== undefined) {
    if (!FARM_WORK_PRIORITIES.includes(body.priority as FarmWorkPriority)) {
      return '업무 우선순위를 확인해 주세요.';
    }
    priority = body.priority as FarmWorkPriority;
  }
  let owner: string | undefined;
  if (body.owner !== undefined) {
    if (typeof body.owner !== 'string') return '담당자를 문자로 입력해 주세요.';
    owner = body.owner.trim();
    if (!owner || owner.length > 50) return '담당자는 1~50자로 입력해 주세요.';
  }
  let dueDate: string | undefined;
  if (body.dueDate !== undefined) {
    if (typeof body.dueDate !== 'string')
      return '처리 기한을 문자로 입력해 주세요.';
    dueDate = body.dueDate.trim();
    if (!validDate(dueDate))
      return '처리 기한은 YYYY-MM-DD 형식으로 입력해 주세요.';
  }
  let expectedOutcome: string | undefined;
  if (body.expectedOutcome !== undefined) {
    if (typeof body.expectedOutcome !== 'string')
      return '완료 기준을 문자로 입력해 주세요.';
    expectedOutcome = body.expectedOutcome.trim();
    if (expectedOutcome.length > 1000)
      return '완료 기준은 1,000자 이내로 입력해 주세요.';
  }
  let responseDueAt: number | undefined;
  if (body.responseDueAt !== undefined) {
    responseDueAt = integerValue(body.responseDueAt);
    if (
      !Number.isSafeInteger(responseDueAt) ||
      (responseDueAt !== 0 &&
        (responseDueAt < 946684800000 ||
          responseDueAt > Date.now() + 5 * 365 * 86400000))
    ) {
      return '최초 대응 목표 일시를 확인해 주세요.';
    }
  }
  let markResponded: boolean | undefined;
  if (body.markResponded !== undefined) {
    if (typeof body.markResponded !== 'boolean')
      return '최초 대응 완료 여부를 확인해 주세요.';
    markResponded = body.markResponded;
  }
  let blockedReason: string | undefined;
  if (body.blockedReason !== undefined) {
    if (typeof body.blockedReason !== 'string')
      return '막힘 사유를 문자로 입력해 주세요.';
    blockedReason = body.blockedReason.trim();
    if (blockedReason.length > 1000)
      return '막힘 사유는 1,000자 이내로 입력해 주세요.';
  }
  let blockedBy: string | undefined;
  if (body.blockedBy !== undefined) {
    if (typeof body.blockedBy !== 'string')
      return '해제 주체를 문자로 입력해 주세요.';
    blockedBy = body.blockedBy.trim();
    if (blockedBy.length > 100)
      return '해제 주체는 100자 이내로 입력해 주세요.';
  }
  let expectedUnblockDate: string | undefined;
  if (body.expectedUnblockDate !== undefined) {
    if (typeof body.expectedUnblockDate !== 'string')
      return '예상 해제일을 문자로 입력해 주세요.';
    expectedUnblockDate = body.expectedUnblockDate.trim();
    if (!validDate(expectedUnblockDate))
      return '예상 해제일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  }
  if (newStatus === 'waiting' && (!blockedReason || !blockedBy)) {
    return '대기 업무에는 막힘 사유와 해결해 줄 사람·기관을 입력해 주세요.';
  }
  return {
    workItemId,
    ...fields,
    ...(newStatus !== undefined ? { newStatus } : {}),
    ...(nextAction !== undefined ? { nextAction } : {}),
    ...(reviewDate !== undefined ? { reviewDate } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(owner !== undefined ? { owner } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(expectedOutcome !== undefined ? { expectedOutcome } : {}),
    ...(responseDueAt !== undefined ? { responseDueAt } : {}),
    ...(markResponded !== undefined ? { markResponded } : {}),
    ...(blockedReason !== undefined ? { blockedReason } : {}),
    ...(blockedBy !== undefined ? { blockedBy } : {}),
    ...(expectedUnblockDate !== undefined ? { expectedUnblockDate } : {}),
  };
}

function parseVisitInput(value: unknown): FarmWorkVisitInput | string {
  const body = objectValue(value);
  if (!body) return '현장 방문 정보를 확인해 주세요.';
  let workItemId: string;
  let id: string | undefined;
  try {
    workItemId = parseId(body.workItemId, '업무 ID');
    if (body.id !== undefined && body.id !== '') {
      id = parseId(body.id, '방문 ID');
    }
  } catch (error) {
    return error instanceof Error ? error.message : '방문 ID를 확인해 주세요.';
  }
  if (
    !hasStringFields(body, [
      'assignedTo',
      'preparationNote',
      'result',
      'recordedBy',
    ])
  ) {
    return '방문 담당자, 준비 메모, 결과, 기록자를 문자로 입력해 주세요.';
  }
  const assignedTo = trimmed(body, 'assignedTo');
  const preparationNote = trimmed(body, 'preparationNote');
  const result = trimmed(body, 'result');
  const recordedBy = trimmed(body, 'recordedBy');
  const status = body.status;
  const scheduledAt = integerValue(body.scheduledAt);
  const actualStartedAt = integerValue(body.actualStartedAt);
  const actualEndedAt = integerValue(body.actualEndedAt);
  const nextVisitAt = integerValue(body.nextVisitAt);
  const now = Date.now();
  const maxTimestamp = now + 5 * 365 * 86400000;
  const validOptionalTimestamp = (timestamp: number) =>
    Number.isSafeInteger(timestamp) &&
    (timestamp === 0 ||
      (timestamp >= 946684800000 && timestamp <= maxTimestamp));

  if (!assignedTo || assignedTo.length > 50)
    return '방문 담당자는 1~50자로 입력해 주세요.';
  if (!recordedBy || recordedBy.length > 50)
    return '방문 기록자는 1~50자로 입력해 주세요.';
  if (!FARM_VISIT_STATUSES.includes(status as FarmWorkVisitInput['status']))
    return '방문 상태를 확인해 주세요.';
  if (
    !Number.isSafeInteger(scheduledAt) ||
    scheduledAt < 946684800000 ||
    scheduledAt > maxTimestamp
  ) {
    return '방문 예정 일시를 확인해 주세요.';
  }
  if (
    !validOptionalTimestamp(actualStartedAt) ||
    !validOptionalTimestamp(actualEndedAt) ||
    !validOptionalTimestamp(nextVisitAt)
  ) {
    return '방문 시작·완료·다음 방문 일시를 확인해 주세요.';
  }
  if (preparationNote.length > 3000)
    return '방문 준비 메모는 3,000자 이내로 입력해 주세요.';
  if (
    (actualStartedAt && actualStartedAt > now + 5 * 60000) ||
    (actualEndedAt && actualEndedAt > now + 5 * 60000)
  ) {
    return '실제 방문 작업 시간은 미래로 기록할 수 없습니다.';
  }
  if (actualStartedAt && actualEndedAt && actualEndedAt <= actualStartedAt) {
    return '방문 완료 일시는 시작 일시보다 늦어야 합니다.';
  }
  if (result.length > 3000) return '방문 결과는 3,000자 이내로 입력해 주세요.';
  if (
    status === 'completed' &&
    (!actualStartedAt || !actualEndedAt || !result)
  ) {
    return '방문 완료 시 실제 시작·완료 일시와 결과를 입력해 주세요.';
  }
  if (status === 'canceled' && !result)
    return '방문 취소 사유를 입력해 주세요.';
  if (status === 'scheduled' && (actualStartedAt || actualEndedAt || result)) {
    return '예정 방문에는 실제 작업 시간이나 결과를 입력할 수 없습니다.';
  }
  if (status === 'scheduled' && nextVisitAt) {
    return '후속 방문은 현재 방문을 완료하거나 취소할 때 등록해 주세요.';
  }
  if (status === 'canceled' && (actualStartedAt || actualEndedAt)) {
    return '취소 방문에는 실제 작업 시간을 입력할 수 없습니다.';
  }
  if (
    nextVisitAt &&
    nextVisitAt <= Math.max(status === 'completed' ? actualEndedAt : 0, now)
  ) {
    return '후속 방문 일시는 현재 시각과 이번 방문 완료 시각보다 늦어야 합니다.';
  }

  return {
    ...(id ? { id } : {}),
    workItemId,
    scheduledAt,
    assignedTo,
    status: status as FarmWorkVisitInput['status'],
    actualStartedAt,
    actualEndedAt,
    preparationNote,
    result,
    nextVisitAt,
    recordedBy,
  };
}

function knownErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const responses: Record<string, [string, number]> = {
    SMARTFARM_PROJECT_NOT_FOUND: ['선택한 사업을 찾을 수 없습니다.', 404],
    FARM_PROJECT_DOCUMENT_NOT_FOUND: ['제출서류 항목을 찾을 수 없습니다.', 404],
    FARM_PROJECT_UPDATE_NOT_FOUND: ['프로젝트 기록을 찾을 수 없습니다.', 404],
    FARM_PROJECT_STAGE_STATUS_INVALID: [
      '사업 완료 상태와 현재 단계가 맞지 않습니다.',
      409,
    ],
    FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING: [
      '필수서류 승인, 정산 완료, 목표 농가, 열린 업무와 막힘을 모두 확인한 뒤 사업을 완료해 주세요.',
      409,
    ],
    FARM_PROJECT_COMPLETED_LOCKED: [
      '완료된 사업의 완료 근거를 바꾸거나 새 막힘을 등록하려면 사업을 먼저 다시 진행 상태로 열어 주세요.',
      409,
    ],
    FARM_PROJECT_DOCUMENT_REVISION_INVALID: [
      '서류 상태를 되돌리려면 개정번호를 올려 새 개정으로 기록해 주세요.',
      409,
    ],
    FARM_PROJECT_DOCUMENT_EVIDENCE_LOCKED: [
      '이미 남긴 제출일·승인일·증빙 링크는 지울 수 없습니다. 정정값으로 교체해 주세요.',
      409,
    ],
    FARM_PROJECT_BLOCKER_DETAILS_REQUIRED: [
      '프로젝트 막힘에는 사유와 해결해 줄 사람·기관이 필요합니다.',
      409,
    ],
    FARM_PROJECT_BLOCKER_REQUIRED: [
      '막힘 기록만 해결 처리할 수 있습니다.',
      409,
    ],
    FARM_PROJECT_BLOCKER_ALREADY_RESOLVED: [
      '이미 해결 처리된 프로젝트 막힘입니다.',
      409,
    ],
    FARM_PROJECT_BLOCKER_RESOLUTION_REQUIRED: [
      '해결 내용과 처리 담당자를 입력해 주세요.',
      409,
    ],
    FARM_PROJECT_BLOCKER_TIME_INVALID: [
      '막힘 기록 시각 이후에 해결 처리해 주세요.',
      409,
    ],
    FARM_PROJECT_SETTLEMENT_AMOUNTS_INVALID: [
      '입금액은 승인액보다 클 수 없습니다.',
      409,
    ],
    FARM_NOT_FOUND: ['농가를 찾을 수 없습니다.', 404],
    FARM_RECORD_NOT_FOUND: ['농가의 사업 참여 정보를 찾을 수 없습니다.', 404],
    FARM_WORK_ITEM_NOT_FOUND: ['업무를 찾을 수 없습니다.', 404],
    FARM_VISIT_NOT_FOUND: ['현장 방문 기록을 찾을 수 없습니다.', 404],
    FARM_BLOCKER_DETAILS_REQUIRED: [
      '대기 업무에는 막힘 사유와 해결해 줄 사람·기관이 필요합니다.',
      409,
    ],
    FARM_VISIT_DETAILS_REQUIRED: [
      '완료 방문에는 실제 작업 시간과 결과가, 취소 방문에는 취소 사유가 필요합니다.',
      409,
    ],
    FARM_VISIT_LOCKED: [
      '완료·취소된 방문 기록은 증빙 보존을 위해 수정할 수 없습니다.',
      409,
    ],
    FARM_VISIT_PENDING: [
      '예정된 현장 방문을 완료하거나 취소한 뒤 업무를 완료해 주세요.',
      409,
    ],
    FARM_WORK_COMPLETED: [
      '완료된 업무에는 현장 방문을 추가하거나 수정할 수 없습니다.',
      409,
    ],
    FARM_BLOCKER_RESOLUTION_REQUIRED: [
      '대기를 해제할 때는 무엇이 해결됐는지 처리 내용에 남겨 주세요.',
      409,
    ],
    FARM_BLOCKER_TIME_INVALID: [
      '막힘 해제 일시는 막힘이 시작된 뒤여야 합니다.',
      409,
    ],
    FARM_BLOCKER_EPISODE_REQUIRED: [
      '대기 상태의 막힘 이력이 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
      409,
    ],
    FARM_BLOCKER_EPISODE_OPEN: [
      '열린 막힘 이력을 먼저 해결 결과와 함께 닫아 주세요.',
      409,
    ],
    FARM_RESPONSE_TARGET_LOCKED: [
      '최초 대응을 기록하는 시점에는 기존 대응 목표를 바꿀 수 없습니다.',
      409,
    ],
    FARM_COMPLETED_TIME_REQUIRED: [
      '업무 완료 시각과 상태가 맞지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
      409,
    ],
    FARM_INBOX_ITEM_NOT_FOUND: ['수신함 항목을 찾을 수 없습니다.', 404],
    FARM_INBOX_ALREADY_PROCESSED: ['이미 정리된 수신함 항목입니다.', 409],
    FARM_CHECKLIST_ITEM_NOT_FOUND: ['체크리스트 항목을 찾을 수 없습니다.', 404],
    FARM_CHECKLIST_INCOMPLETE: [
      '체크리스트를 모두 확인한 뒤 업무를 완료해 주세요.',
      409,
    ],
    FARM_COMPLETED_CHECKLIST_LOCKED: [
      '완료된 업무의 체크리스트는 변경할 수 없습니다. 먼저 업무를 다시 열어 주세요.',
      409,
    ],
    FARM_CODE_EXISTS: ['이미 사용 중인 농장번호입니다.', 409],
    FARM_RECORD_PROJECT_EXISTS: [
      '이 농가는 이미 같은 프로젝트에 등록되어 있습니다.',
      409,
    ],
    FARM_SUBSCRIPTION_EVENT_MANAGED: [
      '구독 처리 이력이 있는 농가는 구독 처리 등록에서 상태와 만료일을 변경해 주세요.',
      409,
    ],
    FARM_SUBSCRIPTION_BASIS_INVALID: [
      '기준 만료일이 현재 구독 만료일보다 늦습니다. 구독 정보를 다시 확인해 주세요.',
      409,
    ],
    FARM_SUBSCRIPTION_REJOIN_REQUIRES_CHURN: [
      '재가입은 만료 또는 이탈 이력이 있는 구독에만 등록할 수 있습니다.',
      409,
    ],
  };
  const known = Object.entries(responses).find(([code]) =>
    error.message.includes(code),
  )?.[1];
  if (known) return errorResponse(known[0], known[1]);
  if (error.message.includes('UNIQUE constraint failed: farms.farm_code')) {
    return errorResponse('이미 사용 중인 농장번호입니다.', 409);
  }
  if (
    error.message.includes('UNIQUE constraint failed: farm_inbox_conversions')
  ) {
    return errorResponse('이미 다른 업무로 정리된 수신함 항목입니다.', 409);
  }
  if (
    error.message.includes(
      'UNIQUE constraint failed: farm_subscription_events.farm_record_id, farm_subscription_events.basis_expiry_date',
    )
  ) {
    return errorResponse(
      '이 만료 회차의 갱신 또는 이탈 결과가 이미 등록되어 있습니다.',
      409,
    );
  }
  if (error.message.includes('FARM_INBOX_ALREADY_PROCESSED')) {
    return errorResponse('이미 정리된 수신함 항목입니다.', 409);
  }
  if (error.message.includes('FARM_CHECKLIST_INCOMPLETE')) {
    return errorResponse(
      '체크리스트를 모두 확인한 뒤 업무를 완료해 주세요.',
      409,
    );
  }
  if (error.message.includes('FARM_COMPLETED_CHECKLIST_LOCKED')) {
    return errorResponse(
      '완료된 업무의 체크리스트는 변경할 수 없습니다. 먼저 업무를 다시 열어 주세요.',
      409,
    );
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = authenticationResponse(await authenticateRequest(request));
  if (unauthorized) return unauthorized;
  try {
    const workspace = await listFarmLedgerWorkspace();
    return Response.json(workspace, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Failed to list farm ledger', error);
    return errorResponse(
      '농가 관리대장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      500,
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = authenticationResponse(await authenticateRequest(request));
  if (unauthorized) return unauthorized;
  try {
    const body = objectValue(await request.json());
    if (!body || typeof body.kind !== 'string')
      return errorResponse('저장할 정보 종류를 확인해 주세요.');

    if (body.kind === 'project') {
      const input = parseProjectInput(body.project);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(
        { project: await createFarmProject(input) },
        { status: 201 },
      );
    }

    if (body.kind === 'project_document') {
      let projectId: string;
      try {
        projectId = parseId(body.projectId, '사업 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '사업 ID를 확인해 주세요.',
        );
      }
      const input = parseProjectDocumentInput(body.document);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(
        { document: await createFarmProjectDocument(projectId, input) },
        { status: 201 },
      );
    }

    if (body.kind === 'project_update') {
      let projectId: string;
      try {
        projectId = parseId(body.projectId, '사업 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '사업 ID를 확인해 주세요.',
        );
      }
      const input = parseProjectUpdateInput(body.update);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(
        { update: await createFarmProjectUpdate(projectId, input) },
        { status: 201 },
      );
    }

    if (body.kind === 'farm') {
      const farmInput = parseFarmInput(body.farm);
      if (typeof farmInput === 'string') return errorResponse(farmInput);
      const recordInput = parseRecordInput(body.record);
      if (typeof recordInput === 'string') return errorResponse(recordInput);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(
        await createFarmWithRecord(farmInput, recordInput, recorder),
        { status: 201 },
      );
    }

    if (body.kind === 'record') {
      let farmId: string;
      try {
        farmId = parseId(body.farmId, '농가 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '농가 ID를 확인해 주세요.',
        );
      }
      const input = parseRecordInput(body.record);
      if (typeof input === 'string') return errorResponse(input);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(await createFarmRecord(farmId, input, recorder), {
        status: 201,
      });
    }

    if (body.kind === 'subscription_event') {
      const input = parseSubscriptionEventInput(body.subscriptionEvent);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(
        { subscriptionEvent: await createFarmSubscriptionEvent(input) },
        { status: 201 },
      );
    }

    if (body.kind === 'inbox') {
      const input = parseInboxInput(body.inboxItem);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(
        { inboxItem: await createFarmInboxItem(input) },
        { status: 201 },
      );
    }

    if (body.kind === 'work_item') {
      const input = parseWorkItemInput(body.workItem);
      if (typeof input === 'string') return errorResponse(input);
      const history = parseInitialHistoryInput(body.history);
      if (typeof history === 'string') return errorResponse(history);
      const checklistContents = parseChecklistContents(body.checklist);
      if (typeof checklistContents === 'string')
        return errorResponse(checklistContents);
      let sourceInboxId = '';
      if (body.sourceInboxId !== undefined && body.sourceInboxId !== '') {
        try {
          sourceInboxId = parseId(body.sourceInboxId, '수신함 ID');
        } catch (error) {
          return errorResponse(
            error instanceof Error
              ? error.message
              : '수신함 ID를 확인해 주세요.',
          );
        }
      }
      return Response.json(
        await createFarmWorkItem(
          input,
          history,
          checklistContents,
          sourceInboxId,
        ),
        { status: 201 },
      );
    }

    if (body.kind === 'history') {
      const input = parseHistoryInput(body.history);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(await addFarmHistoryEntry(input), { status: 201 });
    }

    if (body.kind === 'visit') {
      const input = parseVisitInput(body.visit);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(await saveFarmWorkVisit(input), { status: 201 });
    }

    return errorResponse('저장할 정보 종류를 확인해 주세요.');
  } catch (error) {
    if (error instanceof SyntaxError)
      return errorResponse('요청 본문은 올바른 JSON이어야 합니다.');
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error('Failed to save farm ledger', error);
    return errorResponse(
      '관리대장을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      500,
    );
  }
}

export async function PATCH(request: Request) {
  const unauthorized = authenticationResponse(await authenticateRequest(request));
  if (unauthorized) return unauthorized;
  try {
    const body = objectValue(await request.json());
    if (!body || typeof body.kind !== 'string')
      return errorResponse('수정할 정보 종류를 확인해 주세요.');

    if (body.kind === 'project') {
      let projectId: string;
      try {
        projectId = parseId(body.projectId, '사업 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '사업 ID를 확인해 주세요.',
        );
      }
      const input = parseProjectInput(body.project);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json({
        project: await updateFarmProject(projectId, input),
      });
    }

    if (body.kind === 'project_document') {
      let documentId: string;
      try {
        documentId = parseId(body.documentId, '제출서류 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error
            ? error.message
            : '제출서류 ID를 확인해 주세요.',
        );
      }
      const input = parseProjectDocumentInput(body.document);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json({
        document: await updateFarmProjectDocument(documentId, input),
      });
    }

    if (body.kind === 'project_blocker_resolve') {
      let updateId: string;
      try {
        updateId = parseId(body.updateId, '프로젝트 막힘 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error
            ? error.message
            : '프로젝트 막힘 ID를 확인해 주세요.',
        );
      }
      if (typeof body.resolution !== 'string')
        return errorResponse('해결 내용을 입력해 주세요.');
      const resolution = body.resolution.trim();
      if (!resolution || resolution.length > 3000)
        return errorResponse('해결 내용은 1~3,000자로 입력해 주세요.');
      const resolvedBy = parseRecorder(body.resolvedBy);
      if (resolvedBy.includes('입력해 주세요'))
        return errorResponse(resolvedBy);
      return Response.json({
        update: await resolveFarmProjectBlocker(
          updateId,
          resolution,
          resolvedBy,
        ),
      });
    }

    if (body.kind === 'farm') {
      let farmId: string;
      try {
        farmId = parseId(body.farmId, '농가 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '농가 ID를 확인해 주세요.',
        );
      }
      const input = parseFarmInput(body.farm);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json({ farm: await updateFarm(farmId, input) });
    }

    if (body.kind === 'record') {
      let recordId: string;
      try {
        recordId = parseId(body.recordId, '사업 참여 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error
            ? error.message
            : '사업 참여 ID를 확인해 주세요.',
        );
      }
      const input = parseRecordInput(body.record);
      if (typeof input === 'string') return errorResponse(input);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(await updateFarmRecord(recordId, input, recorder));
    }

    if (body.kind === 'inbox_status') {
      let inboxItemId: string;
      try {
        inboxItemId = parseId(body.inboxItemId, '수신함 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : '수신함 ID를 확인해 주세요.',
        );
      }
      const status = body.status;
      if (
        !FARM_INBOX_STATUSES.includes(status as FarmInboxStatus) ||
        (status !== 'reference' && status !== 'discarded')
      ) {
        return errorResponse('수신함 처리 상태를 확인해 주세요.');
      }
      return Response.json({
        inboxItem: await updateFarmInboxStatus(
          inboxItemId,
          status as FarmInboxStatus,
        ),
      });
    }

    if (body.kind === 'checklist') {
      let workItemId: string;
      let checklistItemId: string;
      try {
        workItemId = parseId(body.workItemId, '업무 ID');
        checklistItemId = parseId(body.checklistItemId, '체크리스트 ID');
      } catch (error) {
        return errorResponse(
          error instanceof Error
            ? error.message
            : '체크리스트 정보를 확인해 주세요.',
        );
      }
      if (typeof body.isCompleted !== 'boolean')
        return errorResponse('체크 여부를 확인해 주세요.');
      const completedBy = parseRecorder(body.completedBy);
      if (completedBy.includes('입력해 주세요'))
        return errorResponse(completedBy);
      return Response.json({
        checklistItem: await toggleFarmChecklistItem(
          workItemId,
          checklistItemId,
          body.isCompleted,
          completedBy,
        ),
      });
    }

    return errorResponse('수정할 정보 종류를 확인해 주세요.');
  } catch (error) {
    if (error instanceof SyntaxError)
      return errorResponse('요청 본문은 올바른 JSON이어야 합니다.');
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error('Failed to update farm ledger', error);
    return errorResponse(
      '관리대장을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      500,
    );
  }
}
