export const TASK_STATUSES = [
  'planned',
  'in_progress',
  'review',
  'completed',
] as const;

export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  dueDate: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  planned: '예정',
  in_progress: '진행 중',
  review: '검토 대기',
  completed: '완료',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};
