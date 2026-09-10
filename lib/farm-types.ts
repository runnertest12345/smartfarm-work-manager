export const FARM_PROJECT_TYPES = ['general', 'research'] as const;
export type FarmProjectType = (typeof FARM_PROJECT_TYPES)[number];

export const FARM_PROJECT_STATUSES = [
  'active',
  'completed',
  'on_hold',
] as const;
export type FarmProjectStatus = (typeof FARM_PROJECT_STATUSES)[number];

export const FARM_PROJECT_STAGES = [
  'agreement',
  'farm_selection',
  'installation',
  'verification',
  'operation',
  'settlement',
  'closed',
] as const;
export type FarmProjectStage = (typeof FARM_PROJECT_STAGES)[number];

export const FARM_SETTLEMENT_STATUSES = [
  'not_started',
  'collecting',
  'submitted',
  'revision',
  'approved',
  'paid',
  'closed',
] as const;
export type FarmSettlementStatus = (typeof FARM_SETTLEMENT_STATUSES)[number];

export const FARM_PROJECT_DOCUMENT_CATEGORIES = [
  'agreement',
  'farm',
  'installation',
  'inspection',
  'settlement',
  'other',
] as const;
export type FarmProjectDocumentCategory =
  (typeof FARM_PROJECT_DOCUMENT_CATEGORIES)[number];

export const FARM_PROJECT_DOCUMENT_STATUSES = [
  'not_started',
  'preparing',
  'submitted',
  'reviewing',
  'revision',
  'approved',
  'rejected',
] as const;
export type FarmProjectDocumentStatus =
  (typeof FARM_PROJECT_DOCUMENT_STATUSES)[number];

export const FARM_PROJECT_UPDATE_KINDS = [
  'communication',
  'decision',
  'blocker',
  'system',
] as const;
export type FarmProjectUpdateKind = (typeof FARM_PROJECT_UPDATE_KINDS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'expired',
  'unregistered',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const FARM_SUBSCRIPTION_EVENT_TYPES = [
  'renewed',
  'churned',
  'rejoined',
] as const;
export type FarmSubscriptionEventType =
  (typeof FARM_SUBSCRIPTION_EVENT_TYPES)[number];

export const FARM_WORK_TYPES = [
  'communication',
  'installation',
  'subscription',
  'payment',
  'service',
  'note',
] as const;
export type FarmWorkType = (typeof FARM_WORK_TYPES)[number];

export const FARM_WORK_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'completed',
] as const;
export type FarmWorkStatus = (typeof FARM_WORK_STATUSES)[number];

export const FARM_WORK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type FarmWorkPriority = (typeof FARM_WORK_PRIORITIES)[number];

export const FARM_VISIT_STATUSES = [
  'scheduled',
  'completed',
  'canceled',
] as const;
export type FarmVisitStatus = (typeof FARM_VISIT_STATUSES)[number];

export const FARM_INBOX_STATUSES = [
  'unprocessed',
  'converted',
  'reference',
  'discarded',
] as const;
export type FarmInboxStatus = (typeof FARM_INBOX_STATUSES)[number];

export const FARM_HISTORY_CHANNELS = [
  'email',
  'kakao',
  'verbal',
  'phone',
  'meeting',
  'system',
  'other',
] as const;
export type FarmHistoryChannel = (typeof FARM_HISTORY_CHANNELS)[number];

export const FARM_PROJECT_TYPE_LABELS: Record<FarmProjectType, string> = {
  general: '일반 사업',
  research: '연구 사업',
};

export const FARM_PROJECT_STATUS_LABELS: Record<FarmProjectStatus, string> = {
  active: '진행 중',
  completed: '완료',
  on_hold: '보류',
};

export const FARM_PROJECT_STAGE_LABELS: Record<FarmProjectStage, string> = {
  agreement: '협약·계약',
  farm_selection: '참여농가 확정',
  installation: '설치·시운전',
  verification: '검수·교육',
  operation: '운영·구독',
  settlement: '정산·서류',
  closed: '사업 마감',
};

export const FARM_SETTLEMENT_STATUS_LABELS: Record<
  FarmSettlementStatus,
  string
> = {
  not_started: '미착수',
  collecting: '자료 수집',
  submitted: '정산 제출',
  revision: '보완 중',
  approved: '승인',
  paid: '입금 완료',
  closed: '정산 마감',
};

export const FARM_PROJECT_DOCUMENT_CATEGORY_LABELS: Record<
  FarmProjectDocumentCategory,
  string
> = {
  agreement: '협약·계약',
  farm: '농가 관련',
  installation: '설치·납품',
  inspection: '검수·교육',
  settlement: '정산',
  other: '기타',
};

export const FARM_PROJECT_DOCUMENT_STATUS_LABELS: Record<
  FarmProjectDocumentStatus,
  string
> = {
  not_started: '미작성',
  preparing: '작성 중',
  submitted: '제출 완료',
  reviewing: '검토 중',
  revision: '보완 요청',
  approved: '승인',
  rejected: '반려',
};

export const FARM_PROJECT_UPDATE_KIND_LABELS: Record<
  FarmProjectUpdateKind,
  string
> = {
  communication: '수신·연락',
  decision: '결정·변경',
  blocker: '프로젝트 막힘',
  system: '시스템 기록',
};

export const FARM_SUBSCRIPTION_EVENT_TYPE_LABELS: Record<
  FarmSubscriptionEventType,
  string
> = {
  renewed: '갱신',
  churned: '이탈',
  rejoined: '재가입',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '사용중',
  expired: '만료',
  unregistered: '미등록',
};

export const FARM_WORK_TYPE_LABELS: Record<FarmWorkType, string> = {
  communication: '수신·연락',
  installation: '설치·교육',
  subscription: '구독',
  payment: '입금',
  service: 'A/S',
  note: '관리 메모',
};

export const FARM_WORK_STATUS_LABELS: Record<FarmWorkStatus, string> = {
  open: '접수',
  in_progress: '처리 중',
  waiting: '대기·막힘',
  completed: '완료',
};

export const FARM_WORK_PRIORITY_LABELS: Record<FarmWorkPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export const FARM_VISIT_STATUS_LABELS: Record<FarmVisitStatus, string> = {
  scheduled: '방문 예정',
  completed: '방문 완료',
  canceled: '방문 취소',
};

export const FARM_INBOX_STATUS_LABELS: Record<FarmInboxStatus, string> = {
  unprocessed: '정리 전',
  converted: '업무 전환',
  reference: '참고 보관',
  discarded: '처리 제외',
};

export const FARM_HISTORY_CHANNEL_LABELS: Record<FarmHistoryChannel, string> = {
  email: '메일',
  kakao: '카톡',
  verbal: '구두',
  phone: '전화',
  meeting: '회의',
  system: '시스템',
  other: '기타',
};

export interface ProjectSettlement {
  status: FarmSettlementStatus;
  dueDate: string;
  claimAmount: number;
  approvedAmount: number;
  paidAmount: number;
  settledAt: string;
  owner: string;
  evidenceUrl: string;
  note: string;
}

export interface ProjectSettlementRounds {
  first: ProjectSettlement;
  second: ProjectSettlement;
  /** Original single settlement, counted once until explicitly assigned. */
  unassigned?: ProjectSettlement;
}

export interface FarmProject {
  id: string;
  /** Recoverable removal from project lists; linked records remain intact. */
  deletedAt?: number;
  deletedByUid?: string;
  lifecycleUpdateId?: string;
  name: string;
  projectType: FarmProjectType;
  year: number;
  institution: string;
  status: FarmProjectStatus;
  description: string;
  targetFarmCount: number;
  manager: string;
  startDate: string;
  endDate: string;
  currentStage: FarmProjectStage;
  settlementStatus: FarmSettlementStatus;
  settlementDueDate: string;
  contractAmount: number;
  settlementClaimAmount: number;
  settlementApprovedAmount: number;
  settlementPaidAmount: number;
  settledAt: string;
  settlementOwner: string;
  settlementEvidenceUrl: string;
  settlementNote: string;
  settlementRounds?: ProjectSettlementRounds;
  createdAt: number;
  updatedAt: number;
}

export interface FarmProjectInput {
  name: string;
  projectType: FarmProjectType;
  year: number;
  institution: string;
  status: FarmProjectStatus;
  description: string;
  targetFarmCount: number;
  manager: string;
  startDate: string;
  endDate: string;
  currentStage: FarmProjectStage;
  settlementStatus: FarmSettlementStatus;
  settlementDueDate: string;
  contractAmount: number;
  settlementClaimAmount: number;
  settlementApprovedAmount: number;
  settlementPaidAmount: number;
  settledAt: string;
  settlementOwner: string;
  settlementEvidenceUrl: string;
  settlementNote: string;
  settlementRounds?: ProjectSettlementRounds;
}

export interface FarmProjectDocument {
  id: string;
  projectId: string;
  title: string;
  category: FarmProjectDocumentCategory;
  isRequired: boolean;
  status: FarmProjectDocumentStatus;
  owner: string;
  currentHandler: string;
  dueDate: string;
  submittedAt: string;
  approvedAt: string;
  referenceUrl: string;
  revision: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmProjectDocumentInput {
  title: string;
  category: FarmProjectDocumentCategory;
  isRequired: boolean;
  status: FarmProjectDocumentStatus;
  owner: string;
  currentHandler: string;
  dueDate: string;
  submittedAt: string;
  approvedAt: string;
  referenceUrl: string;
  revision: number;
  note: string;
}

export interface FarmProjectUpdate {
  id: string;
  projectId: string;
  kind: FarmProjectUpdateKind;
  title: string;
  channel: FarmHistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
  resolvedAt: number;
  resolution: string;
  resolvedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmProjectUpdateInput {
  kind: Exclude<FarmProjectUpdateKind, 'system'>;
  title: string;
  channel: FarmHistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
}

export interface Farm {
  id: string;
  farmCode: string;
  name: string;
  phone: string;
  address: string;
  region: string;
  businessNumber: string;
  folderUrl: string;
  locationUrl: string;
  locationImageIds?: string[];
  specialNotes: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmInput {
  farmCode: string;
  name: string;
  phone: string;
  address: string;
  region: string;
  businessNumber: string;
  folderUrl: string;
  locationUrl: string;
  specialNotes: string;
}

export interface FarmRecord {
  id: string;
  farmId: string;
  projectId: string;
  crop: string;
  deviceType: string;
  productType: string;
  vendor: string;
  productionSetupDate: string;
  installationDate: string;
  commissioningDate: string;
  educationDate: string;
  /** Verified completion without inventing the original completion dates. */
  stageCompletionConfirmed?: {
    installationDate?: boolean;
    commissioningDate?: boolean;
    educationDate?: boolean;
    confirmedAt: number;
    source: string;
  };
  internetType: string;
  warrantyYears: number;
  warrantyExpiresAt: string;
  subscriptionYears: number;
  initialSubscriptionExpiresAt: string;
  currentSubscriptionExpiresAt: string;
  lastPaymentDate: string;
  renewalCount: number;
  /** Verified paid renewal count, initialized from saved payment entries. */
  subscriptionPaymentCount?: number;
  subscriptionStatus: SubscriptionStatus;
  notes: string;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface FarmRecordInput {
  projectId: string;
  crop: string;
  deviceType: string;
  productType: string;
  vendor: string;
  productionSetupDate: string;
  installationDate: string;
  commissioningDate: string;
  educationDate: string;
  internetType: string;
  warrantyYears: number;
  warrantyExpiresAt: string;
  subscriptionYears: number;
  initialSubscriptionExpiresAt: string;
  currentSubscriptionExpiresAt: string;
  lastPaymentDate: string;
  renewalCount: number;
  subscriptionStatus: SubscriptionStatus;
  notes: string;
}

export interface FarmSubscriptionEvent {
  id: string;
  farmRecordId: string;
  projectId: string;
  eventType: FarmSubscriptionEventType;
  basisExpiryDate: string;
  /** Renewals completed before this expiry cycle; absent legacy values are unknown. */
  basisRenewalCount?: number | null;
  basisPaymentCount?: number | null;
  paymentOrdinal?: number;
  /** Automatic renewal linked to exactly one saved payment. */
  paymentHistoryEntryId?: string;
  paymentAmount?: number;
  yearsAdded?: number;
  paymentPolicy?: string;
  supersedesEventIds?: string[];
  processedAt: string;
  newExpiryDate: string;
  recorder: string;
  note: string;
  createdAt: number;
}

export interface FarmSubscriptionEventInput {
  farmRecordId: string;
  expectedCurrentExpiryDate: string;
  expectedUpdatedAt: number;
  eventType: FarmSubscriptionEventType;
  basisExpiryDate: string;
  /** Optional verified count for historical backfills; current cycles are snapshotted in the transaction. */
  basisRenewalCount?: number | null;
  processedAt: string;
  newExpiryDate: string;
  recorder: string;
  note: string;
}

export interface FarmSubscriptionExpiryCorrectionInput {
  farmRecordId: string;
  expectedCurrentExpiryDate: string;
  expectedUpdatedAt: number;
  expiryDate: string;
  recorder: string;
  note: string;
}

export interface FarmWorkItem {
  id: string;
  createdByUid?: string;
  deletedAt?: number;
  deletedByUid?: string;
  workLifecycleEntryId?: string;
  scope?: 'internal';
  assigneeUid?: string;
  assignedByUid?: string;
  departmentId?: string;
  headAssigned?: boolean;
  assignedAt?: number;
  /** Provenance for records imported from the original management ledger. */
  migrationRunId?: string;
  sourceFingerprint?: string;
  parentWorkItemId?: string;
  childWorkItemIds?: string[];
  openChildCount?: number;
  lastChildMutationId?: string;
  /** Direct project task; legacy farm work continues to resolve via farmRecordId. */
  projectId?: string;
  farmRecordId: string;
  /** Resolved from farm_records at read time; it is not duplicated in farm_work_items. */
  farmId: string;
  workType: FarmWorkType;
  title: string;
  status: FarmWorkStatus;
  owner: string;
  dueDate: string;
  description: string;
  expectedOutcome: string;
  nextAction: string;
  priority: FarmWorkPriority;
  reviewDate: string;
  responseDueAt: number;
  respondedAt: number;
  blockedAt: number;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
  completedAt: number;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface FarmWorkItemInput {
  scope?: 'internal';
  assigneeUid?: string;
  projectId?: string;
  parentWorkItemId?: string;
  farmRecordId: string;
  workType: FarmWorkType;
  title: string;
  status: FarmWorkStatus;
  owner: string;
  dueDate: string;
  description: string;
  expectedOutcome: string;
  nextAction: string;
  priority: FarmWorkPriority;
  reviewDate: string;
  responseDueAt: number;
  blockedReason: string;
  blockedBy: string;
  expectedUnblockDate: string;
}

export interface FarmWorkVisit {
  id: string;
  workItemId: string;
  scheduledAt: number;
  assignedTo: string;
  status: FarmVisitStatus;
  actualStartedAt: number;
  actualEndedAt: number;
  preparationNote: string;
  result: string;
  nextVisitAt: number;
  recordedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmWorkVisitInput {
  id?: string;
  workItemId: string;
  scheduledAt: number;
  assignedTo: string;
  status: FarmVisitStatus;
  actualStartedAt: number;
  actualEndedAt: number;
  preparationNote: string;
  result: string;
  nextVisitAt: number;
  recordedBy: string;
}

export interface FarmBlockerEpisode {
  id: string;
  workItemId: string;
  reason: string;
  blockedBy: string;
  expectedUnblockDate: string;
  openedAt: number;
  closedAt: number;
  resolution: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmWorkChecklistItem {
  id: string;
  workItemId: string;
  content: string;
  isCompleted: boolean;
  sortOrder: number;
  completedBy: string;
  completedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface FarmInboxItem {
  id: string;
  projectId?: string;
  imageIds?: string[];
  channel: FarmHistoryChannel;
  sender: string;
  content: string;
  capturedBy: string;
  receivedAt: number;
  referenceUrl: string;
  status: FarmInboxStatus;
  convertedWorkItemId: string;
  createdAt: number;
  updatedAt: number;
}

export interface FarmInboxItemInput {
  projectId?: string;
  taskTitle?: string;
  operationId?: string;
  channel: FarmHistoryChannel;
  sender: string;
  content: string;
  capturedBy: string;
  receivedAt: number;
  referenceUrl: string;
}

export interface FarmHistoryEntry {
  id: string;
  workLifecycleAction?: 'delete' | 'restore';
  workRequestFingerprint?: string;
  previousWorkStatus?: FarmWorkStatus;
  newWorkStatus?: FarmWorkStatus;
  imageIds?: string[];
  workItemId: string;
  channel: FarmHistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  amount: number;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
  createdAt: number;
  paymentRequestFingerprint?: string;
  subscriptionEventId?: string;
  subscriptionPreviousExpiryDate?: string;
  subscriptionNewExpiryDate?: string;
  subscriptionYearsAdded?: number;
  subscriptionPaymentOrdinal?: number;
}

export interface FarmHistoryEntryInput {
  workItemId: string;
  channel: FarmHistoryChannel;
  sender: string;
  receivedContent: string;
  actionContent: string;
  amount: number;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
}

export interface AddFarmHistoryEntryInput extends FarmHistoryEntryInput {
  expectedUpdatedAt?: number;
  operationId?: string;
  /** Command-only field; it updates the work item and is not persisted in history. */
  newStatus?: FarmWorkStatus;
  /** Command-only GTD planning fields; they update the current work item. */
  nextAction?: string;
  reviewDate?: string;
  priority?: FarmWorkPriority;
  owner?: string;
  dueDate?: string;
  expectedOutcome?: string;
  responseDueAt?: number;
  markResponded?: boolean;
  blockedReason?: string;
  blockedBy?: string;
  expectedUnblockDate?: string;
}

export type FarmInitialHistoryEntryInput = Omit<
  FarmHistoryEntryInput,
  'workItemId'
>;

export interface FarmWorkItemMutationResult {
  workItem: FarmWorkItem;
  historyEntry: FarmHistoryEntry;
}

export interface FarmRecordMutationResult {
  record: FarmRecord;
  workItem: FarmWorkItem;
  historyEntry: FarmHistoryEntry;
}

export interface FarmCreationResult extends FarmRecordMutationResult {
  farm: Farm;
}

export interface FarmLedgerWorkspace {
  projects: FarmProject[];
  projectDocuments: FarmProjectDocument[];
  projectUpdates: FarmProjectUpdate[];
  farms: Farm[];
  records: FarmRecord[];
  subscriptionEvents: FarmSubscriptionEvent[];
  inboxItems: FarmInboxItem[];
  workItems: FarmWorkItem[];
  blockerEpisodes: FarmBlockerEpisode[];
  visits: FarmWorkVisit[];
  checklistItems: FarmWorkChecklistItem[];
  historyEntries: FarmHistoryEntry[];
}
