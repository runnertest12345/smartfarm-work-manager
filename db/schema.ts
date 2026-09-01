import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { TaskPriority, TaskStatus } from '../lib/task-types';

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
