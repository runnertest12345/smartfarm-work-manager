export const PROJECT_STATUSES = ['active', 'on_hold', 'completed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WORK_STATUSES = ['received', 'in_progress', 'waiting', 'completed'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_PRIORITIES = ['high', 'medium', 'low'] as const;
export type WorkPriority = (typeof WORK_PRIORITIES)[number];

export const HISTORY_CHANNELS = ['email', 'kakao', 'verbal', 'phone', 'meeting', 'other'] as const;
export type HistoryChannel = (typeof HISTORY_CHANNELS)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: '진행 중',
  on_hold: '보류',
  completed: '완료',
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  received: '접수',
  in_progress: '진행 중',
  waiting: '회신 대기',
  completed: '완료',
};

export const WORK_PRIORITY_LABELS: Record<WorkPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export const HISTORY_CHANNEL_LABELS: Record<HistoryChannel, string> = {
  email: '메일',
  kakao: '카톡',
  verbal: '구두',
  phone: '전화',
  meeting: '회의',
  other: '기타',
};

export interface Project {
  id: string;
  name: string;
  client: string;
  manager: string;
  status: ProjectStatus;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectInput {
  name: string;
  client: string;
  manager: string;
  status: ProjectStatus;
  description: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  title: string;
  category: string;
  status: WorkStatus;
  priority: WorkPriority;
  owner: string;
  dueDate: string;
  description: string;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkItemInput {
  projectId: string;
  title: string;
  category: string;
  status: WorkStatus;
  priority: WorkPriority;
  owner: string;
  dueDate: string;
  description: string;
}

export interface HistoryEntry {
  id: string;
  workItemId: string;
  channel: HistoryChannel;
  sourceSender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
  createdAt: number;
}

export interface HistoryEntryInput {
  workItemId: string;
  channel: HistoryChannel;
  sourceSender: string;
  receivedContent: string;
  actionContent: string;
  recorder: string;
  occurredAt: number;
  referenceUrl: string;
  newStatus?: WorkStatus;
}

export interface BusinessWorkspace {
  projects: Project[];
  workItems: WorkItem[];
  historyEntries: HistoryEntry[];
}
