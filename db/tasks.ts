import type { Task, TaskInput, TaskPriority, TaskStatus } from '../lib/task-types';
import { getD1 } from './index';

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  due_date: string;
  category: string;
  created_at: number;
  updated_at: number;
}

let initialization: Promise<void> | null = null;

function dateFromToday(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    dueDate: row.due_date,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function initializeTaskStore() {
  const db = getD1();

  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'review', 'completed')),
        priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
        assignee TEXT NOT NULL,
        due_date TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_tasks_due_created
      ON tasks(due_date, created_at)
    `),
    db.prepare('PRAGMA optimize'),
  ]);

  const seeded = await db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind('sample_tasks_seeded')
    .first<{ value: string }>();

  if (seeded) return;

  const now = Date.now();
  const samples: Array<Task & { seedOrder: number }> = [
    {
      id: 'sample-sales-report',
      title: '3분기 영업 실적 보고서 마감',
      description: '지역별 실적과 다음 분기 예상 수치를 최종 확인합니다.',
      status: 'in_progress',
      priority: 'high',
      assignee: '김민준',
      dueDate: dateFromToday(0),
      category: '보고서',
      createdAt: now - 5000,
      updatedAt: now - 5000,
      seedOrder: 0,
    },
    {
      id: 'sample-proposal-review',
      title: '신규 거래처 제안서 검토',
      description: '가격 조건과 일정표를 검토하고 최종 의견을 남깁니다.',
      status: 'review',
      priority: 'high',
      assignee: '이서연',
      dueDate: dateFromToday(2),
      category: '영업',
      createdAt: now - 4000,
      updatedAt: now - 4000,
      seedOrder: 1,
    },
    {
      id: 'sample-customer-process',
      title: '고객 문의 대응 프로세스 정리',
      description: '반복 문의 유형과 담당자 이관 기준을 문서화합니다.',
      status: 'in_progress',
      priority: 'medium',
      assignee: '박지훈',
      dueDate: dateFromToday(4),
      category: '운영',
      createdAt: now - 3000,
      updatedAt: now - 3000,
      seedOrder: 2,
    },
    {
      id: 'sample-content-calendar',
      title: '월간 콘텐츠 발행 일정 확정',
      description: '채널별 콘텐츠 주제와 검수 담당자를 확정합니다.',
      status: 'planned',
      priority: 'medium',
      assignee: '최유진',
      dueDate: dateFromToday(5),
      category: '마케팅',
      createdAt: now - 2000,
      updatedAt: now - 2000,
      seedOrder: 3,
    },
    {
      id: 'sample-budget-check',
      title: '분기 예산 사용 내역 확인',
      description: '팀별 집행 내역에서 누락된 증빙을 확인합니다.',
      status: 'planned',
      priority: 'high',
      assignee: '정하늘',
      dueDate: dateFromToday(-1),
      category: '재무',
      createdAt: now - 1000,
      updatedAt: now - 1000,
      seedOrder: 4,
    },
    {
      id: 'sample-onboarding',
      title: '신규 입사자 온보딩 체크리스트',
      description: '계정 발급과 첫 주 교육 일정을 모두 확인했습니다.',
      status: 'completed',
      priority: 'low',
      assignee: '서지아',
      dueDate: dateFromToday(-2),
      category: '인사',
      createdAt: now - 6000,
      updatedAt: now - 500,
      seedOrder: 5,
    },
  ];

  const inserts = samples.map((task) =>
    db
      .prepare(`
        INSERT OR IGNORE INTO tasks (
          id, title, description, status, priority, assignee,
          due_date, category, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assignee,
        task.dueDate,
        task.category,
        task.createdAt + task.seedOrder,
        task.updatedAt,
      ),
  );

  await db.batch([
    ...inserts,
    db
      .prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)')
      .bind('sample_tasks_seeded', '1'),
  ]);
}

export async function ensureTaskStore() {
  initialization ??= initializeTaskStore().catch((error) => {
    initialization = null;
    throw error;
  });
  await initialization;
}

export async function listTasks(): Promise<Task[]> {
  await ensureTaskStore();
  const result = await getD1()
    .prepare(`
      SELECT id, title, description, status, priority, assignee,
             due_date, category, created_at, updated_at
      FROM tasks
      ORDER BY due_date ASC, created_at DESC
      LIMIT 250
    `)
    .all<TaskRow>();

  return result.results.map(mapTask);
}

export async function createTask(input: TaskInput): Promise<Task> {
  await ensureTaskStore();
  const task: Task = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await getD1()
    .prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, assignee,
        due_date, category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      task.id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.assignee,
      task.dueDate,
      task.category,
      task.createdAt,
      task.updatedAt,
    )
    .run();

  return task;
}

export async function updateTask(id: string, input: TaskInput): Promise<Task | null> {
  await ensureTaskStore();
  const updatedAt = Date.now();

  await getD1()
    .prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, assignee = ?,
          due_date = ?, category = ?, updated_at = ?
      WHERE id = ?
    `)
    .bind(
      input.title,
      input.description,
      input.status,
      input.priority,
      input.assignee,
      input.dueDate,
      input.category,
      updatedAt,
      id,
    )
    .run();

  const row = await getD1()
    .prepare(`
      SELECT id, title, description, status, priority, assignee,
             due_date, category, created_at, updated_at
      FROM tasks
      WHERE id = ?
    `)
    .bind(id)
    .first<TaskRow>();

  return row ? mapTask(row) : null;
}

export async function deleteTask(id: string): Promise<boolean> {
  await ensureTaskStore();
  const existing = await getD1()
    .prepare('SELECT id FROM tasks WHERE id = ?')
    .bind(id)
    .first<{ id: string }>();

  if (!existing) return false;

  await getD1().prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return true;
}
