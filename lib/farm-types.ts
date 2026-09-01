export const FARM_PROJECT_TYPES = ['general', 'research'] as const;
export type FarmProjectType = (typeof FARM_PROJECT_TYPES)[number];

export const FARM_PROJECT_STATUSES = [
  'active',
  'completed',
  'on_hold',
] as const;
export type FarmProjectStatus = (typeof FARM_PROJECT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'expired',
  'unregistered',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

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
  waiting: '회신 대기',
  completed: '완료',
};

export const FARM_WORK_PRIORITY_LABELS: Record<FarmWorkPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
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

export interface FarmProject {
  id: string;
  name: string;
  projectType: FarmProjectType;
  year: number;
  institution: string;
  status: FarmProjectStatus;
  description: string;
  targetFarmCount: number;
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

export interface FarmWorkItem {
  id: string;
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
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface FarmWorkItemInput {
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
  channel: FarmHistoryChannel;
  sender: string;
  content: string;
  capturedBy: string;
  receivedAt: number;
  referenceUrl: string;
}

export interface FarmHistoryEntry {
  id: string;
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
  /** Command-only field; it updates the work item and is not persisted in history. */
  newStatus?: FarmWorkStatus;
  /** Command-only GTD planning fields; they update the current work item. */
  nextAction?: string;
  reviewDate?: string;
  priority?: FarmWorkPriority;
  owner?: string;
  dueDate?: string;
  expectedOutcome?: string;
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
  farms: Farm[];
  records: FarmRecord[];
  inboxItems: FarmInboxItem[];
  workItems: FarmWorkItem[];
  checklistItems: FarmWorkChecklistItem[];
  historyEntries: FarmHistoryEntry[];
}
