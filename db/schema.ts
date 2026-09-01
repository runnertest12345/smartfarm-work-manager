import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type {
  HistoryChannel,
  ProjectStatus,
  WorkPriority,
  WorkStatus,
} from '../lib/business-types';
import type { TaskPriority, TaskStatus } from '../lib/task-types';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  client: text('client').notNull(),
  manager: text('manager').notNull(),
  status: text('status').$type<ProjectStatus>().notNull(),
  description: text('description').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const workItems = sqliteTable(
  'work_items',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category').notNull(),
    status: text('status').$type<WorkStatus>().notNull(),
    priority: text('priority').$type<WorkPriority>().notNull(),
    owner: text('owner').notNull(),
    dueDate: text('due_date').notNull(),
    description: text('description').notNull().default(''),
    lastActivityAt: integer('last_activity_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_work_items_project_activity').on(table.projectId, table.lastActivityAt),
  ],
);

export const historyEntries = sqliteTable(
  'history_entries',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<HistoryChannel>().notNull(),
    sourceSender: text('source_sender').notNull().default(''),
    receivedContent: text('received_content').notNull().default(''),
    actionContent: text('action_content').notNull().default(''),
    recorder: text('recorder').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    referenceUrl: text('reference_url').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_history_work_item_occurred').on(table.workItemId, table.occurredAt),
  ],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').$type<TaskStatus>().notNull(),
    priority: text('priority').$type<TaskPriority>().notNull(),
    assignee: text('assignee').notNull(),
    dueDate: text('due_date').notNull(),
    category: text('category').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_tasks_due_created').on(table.dueDate, table.createdAt)],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
