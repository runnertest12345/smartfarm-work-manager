import type {
  AddFarmHistoryEntryInput,
  Farm,
  FarmBlockerEpisode,
  FarmCreationResult,
  FarmHistoryChannel,
  FarmHistoryEntry,
  FarmInboxItem,
  FarmInboxItemInput,
  FarmInboxStatus,
  FarmInitialHistoryEntryInput,
  FarmInput,
  FarmLedgerWorkspace,
  FarmProject,
  FarmProjectDocument,
  FarmProjectDocumentCategory,
  FarmProjectDocumentInput,
  FarmProjectDocumentStatus,
  FarmProjectInput,
  FarmProjectUpdate,
  FarmProjectUpdateInput,
  FarmProjectUpdateKind,
  FarmProjectStatus,
  FarmProjectStage,
  FarmProjectType,
  FarmRecord,
  FarmRecordInput,
  FarmRecordMutationResult,
  FarmVisitStatus,
  FarmSettlementStatus,
  FarmSubscriptionEvent,
  FarmSubscriptionEventInput,
  FarmSubscriptionEventType,
  FarmWorkItem,
  FarmWorkChecklistItem,
  FarmWorkItemInput,
  FarmWorkItemMutationResult,
  FarmWorkVisit,
  FarmWorkVisitInput,
  FarmWorkPriority,
  FarmWorkStatus,
  FarmWorkType,
  SubscriptionStatus,
} from '../lib/farm-types';
import { getD1, type DatabaseClient } from './index';

interface FarmProjectRow {
  id: string;
  name: string;
  project_type: FarmProjectType;
  year: number;
  institution: string;
  status: FarmProjectStatus;
  description: string;
  target_farm_count: number;
  manager: string;
  start_date: string;
  end_date: string;
  current_stage: FarmProjectStage;
  settlement_status: FarmSettlementStatus;
  settlement_due_date: string;
  contract_amount: number;
  settlement_claim_amount: number;
  settlement_approved_amount: number;
  settlement_paid_amount: number;
  settled_at: string;
  settlement_owner: string;
  settlement_evidence_url: string;
  settlement_note: string;
  created_at: number;
  updated_at: number;
}

interface FarmProjectDocumentRow {
  id: string;
  project_id: string;
  title: string;
  category: FarmProjectDocumentCategory;
  is_required: number;
  status: FarmProjectDocumentStatus;
  owner: string;
  current_handler: string;
  due_date: string;
  submitted_at: string;
  approved_at: string;
  reference_url: string;
  revision: number;
  note: string;
  created_at: number;
  updated_at: number;
}

interface FarmProjectUpdateRow {
  id: string;
  project_id: string;
  kind: FarmProjectUpdateKind;
  title: string;
  channel: FarmHistoryChannel;
  sender: string;
  received_content: string;
  action_content: string;
  recorder: string;
  occurred_at: number;
  reference_url: string;
  blocked_reason: string;
  blocked_by: string;
  expected_unblock_date: string;
  resolved_at: number;
  resolution: string;
  resolved_by: string;
  created_at: number;
  updated_at: number;
}

interface FarmRow {
  id: string;
  farm_code: string;
  name: string;
  phone: string;
  address: string;
  region: string;
  business_number: string;
  folder_url: string;
  location_url: string;
  special_notes: string;
  created_at: number;
  updated_at: number;
}

interface FarmRecordRow {
  id: string;
  farm_id: string;
  project_id: string;
  crop: string;
  device_type: string;
  product_type: string;
  vendor: string;
  production_setup_date: string;
  installation_date: string;
  commissioning_date: string;
  education_date: string;
  internet_type: string;
  warranty_years: number;
  warranty_expires_at: string;
  subscription_years: number;
  initial_subscription_expires_at: string;
  current_subscription_expires_at: string;
  last_payment_date: string;
  renewal_count: number;
  subscription_status: SubscriptionStatus;
  notes: string;
  last_activity_at: number;
  created_at: number;
  updated_at: number;
}

interface FarmSubscriptionEventRow {
  id: string;
  farm_record_id: string;
  project_id: string;
  event_type: FarmSubscriptionEventType;
  basis_expiry_date: string;
  processed_at: string;
  new_expiry_date: string;
  recorder: string;
  note: string;
  created_at: number;
}

interface FarmWorkItemRow {
  id: string;
  farm_record_id: string;
  farm_id: string;
  work_type: FarmWorkType;
  title: string;
  status: FarmWorkStatus;
  owner: string;
  due_date: string;
  description: string;
  expected_outcome: string;
  next_action: string;
  priority: FarmWorkPriority;
  review_date: string;
  response_due_at: number;
  responded_at: number;
  blocked_at: number;
  blocked_reason: string;
  blocked_by: string;
  expected_unblock_date: string;
  completed_at: number;
  last_activity_at: number;
  created_at: number;
  updated_at: number;
}

interface FarmWorkVisitRow {
  id: string;
  work_item_id: string;
  scheduled_at: number;
  assigned_to: string;
  status: FarmVisitStatus;
  actual_started_at: number;
  actual_ended_at: number;
  preparation_note: string;
  result: string;
  next_visit_at: number;
  recorded_by: string;
  created_at: number;
  updated_at: number;
}

interface FarmBlockerEpisodeRow {
  id: string;
  work_item_id: string;
  reason: string;
  blocked_by: string;
  expected_unblock_date: string;
  opened_at: number;
  closed_at: number;
  resolution: string;
  created_at: number;
  updated_at: number;
}

interface FarmWorkChecklistItemRow {
  id: string;
  work_item_id: string;
  content: string;
  is_completed: number;
  sort_order: number;
  completed_by: string;
  completed_at: number;
  created_at: number;
  updated_at: number;
}

interface FarmInboxItemRow {
  id: string;
  channel: FarmHistoryChannel;
  sender: string;
  content: string;
  captured_by: string;
  received_at: number;
  reference_url: string;
  status: FarmInboxStatus;
  converted_work_item_id: string;
  created_at: number;
  updated_at: number;
}

interface FarmHistoryEntryRow {
  id: string;
  work_item_id: string;
  channel: FarmHistoryChannel;
  sender: string;
  received_content: string;
  action_content: string;
  amount: number;
  recorder: string;
  occurred_at: number;
  reference_url: string;
  created_at: number;
}

let initialization: Promise<void> | null = null;

function dateFromToday(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dateFromNowMonths(months: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function mapProject(row: FarmProjectRow): FarmProject {
  return {
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    year: row.year,
    institution: row.institution,
    status: row.status,
    description: row.description,
    targetFarmCount: row.target_farm_count,
    manager: row.manager ?? '',
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    currentStage: row.current_stage ?? 'agreement',
    settlementStatus: row.settlement_status ?? 'not_started',
    settlementDueDate: row.settlement_due_date ?? '',
    contractAmount: row.contract_amount ?? 0,
    settlementClaimAmount: row.settlement_claim_amount ?? 0,
    settlementApprovedAmount: row.settlement_approved_amount ?? 0,
    settlementPaidAmount: row.settlement_paid_amount ?? 0,
    settledAt: row.settled_at ?? '',
    settlementOwner: row.settlement_owner ?? '',
    settlementEvidenceUrl: row.settlement_evidence_url ?? '',
    settlementNote: row.settlement_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectDocument(row: FarmProjectDocumentRow): FarmProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    category: row.category,
    isRequired: Boolean(row.is_required),
    status: row.status,
    owner: row.owner,
    currentHandler: row.current_handler,
    dueDate: row.due_date,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    referenceUrl: row.reference_url,
    revision: row.revision,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectUpdate(row: FarmProjectUpdateRow): FarmProjectUpdate {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    title: row.title,
    channel: row.channel,
    sender: row.sender,
    receivedContent: row.received_content,
    actionContent: row.action_content,
    recorder: row.recorder,
    occurredAt: row.occurred_at,
    referenceUrl: row.reference_url,
    blockedReason: row.blocked_reason,
    blockedBy: row.blocked_by,
    expectedUnblockDate: row.expected_unblock_date,
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function systemProjectUpdate(
  projectId: string,
  title: string,
  actionContent: string,
  recorder: string,
  occurredAt: number,
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

function insertProjectUpdateStatement(
  db: DatabaseClient,
  update: FarmProjectUpdate,
) {
  return db
    .prepare(`
      INSERT INTO farm_project_updates (
        id, project_id, kind, title, channel, sender, received_content,
        action_content, recorder, occurred_at, reference_url, blocked_reason,
        blocked_by, expected_unblock_date, resolved_at, resolution,
        resolved_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      update.id,
      update.projectId,
      update.kind,
      update.title,
      update.channel,
      update.sender,
      update.receivedContent,
      update.actionContent,
      update.recorder,
      update.occurredAt,
      update.referenceUrl,
      update.blockedReason,
      update.blockedBy,
      update.expectedUnblockDate,
      update.resolvedAt,
      update.resolution,
      update.resolvedBy,
      update.createdAt,
      update.updatedAt,
    );
}

function mapFarm(row: FarmRow): Farm {
  return {
    id: row.id,
    farmCode: row.farm_code,
    name: row.name,
    phone: row.phone,
    address: row.address,
    region: row.region,
    businessNumber: row.business_number,
    folderUrl: row.folder_url,
    locationUrl: row.location_url,
    specialNotes: row.special_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRecord(row: FarmRecordRow): FarmRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    projectId: row.project_id,
    crop: row.crop,
    deviceType: row.device_type,
    productType: row.product_type,
    vendor: row.vendor,
    productionSetupDate: row.production_setup_date,
    installationDate: row.installation_date,
    commissioningDate: row.commissioning_date,
    educationDate: row.education_date,
    internetType: row.internet_type,
    warrantyYears: row.warranty_years,
    warrantyExpiresAt: row.warranty_expires_at,
    subscriptionYears: row.subscription_years,
    initialSubscriptionExpiresAt: row.initial_subscription_expires_at,
    currentSubscriptionExpiresAt: row.current_subscription_expires_at,
    lastPaymentDate: row.last_payment_date,
    renewalCount: row.renewal_count,
    subscriptionStatus: row.subscription_status,
    notes: row.notes,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscriptionEvent(
  row: FarmSubscriptionEventRow,
): FarmSubscriptionEvent {
  return {
    id: row.id,
    farmRecordId: row.farm_record_id,
    projectId: row.project_id,
    eventType: row.event_type,
    basisExpiryDate: row.basis_expiry_date,
    processedAt: row.processed_at,
    newExpiryDate: row.new_expiry_date,
    recorder: row.recorder,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapWorkItem(row: FarmWorkItemRow): FarmWorkItem {
  return {
    id: row.id,
    farmRecordId: row.farm_record_id,
    farmId: row.farm_id,
    workType: row.work_type,
    title: row.title,
    status: row.status,
    owner: row.owner,
    dueDate: row.due_date,
    description: row.description,
    expectedOutcome: row.expected_outcome,
    nextAction: row.next_action,
    priority: row.priority,
    reviewDate: row.review_date,
    responseDueAt: row.response_due_at ?? 0,
    respondedAt: row.responded_at ?? 0,
    blockedAt: row.blocked_at ?? 0,
    blockedReason: row.blocked_reason ?? '',
    blockedBy: row.blocked_by ?? '',
    expectedUnblockDate: row.expected_unblock_date ?? '',
    completedAt: row.completed_at ?? 0,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVisit(row: FarmWorkVisitRow): FarmWorkVisit {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    scheduledAt: row.scheduled_at,
    assignedTo: row.assigned_to,
    status: row.status,
    actualStartedAt: row.actual_started_at,
    actualEndedAt: row.actual_ended_at,
    preparationNote: row.preparation_note ?? '',
    result: row.result,
    nextVisitAt: row.next_visit_at,
    recordedBy: row.recorded_by ?? row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBlockerEpisode(row: FarmBlockerEpisodeRow): FarmBlockerEpisode {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    reason: row.reason,
    blockedBy: row.blocked_by,
    expectedUnblockDate: row.expected_unblock_date,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChecklistItem(
  row: FarmWorkChecklistItemRow,
): FarmWorkChecklistItem {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    content: row.content,
    isCompleted: Boolean(row.is_completed),
    sortOrder: row.sort_order,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInboxItem(row: FarmInboxItemRow): FarmInboxItem {
  return {
    id: row.id,
    channel: row.channel,
    sender: row.sender,
    content: row.content,
    capturedBy: row.captured_by,
    receivedAt: row.received_at,
    referenceUrl: row.reference_url,
    status: row.status,
    convertedWorkItemId: row.converted_work_item_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistoryEntry(row: FarmHistoryEntryRow): FarmHistoryEntry {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    channel: row.channel,
    sender: row.sender,
    receivedContent: row.received_content,
    actionContent: row.action_content,
    amount: row.amount,
    recorder: row.recorder,
    occurredAt: row.occurred_at,
    referenceUrl: row.reference_url,
    createdAt: row.created_at,
  };
}

function auditArtifacts(
  farmId: string,
  farmRecordId: string,
  owner: string,
  title: string,
  actionContent: string,
  occurredAt: number,
): FarmWorkItemMutationResult {
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

async function initializeFarmLedgerStore() {
  const db = getD1();

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS smartfarm_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_type TEXT NOT NULL CONSTRAINT chk_smartfarm_projects_type
          CHECK (project_type IN ('general', 'research')),
        year INTEGER NOT NULL CONSTRAINT chk_smartfarm_projects_year
          CHECK (year BETWEEN 2000 AND 2100),
        institution TEXT NOT NULL,
        status TEXT NOT NULL CONSTRAINT chk_smartfarm_projects_status
          CHECK (status IN ('active', 'completed', 'on_hold')),
        description TEXT NOT NULL DEFAULT '',
        target_farm_count INTEGER NOT NULL DEFAULT 0
          CONSTRAINT chk_smartfarm_projects_target_count CHECK (target_farm_count BETWEEN 0 AND 100000),
        manager TEXT NOT NULL DEFAULT '',
        start_date TEXT NOT NULL DEFAULT '',
        end_date TEXT NOT NULL DEFAULT '',
        current_stage TEXT NOT NULL DEFAULT 'agreement'
          CONSTRAINT chk_smartfarm_projects_stage
          CHECK (current_stage IN ('agreement', 'farm_selection', 'installation', 'verification', 'operation', 'settlement', 'closed')),
        settlement_status TEXT NOT NULL DEFAULT 'not_started'
          CONSTRAINT chk_smartfarm_projects_settlement_status
          CHECK (settlement_status IN ('not_started', 'collecting', 'submitted', 'revision', 'approved', 'paid', 'closed')),
        settlement_due_date TEXT NOT NULL DEFAULT '',
        contract_amount INTEGER NOT NULL DEFAULT 0,
        settlement_claim_amount INTEGER NOT NULL DEFAULT 0,
        settlement_approved_amount INTEGER NOT NULL DEFAULT 0,
        settlement_paid_amount INTEGER NOT NULL DEFAULT 0,
        settled_at TEXT NOT NULL DEFAULT '',
        settlement_owner TEXT NOT NULL DEFAULT '',
        settlement_evidence_url TEXT NOT NULL DEFAULT '',
        settlement_note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CONSTRAINT chk_smartfarm_projects_amounts CHECK (
          contract_amount BETWEEN 0 AND 100000000000 AND
          settlement_claim_amount BETWEEN 0 AND 100000000000 AND
          settlement_approved_amount BETWEEN 0 AND 100000000000 AND
          settlement_paid_amount BETWEEN 0 AND 100000000000 AND
          settlement_paid_amount <= settlement_approved_amount
        )
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_project_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES smartfarm_projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL CONSTRAINT chk_farm_project_documents_category
          CHECK (category IN ('agreement', 'farm', 'installation', 'inspection', 'settlement', 'other')),
        is_required INTEGER NOT NULL DEFAULT 1
          CONSTRAINT chk_farm_project_documents_required CHECK (is_required IN (0, 1)),
        status TEXT NOT NULL DEFAULT 'not_started'
          CONSTRAINT chk_farm_project_documents_status
          CHECK (status IN ('not_started', 'preparing', 'submitted', 'reviewing', 'revision', 'approved', 'rejected')),
        owner TEXT NOT NULL DEFAULT '',
        current_handler TEXT NOT NULL DEFAULT '',
        due_date TEXT NOT NULL DEFAULT '',
        submitted_at TEXT NOT NULL DEFAULT '',
        approved_at TEXT NOT NULL DEFAULT '',
        reference_url TEXT NOT NULL DEFAULT '',
        revision INTEGER NOT NULL DEFAULT 1
          CONSTRAINT chk_farm_project_documents_revision CHECK (revision BETWEEN 1 AND 1000),
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_project_updates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES smartfarm_projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CONSTRAINT chk_farm_project_updates_kind
          CHECK (kind IN ('communication', 'decision', 'blocker', 'system')),
        title TEXT NOT NULL,
        channel TEXT NOT NULL CONSTRAINT chk_farm_project_updates_channel
          CHECK (channel IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
        sender TEXT NOT NULL DEFAULT '',
        received_content TEXT NOT NULL DEFAULT '',
        action_content TEXT NOT NULL DEFAULT '',
        recorder TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        reference_url TEXT NOT NULL DEFAULT '',
        blocked_reason TEXT NOT NULL DEFAULT '',
        blocked_by TEXT NOT NULL DEFAULT '',
        expected_unblock_date TEXT NOT NULL DEFAULT '',
        resolved_at INTEGER NOT NULL DEFAULT 0,
        resolution TEXT NOT NULL DEFAULT '',
        resolved_by TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CONSTRAINT chk_farm_project_updates_resolution CHECK (
          resolved_at = 0 OR (
            kind = 'blocker' AND resolved_at >= occurred_at AND
            trim(resolution) != '' AND trim(resolved_by) != ''
          )
        )
      )
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_amounts_insert
      BEFORE INSERT ON smartfarm_projects
      FOR EACH ROW
      WHEN NEW.settlement_paid_amount > NEW.settlement_approved_amount
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_SETTLEMENT_AMOUNTS_INVALID');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_amounts_update
      BEFORE UPDATE OF settlement_approved_amount, settlement_paid_amount
      ON smartfarm_projects
      FOR EACH ROW
      WHEN NEW.settlement_paid_amount > NEW.settlement_approved_amount
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_SETTLEMENT_AMOUNTS_INVALID');
      END
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farms (
        id TEXT PRIMARY KEY,
        farm_code TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL,
        business_number TEXT NOT NULL DEFAULT '',
        folder_url TEXT NOT NULL DEFAULT '',
        location_url TEXT NOT NULL DEFAULT '',
        special_notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_records (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES smartfarm_projects(id) ON DELETE RESTRICT,
        crop TEXT NOT NULL DEFAULT '',
        device_type TEXT NOT NULL DEFAULT '',
        product_type TEXT NOT NULL DEFAULT '',
        vendor TEXT NOT NULL DEFAULT '',
        production_setup_date TEXT NOT NULL DEFAULT '',
        installation_date TEXT NOT NULL DEFAULT '',
        commissioning_date TEXT NOT NULL DEFAULT '',
        education_date TEXT NOT NULL DEFAULT '',
        internet_type TEXT NOT NULL DEFAULT '',
        warranty_years INTEGER NOT NULL DEFAULT 1
          CONSTRAINT chk_farm_records_warranty_years CHECK (warranty_years BETWEEN 0 AND 20),
        warranty_expires_at TEXT NOT NULL DEFAULT '',
        subscription_years INTEGER NOT NULL DEFAULT 1
          CONSTRAINT chk_farm_records_subscription_years CHECK (subscription_years BETWEEN 0 AND 20),
        initial_subscription_expires_at TEXT NOT NULL DEFAULT '',
        current_subscription_expires_at TEXT NOT NULL DEFAULT '',
        last_payment_date TEXT NOT NULL DEFAULT '',
        renewal_count INTEGER NOT NULL DEFAULT 0
          CONSTRAINT chk_farm_records_renewal_count CHECK (renewal_count BETWEEN 0 AND 100),
        subscription_status TEXT NOT NULL CONSTRAINT chk_farm_records_subscription_status
          CHECK (subscription_status IN ('active', 'expired', 'unregistered')),
        notes TEXT NOT NULL DEFAULT '',
        last_activity_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_records_project_unique_insert
      BEFORE INSERT ON farm_records
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM farm_records
        WHERE farm_id = NEW.farm_id AND project_id = NEW.project_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_RECORD_PROJECT_EXISTS');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_records_project_unique_update
      BEFORE UPDATE OF farm_id, project_id ON farm_records
      FOR EACH ROW
      WHEN (NEW.farm_id != OLD.farm_id OR NEW.project_id != OLD.project_id)
      AND EXISTS (
        SELECT 1 FROM farm_records
        WHERE farm_id = NEW.farm_id AND project_id = NEW.project_id AND id != OLD.id
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_RECORD_PROJECT_EXISTS');
      END
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_work_items (
        id TEXT PRIMARY KEY,
        farm_record_id TEXT NOT NULL REFERENCES farm_records(id) ON DELETE CASCADE,
        work_type TEXT NOT NULL CONSTRAINT chk_farm_work_items_type
          CHECK (work_type IN ('communication', 'installation', 'subscription', 'payment', 'service', 'note')),
        title TEXT NOT NULL,
        status TEXT NOT NULL CONSTRAINT chk_farm_work_items_status
          CHECK (status IN ('open', 'in_progress', 'waiting', 'completed')),
        owner TEXT NOT NULL,
        due_date TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        expected_outcome TEXT NOT NULL DEFAULT '',
        next_action TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium' CONSTRAINT chk_farm_work_items_priority
          CHECK (priority IN ('high', 'medium', 'low')),
        review_date TEXT NOT NULL DEFAULT '',
        response_due_at INTEGER NOT NULL DEFAULT 0,
        responded_at INTEGER NOT NULL DEFAULT 0,
        blocked_at INTEGER NOT NULL DEFAULT 0,
        blocked_reason TEXT NOT NULL DEFAULT '',
        blocked_by TEXT NOT NULL DEFAULT '',
        expected_unblock_date TEXT NOT NULL DEFAULT '',
        completed_at INTEGER NOT NULL DEFAULT 0,
        last_activity_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_work_visits (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES farm_work_items(id) ON DELETE CASCADE,
        scheduled_at INTEGER NOT NULL,
        assigned_to TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled' CONSTRAINT chk_farm_work_visits_status
          CHECK (status IN ('scheduled', 'completed', 'canceled')),
        actual_started_at INTEGER NOT NULL DEFAULT 0,
        actual_ended_at INTEGER NOT NULL DEFAULT 0,
        preparation_note TEXT NOT NULL DEFAULT '',
        result TEXT NOT NULL DEFAULT '',
        next_visit_at INTEGER NOT NULL DEFAULT 0,
        recorded_by TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_blocker_episodes (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES farm_work_items(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        blocked_by TEXT NOT NULL,
        expected_unblock_date TEXT NOT NULL DEFAULT '',
        opened_at INTEGER NOT NULL,
        closed_at INTEGER NOT NULL DEFAULT 0,
        resolution TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CONSTRAINT chk_farm_blocker_episode_times
          CHECK (closed_at = 0 OR closed_at >= opened_at)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_work_checklist_items (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES farm_work_items(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_farm_work_checklist_completed
          CHECK (is_completed IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_farm_work_checklist_sort
          CHECK (sort_order BETWEEN 0 AND 10000),
        completed_by TEXT NOT NULL DEFAULT '',
        completed_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_inbox_items (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL CONSTRAINT chk_farm_inbox_channel
          CHECK (channel IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
        sender TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        captured_by TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        reference_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'unprocessed' CONSTRAINT chk_farm_inbox_status
          CHECK (status IN ('unprocessed', 'converted', 'reference', 'discarded')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_waiting_requires_blocker_insert
      BEFORE INSERT ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status = 'waiting' AND (
        trim(NEW.blocked_reason) = '' OR trim(NEW.blocked_by) = ''
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_BLOCKER_DETAILS_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_waiting_requires_blocker_update
      BEFORE UPDATE OF status, blocked_reason, blocked_by ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status = 'waiting' AND (
        trim(NEW.blocked_reason) = '' OR trim(NEW.blocked_by) = ''
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_BLOCKER_DETAILS_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_visit_details_insert
      BEFORE INSERT ON farm_work_visits
      FOR EACH ROW
      WHEN (
        NEW.status = 'completed' AND (
          NEW.actual_started_at = 0 OR NEW.actual_ended_at = 0 OR
          NEW.actual_ended_at <= NEW.actual_started_at OR
          NEW.actual_started_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
          NEW.actual_ended_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
          trim(NEW.result) = ''
        )
      ) OR (
        NEW.status = 'canceled' AND (
          trim(NEW.result) = '' OR NEW.actual_started_at != 0 OR NEW.actual_ended_at != 0
        )
      ) OR (
        NEW.status = 'scheduled' AND (
          NEW.actual_started_at != 0 OR NEW.actual_ended_at != 0 OR
          trim(NEW.result) != '' OR NEW.next_visit_at != 0
        )
      ) OR trim(NEW.recorded_by) = '' OR (
        NEW.next_visit_at != 0 AND NEW.next_visit_at <= CASE
          WHEN NEW.status = 'completed' AND
            NEW.actual_ended_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
          THEN NEW.actual_ended_at
          ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000
        END
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_visit_details_update
      BEFORE UPDATE OF status, actual_started_at, actual_ended_at, result,
        next_visit_at, recorded_by
      ON farm_work_visits
      FOR EACH ROW
      WHEN (
        NEW.status = 'completed' AND (
          NEW.actual_started_at = 0 OR NEW.actual_ended_at = 0 OR
          NEW.actual_ended_at <= NEW.actual_started_at OR
          NEW.actual_started_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
          NEW.actual_ended_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
          trim(NEW.result) = ''
        )
      ) OR (
        NEW.status = 'canceled' AND (
          trim(NEW.result) = '' OR NEW.actual_started_at != 0 OR NEW.actual_ended_at != 0
        )
      ) OR (
        NEW.status = 'scheduled' AND (
          NEW.actual_started_at != 0 OR NEW.actual_ended_at != 0 OR
          trim(NEW.result) != '' OR NEW.next_visit_at != 0
        )
      ) OR trim(NEW.recorded_by) = '' OR (
        NEW.next_visit_at != 0 AND NEW.next_visit_at <= CASE
          WHEN NEW.status = 'completed' AND
            NEW.actual_ended_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
          THEN NEW.actual_ended_at
          ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000
        END
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_completed_work_visit_insert_lock
      BEFORE INSERT ON farm_work_visits
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM farm_work_items
        WHERE id = NEW.work_item_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_WORK_COMPLETED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_visit_terminal_lock
      BEFORE UPDATE ON farm_work_visits
      FOR EACH ROW
      WHEN OLD.status IN ('completed', 'canceled')
      BEGIN
        SELECT RAISE(ABORT, 'FARM_VISIT_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_completed_time_insert
      BEFORE INSERT ON farm_work_items
      FOR EACH ROW
      WHEN (NEW.status = 'completed' AND NEW.completed_at = 0) OR
        (NEW.status != 'completed' AND NEW.completed_at != 0)
      BEGIN
        SELECT RAISE(ABORT, 'FARM_COMPLETED_TIME_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_completed_time_update
      BEFORE UPDATE OF status, completed_at ON farm_work_items
      FOR EACH ROW
      WHEN (NEW.status = 'completed' AND NEW.completed_at = 0) OR
        (NEW.status != 'completed' AND NEW.completed_at != 0)
      BEGIN
        SELECT RAISE(ABORT, 'FARM_COMPLETED_TIME_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_waiting_requires_open_episode
      BEFORE UPDATE OF status ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status = 'waiting' AND NOT EXISTS (
        SELECT 1 FROM farm_blocker_episodes
        WHERE work_item_id = NEW.id AND closed_at = 0
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_BLOCKER_EPISODE_REQUIRED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_nonwaiting_rejects_open_episode
      BEFORE UPDATE OF status ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status != 'waiting' AND EXISTS (
        SELECT 1 FROM farm_blocker_episodes
        WHERE work_item_id = NEW.id AND closed_at = 0
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_BLOCKER_EPISODE_OPEN');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_complete_requires_checklist
      BEFORE UPDATE OF status ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status = 'completed' AND EXISTS (
        SELECT 1 FROM farm_work_checklist_items
        WHERE work_item_id = NEW.id AND is_completed = 0
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_CHECKLIST_INCOMPLETE');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_complete_requires_visits
      BEFORE UPDATE OF status ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status = 'completed' AND EXISTS (
        SELECT 1 FROM farm_work_visits
        WHERE work_item_id = NEW.id AND status = 'scheduled'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_VISIT_PENDING');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_completed_checklist_insert_lock
      BEFORE INSERT ON farm_work_checklist_items
      FOR EACH ROW
      WHEN NEW.is_completed = 0 AND EXISTS (
        SELECT 1 FROM farm_work_items
        WHERE id = NEW.work_item_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_COMPLETED_CHECKLIST_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_completed_checklist_update_lock
      BEFORE UPDATE OF is_completed ON farm_work_checklist_items
      FOR EACH ROW
      WHEN NEW.is_completed = 0 AND EXISTS (
        SELECT 1 FROM farm_work_items
        WHERE id = NEW.work_item_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_COMPLETED_CHECKLIST_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_inbox_conversions (
        inbox_item_id TEXT PRIMARY KEY REFERENCES farm_inbox_items(id) ON DELETE CASCADE,
        work_item_id TEXT NOT NULL UNIQUE REFERENCES farm_work_items(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_inbox_conversion_unprocessed
      BEFORE INSERT ON farm_inbox_conversions
      FOR EACH ROW
      WHEN NOT EXISTS (
        SELECT 1 FROM farm_inbox_items
        WHERE id = NEW.inbox_item_id AND status = 'unprocessed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_INBOX_ALREADY_PROCESSED');
      END
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS farm_history_entries (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES farm_work_items(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CONSTRAINT chk_farm_history_entries_channel
          CHECK (channel IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
        sender TEXT NOT NULL DEFAULT '',
        received_content TEXT NOT NULL DEFAULT '',
        action_content TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0 CONSTRAINT chk_farm_history_entries_amount
          CHECK (amount BETWEEN 0 AND 10000000000),
        recorder TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        reference_url TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_smartfarm_projects_status_year ON smartfarm_projects(status, year)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_smartfarm_projects_stage_settlement ON smartfarm_projects(current_stage, settlement_status)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_project_documents_project_status ON farm_project_documents(project_id, status)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_project_documents_due ON farm_project_documents(status, due_date)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_project_updates_project_occurred ON farm_project_updates(project_id, occurred_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_project_updates_open_blockers ON farm_project_updates(project_id, occurred_at) WHERE kind = 'blocker' AND resolved_at = 0`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_farm_code ON farms(farm_code)`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_records_farm_project ON farm_records(farm_id, project_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_records_project_farm ON farm_records(project_id, farm_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_records_subscription_expiry ON farm_records(subscription_status, current_subscription_expires_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_records_last_activity ON farm_records(last_activity_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_record_activity ON farm_work_items(farm_record_id, last_activity_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_status_due ON farm_work_items(status, due_date)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_type_status ON farm_work_items(work_type, status)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_review_priority ON farm_work_items(status, review_date, priority)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_response_risk ON farm_work_items(status, responded_at, response_due_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_items_blocked ON farm_work_items(status, blocked_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_checklist_order ON farm_work_checklist_items(work_item_id, sort_order, created_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_visits_work_schedule ON farm_work_visits(work_item_id, scheduled_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_work_visits_status_schedule ON farm_work_visits(status, scheduled_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_blocker_episodes_work_opened ON farm_blocker_episodes(work_item_id, opened_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_blocker_episodes_open ON farm_blocker_episodes(closed_at, opened_at)`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_blocker_episodes_one_open ON farm_blocker_episodes(work_item_id) WHERE closed_at = 0`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_inbox_status_received ON farm_inbox_items(status, received_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_history_work_item_occurred ON farm_history_entries(work_item_id, occurred_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_farm_history_occurred ON farm_history_entries(occurred_at)`,
    ),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_state_insert
      BEFORE INSERT ON smartfarm_projects
      FOR EACH ROW
      WHEN (NEW.status = 'completed' AND NEW.current_stage != 'closed')
        OR (NEW.status != 'completed' AND NEW.current_stage = 'closed')
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_STAGE_STATUS_INVALID');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_completed_insert
      BEFORE INSERT ON smartfarm_projects
      FOR EACH ROW
      WHEN NEW.status = 'completed'
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_state_update
      BEFORE UPDATE OF status, current_stage ON smartfarm_projects
      FOR EACH ROW
      WHEN (NEW.status = 'completed' AND NEW.current_stage != 'closed')
        OR (NEW.status != 'completed' AND NEW.current_stage = 'closed')
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_STAGE_STATUS_INVALID');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_completion_update
      BEFORE UPDATE OF status ON smartfarm_projects
      FOR EACH ROW
      WHEN OLD.status != 'completed' AND NEW.status = 'completed' AND (
        NEW.current_stage != 'closed' OR
        NEW.settlement_status NOT IN ('paid', 'closed') OR
        trim(NEW.settled_at) = '' OR
        NOT EXISTS (
          SELECT 1 FROM farm_project_documents
          WHERE project_id = NEW.id AND is_required = 1
        ) OR
        EXISTS (
          SELECT 1 FROM farm_project_documents
          WHERE project_id = NEW.id AND is_required = 1 AND status != 'approved'
        ) OR
        EXISTS (
          SELECT 1 FROM farm_project_updates
          WHERE project_id = NEW.id AND kind = 'blocker' AND resolved_at = 0
        ) OR
        EXISTS (
          SELECT 1 FROM farm_work_items wi
          INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
          WHERE fr.project_id = NEW.id AND wi.status != 'completed'
        ) OR
        (
          NEW.target_farm_count > 0 AND
          (SELECT COUNT(DISTINCT farm_id) FROM farm_records WHERE project_id = NEW.id) < NEW.target_farm_count
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_smartfarm_project_completed_fields_update
      BEFORE UPDATE OF target_farm_count, start_date, end_date,
        settlement_status, settlement_due_date, contract_amount,
        settlement_claim_amount, settlement_approved_amount,
        settlement_paid_amount, settled_at, settlement_evidence_url
      ON smartfarm_projects
      FOR EACH ROW
      WHEN OLD.status = 'completed' AND NEW.status = 'completed' AND (
        NEW.target_farm_count != OLD.target_farm_count OR
        NEW.start_date != OLD.start_date OR NEW.end_date != OLD.end_date OR
        NEW.settlement_status != OLD.settlement_status OR
        NEW.settlement_due_date != OLD.settlement_due_date OR
        NEW.contract_amount != OLD.contract_amount OR
        NEW.settlement_claim_amount != OLD.settlement_claim_amount OR
        NEW.settlement_approved_amount != OLD.settlement_approved_amount OR
        NEW.settlement_paid_amount != OLD.settlement_paid_amount OR
        NEW.settled_at != OLD.settled_at OR
        NEW.settlement_evidence_url != OLD.settlement_evidence_url
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_project_document_completed_insert
      BEFORE INSERT ON farm_project_documents
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = NEW.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_project_document_completed_update
      BEFORE UPDATE ON farm_project_documents
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = NEW.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_project_document_completed_delete
      BEFORE DELETE ON farm_project_documents
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = OLD.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_record_completed_project_insert
      BEFORE INSERT ON farm_records
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = NEW.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_record_completed_project_update
      BEFORE UPDATE OF project_id ON farm_records
      FOR EACH ROW
      WHEN NEW.project_id != OLD.project_id AND (
        EXISTS (
          SELECT 1 FROM smartfarm_projects
          WHERE id = OLD.project_id AND status = 'completed'
        ) OR EXISTS (
          SELECT 1 FROM smartfarm_projects
          WHERE id = NEW.project_id AND status = 'completed'
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_record_completed_project_delete
      BEFORE DELETE ON farm_records
      FOR EACH ROW
      WHEN EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = OLD.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_completed_project_insert
      BEFORE INSERT ON farm_work_items
      FOR EACH ROW
      WHEN NEW.status != 'completed' AND EXISTS (
        SELECT 1 FROM farm_records fr
        INNER JOIN smartfarm_projects p ON p.id = fr.project_id
        WHERE fr.id = NEW.farm_record_id AND p.status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_work_completed_project_reopen
      BEFORE UPDATE OF status ON farm_work_items
      FOR EACH ROW
      WHEN OLD.status = 'completed' AND NEW.status != 'completed' AND EXISTS (
        SELECT 1 FROM farm_records fr
        INNER JOIN smartfarm_projects p ON p.id = fr.project_id
        WHERE fr.id = NEW.farm_record_id AND p.status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS trg_farm_project_blocker_completed_insert
      BEFORE INSERT ON farm_project_updates
      FOR EACH ROW
      WHEN NEW.kind = 'blocker' AND EXISTS (
        SELECT 1 FROM smartfarm_projects
        WHERE id = NEW.project_id AND status = 'completed'
      )
      BEGIN
        SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
      END
    `),
    db.prepare('PRAGMA optimize'),
  ]);

  if (process.env.ENABLE_SAMPLE_DATA !== 'true') return;

  const seeded = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind('smartfarm_ledger_seeded_v2')
    .first<{ value: string }>();
  if (seeded) return;

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const projects: FarmProject[] = [
    {
      id: 'sf-project-data-2025',
      name: '2025 데이터 기반 스마트농업',
      projectType: 'general',
      year: 2025,
      institution: '지역 농업기술원',
      status: 'active',
      description:
        '과수 농가의 환경·관수 데이터를 수집하고 생산 모델을 적용합니다.',
      targetFarmCount: 12,
      manager: '사업운영팀',
      startDate: dateFromToday(-150),
      endDate: dateFromToday(120),
      currentStage: 'installation',
      settlementStatus: 'collecting',
      settlementDueDate: dateFromToday(150),
      contractAmount: 180000000,
      settlementClaimAmount: 0,
      settlementApprovedAmount: 0,
      settlementPaidAmount: 0,
      settledAt: '',
      settlementOwner: '경영지원팀',
      settlementEvidenceUrl: '',
      settlementNote: '설치 완료 농가의 검수서류를 순차 수집합니다.',
      createdAt: now - 120 * day,
      updatedAt: now - 2 * hour,
    },
    {
      id: 'sf-project-water-2025',
      name: '2025 수분스트레스 자동관수',
      projectType: 'research',
      year: 2025,
      institution: '농림식품기술기획평가원',
      status: 'active',
      description: '수분스트레스 측정과 자동관수 제어를 실증합니다.',
      targetFarmCount: 8,
      manager: '연구개발팀',
      startDate: dateFromToday(-110),
      endDate: dateFromToday(180),
      currentStage: 'verification',
      settlementStatus: 'not_started',
      settlementDueDate: dateFromToday(210),
      contractAmount: 120000000,
      settlementClaimAmount: 0,
      settlementApprovedAmount: 0,
      settlementPaidAmount: 0,
      settledAt: '',
      settlementOwner: '연구행정팀',
      settlementEvidenceUrl: '',
      settlementNote: '',
      createdAt: now - 90 * day,
      updatedAt: now - 5 * hour,
    },
    {
      id: 'sf-project-outdoor-2024',
      name: '2024 노지 스마트팜 확산',
      projectType: 'general',
      year: 2024,
      institution: '농촌진흥청',
      status: 'on_hold',
      description: '노지 과수 농가의 관수·기상 장비를 설치한 사업입니다.',
      targetFarmCount: 20,
      manager: '사업운영팀',
      startDate: dateFromToday(-620),
      endDate: dateFromToday(-260),
      currentStage: 'settlement',
      settlementStatus: 'closed',
      settlementDueDate: dateFromToday(-220),
      contractAmount: 250000000,
      settlementClaimAmount: 250000000,
      settlementApprovedAmount: 250000000,
      settlementPaidAmount: 250000000,
      settledAt: dateFromToday(-190),
      settlementOwner: '경영지원팀',
      settlementEvidenceUrl: '',
      settlementNote:
        '정산 입금은 확인했고 필수서류·참여농가 근거를 재확인 중입니다.',
      createdAt: now - 500 * day,
      updatedAt: now - 20 * day,
    },
    {
      id: 'sf-project-greenhouse-2023',
      name: '2023 시설원예 스마트팜 보급',
      projectType: 'general',
      year: 2023,
      institution: '지방자치단체',
      status: 'on_hold',
      description: '시설원예 농가에 환경계측과 제어 장비를 보급했습니다.',
      targetFarmCount: 10,
      manager: '시설사업팀',
      startDate: dateFromToday(-920),
      endDate: dateFromToday(-580),
      currentStage: 'settlement',
      settlementStatus: 'closed',
      settlementDueDate: dateFromToday(-540),
      contractAmount: 160000000,
      settlementClaimAmount: 160000000,
      settlementApprovedAmount: 160000000,
      settlementPaidAmount: 160000000,
      settledAt: dateFromToday(-510),
      settlementOwner: '경영지원팀',
      settlementEvidenceUrl: '',
      settlementNote:
        '정산 입금은 확인했고 필수서류·참여농가 근거를 재확인 중입니다.',
      createdAt: now - 800 * day,
      updatedAt: now - 60 * day,
    },
  ];
  const seedDocumentTemplates: Array<
    Pick<FarmProjectDocumentInput, 'title' | 'category'>
  > = [
    { title: '협약서·계약서', category: 'agreement' },
    { title: '참여농가 확정 명단', category: 'farm' },
    { title: '설치·시운전 확인서', category: 'installation' },
    { title: '검수·교육 확인서', category: 'inspection' },
    { title: '정산보고서·증빙', category: 'settlement' },
  ];

  const farms: Farm[] = [
    ['001', '김천 포도농가 A', '김천', '경북 김천시 예시 주소', 50, 2],
    ['002', '화성 포도농가 B', '화성', '경기 화성시 예시 주소', 44, 5],
    ['003', '천안 실증농가 C', '천안', '충남 천안시 예시 주소', 40, 24],
    ['004', '춘천 토마토농가 D', '춘천', '강원 춘천시 예시 주소', 34, 48],
    ['005', '상주 사과농가 E', '상주', '경북 상주시 예시 주소', 28, 72],
    ['006', '완주 딸기농가 F', '완주', '전북 완주군 예시 주소', 22, 96],
  ].map(([code, name, region, address, createdDays, updatedHours]) => ({
    id: `sf-farm-sample-${code}`,
    farmCode: `SAMPLE-${code}`,
    name: String(name),
    phone: `010-0000-${code}`,
    address: String(address),
    region: String(region),
    businessNumber: '',
    folderUrl: '',
    locationUrl: '',
    specialNotes: '개인정보가 아닌 화면 확인용 예시 농가입니다.',
    createdAt: now - Number(createdDays) * day,
    updatedAt: now - Number(updatedHours) * hour,
  }));

  const recordSeeds = [
    [
      0,
      0,
      '포도',
      '클라우드',
      '관수내비',
      '인지시스템',
      '무선 라우터',
      'active',
      2,
      -5,
      14,
      true,
      true,
    ],
    [
      1,
      2,
      '포도',
      '라떼판다',
      '온실내비',
      '인지시스템',
      '유선',
      'active',
      1,
      -12,
      9,
      true,
      true,
    ],
    [
      2,
      1,
      '사과',
      '미니컴',
      '센서내비',
      '금화이엔에스',
      '유선',
      'expired',
      0,
      -15,
      -1,
      true,
      false,
    ],
    [
      3,
      3,
      '토마토',
      '라떼판다',
      '21년식',
      '인지시스템',
      '무선 라우터',
      'active',
      1,
      -20,
      11,
      true,
      true,
    ],
    [
      4,
      0,
      '사과',
      '클라우드',
      '관수내비',
      '경농',
      '무선 라우터',
      'unregistered',
      0,
      -2,
      0,
      false,
      false,
    ],
    [
      5,
      3,
      '딸기',
      '라떼판다',
      '22년식',
      '인지시스템',
      '유선',
      'active',
      2,
      -25,
      18,
      true,
      true,
    ],
  ] as const;

  const records: FarmRecord[] = recordSeeds.map((seed, index) => {
    const [
      farmIndex,
      projectIndex,
      crop,
      deviceType,
      productType,
      vendor,
      internetType,
      subscriptionStatus,
      renewalCount,
      installedOffset,
      expiryMonths,
      commissioned,
      educated,
    ] = seed;
    const installationDate = dateFromToday(installedOffset);
    return {
      id: `sf-record-sample-${String(index + 1).padStart(3, '0')}`,
      farmId: farms[farmIndex].id,
      projectId: projects[projectIndex].id,
      crop,
      deviceType,
      productType,
      vendor,
      productionSetupDate: installationDate,
      installationDate,
      commissioningDate: commissioned ? dateFromToday(installedOffset + 1) : '',
      educationDate: educated ? dateFromToday(installedOffset + 1) : '',
      internetType,
      warrantyYears: 1,
      warrantyExpiresAt: dateFromNowMonths(12),
      subscriptionYears: subscriptionStatus === 'unregistered' ? 0 : 1,
      initialSubscriptionExpiresAt:
        subscriptionStatus === 'unregistered'
          ? ''
          : dateFromNowMonths(expiryMonths),
      currentSubscriptionExpiresAt:
        subscriptionStatus === 'unregistered'
          ? ''
          : dateFromNowMonths(expiryMonths),
      lastPaymentDate:
        subscriptionStatus === 'active' ? dateFromToday(-30) : '',
      renewalCount,
      subscriptionStatus,
      notes: index === 4 ? '시운전과 교육 일정을 확정해야 합니다.' : '',
      lastActivityAt: farms[farmIndex].updatedAt,
      createdAt: farms[farmIndex].createdAt,
      updatedAt: farms[farmIndex].updatedAt,
    };
  });

  const workItemSeeds = [
    [
      'communication',
      '관수 시간 조정 문의',
      'completed',
      '운영 담당자',
      '',
      now - 2 * hour,
    ],
    [
      'payment',
      '연간 구독료 입금 확인',
      'completed',
      '회계 담당자',
      '',
      now - 5 * hour,
    ],
    [
      'service',
      '센서 게이트웨이 통신 불량',
      'in_progress',
      'A/S 담당자',
      dateFromToday(2),
      now - day,
    ],
    [
      'subscription',
      '구독 갱신 안내 발송',
      'waiting',
      '운영 담당자',
      dateFromToday(14),
      now - 2 * day,
    ],
    [
      'installation',
      '시운전·교육 일정 조율',
      'in_progress',
      '설치 담당자',
      dateFromToday(5),
      now - 3 * day,
    ],
    [
      'service',
      '제어기 화면 점검',
      'completed',
      'A/S 담당자',
      '',
      now - 4 * day,
    ],
  ] as const;
  const workItems: FarmWorkItem[] = workItemSeeds.map((seed, index) => ({
    id: `sf-work-sample-${String(index + 1).padStart(3, '0')}`,
    farmRecordId: records[index].id,
    farmId: records[index].farmId,
    workType: seed[0],
    title: seed[1],
    status: seed[2],
    owner: seed[3],
    dueDate: seed[4],
    description: seed[1],
    expectedOutcome: `${seed[1]} 처리가 끝났음을 농가와 담당자가 확인합니다.`,
    nextAction:
      index === 2
        ? '농가와 현장 방문 일정을 확정합니다.'
        : index === 3
          ? '갱신 의사를 다시 확인합니다.'
          : index === 4
            ? '농가와 시운전 가능 날짜를 확정합니다.'
            : '',
    priority:
      index === 2 || index === 4 ? 'high' : index === 3 ? 'medium' : 'low',
    reviewDate:
      index === 2
        ? dateFromToday(1)
        : index === 3
          ? dateFromToday(3)
          : index === 4
            ? dateFromToday(2)
            : '',
    responseDueAt:
      seed[5] +
      (index === 2 || index === 4 ? day : index === 3 ? 3 * day : 7 * day),
    respondedAt: index === 2 || index === 4 ? 0 : seed[5],
    blockedAt: index === 3 ? seed[5] : 0,
    blockedReason: index === 3 ? '농가의 구독 갱신 의사 회신 대기' : '',
    blockedBy: index === 3 ? '농가 담당자' : '',
    expectedUnblockDate: index === 3 ? dateFromToday(3) : '',
    completedAt: seed[2] === 'completed' ? seed[5] : 0,
    lastActivityAt: seed[5],
    createdAt: seed[5],
    updatedAt: seed[5],
  }));
  const blockerEpisodes: FarmBlockerEpisode[] = workItems
    .filter((item) => item.status === 'waiting')
    .map((item) => ({
      id: `sf-blocker-${item.id}`,
      workItemId: item.id,
      reason: item.blockedReason,
      blockedBy: item.blockedBy,
      expectedUnblockDate: item.expectedUnblockDate,
      openedAt: item.blockedAt,
      closedAt: 0,
      resolution: '',
      createdAt: item.blockedAt,
      updatedAt: item.blockedAt,
    }));

  const historyContents = [
    [
      'kakao',
      '농가 담당자',
      '최근 기온 변화에 맞춰 관수 시간을 조정할 수 있는지 문의했습니다.',
      '데이터 확인 후 오전 관수 시작 시간을 30분 앞당겨 안내했습니다.',
      0,
    ],
    [
      'system',
      '',
      '',
      '연간 구독료 입금을 확인하고 구독 상태를 유지했습니다.',
      66000,
    ],
    [
      'phone',
      '농가 담당자',
      '센서 데이터가 새벽부터 수집되지 않는다고 접수했습니다.',
      '원격 재부팅을 시도했고 현장 점검 일정을 조율 중입니다.',
      0,
    ],
    ['email', '', '', '만료 60일 전 갱신 안내 메일을 발송했습니다.', 0],
    [
      'meeting',
      '사업 담당자',
      '장비 설치 후 시운전과 사용자 교육 일정을 확정해 달라는 요청이 있었습니다.',
      '농가 가능 일정을 확인하고 있습니다.',
      0,
    ],
    [
      'phone',
      '농가 담당자',
      '화면 밝기가 간헐적으로 어두워진다고 접수했습니다.',
      '전원 어댑터를 교체한 뒤 정상 동작을 확인했습니다.',
      0,
    ],
  ] as const;
  const historyEntries: FarmHistoryEntry[] = historyContents.map(
    (seed, index) => ({
      id: `sf-history-sample-${String(index + 1).padStart(3, '0')}`,
      workItemId: workItems[index].id,
      channel: seed[0],
      sender: seed[1],
      receivedContent: seed[2],
      actionContent: seed[3],
      amount: seed[4],
      recorder: workItems[index].owner,
      occurredAt: workItems[index].lastActivityAt,
      referenceUrl: '',
      createdAt: workItems[index].lastActivityAt,
    }),
  );

  await db.batch([
    ...projects.map((project) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO smartfarm_projects (
        id, name, project_type, year, institution, status, description,
        target_farm_count, manager, start_date, end_date, current_stage,
        settlement_status, settlement_due_date, contract_amount,
        settlement_claim_amount, settlement_approved_amount,
        settlement_paid_amount, settled_at, settlement_owner,
        settlement_evidence_url, settlement_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          project.id,
          project.name,
          project.projectType,
          project.year,
          project.institution,
          project.status,
          project.description,
          project.targetFarmCount,
          project.manager,
          project.startDate,
          project.endDate,
          project.currentStage,
          project.settlementStatus,
          project.settlementDueDate,
          project.contractAmount,
          project.settlementClaimAmount,
          project.settlementApprovedAmount,
          project.settlementPaidAmount,
          project.settledAt,
          project.settlementOwner,
          project.settlementEvidenceUrl,
          project.settlementNote,
          project.createdAt,
          project.updatedAt,
        ),
    ),
    ...projects.flatMap((project) =>
      seedDocumentTemplates.map((template) => {
        const approved = project.status === 'completed';
        const owner =
          template.category === 'settlement'
            ? project.settlementOwner || project.manager
            : project.manager;
        return db
          .prepare(`
            INSERT OR IGNORE INTO farm_project_documents (
              id, project_id, title, category, is_required, status, owner,
              current_handler, due_date, submitted_at, approved_at,
              reference_url, revision, note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, '', ?, ?, '', 1, '', ?, ?)
          `)
          .bind(
            `${project.id}:doc:${template.category}`,
            project.id,
            template.title,
            template.category,
            approved ? 'approved' : 'not_started',
            owner,
            owner,
            approved ? project.endDate : '',
            approved ? project.settledAt || project.endDate : '',
            project.createdAt,
            project.updatedAt,
          );
      }),
    ),
    ...projects.map((project) =>
      insertProjectUpdateStatement(
        db,
        systemProjectUpdate(
          project.id,
          '프로젝트 등록',
          `${project.name} 프로젝트를 등록했습니다.`,
          project.manager,
          project.createdAt,
        ),
      ),
    ),
    ...farms.map((farm) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO farms (
        id, farm_code, name, phone, address, region, business_number,
        folder_url, location_url, special_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          farm.id,
          farm.farmCode,
          farm.name,
          farm.phone,
          farm.address,
          farm.region,
          farm.businessNumber,
          farm.folderUrl,
          farm.locationUrl,
          farm.specialNotes,
          farm.createdAt,
          farm.updatedAt,
        ),
    ),
    ...records.map((record) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          record.id,
          record.farmId,
          record.projectId,
          record.crop,
          record.deviceType,
          record.productType,
          record.vendor,
          record.productionSetupDate,
          record.installationDate,
          record.commissioningDate,
          record.educationDate,
          record.internetType,
          record.warrantyYears,
          record.warrantyExpiresAt,
          record.subscriptionYears,
          record.initialSubscriptionExpiresAt,
          record.currentSubscriptionExpiresAt,
          record.lastPaymentDate,
          record.renewalCount,
          record.subscriptionStatus,
          record.notes,
          record.lastActivityAt,
          record.createdAt,
          record.updatedAt,
        ),
    ),
    ...workItems.map((item) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        expected_outcome, next_action, priority, review_date,
        response_due_at, responded_at, blocked_at, blocked_reason, blocked_by,
        expected_unblock_date, completed_at, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          item.id,
          item.farmRecordId,
          item.workType,
          item.title,
          item.status,
          item.owner,
          item.dueDate,
          item.description,
          item.expectedOutcome,
          item.nextAction,
          item.priority,
          item.reviewDate,
          item.responseDueAt,
          item.respondedAt,
          item.blockedAt,
          item.blockedReason,
          item.blockedBy,
          item.expectedUnblockDate,
          item.completedAt,
          item.lastActivityAt,
          item.createdAt,
          item.updatedAt,
        ),
    ),
    ...blockerEpisodes.map((episode) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO farm_blocker_episodes (
        id, work_item_id, reason, blocked_by, expected_unblock_date,
        opened_at, closed_at, resolution, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          episode.id,
          episode.workItemId,
          episode.reason,
          episode.blockedBy,
          episode.expectedUnblockDate,
          episode.openedAt,
          episode.closedAt,
          episode.resolution,
          episode.createdAt,
          episode.updatedAt,
        ),
    ),
    ...historyEntries.map((entry) =>
      db
        .prepare(`
      INSERT OR IGNORE INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          entry.id,
          entry.workItemId,
          entry.channel,
          entry.sender,
          entry.receivedContent,
          entry.actionContent,
          entry.amount,
          entry.recorder,
          entry.occurredAt,
          entry.referenceUrl,
          entry.createdAt,
        ),
    ),
    db
      .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
      .bind('smartfarm_ledger_seeded_v2', '1'),
  ]);
}

export async function ensureFarmLedgerStore() {
  initialization ??= initializeFarmLedgerStore().catch((error) => {
    initialization = null;
    throw error;
  });
  await initialization;
}

function assertProjectStateConsistency(input: FarmProjectInput) {
  if (
    (input.status === 'completed' && input.currentStage !== 'closed') ||
    (input.status !== 'completed' && input.currentStage === 'closed')
  ) {
    throw new Error('FARM_PROJECT_STAGE_STATUS_INVALID');
  }
}

function projectChangeSummary(existing: FarmProject, input: FarmProjectInput) {
  const changed: string[] = [];
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

export async function listFarmLedgerWorkspace(): Promise<FarmLedgerWorkspace> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [
    projectResult,
    projectDocumentResult,
    projectUpdateResult,
    farmResult,
    recordResult,
    subscriptionEventResult,
    inboxResult,
    workItemResult,
    blockerEpisodeResult,
    visitResult,
    checklistResult,
    historyResult,
  ] = await Promise.all([
    db
      .prepare(`
      SELECT id, name, project_type, year, institution, status, description,
             target_farm_count, manager, start_date, end_date, current_stage,
             settlement_status, settlement_due_date, contract_amount,
             settlement_claim_amount, settlement_approved_amount,
             settlement_paid_amount, settled_at, settlement_owner,
             settlement_evidence_url, settlement_note, created_at, updated_at
      FROM smartfarm_projects
      ORDER BY year DESC, name ASC
      LIMIT 5000
    `)
      .all<FarmProjectRow>(),
    db
      .prepare(`
      SELECT id, project_id, title, category, is_required, status, owner,
             current_handler, due_date, submitted_at, approved_at,
             reference_url, revision, note, created_at, updated_at
      FROM farm_project_documents
      ORDER BY project_id ASC, due_date ASC, created_at ASC
      LIMIT 30000
    `)
      .all<FarmProjectDocumentRow>(),
    db
      .prepare(`
      SELECT id, project_id, kind, title, channel, sender, received_content,
             action_content, recorder, occurred_at, reference_url,
             blocked_reason, blocked_by, expected_unblock_date, resolved_at,
             resolution, resolved_by, created_at, updated_at
      FROM farm_project_updates
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 30000
    `)
      .all<FarmProjectUpdateRow>(),
    db
      .prepare(`
      SELECT id, farm_code, name, phone, address, region, business_number,
             folder_url, location_url, special_notes, created_at, updated_at
      FROM farms
      ORDER BY updated_at DESC
      LIMIT 5000
    `)
      .all<FarmRow>(),
    db
      .prepare(`
      SELECT id, farm_id, project_id, crop, device_type, product_type, vendor,
             production_setup_date, installation_date, commissioning_date, education_date,
             internet_type, warranty_years, warranty_expires_at, subscription_years,
             initial_subscription_expires_at, current_subscription_expires_at,
             last_payment_date, renewal_count, subscription_status, notes,
             last_activity_at, created_at, updated_at
      FROM farm_records
      ORDER BY last_activity_at DESC
      LIMIT 10000
    `)
      .all<FarmRecordRow>(),
    db
      .prepare(`
      SELECT id, farm_record_id, project_id, event_type, basis_expiry_date,
             processed_at, new_expiry_date, recorder, note, created_at
      FROM farm_subscription_events
      ORDER BY processed_at DESC, created_at DESC
      LIMIT 30000
    `)
      .all<FarmSubscriptionEventRow>(),
    db
      .prepare(`
      SELECT i.id, i.channel, i.sender, i.content, i.captured_by, i.received_at,
             i.reference_url, i.status, COALESCE(c.work_item_id, '') AS converted_work_item_id,
             i.created_at, i.updated_at
      FROM farm_inbox_items i
      LEFT JOIN farm_inbox_conversions c ON c.inbox_item_id = i.id
      ORDER BY i.received_at DESC, i.created_at DESC
      LIMIT 10000
    `)
      .all<FarmInboxItemRow>(),
    db
      .prepare(`
      SELECT wi.id, wi.farm_record_id, fr.farm_id, wi.work_type, wi.title, wi.status,
             wi.owner, wi.due_date, wi.description, wi.expected_outcome, wi.next_action,
              wi.priority, wi.review_date, wi.response_due_at, wi.responded_at,
              wi.blocked_at, wi.blocked_reason, wi.blocked_by, wi.expected_unblock_date,
              wi.completed_at, wi.last_activity_at,
             wi.created_at, wi.updated_at
      FROM farm_work_items wi
      INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
      ORDER BY wi.last_activity_at DESC, wi.created_at DESC
      LIMIT 10000
    `)
      .all<FarmWorkItemRow>(),
    db
      .prepare(`
      SELECT id, work_item_id, reason, blocked_by, expected_unblock_date,
             opened_at, closed_at, resolution, created_at, updated_at
      FROM farm_blocker_episodes
      ORDER BY opened_at DESC, created_at DESC
      LIMIT 30000
    `)
      .all<FarmBlockerEpisodeRow>(),
    db
      .prepare(`
      SELECT id, work_item_id, scheduled_at, assigned_to, status,
             actual_started_at, actual_ended_at, preparation_note, result,
             next_visit_at, recorded_by, created_at, updated_at
      FROM farm_work_visits
      ORDER BY scheduled_at DESC, created_at DESC
      LIMIT 30000
    `)
      .all<FarmWorkVisitRow>(),
    db
      .prepare(`
      SELECT id, work_item_id, content, is_completed, sort_order, completed_by,
             completed_at, created_at, updated_at
      FROM farm_work_checklist_items
      ORDER BY work_item_id ASC, sort_order ASC, created_at ASC
      LIMIT 50000
    `)
      .all<FarmWorkChecklistItemRow>(),
    db
      .prepare(`
      SELECT id, work_item_id, channel, sender, received_content, action_content,
             amount, recorder, occurred_at, reference_url, created_at
      FROM farm_history_entries
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 30000
    `)
      .all<FarmHistoryEntryRow>(),
  ]);

  return {
    projects: projectResult.results.map(mapProject),
    projectDocuments: projectDocumentResult.results.map(mapProjectDocument),
    projectUpdates: projectUpdateResult.results.map(mapProjectUpdate),
    farms: farmResult.results.map(mapFarm),
    records: recordResult.results.map(mapRecord),
    subscriptionEvents:
      subscriptionEventResult.results.map(mapSubscriptionEvent),
    inboxItems: inboxResult.results.map(mapInboxItem),
    workItems: workItemResult.results.map(mapWorkItem),
    blockerEpisodes: blockerEpisodeResult.results.map(mapBlockerEpisode),
    visits: visitResult.results.map(mapVisit),
    checklistItems: checklistResult.results.map(mapChecklistItem),
    historyEntries: historyResult.results.map(mapHistoryEntry),
  };
}

export async function createFarmProject(
  input: FarmProjectInput,
): Promise<FarmProject> {
  await ensureFarmLedgerStore();
  assertProjectStateConsistency(input);
  if (input.status === 'completed') {
    throw new Error('FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
  }
  const now = Date.now();
  const project: FarmProject = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const db = getD1();
  const auditUpdate = systemProjectUpdate(
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
  await db.batch([
    db
      .prepare(`
    INSERT INTO smartfarm_projects (
      id, name, project_type, year, institution, status, description,
      target_farm_count, manager, start_date, end_date, current_stage,
      settlement_status, settlement_due_date, contract_amount,
      settlement_claim_amount, settlement_approved_amount,
      settlement_paid_amount, settled_at, settlement_owner,
      settlement_evidence_url, settlement_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
      .bind(
        project.id,
        project.name,
        project.projectType,
        project.year,
        project.institution,
        project.status,
        project.description,
        project.targetFarmCount,
        project.manager,
        project.startDate,
        project.endDate,
        project.currentStage,
        project.settlementStatus,
        project.settlementDueDate,
        project.contractAmount,
        project.settlementClaimAmount,
        project.settlementApprovedAmount,
        project.settlementPaidAmount,
        project.settledAt,
        project.settlementOwner,
        project.settlementEvidenceUrl,
        project.settlementNote,
        project.createdAt,
        project.updatedAt,
      ),
    ...templates.map((template) =>
      db
        .prepare(`
        INSERT INTO farm_project_documents (
          id, project_id, title, category, is_required, status, owner,
          current_handler, due_date, submitted_at, approved_at,
          reference_url, revision, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, 'not_started', ?, ?, '', '', '', '', 1, '', ?, ?)
      `)
        .bind(
          crypto.randomUUID(),
          project.id,
          template.title,
          template.category,
          template.category === 'settlement'
            ? project.settlementOwner || project.manager
            : project.manager,
          template.category === 'settlement'
            ? project.settlementOwner || project.manager
            : project.manager,
          now,
          now,
        ),
    ),
    insertProjectUpdateStatement(db, auditUpdate),
  ]);
  return project;
}

export async function updateFarmProject(
  projectId: string,
  input: FarmProjectInput,
): Promise<FarmProject> {
  await ensureFarmLedgerStore();
  assertProjectStateConsistency(input);
  const db = getD1();
  const existing = await db
    .prepare(`
      SELECT id, name, project_type, year, institution, status, description,
             target_farm_count, manager, start_date, end_date, current_stage,
             settlement_status, settlement_due_date, contract_amount,
             settlement_claim_amount, settlement_approved_amount,
             settlement_paid_amount, settled_at, settlement_owner,
             settlement_evidence_url, settlement_note, created_at, updated_at
      FROM smartfarm_projects
      WHERE id = ?
    `)
    .bind(projectId)
    .first<FarmProjectRow>();
  if (!existing) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');

  const existingProject = mapProject(existing);
  if (
    existingProject.status === 'completed' &&
    input.status === 'completed' &&
    (existingProject.targetFarmCount !== input.targetFarmCount ||
      existingProject.startDate !== input.startDate ||
      existingProject.endDate !== input.endDate ||
      existingProject.settlementStatus !== input.settlementStatus ||
      existingProject.settlementDueDate !== input.settlementDueDate ||
      existingProject.contractAmount !== input.contractAmount ||
      existingProject.settlementClaimAmount !== input.settlementClaimAmount ||
      existingProject.settlementApprovedAmount !==
        input.settlementApprovedAmount ||
      existingProject.settlementPaidAmount !== input.settlementPaidAmount ||
      existingProject.settledAt !== input.settledAt ||
      existingProject.settlementEvidenceUrl !== input.settlementEvidenceUrl)
  ) {
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  }
  if (existingProject.status !== 'completed' && input.status === 'completed') {
    const [documentStats, blockerStats, openWorkStats, farmStats] =
      await Promise.all([
        db
          .prepare(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status != 'approved' THEN 1 ELSE 0 END) AS incomplete
            FROM farm_project_documents
            WHERE project_id = ? AND is_required = 1
          `)
          .bind(projectId)
          .first<{ total: number; incomplete: number | null }>(),
        db
          .prepare(`
            SELECT COUNT(*) AS count
            FROM farm_project_updates
            WHERE project_id = ? AND kind = 'blocker' AND resolved_at = 0
          `)
          .bind(projectId)
          .first<{ count: number }>(),
        db
          .prepare(`
            SELECT COUNT(*) AS count
            FROM farm_work_items wi
            INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
            WHERE fr.project_id = ? AND wi.status != 'completed'
          `)
          .bind(projectId)
          .first<{ count: number }>(),
        db
          .prepare(
            'SELECT COUNT(DISTINCT farm_id) AS count FROM farm_records WHERE project_id = ?',
          )
          .bind(projectId)
          .first<{ count: number }>(),
      ]);
    const completionMissing =
      !documentStats ||
      documentStats.total === 0 ||
      Number(documentStats.incomplete ?? 0) > 0 ||
      !['paid', 'closed'].includes(input.settlementStatus) ||
      Number(blockerStats?.count ?? 0) > 0 ||
      Number(openWorkStats?.count ?? 0) > 0 ||
      (input.targetFarmCount > 0 &&
        Number(farmStats?.count ?? 0) < input.targetFarmCount);
    if (completionMissing) {
      throw new Error('FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
    }
  }

  const updatedAt = Date.now();
  const auditUpdate = systemProjectUpdate(
    projectId,
    '프로젝트 정보 수정',
    projectChangeSummary(existingProject, input),
    input.manager,
    updatedAt,
  );
  await db.batch([
    db
      .prepare(`
      UPDATE smartfarm_projects SET
        name = ?, project_type = ?, year = ?, institution = ?, status = ?,
        description = ?, target_farm_count = ?, manager = ?, start_date = ?,
        end_date = ?, current_stage = ?, settlement_status = ?,
        settlement_due_date = ?, contract_amount = ?,
        settlement_claim_amount = ?, settlement_approved_amount = ?,
        settlement_paid_amount = ?, settled_at = ?, settlement_owner = ?,
        settlement_evidence_url = ?, settlement_note = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        input.name,
        input.projectType,
        input.year,
        input.institution,
        input.status,
        input.description,
        input.targetFarmCount,
        input.manager,
        input.startDate,
        input.endDate,
        input.currentStage,
        input.settlementStatus,
        input.settlementDueDate,
        input.contractAmount,
        input.settlementClaimAmount,
        input.settlementApprovedAmount,
        input.settlementPaidAmount,
        input.settledAt,
        input.settlementOwner,
        input.settlementEvidenceUrl,
        input.settlementNote,
        updatedAt,
        projectId,
      ),
    insertProjectUpdateStatement(db, auditUpdate),
  ]);

  return {
    id: projectId,
    ...input,
    createdAt: existing.created_at,
    updatedAt,
  };
}

export async function createFarmProjectDocument(
  projectId: string,
  input: FarmProjectDocumentInput,
): Promise<FarmProjectDocument> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const project = await db
    .prepare('SELECT id, manager, status FROM smartfarm_projects WHERE id = ?')
    .bind(projectId)
    .first<{ id: string; manager: string; status: FarmProjectStatus }>();
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
  if (project.status === 'completed') {
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  }
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
  await db.batch([
    db
      .prepare(`
        INSERT INTO farm_project_documents (
          id, project_id, title, category, is_required, status, owner,
          current_handler, due_date, submitted_at, approved_at,
          reference_url, revision, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        document.id,
        document.projectId,
        document.title,
        document.category,
        document.isRequired ? 1 : 0,
        document.status,
        document.owner,
        document.currentHandler,
        document.dueDate,
        document.submittedAt,
        document.approvedAt,
        document.referenceUrl,
        document.revision,
        document.note,
        document.createdAt,
        document.updatedAt,
      ),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(now, projectId),
    insertProjectUpdateStatement(db, auditUpdate),
  ]);
  return document;
}

export async function updateFarmProjectDocument(
  documentId: string,
  input: FarmProjectDocumentInput,
): Promise<FarmProjectDocument> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const existing = await db
    .prepare(`
      SELECT d.id, d.project_id, d.title, d.category, d.is_required, d.status,
             d.owner, d.current_handler, d.due_date, d.submitted_at,
             d.approved_at, d.reference_url, d.revision, d.note,
             d.created_at, d.updated_at, p.status AS project_status
      FROM farm_project_documents d
      INNER JOIN smartfarm_projects p ON p.id = d.project_id
      WHERE d.id = ?
    `)
    .bind(documentId)
    .first<FarmProjectDocumentRow & { project_status: FarmProjectStatus }>();
  if (!existing) throw new Error('FARM_PROJECT_DOCUMENT_NOT_FOUND');
  if (existing.project_status === 'completed') {
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  }
  const statusRank: Record<FarmProjectDocumentStatus, number> = {
    not_started: 0,
    preparing: 1,
    submitted: 2,
    reviewing: 3,
    revision: 4,
    rejected: 4,
    approved: 5,
  };
  if (
    input.revision < existing.revision ||
    (statusRank[input.status] < statusRank[existing.status] &&
      input.revision <= existing.revision)
  ) {
    throw new Error('FARM_PROJECT_DOCUMENT_REVISION_INVALID');
  }
  const isNewRevision = input.revision > existing.revision;
  if (
    !isNewRevision &&
    ((existing.submitted_at && !input.submittedAt) ||
      (existing.approved_at && !input.approvedAt) ||
      (existing.reference_url && !input.referenceUrl))
  ) {
    throw new Error('FARM_PROJECT_DOCUMENT_EVIDENCE_LOCKED');
  }
  const updatedAt = Date.now();
  const changes = [
    existing.status !== input.status ? '상태' : '',
    existing.revision !== input.revision ? '개정번호' : '',
    existing.current_handler !== input.currentHandler ? '현재 처리자' : '',
    existing.due_date !== input.dueDate ? '제출기한' : '',
  ].filter(Boolean);
  const auditUpdate = systemProjectUpdate(
    existing.project_id,
    '제출서류 수정',
    `${input.title}: ${changes.length ? `${changes.join(', ')}을(를) 수정했습니다.` : '서류 정보를 다시 확인하고 저장했습니다.'} 이전 상태 ${existing.status}, 개정 ${existing.revision}, 제출일 ${existing.submitted_at || '없음'}, 승인일 ${existing.approved_at || '없음'}.`,
    input.owner || input.currentHandler,
    updatedAt,
  );
  auditUpdate.referenceUrl = existing.reference_url;
  await db.batch([
    db
      .prepare(`
        UPDATE farm_project_documents SET
          title = ?, category = ?, is_required = ?, status = ?, owner = ?,
          current_handler = ?, due_date = ?, submitted_at = ?, approved_at = ?,
          reference_url = ?, revision = ?, note = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        input.title,
        input.category,
        input.isRequired ? 1 : 0,
        input.status,
        input.owner,
        input.currentHandler,
        input.dueDate,
        input.submittedAt,
        input.approvedAt,
        input.referenceUrl,
        input.revision,
        input.note,
        updatedAt,
        documentId,
      ),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(updatedAt, existing.project_id),
    insertProjectUpdateStatement(db, auditUpdate),
  ]);
  return {
    id: existing.id,
    projectId: existing.project_id,
    ...input,
    createdAt: existing.created_at,
    updatedAt,
  };
}

export async function createFarmProjectUpdate(
  projectId: string,
  input: FarmProjectUpdateInput,
): Promise<FarmProjectUpdate> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const project = await db
    .prepare('SELECT id, status FROM smartfarm_projects WHERE id = ?')
    .bind(projectId)
    .first<{ id: string; status: FarmProjectStatus }>();
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
  if (project.status === 'completed' && input.kind === 'blocker')
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  if (
    input.kind === 'blocker' &&
    (!input.blockedReason.trim() || !input.blockedBy.trim())
  ) {
    throw new Error('FARM_PROJECT_BLOCKER_DETAILS_REQUIRED');
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
  await db.batch([
    insertProjectUpdateStatement(db, update),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(Math.max(now, update.occurredAt), projectId),
  ]);
  return update;
}

export async function resolveFarmProjectBlocker(
  updateId: string,
  resolution: string,
  resolvedBy: string,
): Promise<FarmProjectUpdate> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const existing = await db
    .prepare(`
      SELECT id, project_id, kind, title, channel, sender, received_content,
             action_content, recorder, occurred_at, reference_url,
             blocked_reason, blocked_by, expected_unblock_date, resolved_at,
             resolution, resolved_by, created_at, updated_at
      FROM farm_project_updates
      WHERE id = ?
    `)
    .bind(updateId)
    .first<FarmProjectUpdateRow>();
  if (!existing) throw new Error('FARM_PROJECT_UPDATE_NOT_FOUND');
  if (existing.kind !== 'blocker')
    throw new Error('FARM_PROJECT_BLOCKER_REQUIRED');
  if (existing.resolved_at)
    throw new Error('FARM_PROJECT_BLOCKER_ALREADY_RESOLVED');
  if (!resolution.trim() || !resolvedBy.trim())
    throw new Error('FARM_PROJECT_BLOCKER_RESOLUTION_REQUIRED');
  const resolvedAt = Date.now();
  if (resolvedAt < existing.occurred_at)
    throw new Error('FARM_PROJECT_BLOCKER_TIME_INVALID');
  const updateResult = await db
    .prepare(`
        UPDATE farm_project_updates SET
          resolved_at = ?, resolution = ?, resolved_by = ?, updated_at = ?
        WHERE id = ? AND resolved_at = 0
      `)
    .bind(
      resolvedAt,
      resolution.trim(),
      resolvedBy.trim(),
      resolvedAt,
      updateId,
    )
    .run();
  if ((updateResult.meta.changes ?? 0) !== 1)
    throw new Error('FARM_PROJECT_BLOCKER_ALREADY_RESOLVED');
  const resolutionUpdate = systemProjectUpdate(
    existing.project_id,
    `${existing.title} 해결`,
    resolution.trim(),
    resolvedBy.trim(),
    resolvedAt,
  );
  resolutionUpdate.referenceUrl = existing.reference_url;
  await db.batch([
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(resolvedAt, existing.project_id),
    insertProjectUpdateStatement(db, resolutionUpdate),
  ]);
  return {
    ...mapProjectUpdate(existing),
    resolvedAt,
    resolution: resolution.trim(),
    resolvedBy: resolvedBy.trim(),
    updatedAt: resolvedAt,
  };
}

export async function createFarm(input: FarmInput): Promise<Farm> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const duplicate = await db
    .prepare('SELECT id FROM farms WHERE farm_code = ?')
    .bind(input.farmCode)
    .first<{ id: string }>();
  if (duplicate) throw new Error('FARM_CODE_EXISTS');

  const now = Date.now();
  const farm: Farm = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await db
    .prepare(`
    INSERT INTO farms (
      id, farm_code, name, phone, address, region, business_number,
      folder_url, location_url, special_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      farm.id,
      farm.farmCode,
      farm.name,
      farm.phone,
      farm.address,
      farm.region,
      farm.businessNumber,
      farm.folderUrl,
      farm.locationUrl,
      farm.specialNotes,
      farm.createdAt,
      farm.updatedAt,
    )
    .run();
  return farm;
}

export async function createFarmWithRecord(
  farmInput: FarmInput,
  recordInput: FarmRecordInput,
  recorder: string,
): Promise<FarmCreationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [project, duplicate] = await Promise.all([
    db
      .prepare('SELECT id, name, status FROM smartfarm_projects WHERE id = ?')
      .bind(recordInput.projectId)
      .first<{ id: string; name: string; status: FarmProjectStatus }>(),
    db
      .prepare('SELECT id FROM farms WHERE farm_code = ?')
      .bind(farmInput.farmCode)
      .first<{ id: string }>(),
  ]);
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
  if (project.status === 'completed')
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  if (duplicate) throw new Error('FARM_CODE_EXISTS');

  const now = Date.now();
  const farm: Farm = {
    id: crypto.randomUUID(),
    ...farmInput,
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

  await db.batch([
    db
      .prepare(`
      INSERT INTO farms (
        id, farm_code, name, phone, address, region, business_number,
        folder_url, location_url, special_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        farm.id,
        farm.farmCode,
        farm.name,
        farm.phone,
        farm.address,
        farm.region,
        farm.businessNumber,
        farm.folderUrl,
        farm.locationUrl,
        farm.specialNotes,
        farm.createdAt,
        farm.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        record.id,
        record.farmId,
        record.projectId,
        record.crop,
        record.deviceType,
        record.productType,
        record.vendor,
        record.productionSetupDate,
        record.installationDate,
        record.commissioningDate,
        record.educationDate,
        record.internetType,
        record.warrantyYears,
        record.warrantyExpiresAt,
        record.subscriptionYears,
        record.initialSubscriptionExpiresAt,
        record.currentSubscriptionExpiresAt,
        record.lastPaymentDate,
        record.renewalCount,
        record.subscriptionStatus,
        record.notes,
        record.lastActivityAt,
        record.createdAt,
        record.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        expected_outcome, next_action, priority, review_date, completed_at,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        workItem.id,
        workItem.farmRecordId,
        workItem.workType,
        workItem.title,
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.description,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.createdAt,
        workItem.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(now, record.projectId),
  ]);

  return { farm, record, workItem, historyEntry };
}

export async function createFarmRecord(
  farmId: string,
  input: FarmRecordInput,
  recorder: string,
): Promise<FarmRecordMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [farm, project, duplicate] = await Promise.all([
    db
      .prepare('SELECT id, name FROM farms WHERE id = ?')
      .bind(farmId)
      .first<{ id: string; name: string }>(),
    db
      .prepare('SELECT id, name, status FROM smartfarm_projects WHERE id = ?')
      .bind(input.projectId)
      .first<{ id: string; name: string; status: FarmProjectStatus }>(),
    db
      .prepare(
        'SELECT id FROM farm_records WHERE farm_id = ? AND project_id = ? LIMIT 1',
      )
      .bind(farmId, input.projectId)
      .first<{ id: string }>(),
  ]);
  if (!farm) throw new Error('FARM_NOT_FOUND');
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
  if (project.status === 'completed')
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  if (duplicate) throw new Error('FARM_RECORD_PROJECT_EXISTS');

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

  await db.batch([
    db
      .prepare(`
      INSERT INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        record.id,
        record.farmId,
        record.projectId,
        record.crop,
        record.deviceType,
        record.productType,
        record.vendor,
        record.productionSetupDate,
        record.installationDate,
        record.commissioningDate,
        record.educationDate,
        record.internetType,
        record.warrantyYears,
        record.warrantyExpiresAt,
        record.subscriptionYears,
        record.initialSubscriptionExpiresAt,
        record.currentSubscriptionExpiresAt,
        record.lastPaymentDate,
        record.renewalCount,
        record.subscriptionStatus,
        record.notes,
        record.lastActivityAt,
        record.createdAt,
        record.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        expected_outcome, next_action, priority, review_date, completed_at,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        workItem.id,
        workItem.farmRecordId,
        workItem.workType,
        workItem.title,
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.description,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.createdAt,
        workItem.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, farmId),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(now, input.projectId),
  ]);

  return { record, workItem, historyEntry };
}

export async function updateFarm(
  farmId: string,
  input: FarmInput,
): Promise<Farm> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [existing, duplicate] = await Promise.all([
    db
      .prepare(`
      SELECT id, farm_code, name, phone, address, region, business_number,
             folder_url, location_url, special_notes, created_at, updated_at
      FROM farms WHERE id = ?
    `)
      .bind(farmId)
      .first<FarmRow>(),
    db
      .prepare('SELECT id FROM farms WHERE farm_code = ? AND id <> ?')
      .bind(input.farmCode, farmId)
      .first<{ id: string }>(),
  ]);
  if (!existing) throw new Error('FARM_NOT_FOUND');
  if (duplicate) throw new Error('FARM_CODE_EXISTS');

  const farm: Farm = {
    id: farmId,
    ...input,
    createdAt: existing.created_at,
    updatedAt: Date.now(),
  };
  await db
    .prepare(`
    UPDATE farms SET
      farm_code = ?, name = ?, phone = ?, address = ?, region = ?, business_number = ?,
      folder_url = ?, location_url = ?, special_notes = ?, updated_at = ?
    WHERE id = ?
  `)
    .bind(
      farm.farmCode,
      farm.name,
      farm.phone,
      farm.address,
      farm.region,
      farm.businessNumber,
      farm.folderUrl,
      farm.locationUrl,
      farm.specialNotes,
      farm.updatedAt,
      farm.id,
    )
    .run();
  return farm;
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

export async function updateFarmRecord(
  recordId: string,
  input: FarmRecordInput,
  recorder: string,
): Promise<FarmRecordMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [existingRow, project, subscriptionEvent] = await Promise.all([
    db
      .prepare(`
      SELECT id, farm_id, project_id, crop, device_type, product_type, vendor,
             production_setup_date, installation_date, commissioning_date, education_date,
             internet_type, warranty_years, warranty_expires_at, subscription_years,
             initial_subscription_expires_at, current_subscription_expires_at,
             last_payment_date, renewal_count, subscription_status, notes,
             last_activity_at, created_at, updated_at
      FROM farm_records WHERE id = ?
    `)
      .bind(recordId)
      .first<FarmRecordRow>(),
    db
      .prepare('SELECT id, status FROM smartfarm_projects WHERE id = ?')
      .bind(input.projectId)
      .first<{ id: string; status: FarmProjectStatus }>(),
    db
      .prepare(
        'SELECT id FROM farm_subscription_events WHERE farm_record_id = ? LIMIT 1',
      )
      .bind(recordId)
      .first<{ id: string }>(),
  ]);
  if (!existingRow) throw new Error('FARM_RECORD_NOT_FOUND');
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
  if (existingRow.project_id !== input.projectId) {
    const previousProject = await db
      .prepare('SELECT status FROM smartfarm_projects WHERE id = ?')
      .bind(existingRow.project_id)
      .first<{ status: FarmProjectStatus }>();
    if (
      project.status === 'completed' ||
      previousProject?.status === 'completed'
    ) {
      throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
    }
    const duplicate = await db
      .prepare(`
        SELECT id FROM farm_records
        WHERE farm_id = ? AND project_id = ? AND id != ?
        LIMIT 1
      `)
      .bind(existingRow.farm_id, input.projectId, recordId)
      .first<{ id: string }>();
    if (duplicate) throw new Error('FARM_RECORD_PROJECT_EXISTS');
  }

  const existing = mapRecord(existingRow);
  if (
    subscriptionEvent &&
    (existing.currentSubscriptionExpiresAt !==
      input.currentSubscriptionExpiresAt ||
      existing.renewalCount !== input.renewalCount ||
      existing.subscriptionStatus !== input.subscriptionStatus)
  ) {
    throw new Error('FARM_SUBSCRIPTION_EVENT_MANAGED');
  }
  const now = Date.now();
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

  const projectUpdates =
    existing.projectId === input.projectId
      ? [
          db
            .prepare(
              'UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?',
            )
            .bind(now, input.projectId),
        ]
      : [
          db
            .prepare(
              'UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?',
            )
            .bind(now, existing.projectId),
          db
            .prepare(
              'UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?',
            )
            .bind(now, input.projectId),
        ];

  await db.batch([
    db
      .prepare(`
      UPDATE farm_records SET
        project_id = ?, crop = ?, device_type = ?, product_type = ?, vendor = ?,
        production_setup_date = ?, installation_date = ?, commissioning_date = ?, education_date = ?,
        internet_type = ?, warranty_years = ?, warranty_expires_at = ?, subscription_years = ?,
        initial_subscription_expires_at = ?, current_subscription_expires_at = ?,
        last_payment_date = ?, renewal_count = ?, subscription_status = ?, notes = ?,
        last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        record.projectId,
        record.crop,
        record.deviceType,
        record.productType,
        record.vendor,
        record.productionSetupDate,
        record.installationDate,
        record.commissioningDate,
        record.educationDate,
        record.internetType,
        record.warrantyYears,
        record.warrantyExpiresAt,
        record.subscriptionYears,
        record.initialSubscriptionExpiresAt,
        record.currentSubscriptionExpiresAt,
        record.lastPaymentDate,
        record.renewalCount,
        record.subscriptionStatus,
        record.notes,
        record.lastActivityAt,
        record.updatedAt,
        record.id,
      ),
    db
      .prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        expected_outcome, next_action, priority, review_date, completed_at,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        workItem.id,
        workItem.farmRecordId,
        workItem.workType,
        workItem.title,
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.description,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.createdAt,
        workItem.updatedAt,
      ),
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, record.farmId),
    ...projectUpdates,
  ]);

  return { record, workItem, historyEntry };
}

export async function createFarmSubscriptionEvent(
  input: FarmSubscriptionEventInput,
): Promise<FarmSubscriptionEvent> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [record, priorChurn] = await Promise.all([
    db
      .prepare(`
        SELECT fr.id, fr.farm_id, fr.project_id,
               fr.current_subscription_expires_at, fr.renewal_count,
               fr.subscription_status, f.name AS farm_name,
               p.name AS project_name
        FROM farm_records fr
        INNER JOIN farms f ON f.id = fr.farm_id
        INNER JOIN smartfarm_projects p ON p.id = fr.project_id
        WHERE fr.id = ?
      `)
      .bind(input.farmRecordId)
      .first<{
        id: string;
        farm_id: string;
        project_id: string;
        current_subscription_expires_at: string;
        renewal_count: number;
        subscription_status: SubscriptionStatus;
        farm_name: string;
        project_name: string;
      }>(),
    db
      .prepare(`
        SELECT id FROM farm_subscription_events
        WHERE farm_record_id = ? AND event_type = 'churned'
        LIMIT 1
      `)
      .bind(input.farmRecordId)
      .first<{ id: string }>(),
  ]);
  if (!record) throw new Error('FARM_RECORD_NOT_FOUND');

  if (
    input.eventType !== 'rejoined' &&
    record.current_subscription_expires_at &&
    input.basisExpiryDate > record.current_subscription_expires_at
  ) {
    throw new Error('FARM_SUBSCRIPTION_BASIS_INVALID');
  }
  if (
    input.eventType === 'rejoined' &&
    record.subscription_status !== 'expired' &&
    !priorChurn
  ) {
    throw new Error('FARM_SUBSCRIPTION_REJOIN_REQUIRES_CHURN');
  }

  const now = Date.now();
  const event: FarmSubscriptionEvent = {
    id: crypto.randomUUID(),
    farmRecordId: record.id,
    projectId: record.project_id,
    eventType: input.eventType,
    basisExpiryDate: input.basisExpiryDate,
    processedAt: input.processedAt,
    newExpiryDate: input.newExpiryDate,
    recorder: input.recorder,
    note: input.note,
    createdAt: now,
  };

  let nextExpiry = record.current_subscription_expires_at;
  let nextStatus = record.subscription_status;
  let nextRenewalCount = record.renewal_count;
  if (
    (event.eventType === 'renewed' || event.eventType === 'rejoined') &&
    event.newExpiryDate > nextExpiry
  ) {
    nextExpiry = event.newExpiryDate;
    nextStatus = 'active';
    if (event.eventType === 'renewed') nextRenewalCount += 1;
  } else if (
    event.eventType === 'churned' &&
    (!nextExpiry || event.basisExpiryDate >= nextExpiry)
  ) {
    nextExpiry ||= event.basisExpiryDate;
    nextStatus = 'expired';
  }

  const label = {
    renewed: '갱신',
    churned: '이탈',
    rejoined: '재가입',
  }[event.eventType];
  const resultText = event.newExpiryDate
    ? `${event.basisExpiryDate} 만료 구독을 ${event.newExpiryDate}까지 ${label} 처리했습니다.`
    : `${event.basisExpiryDate} 만료 구독을 ${label} 처리했습니다.`;
  const { workItem, historyEntry } = auditArtifacts(
    record.farm_id,
    record.id,
    event.recorder,
    `구독 ${label} 처리`,
    event.note ? `${resultText}\n메모: ${event.note}` : resultText,
    Date.parse(`${event.processedAt}T00:00:00+09:00`),
  );
  workItem.workType = 'subscription';

  await db.batch([
    db
      .prepare(`
        INSERT INTO farm_subscription_events (
          id, farm_record_id, project_id, event_type, basis_expiry_date,
          processed_at, new_expiry_date, recorder, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        event.id,
        event.farmRecordId,
        event.projectId,
        event.eventType,
        event.basisExpiryDate,
        event.processedAt,
        event.newExpiryDate,
        event.recorder,
        event.note,
        event.createdAt,
      ),
    db
      .prepare(`
        UPDATE farm_records SET
          current_subscription_expires_at = ?, renewal_count = ?,
          subscription_status = ?, last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(nextExpiry, nextRenewalCount, nextStatus, now, now, record.id),
    db
      .prepare(`
        INSERT INTO farm_work_items (
          id, farm_record_id, work_type, title, status, owner, due_date,
          description, expected_outcome, next_action, priority, review_date,
          completed_at, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        workItem.id,
        workItem.farmRecordId,
        workItem.workType,
        workItem.title,
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.description,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.createdAt,
        workItem.updatedAt,
      ),
    db
      .prepare(`
        INSERT INTO farm_history_entries (
          id, work_item_id, channel, sender, received_content, action_content,
          amount, recorder, occurred_at, reference_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, record.farm_id),
    db
      .prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
      .bind(now, record.project_id),
  ]);

  return event;
}

export async function createFarmWorkItem(
  input: FarmWorkItemInput,
  initialHistory: FarmInitialHistoryEntryInput,
  checklistContents: string[] = [],
  sourceInboxId = '',
): Promise<FarmWorkItemMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [record, sourceInbox] = await Promise.all([
    db
      .prepare(`
        SELECT fr.id, fr.farm_id, p.status AS project_status
        FROM farm_records fr
        INNER JOIN smartfarm_projects p ON p.id = fr.project_id
        WHERE fr.id = ?
      `)
      .bind(input.farmRecordId)
      .first<{
        id: string;
        farm_id: string;
        project_status: FarmProjectStatus;
      }>(),
    sourceInboxId
      ? db
          .prepare(`
          SELECT i.id, i.channel, i.sender, i.content, i.captured_by, i.received_at,
                 i.reference_url, i.status, COALESCE(c.work_item_id, '') AS converted_work_item_id,
                 i.created_at, i.updated_at
          FROM farm_inbox_items i
          LEFT JOIN farm_inbox_conversions c ON c.inbox_item_id = i.id
          WHERE i.id = ?
        `)
          .bind(sourceInboxId)
          .first<FarmInboxItemRow>()
      : Promise.resolve(null),
  ]);
  if (!record) throw new Error('FARM_RECORD_NOT_FOUND');
  if (record.project_status === 'completed')
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  if (sourceInboxId && !sourceInbox)
    throw new Error('FARM_INBOX_ITEM_NOT_FOUND');
  if (sourceInbox && sourceInbox.status !== 'unprocessed') {
    throw new Error('FARM_INBOX_ALREADY_PROCESSED');
  }
  if (input.status === 'completed' && checklistContents.length > 0) {
    throw new Error('FARM_CHECKLIST_INCOMPLETE');
  }

  const now = Date.now();
  const initialActionAt = sourceInbox ? now : initialHistory.occurredAt;
  const workItem: FarmWorkItem = {
    id: crypto.randomUUID(),
    ...input,
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
    farmId: record.farm_id,
    lastActivityAt: sourceInbox ? now : initialHistory.occurredAt,
    createdAt: now,
    updatedAt: now,
  };
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(),
    workItemId: workItem.id,
    ...(sourceInbox
      ? {
          channel: sourceInbox.channel,
          sender: sourceInbox.sender || '발신자 미상',
          receivedContent: sourceInbox.content,
          actionContent: '',
          amount: 0,
          recorder: sourceInbox.captured_by || initialHistory.recorder,
          occurredAt: sourceInbox.received_at,
          referenceUrl: sourceInbox.reference_url,
        }
      : initialHistory),
    createdAt: now,
  };
  const transitionHistory: FarmHistoryEntry | null = sourceInbox
    ? {
        id: crypto.randomUUID(),
        workItemId: workItem.id,
        channel: 'system',
        sender: '',
        receivedContent: '',
        actionContent:
          initialHistory.actionContent.trim() ||
          '수신함 내용을 업무로 정리하고 다음 행동을 설정했습니다.',
        amount: initialHistory.amount,
        recorder: initialHistory.recorder,
        occurredAt: now,
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

  await db.batch([
    db
      .prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        expected_outcome, next_action, priority, review_date,
        response_due_at, responded_at, blocked_at, blocked_reason, blocked_by,
        expected_unblock_date, completed_at, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        workItem.id,
        workItem.farmRecordId,
        workItem.workType,
        workItem.title,
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.description,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.responseDueAt,
        workItem.respondedAt,
        workItem.blockedAt,
        workItem.blockedReason,
        workItem.blockedBy,
        workItem.expectedUnblockDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.createdAt,
        workItem.updatedAt,
      ),
    ...(blockerEpisode
      ? [
          db
            .prepare(`
              INSERT INTO farm_blocker_episodes (
                id, work_item_id, reason, blocked_by, expected_unblock_date,
                opened_at, closed_at, resolution, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              blockerEpisode.id,
              blockerEpisode.workItemId,
              blockerEpisode.reason,
              blockerEpisode.blockedBy,
              blockerEpisode.expectedUnblockDate,
              blockerEpisode.openedAt,
              blockerEpisode.closedAt,
              blockerEpisode.resolution,
              blockerEpisode.createdAt,
              blockerEpisode.updatedAt,
            ),
        ]
      : []),
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    ...(transitionHistory
      ? [
          db
            .prepare(`
              INSERT INTO farm_history_entries (
                id, work_item_id, channel, sender, received_content, action_content,
                amount, recorder, occurred_at, reference_url, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              transitionHistory.id,
              transitionHistory.workItemId,
              transitionHistory.channel,
              transitionHistory.sender,
              transitionHistory.receivedContent,
              transitionHistory.actionContent,
              transitionHistory.amount,
              transitionHistory.recorder,
              transitionHistory.occurredAt,
              transitionHistory.referenceUrl,
              transitionHistory.createdAt,
            ),
        ]
      : []),
    ...checklistItems.map((item) =>
      db
        .prepare(`
      INSERT INTO farm_work_checklist_items (
        id, work_item_id, content, is_completed, sort_order, completed_by,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
          item.id,
          item.workItemId,
          item.content,
          item.isCompleted ? 1 : 0,
          item.sortOrder,
          item.completedBy,
          item.completedAt,
          item.createdAt,
          item.updatedAt,
        ),
    ),
    ...(sourceInboxId
      ? [
          db
            .prepare(`
            INSERT INTO farm_inbox_conversions (inbox_item_id, work_item_id, created_at)
            VALUES (?, ?, ?)
          `)
            .bind(sourceInboxId, workItem.id, now),
          db
            .prepare(`
          UPDATE farm_inbox_items
          SET status = 'converted', updated_at = ?
          WHERE id = ? AND status = 'unprocessed'
        `)
            .bind(now, sourceInboxId),
        ]
      : []),
    db
      .prepare(`
      UPDATE farm_records
      SET last_activity_at = CASE WHEN last_activity_at > ? THEN last_activity_at ELSE ? END,
          updated_at = ?
      WHERE id = ?
    `)
      .bind(
        workItem.lastActivityAt,
        workItem.lastActivityAt,
        now,
        input.farmRecordId,
      ),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, record.farm_id),
  ]);
  return { workItem, historyEntry };
}

export async function createFarmInboxItem(
  input: FarmInboxItemInput,
): Promise<FarmInboxItem> {
  await ensureFarmLedgerStore();
  const now = Date.now();
  const inboxItem: FarmInboxItem = {
    id: crypto.randomUUID(),
    ...input,
    status: 'unprocessed',
    convertedWorkItemId: '',
    createdAt: now,
    updatedAt: now,
  };
  await getD1()
    .prepare(`
    INSERT INTO farm_inbox_items (
      id, channel, sender, content, captured_by, received_at, reference_url,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      inboxItem.id,
      inboxItem.channel,
      inboxItem.sender,
      inboxItem.content,
      inboxItem.capturedBy,
      inboxItem.receivedAt,
      inboxItem.referenceUrl,
      inboxItem.status,
      inboxItem.createdAt,
      inboxItem.updatedAt,
    )
    .run();
  return inboxItem;
}

export async function updateFarmInboxStatus(
  inboxItemId: string,
  status: FarmInboxStatus,
): Promise<FarmInboxItem> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const row = await db
    .prepare(`
    SELECT i.id, i.channel, i.sender, i.content, i.captured_by, i.received_at,
           i.reference_url, i.status, COALESCE(c.work_item_id, '') AS converted_work_item_id,
           i.created_at, i.updated_at
    FROM farm_inbox_items i
    LEFT JOIN farm_inbox_conversions c ON c.inbox_item_id = i.id
    WHERE i.id = ?
  `)
    .bind(inboxItemId)
    .first<FarmInboxItemRow>();
  if (!row) throw new Error('FARM_INBOX_ITEM_NOT_FOUND');
  if (row.status !== 'unprocessed') {
    throw new Error('FARM_INBOX_ALREADY_PROCESSED');
  }

  const inboxItem = mapInboxItem({ ...row, status, updated_at: Date.now() });
  const updateResult = await db
    .prepare(`
    UPDATE farm_inbox_items
    SET status = ?, updated_at = ?
    WHERE id = ?
      AND status = 'unprocessed'
      AND NOT EXISTS (
        SELECT 1 FROM farm_inbox_conversions WHERE inbox_item_id = ?
      )
  `)
    .bind(inboxItem.status, inboxItem.updatedAt, inboxItem.id, inboxItem.id)
    .run();
  if ((updateResult.meta.changes ?? 0) !== 1) {
    throw new Error('FARM_INBOX_ALREADY_PROCESSED');
  }
  return inboxItem;
}

export async function saveFarmWorkVisit(input: FarmWorkVisitInput): Promise<{
  visit: FarmWorkVisit;
  historyEntry: FarmHistoryEntry;
  followUpVisit: FarmWorkVisit | null;
}> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const work = await db
    .prepare(`
      SELECT wi.id, wi.status, wi.farm_record_id, fr.farm_id
      FROM farm_work_items wi
      INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
      WHERE wi.id = ?
    `)
    .bind(input.workItemId)
    .first<{
      id: string;
      status: FarmWorkStatus;
      farm_record_id: string;
      farm_id: string;
    }>();
  if (!work) throw new Error('FARM_WORK_ITEM_NOT_FOUND');
  if (work.status === 'completed') throw new Error('FARM_WORK_COMPLETED');

  const existingVisit = input.id
    ? await db
        .prepare(`
          SELECT id, status, created_at
          FROM farm_work_visits
          WHERE id = ? AND work_item_id = ?
        `)
        .bind(input.id, input.workItemId)
        .first<{
          id: string;
          status: FarmVisitStatus;
          created_at: number;
        }>()
    : null;
  if (input.id && !existingVisit) throw new Error('FARM_VISIT_NOT_FOUND');
  if (
    existingVisit &&
    (existingVisit.status === 'completed' ||
      existingVisit.status === 'canceled')
  ) {
    throw new Error('FARM_VISIT_LOCKED');
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
    createdAt: existingVisit?.created_at ?? now,
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
  const followUpLabel = followUpVisit
    ? ` · 후속 방문 ${new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(followUpVisit.scheduledAt))}`
    : '';
  const actionContent =
    visit.status === 'completed'
      ? `현장 방문 완료: ${scheduledLabel} · ${visit.result}${followUpLabel}`
      : visit.status === 'canceled'
        ? `현장 방문 취소: ${scheduledLabel} · ${visit.result}${followUpLabel}`
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

  const visitStatement = input.id
    ? db
        .prepare(`
          UPDATE farm_work_visits
          SET scheduled_at = ?, assigned_to = ?, status = ?,
              actual_started_at = ?, actual_ended_at = ?, preparation_note = ?,
              result = ?, next_visit_at = ?, recorded_by = ?, updated_at = ?
          WHERE id = ? AND work_item_id = ?
        `)
        .bind(
          visit.scheduledAt,
          visit.assignedTo,
          visit.status,
          visit.actualStartedAt,
          visit.actualEndedAt,
          visit.preparationNote,
          visit.result,
          visit.nextVisitAt,
          visit.recordedBy,
          visit.updatedAt,
          visit.id,
          visit.workItemId,
        )
    : db
        .prepare(`
          INSERT INTO farm_work_visits (
            id, work_item_id, scheduled_at, assigned_to, status,
            actual_started_at, actual_ended_at, preparation_note, result,
            next_visit_at, recorded_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          visit.id,
          visit.workItemId,
          visit.scheduledAt,
          visit.assignedTo,
          visit.status,
          visit.actualStartedAt,
          visit.actualEndedAt,
          visit.preparationNote,
          visit.result,
          visit.nextVisitAt,
          visit.recordedBy,
          visit.createdAt,
          visit.updatedAt,
        );

  await db.batch([
    visitStatement,
    ...(followUpVisit
      ? [
          db
            .prepare(`
              INSERT INTO farm_work_visits (
                id, work_item_id, scheduled_at, assigned_to, status,
                actual_started_at, actual_ended_at, preparation_note, result,
                next_visit_at, recorded_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              followUpVisit.id,
              followUpVisit.workItemId,
              followUpVisit.scheduledAt,
              followUpVisit.assignedTo,
              followUpVisit.status,
              followUpVisit.actualStartedAt,
              followUpVisit.actualEndedAt,
              followUpVisit.preparationNote,
              followUpVisit.result,
              followUpVisit.nextVisitAt,
              followUpVisit.recordedBy,
              followUpVisit.createdAt,
              followUpVisit.updatedAt,
            ),
        ]
      : []),
    db
      .prepare(`
        INSERT INTO farm_history_entries (
          id, work_item_id, channel, sender, received_content, action_content,
          amount, recorder, occurred_at, reference_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    db
      .prepare(`
        UPDATE farm_work_items
        SET last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, now, visit.workItemId),
    db
      .prepare(`
        UPDATE farm_records
        SET last_activity_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(now, now, work.farm_record_id),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, work.farm_id),
  ]);

  return { visit, historyEntry, followUpVisit };
}

export async function toggleFarmChecklistItem(
  workItemId: string,
  checklistItemId: string,
  isCompleted: boolean,
  completedBy: string,
): Promise<FarmWorkChecklistItem> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const row = await db
    .prepare(`
    SELECT id, work_item_id, content, is_completed, sort_order, completed_by,
           completed_at, created_at, updated_at
    FROM farm_work_checklist_items
    WHERE id = ? AND work_item_id = ?
  `)
    .bind(checklistItemId, workItemId)
    .first<FarmWorkChecklistItemRow>();
  if (!row) throw new Error('FARM_CHECKLIST_ITEM_NOT_FOUND');
  const parentWorkItem = await db
    .prepare('SELECT status FROM farm_work_items WHERE id = ?')
    .bind(workItemId)
    .first<{ status: FarmWorkStatus }>();
  if (parentWorkItem?.status === 'completed') {
    throw new Error('FARM_COMPLETED_CHECKLIST_LOCKED');
  }

  const now = Date.now();
  const checklistItem = mapChecklistItem({
    ...row,
    is_completed: isCompleted ? 1 : 0,
    completed_by: isCompleted ? completedBy : '',
    completed_at: isCompleted ? now : 0,
    updated_at: now,
  });
  const actionContent = `${isCompleted ? '체크리스트 완료' : '체크리스트 확인 취소'}: ${checklistItem.content}`;
  await db.batch([
    db
      .prepare(`
      UPDATE farm_work_checklist_items
      SET is_completed = ?, completed_by = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND work_item_id = ?
    `)
      .bind(
        checklistItem.isCompleted ? 1 : 0,
        checklistItem.completedBy,
        checklistItem.completedAt,
        checklistItem.updatedAt,
        checklistItem.id,
        checklistItem.workItemId,
      ),
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, 'system', '', '', ?, 0, ?, ?, '', ?)
    `)
      .bind(
        crypto.randomUUID(),
        workItemId,
        actionContent,
        completedBy,
        now,
        now,
      ),
    db
      .prepare(`
      UPDATE farm_work_items
      SET last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(now, now, workItemId),
    db
      .prepare(`
      UPDATE farm_records
      SET last_activity_at = ?, updated_at = ?
      WHERE id = (SELECT farm_record_id FROM farm_work_items WHERE id = ?)
    `)
      .bind(now, now, workItemId),
    db
      .prepare(`
      UPDATE farms
      SET updated_at = ?
      WHERE id = (
        SELECT fr.farm_id
        FROM farm_records fr
        INNER JOIN farm_work_items wi ON wi.farm_record_id = fr.id
        WHERE wi.id = ?
      )
    `)
      .bind(now, workItemId),
  ]);
  return checklistItem;
}

export async function addFarmHistoryEntry(
  input: AddFarmHistoryEntryInput,
): Promise<FarmWorkItemMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const row = await db
    .prepare(`
    SELECT wi.id, wi.farm_record_id, fr.farm_id, wi.work_type, wi.title, wi.status,
           wi.owner, wi.due_date, wi.description, wi.expected_outcome, wi.next_action,
           wi.priority, wi.review_date, wi.response_due_at, wi.responded_at,
           wi.blocked_at, wi.blocked_reason, wi.blocked_by, wi.expected_unblock_date,
           wi.completed_at, wi.last_activity_at,
           wi.created_at, wi.updated_at, p.status AS project_status
    FROM farm_work_items wi
    INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
    INNER JOIN smartfarm_projects p ON p.id = fr.project_id
    WHERE wi.id = ?
  `)
    .bind(input.workItemId)
    .first<FarmWorkItemRow & { project_status: FarmProjectStatus }>();
  if (!row) throw new Error('FARM_WORK_ITEM_NOT_FOUND');

  const existing = mapWorkItem(row);
  if (
    row.project_status === 'completed' &&
    input.newStatus !== undefined &&
    input.newStatus !== 'completed'
  ) {
    throw new Error('FARM_PROJECT_COMPLETED_LOCKED');
  }
  if (input.newStatus === 'completed' && existing.status !== 'completed') {
    const [incompleteChecklist, pendingVisits] = await Promise.all([
      db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM farm_work_checklist_items
          WHERE work_item_id = ? AND is_completed = 0
        `)
        .bind(input.workItemId)
        .first<{ count: number }>(),
      db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM farm_work_visits
          WHERE work_item_id = ? AND status = 'scheduled'
        `)
        .bind(input.workItemId)
        .first<{ count: number }>(),
    ]);
    if ((incompleteChecklist?.count ?? 0) > 0) {
      throw new Error('FARM_CHECKLIST_INCOMPLETE');
    }
    if ((pendingVisits?.count ?? 0) > 0) {
      throw new Error('FARM_VISIT_PENDING');
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
    ...historyInput
  } = input;
  const resolvedStatus = newStatus ?? existing.status;
  if (
    existing.status === 'waiting' &&
    resolvedStatus !== 'waiting' &&
    !historyInput.actionContent.trim()
  ) {
    throw new Error('FARM_BLOCKER_RESOLUTION_REQUIRED');
  }
  if (
    existing.status === 'waiting' &&
    resolvedStatus !== 'waiting' &&
    input.occurredAt < existing.blockedAt
  ) {
    throw new Error('FARM_BLOCKER_TIME_INVALID');
  }
  if (
    (existing.respondedAt || markResponded || resolvedStatus === 'completed') &&
    responseDueAt !== undefined &&
    responseDueAt !== existing.responseDueAt
  ) {
    throw new Error('FARM_RESPONSE_TARGET_LOCKED');
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
    updatedAt: now,
  };
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
    workItem.blockedBy !== existing.blockedBy ? '해제 주체' : '',
    workItem.expectedUnblockDate !== existing.expectedUnblockDate
      ? '예상 해제일'
      : '',
  ].filter(Boolean);
  const isPlanningOnly =
    !historyInput.receivedContent.trim() && !historyInput.actionContent.trim();
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(),
    ...historyInput,
    channel: isPlanningOnly ? 'system' : historyInput.channel,
    sender: isPlanningOnly ? '' : historyInput.sender,
    actionContent: isPlanningOnly
      ? planningChanges.length
        ? `${planningChanges.join(', ')}을(를) 변경했습니다.`
        : '업무 계획을 검토했습니다.'
      : historyInput.actionContent,
    createdAt: now,
  };
  const blockerStatement =
    existing.status !== 'waiting' && resolvedStatus === 'waiting'
      ? db
          .prepare(`
            INSERT INTO farm_blocker_episodes (
              id, work_item_id, reason, blocked_by, expected_unblock_date,
              opened_at, closed_at, resolution, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, '', ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            workItem.id,
            workItem.blockedReason,
            workItem.blockedBy,
            workItem.expectedUnblockDate,
            workItem.blockedAt,
            now,
            now,
          )
      : existing.status === 'waiting' && resolvedStatus === 'waiting'
        ? db
            .prepare(`
              UPDATE farm_blocker_episodes
              SET reason = ?, blocked_by = ?, expected_unblock_date = ?, updated_at = ?
              WHERE work_item_id = ? AND closed_at = 0
            `)
            .bind(
              workItem.blockedReason,
              workItem.blockedBy,
              workItem.expectedUnblockDate,
              now,
              workItem.id,
            )
        : existing.status === 'waiting' && resolvedStatus !== 'waiting'
          ? db
              .prepare(`
                UPDATE farm_blocker_episodes
                SET closed_at = ?, resolution = ?, updated_at = ?
                WHERE work_item_id = ? AND closed_at = 0
              `)
              .bind(
                input.occurredAt,
                historyInput.actionContent,
                now,
                workItem.id,
              )
          : null;

  await db.batch([
    db
      .prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        historyEntry.id,
        historyEntry.workItemId,
        historyEntry.channel,
        historyEntry.sender,
        historyEntry.receivedContent,
        historyEntry.actionContent,
        historyEntry.amount,
        historyEntry.recorder,
        historyEntry.occurredAt,
        historyEntry.referenceUrl,
        historyEntry.createdAt,
      ),
    ...(blockerStatement ? [blockerStatement] : []),
    db
      .prepare(`
      UPDATE farm_work_items
      SET status = ?, owner = ?, due_date = ?, expected_outcome = ?,
          next_action = ?, priority = ?, review_date = ?,
          response_due_at = ?, responded_at = ?, blocked_at = ?,
          blocked_reason = ?, blocked_by = ?, expected_unblock_date = ?,
          completed_at = ?, last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `)
      .bind(
        workItem.status,
        workItem.owner,
        workItem.dueDate,
        workItem.expectedOutcome,
        workItem.nextAction,
        workItem.priority,
        workItem.reviewDate,
        workItem.responseDueAt,
        workItem.respondedAt,
        workItem.blockedAt,
        workItem.blockedReason,
        workItem.blockedBy,
        workItem.expectedUnblockDate,
        workItem.completedAt,
        workItem.lastActivityAt,
        workItem.updatedAt,
        workItem.id,
      ),
    db
      .prepare(`
      UPDATE farm_records
      SET last_activity_at = CASE WHEN last_activity_at > ? THEN last_activity_at ELSE ? END,
          updated_at = ?
      WHERE id = ?
    `)
      .bind(input.occurredAt, input.occurredAt, now, workItem.farmRecordId),
    db
      .prepare('UPDATE farms SET updated_at = ? WHERE id = ?')
      .bind(now, workItem.farmId),
  ]);
  return { workItem, historyEntry };
}
