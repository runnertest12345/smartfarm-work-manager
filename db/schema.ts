import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type {
  HistoryChannel,
  ProjectStatus,
  WorkPriority,
  WorkStatus,
} from '../lib/business-types';
import type {
  FarmHistoryChannel,
  FarmProjectStatus,
  FarmProjectType,
  FarmInboxStatus,
  FarmVisitStatus,
  FarmWorkPriority,
  FarmWorkStatus,
  FarmWorkType,
  SubscriptionStatus,
} from '../lib/farm-types';
import type { TaskPriority, TaskStatus } from '../lib/task-types';

export const smartfarmProjects = sqliteTable(
  'smartfarm_projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectType: text('project_type').$type<FarmProjectType>().notNull(),
    year: integer('year').notNull(),
    institution: text('institution').notNull(),
    status: text('status').$type<FarmProjectStatus>().notNull(),
    description: text('description').notNull().default(''),
    targetFarmCount: integer('target_farm_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_smartfarm_projects_type',
      sql`${table.projectType} IN ('general', 'research')`,
    ),
    check(
      'chk_smartfarm_projects_status',
      sql`${table.status} IN ('active', 'completed', 'on_hold')`,
    ),
    check(
      'chk_smartfarm_projects_year',
      sql`${table.year} BETWEEN 2000 AND 2100`,
    ),
    check(
      'chk_smartfarm_projects_target_count',
      sql`${table.targetFarmCount} BETWEEN 0 AND 100000`,
    ),
    index('idx_smartfarm_projects_status_year').on(table.status, table.year),
  ],
);

export const farms = sqliteTable(
  'farms',
  {
    id: text('id').primaryKey(),
    farmCode: text('farm_code').notNull(),
    name: text('name').notNull(),
    phone: text('phone').notNull().default(''),
    address: text('address').notNull().default(''),
    region: text('region').notNull(),
    businessNumber: text('business_number').notNull().default(''),
    folderUrl: text('folder_url').notNull().default(''),
    locationUrl: text('location_url').notNull().default(''),
    specialNotes: text('special_notes').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_farms_farm_code').on(table.farmCode)],
);

export const farmRecords = sqliteTable(
  'farm_records',
  {
    id: text('id').primaryKey(),
    farmId: text('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => smartfarmProjects.id, { onDelete: 'restrict' }),
    crop: text('crop').notNull().default(''),
    deviceType: text('device_type').notNull().default(''),
    productType: text('product_type').notNull().default(''),
    vendor: text('vendor').notNull().default(''),
    productionSetupDate: text('production_setup_date').notNull().default(''),
    installationDate: text('installation_date').notNull().default(''),
    commissioningDate: text('commissioning_date').notNull().default(''),
    educationDate: text('education_date').notNull().default(''),
    internetType: text('internet_type').notNull().default(''),
    warrantyYears: integer('warranty_years').notNull().default(1),
    warrantyExpiresAt: text('warranty_expires_at').notNull().default(''),
    subscriptionYears: integer('subscription_years').notNull().default(1),
    initialSubscriptionExpiresAt: text('initial_subscription_expires_at')
      .notNull()
      .default(''),
    currentSubscriptionExpiresAt: text('current_subscription_expires_at')
      .notNull()
      .default(''),
    lastPaymentDate: text('last_payment_date').notNull().default(''),
    renewalCount: integer('renewal_count').notNull().default(0),
    subscriptionStatus: text('subscription_status')
      .$type<SubscriptionStatus>()
      .notNull(),
    notes: text('notes').notNull().default(''),
    lastActivityAt: integer('last_activity_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_records_warranty_years',
      sql`${table.warrantyYears} BETWEEN 0 AND 20`,
    ),
    check(
      'chk_farm_records_subscription_years',
      sql`${table.subscriptionYears} BETWEEN 0 AND 20`,
    ),
    check(
      'chk_farm_records_renewal_count',
      sql`${table.renewalCount} BETWEEN 0 AND 100`,
    ),
    check(
      'chk_farm_records_subscription_status',
      sql`${table.subscriptionStatus} IN ('active', 'expired', 'unregistered')`,
    ),
    index('idx_farm_records_farm_project').on(table.farmId, table.projectId),
    index('idx_farm_records_project_farm').on(table.projectId, table.farmId),
    index('idx_farm_records_subscription_expiry').on(
      table.subscriptionStatus,
      table.currentSubscriptionExpiresAt,
    ),
    index('idx_farm_records_last_activity').on(table.lastActivityAt),
  ],
);

export const farmWorkItems = sqliteTable(
  'farm_work_items',
  {
    id: text('id').primaryKey(),
    farmRecordId: text('farm_record_id')
      .notNull()
      .references(() => farmRecords.id, { onDelete: 'cascade' }),
    workType: text('work_type').$type<FarmWorkType>().notNull(),
    title: text('title').notNull(),
    status: text('status').$type<FarmWorkStatus>().notNull(),
    owner: text('owner').notNull(),
    dueDate: text('due_date').notNull().default(''),
    description: text('description').notNull().default(''),
    expectedOutcome: text('expected_outcome').notNull().default(''),
    nextAction: text('next_action').notNull().default(''),
    priority: text('priority')
      .$type<FarmWorkPriority>()
      .notNull()
      .default('medium'),
    reviewDate: text('review_date').notNull().default(''),
    responseDueAt: integer('response_due_at').notNull().default(0),
    respondedAt: integer('responded_at').notNull().default(0),
    blockedAt: integer('blocked_at').notNull().default(0),
    blockedReason: text('blocked_reason').notNull().default(''),
    blockedBy: text('blocked_by').notNull().default(''),
    expectedUnblockDate: text('expected_unblock_date').notNull().default(''),
    completedAt: integer('completed_at').notNull().default(0),
    lastActivityAt: integer('last_activity_at').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_work_items_type',
      sql`${table.workType} IN ('communication', 'installation', 'subscription', 'payment', 'service', 'note')`,
    ),
    check(
      'chk_farm_work_items_status',
      sql`${table.status} IN ('open', 'in_progress', 'waiting', 'completed')`,
    ),
    check(
      'chk_farm_work_items_priority',
      sql`${table.priority} IN ('high', 'medium', 'low')`,
    ),
    index('idx_farm_work_items_record_activity').on(
      table.farmRecordId,
      table.lastActivityAt,
    ),
    index('idx_farm_work_items_status_due').on(table.status, table.dueDate),
    index('idx_farm_work_items_type_status').on(table.workType, table.status),
    index('idx_farm_work_items_review_priority').on(
      table.status,
      table.reviewDate,
      table.priority,
    ),
    index('idx_farm_work_items_response_risk').on(
      table.status,
      table.respondedAt,
      table.responseDueAt,
    ),
    index('idx_farm_work_items_blocked').on(table.status, table.blockedAt),
  ],
);

export const farmWorkChecklistItems = sqliteTable(
  'farm_work_checklist_items',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => farmWorkItems.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isCompleted: integer('is_completed', { mode: 'boolean' })
      .notNull()
      .default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    completedBy: text('completed_by').notNull().default(''),
    completedAt: integer('completed_at').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_work_checklist_completed',
      sql`${table.isCompleted} IN (0, 1)`,
    ),
    check(
      'chk_farm_work_checklist_sort',
      sql`${table.sortOrder} BETWEEN 0 AND 10000`,
    ),
    index('idx_farm_work_checklist_order').on(
      table.workItemId,
      table.sortOrder,
      table.createdAt,
    ),
  ],
);

export const farmWorkVisits = sqliteTable(
  'farm_work_visits',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => farmWorkItems.id, { onDelete: 'cascade' }),
    scheduledAt: integer('scheduled_at').notNull(),
    assignedTo: text('assigned_to').notNull(),
    status: text('status')
      .$type<FarmVisitStatus>()
      .notNull()
      .default('scheduled'),
    actualStartedAt: integer('actual_started_at').notNull().default(0),
    actualEndedAt: integer('actual_ended_at').notNull().default(0),
    preparationNote: text('preparation_note').notNull().default(''),
    result: text('result').notNull().default(''),
    nextVisitAt: integer('next_visit_at').notNull().default(0),
    recordedBy: text('recorded_by').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_work_visits_status',
      sql`${table.status} IN ('scheduled', 'completed', 'canceled')`,
    ),
    index('idx_farm_work_visits_work_schedule').on(
      table.workItemId,
      table.scheduledAt,
    ),
    index('idx_farm_work_visits_status_schedule').on(
      table.status,
      table.scheduledAt,
    ),
  ],
);

export const farmBlockerEpisodes = sqliteTable(
  'farm_blocker_episodes',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => farmWorkItems.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    blockedBy: text('blocked_by').notNull(),
    expectedUnblockDate: text('expected_unblock_date').notNull().default(''),
    openedAt: integer('opened_at').notNull(),
    closedAt: integer('closed_at').notNull().default(0),
    resolution: text('resolution').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_blocker_episode_times',
      sql`${table.closedAt} = 0 OR ${table.closedAt} >= ${table.openedAt}`,
    ),
    index('idx_farm_blocker_episodes_work_opened').on(
      table.workItemId,
      table.openedAt,
    ),
    index('idx_farm_blocker_episodes_open').on(table.closedAt, table.openedAt),
    uniqueIndex('idx_farm_blocker_episodes_one_open')
      .on(table.workItemId)
      .where(sql`${table.closedAt} = 0`),
  ],
);

export const farmInboxItems = sqliteTable(
  'farm_inbox_items',
  {
    id: text('id').primaryKey(),
    channel: text('channel').$type<FarmHistoryChannel>().notNull(),
    sender: text('sender').notNull().default(''),
    content: text('content').notNull(),
    capturedBy: text('captured_by').notNull(),
    receivedAt: integer('received_at').notNull(),
    referenceUrl: text('reference_url').notNull().default(''),
    status: text('status')
      .$type<FarmInboxStatus>()
      .notNull()
      .default('unprocessed'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_inbox_channel',
      sql`${table.channel} IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')`,
    ),
    check(
      'chk_farm_inbox_status',
      sql`${table.status} IN ('unprocessed', 'converted', 'reference', 'discarded')`,
    ),
    index('idx_farm_inbox_status_received').on(table.status, table.receivedAt),
  ],
);

export const farmInboxConversions = sqliteTable('farm_inbox_conversions', {
  inboxItemId: text('inbox_item_id')
    .primaryKey()
    .references(() => farmInboxItems.id, { onDelete: 'cascade' }),
  workItemId: text('work_item_id')
    .notNull()
    .unique()
    .references(() => farmWorkItems.id, { onDelete: 'restrict' }),
  createdAt: integer('created_at').notNull(),
});

export const farmHistoryEntries = sqliteTable(
  'farm_history_entries',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => farmWorkItems.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<FarmHistoryChannel>().notNull(),
    sender: text('sender').notNull().default(''),
    receivedContent: text('received_content').notNull().default(''),
    actionContent: text('action_content').notNull().default(''),
    amount: integer('amount').notNull().default(0),
    recorder: text('recorder').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    referenceUrl: text('reference_url').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    check(
      'chk_farm_history_entries_channel',
      sql`${table.channel} IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')`,
    ),
    check(
      'chk_farm_history_entries_amount',
      sql`${table.amount} BETWEEN 0 AND 10000000000`,
    ),
    index('idx_farm_history_work_item_occurred').on(
      table.workItemId,
      table.occurredAt,
    ),
    index('idx_farm_history_occurred').on(table.occurredAt),
  ],
);

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
    index('idx_work_items_project_activity').on(
      table.projectId,
      table.lastActivityAt,
    ),
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
    index('idx_history_work_item_occurred').on(
      table.workItemId,
      table.occurredAt,
    ),
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
  (table) => [
    index('idx_tasks_due_created').on(table.dueDate, table.createdAt),
  ],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
