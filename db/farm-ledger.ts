import type {
  AddFarmHistoryEntryInput,
  Farm,
  FarmCreationResult,
  FarmHistoryChannel,
  FarmHistoryEntry,
  FarmInitialHistoryEntryInput,
  FarmInput,
  FarmLedgerWorkspace,
  FarmProject,
  FarmProjectInput,
  FarmProjectStatus,
  FarmProjectType,
  FarmRecord,
  FarmRecordInput,
  FarmRecordMutationResult,
  FarmWorkItem,
  FarmWorkItemInput,
  FarmWorkItemMutationResult,
  FarmWorkStatus,
  FarmWorkType,
  SubscriptionStatus,
} from '../lib/farm-types';
import { getD1 } from './index';

interface FarmProjectRow {
  id: string;
  name: string;
  project_type: FarmProjectType;
  year: number;
  institution: string;
  status: FarmProjectStatus;
  description: string;
  target_farm_count: number;
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
  last_activity_at: number;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    lastActivityAt: row.last_activity_at,
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
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
        last_activity_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
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
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_smartfarm_projects_status_year ON smartfarm_projects(status, year)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_farm_code ON farms(farm_code)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_records_farm_project ON farm_records(farm_id, project_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_records_project_farm ON farm_records(project_id, farm_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_records_subscription_expiry ON farm_records(subscription_status, current_subscription_expires_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_records_last_activity ON farm_records(last_activity_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_work_items_record_activity ON farm_work_items(farm_record_id, last_activity_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_work_items_status_due ON farm_work_items(status, due_date)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_work_items_type_status ON farm_work_items(work_type, status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_history_work_item_occurred ON farm_history_entries(work_item_id, occurred_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_farm_history_occurred ON farm_history_entries(occurred_at)`),
    db.prepare('PRAGMA optimize'),
  ]);

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
      id: 'sf-project-data-2025', name: '2025 데이터 기반 스마트농업', projectType: 'general',
      year: 2025, institution: '지역 농업기술원', status: 'active',
      description: '과수 농가의 환경·관수 데이터를 수집하고 생산 모델을 적용합니다.', targetFarmCount: 12,
      createdAt: now - 120 * day, updatedAt: now - 2 * hour,
    },
    {
      id: 'sf-project-water-2025', name: '2025 수분스트레스 자동관수', projectType: 'research',
      year: 2025, institution: '농림식품기술기획평가원', status: 'active',
      description: '수분스트레스 측정과 자동관수 제어를 실증합니다.', targetFarmCount: 8,
      createdAt: now - 90 * day, updatedAt: now - 5 * hour,
    },
    {
      id: 'sf-project-outdoor-2024', name: '2024 노지 스마트팜 확산', projectType: 'general',
      year: 2024, institution: '농촌진흥청', status: 'completed',
      description: '노지 과수 농가의 관수·기상 장비를 설치한 사업입니다.', targetFarmCount: 20,
      createdAt: now - 500 * day, updatedAt: now - 20 * day,
    },
    {
      id: 'sf-project-greenhouse-2023', name: '2023 시설원예 스마트팜 보급', projectType: 'general',
      year: 2023, institution: '지방자치단체', status: 'completed',
      description: '시설원예 농가에 환경계측과 제어 장비를 보급했습니다.', targetFarmCount: 10,
      createdAt: now - 800 * day, updatedAt: now - 60 * day,
    },
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
    [0, 0, '포도', '클라우드', '관수내비', '인지시스템', '무선 라우터', 'active', 2, -5, 14, true, true],
    [1, 2, '포도', '라떼판다', '온실내비', '인지시스템', '유선', 'active', 1, -12, 9, true, true],
    [2, 1, '사과', '미니컴', '센서내비', '금화이엔에스', '유선', 'expired', 0, -15, -1, true, false],
    [3, 3, '토마토', '라떼판다', '21년식', '인지시스템', '무선 라우터', 'active', 1, -20, 11, true, true],
    [4, 0, '사과', '클라우드', '관수내비', '경농', '무선 라우터', 'unregistered', 0, -2, 0, false, false],
    [5, 3, '딸기', '라떼판다', '22년식', '인지시스템', '유선', 'active', 2, -25, 18, true, true],
  ] as const;

  const records: FarmRecord[] = recordSeeds.map((seed, index) => {
    const [farmIndex, projectIndex, crop, deviceType, productType, vendor, internetType,
      subscriptionStatus, renewalCount, installedOffset, expiryMonths, commissioned, educated] = seed;
    const installationDate = dateFromToday(installedOffset);
    return {
      id: `sf-record-sample-${String(index + 1).padStart(3, '0')}`,
      farmId: farms[farmIndex].id,
      projectId: projects[projectIndex].id,
      crop, deviceType, productType, vendor,
      productionSetupDate: installationDate,
      installationDate,
      commissioningDate: commissioned ? dateFromToday(installedOffset + 1) : '',
      educationDate: educated ? dateFromToday(installedOffset + 1) : '',
      internetType,
      warrantyYears: 1,
      warrantyExpiresAt: dateFromNowMonths(12),
      subscriptionYears: subscriptionStatus === 'unregistered' ? 0 : 1,
      initialSubscriptionExpiresAt: subscriptionStatus === 'unregistered' ? '' : dateFromNowMonths(expiryMonths),
      currentSubscriptionExpiresAt: subscriptionStatus === 'unregistered' ? '' : dateFromNowMonths(expiryMonths),
      lastPaymentDate: subscriptionStatus === 'active' ? dateFromToday(-30) : '',
      renewalCount,
      subscriptionStatus,
      notes: index === 4 ? '시운전과 교육 일정을 확정해야 합니다.' : '',
      lastActivityAt: farms[farmIndex].updatedAt,
      createdAt: farms[farmIndex].createdAt,
      updatedAt: farms[farmIndex].updatedAt,
    };
  });

  const workItemSeeds = [
    ['communication', '관수 시간 조정 문의', 'completed', '운영 담당자', '', now - 2 * hour],
    ['payment', '연간 구독료 입금 확인', 'completed', '회계 담당자', '', now - 5 * hour],
    ['service', '센서 게이트웨이 통신 불량', 'in_progress', 'A/S 담당자', dateFromToday(2), now - day],
    ['subscription', '구독 갱신 안내 발송', 'waiting', '운영 담당자', dateFromToday(14), now - 2 * day],
    ['installation', '시운전·교육 일정 조율', 'in_progress', '설치 담당자', dateFromToday(5), now - 3 * day],
    ['service', '제어기 화면 점검', 'completed', 'A/S 담당자', '', now - 4 * day],
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
    lastActivityAt: seed[5],
    createdAt: seed[5],
    updatedAt: seed[5],
  }));

  const historyContents = [
    ['kakao', '농가 담당자', '최근 기온 변화에 맞춰 관수 시간을 조정할 수 있는지 문의했습니다.', '데이터 확인 후 오전 관수 시작 시간을 30분 앞당겨 안내했습니다.', 0],
    ['system', '', '', '연간 구독료 입금을 확인하고 구독 상태를 유지했습니다.', 66000],
    ['phone', '농가 담당자', '센서 데이터가 새벽부터 수집되지 않는다고 접수했습니다.', '원격 재부팅을 시도했고 현장 점검 일정을 조율 중입니다.', 0],
    ['email', '', '', '만료 60일 전 갱신 안내 메일을 발송했습니다.', 0],
    ['meeting', '사업 담당자', '장비 설치 후 시운전과 사용자 교육 일정을 확정해 달라는 요청이 있었습니다.', '농가 가능 일정을 확인하고 있습니다.', 0],
    ['phone', '농가 담당자', '화면 밝기가 간헐적으로 어두워진다고 접수했습니다.', '전원 어댑터를 교체한 뒤 정상 동작을 확인했습니다.', 0],
  ] as const;
  const historyEntries: FarmHistoryEntry[] = historyContents.map((seed, index) => ({
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
  }));

  await db.batch([
    ...projects.map((project) => db.prepare(`
      INSERT OR IGNORE INTO smartfarm_projects (
        id, name, project_type, year, institution, status, description,
        target_farm_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(project.id, project.name, project.projectType, project.year, project.institution,
      project.status, project.description, project.targetFarmCount, project.createdAt, project.updatedAt)),
    ...farms.map((farm) => db.prepare(`
      INSERT OR IGNORE INTO farms (
        id, farm_code, name, phone, address, region, business_number,
        folder_url, location_url, special_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(farm.id, farm.farmCode, farm.name, farm.phone, farm.address, farm.region,
      farm.businessNumber, farm.folderUrl, farm.locationUrl, farm.specialNotes, farm.createdAt, farm.updatedAt)),
    ...records.map((record) => db.prepare(`
      INSERT OR IGNORE INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(record.id, record.farmId, record.projectId, record.crop, record.deviceType,
      record.productType, record.vendor, record.productionSetupDate, record.installationDate,
      record.commissioningDate, record.educationDate, record.internetType, record.warrantyYears,
      record.warrantyExpiresAt, record.subscriptionYears, record.initialSubscriptionExpiresAt,
      record.currentSubscriptionExpiresAt, record.lastPaymentDate, record.renewalCount,
      record.subscriptionStatus, record.notes, record.lastActivityAt, record.createdAt, record.updatedAt)),
    ...workItems.map((item) => db.prepare(`
      INSERT OR IGNORE INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(item.id, item.farmRecordId, item.workType, item.title, item.status, item.owner,
      item.dueDate, item.description, item.lastActivityAt, item.createdAt, item.updatedAt)),
    ...historyEntries.map((entry) => db.prepare(`
      INSERT OR IGNORE INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(entry.id, entry.workItemId, entry.channel, entry.sender, entry.receivedContent,
      entry.actionContent, entry.amount, entry.recorder, entry.occurredAt, entry.referenceUrl, entry.createdAt)),
    db.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
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

export async function listFarmLedgerWorkspace(): Promise<FarmLedgerWorkspace> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [projectResult, farmResult, recordResult, workItemResult, historyResult] = await Promise.all([
    db.prepare(`
      SELECT id, name, project_type, year, institution, status, description,
             target_farm_count, created_at, updated_at
      FROM smartfarm_projects
      ORDER BY year DESC, name ASC
      LIMIT 5000
    `).all<FarmProjectRow>(),
    db.prepare(`
      SELECT id, farm_code, name, phone, address, region, business_number,
             folder_url, location_url, special_notes, created_at, updated_at
      FROM farms
      ORDER BY updated_at DESC
      LIMIT 5000
    `).all<FarmRow>(),
    db.prepare(`
      SELECT id, farm_id, project_id, crop, device_type, product_type, vendor,
             production_setup_date, installation_date, commissioning_date, education_date,
             internet_type, warranty_years, warranty_expires_at, subscription_years,
             initial_subscription_expires_at, current_subscription_expires_at,
             last_payment_date, renewal_count, subscription_status, notes,
             last_activity_at, created_at, updated_at
      FROM farm_records
      ORDER BY last_activity_at DESC
      LIMIT 10000
    `).all<FarmRecordRow>(),
    db.prepare(`
      SELECT wi.id, wi.farm_record_id, fr.farm_id, wi.work_type, wi.title, wi.status,
             wi.owner, wi.due_date, wi.description, wi.last_activity_at,
             wi.created_at, wi.updated_at
      FROM farm_work_items wi
      INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
      ORDER BY wi.last_activity_at DESC, wi.created_at DESC
      LIMIT 10000
    `).all<FarmWorkItemRow>(),
    db.prepare(`
      SELECT id, work_item_id, channel, sender, received_content, action_content,
             amount, recorder, occurred_at, reference_url, created_at
      FROM farm_history_entries
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 30000
    `).all<FarmHistoryEntryRow>(),
  ]);

  return {
    projects: projectResult.results.map(mapProject),
    farms: farmResult.results.map(mapFarm),
    records: recordResult.results.map(mapRecord),
    workItems: workItemResult.results.map(mapWorkItem),
    historyEntries: historyResult.results.map(mapHistoryEntry),
  };
}

export async function createFarmProject(input: FarmProjectInput): Promise<FarmProject> {
  await ensureFarmLedgerStore();
  const now = Date.now();
  const project: FarmProject = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
  await getD1().prepare(`
    INSERT INTO smartfarm_projects (
      id, name, project_type, year, institution, status, description,
      target_farm_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(project.id, project.name, project.projectType, project.year, project.institution,
    project.status, project.description, project.targetFarmCount, project.createdAt, project.updatedAt).run();
  return project;
}

export async function createFarm(input: FarmInput): Promise<Farm> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const duplicate = await db.prepare('SELECT id FROM farms WHERE farm_code = ?')
    .bind(input.farmCode).first<{ id: string }>();
  if (duplicate) throw new Error('FARM_CODE_EXISTS');

  const now = Date.now();
  const farm: Farm = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now };
  await db.prepare(`
    INSERT INTO farms (
      id, farm_code, name, phone, address, region, business_number,
      folder_url, location_url, special_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(farm.id, farm.farmCode, farm.name, farm.phone, farm.address, farm.region,
    farm.businessNumber, farm.folderUrl, farm.locationUrl, farm.specialNotes,
    farm.createdAt, farm.updatedAt).run();
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
    db.prepare('SELECT id, name FROM smartfarm_projects WHERE id = ?')
      .bind(recordInput.projectId).first<{ id: string; name: string }>(),
    db.prepare('SELECT id FROM farms WHERE farm_code = ?')
      .bind(farmInput.farmCode).first<{ id: string }>(),
  ]);
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');
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
    db.prepare(`
      INSERT INTO farms (
        id, farm_code, name, phone, address, region, business_number,
        folder_url, location_url, special_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(farm.id, farm.farmCode, farm.name, farm.phone, farm.address, farm.region,
      farm.businessNumber, farm.folderUrl, farm.locationUrl, farm.specialNotes,
      farm.createdAt, farm.updatedAt),
    db.prepare(`
      INSERT INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(record.id, record.farmId, record.projectId, record.crop, record.deviceType,
      record.productType, record.vendor, record.productionSetupDate, record.installationDate,
      record.commissioningDate, record.educationDate, record.internetType, record.warrantyYears,
      record.warrantyExpiresAt, record.subscriptionYears, record.initialSubscriptionExpiresAt,
      record.currentSubscriptionExpiresAt, record.lastPaymentDate, record.renewalCount,
      record.subscriptionStatus, record.notes, record.lastActivityAt, record.createdAt, record.updatedAt),
    db.prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(workItem.id, workItem.farmRecordId, workItem.workType, workItem.title,
      workItem.status, workItem.owner, workItem.dueDate, workItem.description,
      workItem.lastActivityAt, workItem.createdAt, workItem.updatedAt),
    db.prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyEntry.id, historyEntry.workItemId, historyEntry.channel, historyEntry.sender,
      historyEntry.receivedContent, historyEntry.actionContent, historyEntry.amount,
      historyEntry.recorder, historyEntry.occurredAt, historyEntry.referenceUrl, historyEntry.createdAt),
    db.prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?')
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
  const [farm, project] = await Promise.all([
    db.prepare('SELECT id, name FROM farms WHERE id = ?').bind(farmId).first<{ id: string; name: string }>(),
    db.prepare('SELECT id, name FROM smartfarm_projects WHERE id = ?')
      .bind(input.projectId).first<{ id: string; name: string }>(),
  ]);
  if (!farm) throw new Error('FARM_NOT_FOUND');
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');

  const now = Date.now();
  const record: FarmRecord = {
    id: crypto.randomUUID(), farmId, ...input,
    lastActivityAt: now, createdAt: now, updatedAt: now,
  };
  const { workItem, historyEntry } = auditArtifacts(
    farmId, record.id, recorder, '사업 참여 등록',
    `${farm.name} 농가를 ${project.name} 사업에 연결했습니다.`, now,
  );

  await db.batch([
    db.prepare(`
      INSERT INTO farm_records (
        id, farm_id, project_id, crop, device_type, product_type, vendor,
        production_setup_date, installation_date, commissioning_date, education_date,
        internet_type, warranty_years, warranty_expires_at, subscription_years,
        initial_subscription_expires_at, current_subscription_expires_at,
        last_payment_date, renewal_count, subscription_status, notes,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(record.id, record.farmId, record.projectId, record.crop, record.deviceType,
      record.productType, record.vendor, record.productionSetupDate, record.installationDate,
      record.commissioningDate, record.educationDate, record.internetType, record.warrantyYears,
      record.warrantyExpiresAt, record.subscriptionYears, record.initialSubscriptionExpiresAt,
      record.currentSubscriptionExpiresAt, record.lastPaymentDate, record.renewalCount,
      record.subscriptionStatus, record.notes, record.lastActivityAt, record.createdAt, record.updatedAt),
    db.prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(workItem.id, workItem.farmRecordId, workItem.workType, workItem.title,
      workItem.status, workItem.owner, workItem.dueDate, workItem.description,
      workItem.lastActivityAt, workItem.createdAt, workItem.updatedAt),
    db.prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyEntry.id, historyEntry.workItemId, historyEntry.channel, historyEntry.sender,
      historyEntry.receivedContent, historyEntry.actionContent, historyEntry.amount,
      historyEntry.recorder, historyEntry.occurredAt, historyEntry.referenceUrl, historyEntry.createdAt),
    db.prepare('UPDATE farms SET updated_at = ? WHERE id = ?').bind(now, farmId),
    db.prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?').bind(now, input.projectId),
  ]);

  return { record, workItem, historyEntry };
}

export async function updateFarm(farmId: string, input: FarmInput): Promise<Farm> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const [existing, duplicate] = await Promise.all([
    db.prepare(`
      SELECT id, farm_code, name, phone, address, region, business_number,
             folder_url, location_url, special_notes, created_at, updated_at
      FROM farms WHERE id = ?
    `).bind(farmId).first<FarmRow>(),
    db.prepare('SELECT id FROM farms WHERE farm_code = ? AND id <> ?')
      .bind(input.farmCode, farmId).first<{ id: string }>(),
  ]);
  if (!existing) throw new Error('FARM_NOT_FOUND');
  if (duplicate) throw new Error('FARM_CODE_EXISTS');

  const farm: Farm = {
    id: farmId, ...input, createdAt: existing.created_at, updatedAt: Date.now(),
  };
  await db.prepare(`
    UPDATE farms SET
      farm_code = ?, name = ?, phone = ?, address = ?, region = ?, business_number = ?,
      folder_url = ?, location_url = ?, special_notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(farm.farmCode, farm.name, farm.phone, farm.address, farm.region, farm.businessNumber,
    farm.folderUrl, farm.locationUrl, farm.specialNotes, farm.updatedAt, farm.id).run();
  return farm;
}

const RECORD_FIELD_LABELS: Array<[keyof FarmRecordInput, string]> = [
  ['projectId', '참여 사업'], ['crop', '작물'], ['deviceType', '장비 종류'],
  ['productType', '제품 종류'], ['vendor', '장비업체'], ['productionSetupDate', '제작·세팅일'],
  ['installationDate', '설치일'], ['commissioningDate', '시운전일'], ['educationDate', '교육일'],
  ['internetType', '인터넷 유형'], ['warrantyYears', '보증기간'], ['warrantyExpiresAt', '보증 만료일'],
  ['subscriptionYears', '구독기간'], ['initialSubscriptionExpiresAt', '최초 구독 만료일'],
  ['currentSubscriptionExpiresAt', '현재 구독 만료일'], ['lastPaymentDate', '최근 입금일'],
  ['renewalCount', '갱신횟수'], ['subscriptionStatus', '구독 상태'], ['notes', '비고'],
];

function recordChangeSummary(existing: FarmRecord, input: FarmRecordInput) {
  const changed = RECORD_FIELD_LABELS
    .filter(([key]) => existing[key] !== input[key])
    .map(([, label]) => label);
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
  const [existingRow, project] = await Promise.all([
    db.prepare(`
      SELECT id, farm_id, project_id, crop, device_type, product_type, vendor,
             production_setup_date, installation_date, commissioning_date, education_date,
             internet_type, warranty_years, warranty_expires_at, subscription_years,
             initial_subscription_expires_at, current_subscription_expires_at,
             last_payment_date, renewal_count, subscription_status, notes,
             last_activity_at, created_at, updated_at
      FROM farm_records WHERE id = ?
    `).bind(recordId).first<FarmRecordRow>(),
    db.prepare('SELECT id FROM smartfarm_projects WHERE id = ?')
      .bind(input.projectId).first<{ id: string }>(),
  ]);
  if (!existingRow) throw new Error('FARM_RECORD_NOT_FOUND');
  if (!project) throw new Error('SMARTFARM_PROJECT_NOT_FOUND');

  const existing = mapRecord(existingRow);
  const now = Date.now();
  const record: FarmRecord = {
    ...existing,
    ...input,
    lastActivityAt: Math.max(existing.lastActivityAt, now),
    updatedAt: now,
  };
  const { workItem, historyEntry } = auditArtifacts(
    record.farmId, record.id, recorder, '사업 참여 정보 수정', recordChangeSummary(existing, input), now,
  );

  const projectUpdates = existing.projectId === input.projectId
    ? [db.prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?').bind(now, input.projectId)]
    : [
        db.prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?').bind(now, existing.projectId),
        db.prepare('UPDATE smartfarm_projects SET updated_at = ? WHERE id = ?').bind(now, input.projectId),
      ];

  await db.batch([
    db.prepare(`
      UPDATE farm_records SET
        project_id = ?, crop = ?, device_type = ?, product_type = ?, vendor = ?,
        production_setup_date = ?, installation_date = ?, commissioning_date = ?, education_date = ?,
        internet_type = ?, warranty_years = ?, warranty_expires_at = ?, subscription_years = ?,
        initial_subscription_expires_at = ?, current_subscription_expires_at = ?,
        last_payment_date = ?, renewal_count = ?, subscription_status = ?, notes = ?,
        last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(record.projectId, record.crop, record.deviceType, record.productType, record.vendor,
      record.productionSetupDate, record.installationDate, record.commissioningDate, record.educationDate,
      record.internetType, record.warrantyYears, record.warrantyExpiresAt, record.subscriptionYears,
      record.initialSubscriptionExpiresAt, record.currentSubscriptionExpiresAt, record.lastPaymentDate,
      record.renewalCount, record.subscriptionStatus, record.notes, record.lastActivityAt, record.updatedAt, record.id),
    db.prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(workItem.id, workItem.farmRecordId, workItem.workType, workItem.title,
      workItem.status, workItem.owner, workItem.dueDate, workItem.description,
      workItem.lastActivityAt, workItem.createdAt, workItem.updatedAt),
    db.prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyEntry.id, historyEntry.workItemId, historyEntry.channel, historyEntry.sender,
      historyEntry.receivedContent, historyEntry.actionContent, historyEntry.amount,
      historyEntry.recorder, historyEntry.occurredAt, historyEntry.referenceUrl, historyEntry.createdAt),
    db.prepare('UPDATE farms SET updated_at = ? WHERE id = ?').bind(now, record.farmId),
    ...projectUpdates,
  ]);

  return { record, workItem, historyEntry };
}

export async function createFarmWorkItem(
  input: FarmWorkItemInput,
  initialHistory: FarmInitialHistoryEntryInput,
): Promise<FarmWorkItemMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const record = await db.prepare('SELECT id, farm_id FROM farm_records WHERE id = ?')
    .bind(input.farmRecordId).first<{ id: string; farm_id: string }>();
  if (!record) throw new Error('FARM_RECORD_NOT_FOUND');

  const now = Date.now();
  const workItem: FarmWorkItem = {
    id: crypto.randomUUID(), ...input, farmId: record.farm_id,
    lastActivityAt: initialHistory.occurredAt, createdAt: now, updatedAt: now,
  };
  const historyEntry: FarmHistoryEntry = {
    id: crypto.randomUUID(), workItemId: workItem.id, ...initialHistory, createdAt: now,
  };

  await db.batch([
    db.prepare(`
      INSERT INTO farm_work_items (
        id, farm_record_id, work_type, title, status, owner, due_date, description,
        last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(workItem.id, workItem.farmRecordId, workItem.workType, workItem.title,
      workItem.status, workItem.owner, workItem.dueDate, workItem.description,
      workItem.lastActivityAt, workItem.createdAt, workItem.updatedAt),
    db.prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyEntry.id, historyEntry.workItemId, historyEntry.channel, historyEntry.sender,
      historyEntry.receivedContent, historyEntry.actionContent, historyEntry.amount,
      historyEntry.recorder, historyEntry.occurredAt, historyEntry.referenceUrl, historyEntry.createdAt),
    db.prepare(`
      UPDATE farm_records
      SET last_activity_at = CASE WHEN last_activity_at > ? THEN last_activity_at ELSE ? END,
          updated_at = ?
      WHERE id = ?
    `).bind(initialHistory.occurredAt, initialHistory.occurredAt, now, input.farmRecordId),
    db.prepare('UPDATE farms SET updated_at = ? WHERE id = ?').bind(now, record.farm_id),
  ]);
  return { workItem, historyEntry };
}

export async function addFarmHistoryEntry(
  input: AddFarmHistoryEntryInput,
): Promise<FarmWorkItemMutationResult> {
  await ensureFarmLedgerStore();
  const db = getD1();
  const row = await db.prepare(`
    SELECT wi.id, wi.farm_record_id, fr.farm_id, wi.work_type, wi.title, wi.status,
           wi.owner, wi.due_date, wi.description, wi.last_activity_at,
           wi.created_at, wi.updated_at
    FROM farm_work_items wi
    INNER JOIN farm_records fr ON fr.id = wi.farm_record_id
    WHERE wi.id = ?
  `).bind(input.workItemId).first<FarmWorkItemRow>();
  if (!row) throw new Error('FARM_WORK_ITEM_NOT_FOUND');

  const existing = mapWorkItem(row);
  const now = Date.now();
  const { newStatus, ...historyInput } = input;
  const historyEntry: FarmHistoryEntry = { id: crypto.randomUUID(), ...historyInput, createdAt: now };
  const workItem: FarmWorkItem = {
    ...existing,
    status: newStatus ?? existing.status,
    lastActivityAt: Math.max(existing.lastActivityAt, input.occurredAt),
    updatedAt: now,
  };

  await db.batch([
    db.prepare(`
      INSERT INTO farm_history_entries (
        id, work_item_id, channel, sender, received_content, action_content,
        amount, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyEntry.id, historyEntry.workItemId, historyEntry.channel, historyEntry.sender,
      historyEntry.receivedContent, historyEntry.actionContent, historyEntry.amount,
      historyEntry.recorder, historyEntry.occurredAt, historyEntry.referenceUrl, historyEntry.createdAt),
    db.prepare(`
      UPDATE farm_work_items
      SET status = ?, last_activity_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(workItem.status, workItem.lastActivityAt, workItem.updatedAt, workItem.id),
    db.prepare(`
      UPDATE farm_records
      SET last_activity_at = CASE WHEN last_activity_at > ? THEN last_activity_at ELSE ? END,
          updated_at = ?
      WHERE id = ?
    `).bind(input.occurredAt, input.occurredAt, now, workItem.farmRecordId),
    db.prepare('UPDATE farms SET updated_at = ? WHERE id = ?').bind(now, workItem.farmId),
  ]);
  return { workItem, historyEntry };
}
