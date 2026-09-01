import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '@/db/tasks';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskInput,
} from '@/lib/task-types';

export const dynamic = 'force-dynamic';

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function parseTaskInput(value: unknown): TaskInput | string {
  if (!value || typeof value !== 'object') return '업무 정보를 확인해 주세요.';

  const body = value as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const assignee = typeof body.assignee === 'string' ? body.assignee.trim() : '';
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const status = body.status;
  const priority = body.priority;

  if (!title || title.length > 120) return '업무명은 1~120자로 입력해 주세요.';
  if (description.length > 1000) return '업무 설명은 1,000자 이내로 입력해 주세요.';
  if (!assignee || assignee.length > 40) return '담당자는 1~40자로 입력해 주세요.';
  if (!category || category.length > 30) return '업무 분류는 1~30자로 입력해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return '마감일을 올바르게 선택해 주세요.';
  const parsedDate = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate) {
    return '마감일을 올바르게 선택해 주세요.';
  }
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) return '업무 상태를 확인해 주세요.';
  if (!TASK_PRIORITIES.includes(priority as (typeof TASK_PRIORITIES)[number])) return '우선순위를 확인해 주세요.';

  return {
    title,
    description,
    assignee,
    dueDate,
    category,
    status: status as TaskInput['status'],
    priority: priority as TaskInput['priority'],
  };
}

export async function GET() {
  try {
    const tasks = await listTasks();
    return Response.json({ tasks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to list tasks', error);
    return errorResponse('업무 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseTaskInput(await request.json());
    if (typeof input === 'string') return errorResponse(input);
    const task = await createTask(input);
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Failed to create task', error);
    return errorResponse('업무를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return errorResponse('수정할 업무를 찾을 수 없습니다.');

    const input = parseTaskInput(body);
    if (typeof input === 'string') return errorResponse(input);
    const task = await updateTask(id, input);
    if (!task) return errorResponse('수정할 업무를 찾을 수 없습니다.', 404);
    return Response.json({ task });
  } catch (error) {
    console.error('Failed to update task', error);
    return errorResponse('업무를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id) return errorResponse('삭제할 업무를 찾을 수 없습니다.');
    const deleted = await deleteTask(id);
    if (!deleted) return errorResponse('삭제할 업무를 찾을 수 없습니다.', 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete task', error);
    return errorResponse('업무를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
