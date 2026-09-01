import type {
  BusinessWorkspace,
  HistoryChannel,
  HistoryEntry,
  HistoryEntryInput,
  Project,
  ProjectInput,
  ProjectStatus,
  WorkItem,
  WorkItemInput,
  WorkPriority,
  WorkStatus,
} from '../lib/business-types';
import { getD1 } from './index';

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  manager: string;
  status: ProjectStatus;
  description: string;
  created_at: number;
  updated_at: number;
}

interface WorkItemRow {
  id: string;
  project_id: string;
  title: string;
  category: string;
  status: WorkStatus;
  priority: WorkPriority;
  owner: string;
  due_date: string;
  description: string;
  last_activity_at: number;
  created_at: number;
  updated_at: number;
}

interface HistoryEntryRow {
  id: string;
  work_item_id: string;
  channel: HistoryChannel;
  source_sender: string;
  received_content: string;
  action_content: string;
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

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    manager: row.manager,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkItem(row: WorkItemRow): WorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    category: row.category,
    status: row.status,
    priority: row.priority,
    owner: row.owner,
    dueDate: row.due_date,
    description: row.description,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistoryEntry(row: HistoryEntryRow): HistoryEntry {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    channel: row.channel,
    sourceSender: row.source_sender,
    receivedContent: row.received_content,
    actionContent: row.action_content,
    recorder: row.recorder,
    occurredAt: row.occurred_at,
    referenceUrl: row.reference_url,
    createdAt: row.created_at,
  };
}

async function initializeBusinessStore() {
  const db = getD1();

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        client TEXT NOT NULL,
        manager TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'on_hold', 'completed')),
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('received', 'in_progress', 'waiting', 'completed')),
        priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
        owner TEXT NOT NULL,
        due_date TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        last_activity_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS history_entries (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'other')),
        source_sender TEXT NOT NULL DEFAULT '',
        received_content TEXT NOT NULL DEFAULT '',
        action_content TEXT NOT NULL DEFAULT '',
        recorder TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        reference_url TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_work_items_project_activity
      ON work_items(project_id, last_activity_at)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_history_work_item_occurred
      ON history_entries(work_item_id, occurred_at)
    `),
    db.prepare('PRAGMA optimize'),
  ]);

  const seeded = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind('business_workspace_seeded')
    .first<{ value: string }>();

  if (seeded) return;

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const projects: Project[] = [
    {
      id: 'project-seocho-renewal',
      name: '2026 서초구 공간 리뉴얼',
      client: '서초구청',
      manager: '김민지',
      status: 'active',
      description: '청사 공용공간 개선 설계와 시공 일정을 관리합니다.',
      createdAt: now - 30 * day,
      updatedAt: now - hour,
    },
    {
      id: 'project-hanbit-web',
      name: '한빛물산 홈페이지 개편',
      client: '한빛물산',
      manager: '박서준',
      status: 'active',
      description: '기업 홈페이지 콘텐츠와 화면 디자인 개편 사업입니다.',
      createdAt: now - 18 * day,
      updatedAt: now - 9 * hour,
    },
    {
      id: 'project-recruit-brand',
      name: '상반기 채용 브랜딩',
      client: '내부 프로젝트',
      manager: '이하늘',
      status: 'on_hold',
      description: '채용 페이지와 인터뷰 콘텐츠 제작을 준비합니다.',
      createdAt: now - 12 * day,
      updatedAt: now - 2 * day,
    },
  ];

  const workItems: WorkItem[] = [
    {
      id: 'work-seocho-access',
      projectId: projects[0].id,
      title: '착공 일정 및 출입 인원 확정',
      category: '일정',
      status: 'in_progress',
      priority: 'high',
      owner: '김민지',
      dueDate: dateFromToday(1),
      description: '착공일과 현장 출입자 명단을 발주처에 회신합니다.',
      lastActivityAt: now - hour,
      createdAt: now - 5 * day,
      updatedAt: now - hour,
    },
    {
      id: 'work-seocho-sign',
      projectId: projects[0].id,
      title: '안내 사인 문구 수정',
      category: '디자인',
      status: 'waiting',
      priority: 'medium',
      owner: '박서준',
      dueDate: dateFromToday(3),
      description: '1층 안내 사인의 국·영문 표기를 최종 확정합니다.',
      lastActivityAt: now - 17 * hour,
      createdAt: now - 6 * day,
      updatedAt: now - 17 * hour,
    },
    {
      id: 'work-seocho-safety',
      projectId: projects[0].id,
      title: '현장 안전계획서 보완',
      category: '서류',
      status: 'received',
      priority: 'high',
      owner: '최유진',
      dueDate: dateFromToday(-1),
      description: '안전관리 담당자 의견에 따라 계획서를 보완합니다.',
      lastActivityAt: now - 26 * hour,
      createdAt: now - 8 * day,
      updatedAt: now - 26 * hour,
    },
    {
      id: 'work-hanbit-copy',
      projectId: projects[1].id,
      title: '회사소개 원고 최종 수급',
      category: '콘텐츠',
      status: 'waiting',
      priority: 'high',
      owner: '이하늘',
      dueDate: dateFromToday(2),
      description: '대표 인사말과 회사 연혁 원고를 최종 수급합니다.',
      lastActivityAt: now - 9 * hour,
      createdAt: now - 4 * day,
      updatedAt: now - 9 * hour,
    },
    {
      id: 'work-brand-shoot',
      projectId: projects[2].id,
      title: '직무 인터뷰 촬영 일정 조율',
      category: '촬영',
      status: 'received',
      priority: 'low',
      owner: '정하늘',
      dueDate: dateFromToday(8),
      description: '참여자 일정을 받은 뒤 촬영일을 확정합니다.',
      lastActivityAt: now - 2 * day,
      createdAt: now - 3 * day,
      updatedAt: now - 2 * day,
    },
  ];

  const historyEntries: HistoryEntry[] = [
    {
      id: 'history-access-mail',
      workItemId: workItems[0].id,
      channel: 'email',
      sourceSender: '서초구청 시설관리팀 이주임',
      receivedContent: '9월 7일 착공 가능 여부와 당일 출입자 명단을 요청했습니다.',
      actionContent: '',
      recorder: '김민지',
      occurredAt: now - 3 * hour,
      referenceUrl: '',
      createdAt: now - 3 * hour,
    },
    {
      id: 'history-access-action',
      workItemId: workItems[0].id,
      channel: 'other',
      sourceSender: '',
      receivedContent: '',
      actionContent: '현장팀 일정 확인 완료. 출입 명단 취합 후 오늘 16시까지 회신 예정입니다.',
      recorder: '김민지',
      occurredAt: now - hour,
      referenceUrl: '',
      createdAt: now - hour,
    },
    {
      id: 'history-sign-kakao',
      workItemId: workItems[1].id,
      channel: 'kakao',
      sourceSender: '발주처 담당자',
      receivedContent: '1층 안내 사인의 영문 표기를 다시 확인해 달라는 요청이 왔습니다.',
      actionContent: '',
      recorder: '박서준',
      occurredAt: now - 20 * hour,
      referenceUrl: '',
      createdAt: now - 20 * hour,
    },
    {
      id: 'history-sign-action',
      workItemId: workItems[1].id,
      channel: 'email',
      sourceSender: '',
      receivedContent: '',
      actionContent: '영문 표기 수정 시안을 전달했고 최종 승인 답변을 기다리고 있습니다.',
      recorder: '박서준',
      occurredAt: now - 17 * hour,
      referenceUrl: '',
      createdAt: now - 17 * hour,
    },
    {
      id: 'history-safety-verbal',
      workItemId: workItems[2].id,
      channel: 'verbal',
      sourceSender: '안전관리 담당자',
      receivedContent: '비상 연락망과 작업자 교육 일정이 빠져 있어 보완이 필요하다고 전달받았습니다.',
      actionContent: '',
      recorder: '최유진',
      occurredAt: now - 26 * hour,
      referenceUrl: '',
      createdAt: now - 25 * hour,
    },
    {
      id: 'history-copy-phone',
      workItemId: workItems[3].id,
      channel: 'phone',
      sourceSender: '한빛물산 홍보팀',
      receivedContent: '대표 인사말은 오늘, 회사 연혁은 내일 오전까지 전달하겠다고 안내받았습니다.',
      actionContent: '수급 일정에 맞춰 내부 편집 일정을 하루 조정했습니다.',
      recorder: '이하늘',
      occurredAt: now - 9 * hour,
      referenceUrl: '',
      createdAt: now - 9 * hour,
    },
    {
      id: 'history-shoot-meeting',
      workItemId: workItems[4].id,
      channel: 'meeting',
      sourceSender: '인사팀 정기회의',
      receivedContent: '인터뷰 대상자 세 명의 후보 일정을 먼저 받아 달라는 요청이 있었습니다.',
      actionContent: '',
      recorder: '정하늘',
      occurredAt: now - 2 * day,
      referenceUrl: '',
      createdAt: now - 2 * day,
    },
  ];

  await db.batch([
    ...projects.map((project) =>
      db.prepare(`
        INSERT OR IGNORE INTO projects (
          id, name, client, manager, status, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        project.id,
        project.name,
        project.client,
        project.manager,
        project.status,
        project.description,
        project.createdAt,
        project.updatedAt,
      ),
    ),
    ...workItems.map((item) =>
      db.prepare(`
        INSERT OR IGNORE INTO work_items (
          id, project_id, title, category, status, priority, owner, due_date,
          description, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.id,
        item.projectId,
        item.title,
        item.category,
        item.status,
        item.priority,
        item.owner,
        item.dueDate,
        item.description,
        item.lastActivityAt,
        item.createdAt,
        item.updatedAt,
      ),
    ),
    ...historyEntries.map((entry) =>
      db.prepare(`
        INSERT OR IGNORE INTO history_entries (
          id, work_item_id, channel, source_sender, received_content,
          action_content, recorder, occurred_at, reference_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entry.id,
        entry.workItemId,
        entry.channel,
        entry.sourceSender,
        entry.receivedContent,
        entry.actionContent,
        entry.recorder,
        entry.occurredAt,
        entry.referenceUrl,
        entry.createdAt,
      ),
    ),
    db.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)').bind(
      'business_workspace_seeded',
      '1',
    ),
  ]);
}

export async function ensureBusinessStore() {
  initialization ??= initializeBusinessStore().catch((error) => {
    initialization = null;
    throw error;
  });
  await initialization;
}

export async function listBusinessWorkspace(): Promise<BusinessWorkspace> {
  await ensureBusinessStore();
  const db = getD1();
  const [projectResult, workItemResult, historyResult] = await Promise.all([
    db.prepare(`
      SELECT id, name, client, manager, status, description, created_at, updated_at
      FROM projects
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 ELSE 2 END,
               updated_at DESC
      LIMIT 100
    `).all<ProjectRow>(),
    db.prepare(`
      SELECT id, project_id, title, category, status, priority, owner, due_date,
             description, last_activity_at, created_at, updated_at
      FROM work_items
      ORDER BY project_id ASC, last_activity_at DESC
      LIMIT 500
    `).all<WorkItemRow>(),
    db.prepare(`
      SELECT id, work_item_id, channel, source_sender, received_content,
             action_content, recorder, occurred_at, reference_url, created_at
      FROM history_entries
      ORDER BY work_item_id ASC, occurred_at DESC, created_at DESC
      LIMIT 2000
    `).all<HistoryEntryRow>(),
  ]);

  return {
    projects: projectResult.results.map(mapProject),
    workItems: workItemResult.results.map(mapWorkItem),
    historyEntries: historyResult.results.map(mapHistoryEntry),
  };
}

export async function createProject(input: ProjectInput): Promise<Project> {
  await ensureBusinessStore();
  const now = Date.now();
  const project: Project = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  await getD1().prepare(`
    INSERT INTO projects (
      id, name, client, manager, status, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    project.id,
    project.name,
    project.client,
    project.manager,
    project.status,
    project.description,
    project.createdAt,
    project.updatedAt,
  ).run();

  return project;
}

export async function createWorkItem(
  input: WorkItemInput,
  initialHistory: Omit<HistoryEntryInput, 'workItemId' | 'newStatus'>,
): Promise<{ workItem: WorkItem; historyEntry: HistoryEntry }> {
  await ensureBusinessStore();
  const db = getD1();
  const project = await db
    .prepare('SELECT id FROM projects WHERE id = ?')
    .bind(input.projectId)
    .first<{ id: string }>();
  if (!project) throw new Error('PROJECT_NOT_FOUND');

  const now = Date.now();
  const workItem: WorkItem = {
    id: crypto.randomUUID(),
    ...input,
    lastActivityAt: initialHistory.occurredAt,
    createdAt: now,
    updatedAt: now,
  };
  const historyEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    workItemId: workItem.id,
    ...initialHistory,
    createdAt: now,
  };

  await db.batch([
    db.prepare(`
      INSERT INTO work_items (
        id, project_id, title, category, status, priority, owner, due_date,
        description, last_activity_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      workItem.id,
      workItem.projectId,
      workItem.title,
      workItem.category,
      workItem.status,
      workItem.priority,
      workItem.owner,
      workItem.dueDate,
      workItem.description,
      workItem.lastActivityAt,
      workItem.createdAt,
      workItem.updatedAt,
    ),
    db.prepare(`
      INSERT INTO history_entries (
        id, work_item_id, channel, source_sender, received_content,
        action_content, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyEntry.id,
      historyEntry.workItemId,
      historyEntry.channel,
      historyEntry.sourceSender,
      historyEntry.receivedContent,
      historyEntry.actionContent,
      historyEntry.recorder,
      historyEntry.occurredAt,
      historyEntry.referenceUrl,
      historyEntry.createdAt,
    ),
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(now, input.projectId),
  ]);

  return { workItem, historyEntry };
}

export async function addHistoryEntry(input: HistoryEntryInput): Promise<HistoryEntry> {
  await ensureBusinessStore();
  const db = getD1();
  const workItem = await db
    .prepare('SELECT id, project_id, status FROM work_items WHERE id = ?')
    .bind(input.workItemId)
    .first<{ id: string; project_id: string; status: WorkStatus }>();
  if (!workItem) throw new Error('WORK_ITEM_NOT_FOUND');

  const now = Date.now();
  const historyEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    workItemId: input.workItemId,
    channel: input.channel,
    sourceSender: input.sourceSender,
    receivedContent: input.receivedContent,
    actionContent: input.actionContent,
    recorder: input.recorder,
    occurredAt: input.occurredAt,
    referenceUrl: input.referenceUrl,
    createdAt: now,
  };

  await db.batch([
    db.prepare(`
      INSERT INTO history_entries (
        id, work_item_id, channel, source_sender, received_content,
        action_content, recorder, occurred_at, reference_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyEntry.id,
      historyEntry.workItemId,
      historyEntry.channel,
      historyEntry.sourceSender,
      historyEntry.receivedContent,
      historyEntry.actionContent,
      historyEntry.recorder,
      historyEntry.occurredAt,
      historyEntry.referenceUrl,
      historyEntry.createdAt,
    ),
    db.prepare(`
      UPDATE work_items
      SET status = ?,
          last_activity_at = CASE WHEN last_activity_at > ? THEN last_activity_at ELSE ? END,
          updated_at = ?
      WHERE id = ?
    `).bind(
      input.newStatus ?? workItem.status,
      input.occurredAt,
      input.occurredAt,
      now,
      input.workItemId,
    ),
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(now, workItem.project_id),
  ]);

  return historyEntry;
}
