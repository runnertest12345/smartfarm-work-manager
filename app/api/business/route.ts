import {
  addHistoryEntry,
  createProject,
  createWorkItem,
  listBusinessWorkspace,
} from '@/db/business';
import {
  HISTORY_CHANNELS,
  PROJECT_STATUSES,
  WORK_PRIORITIES,
  WORK_STATUSES,
  type HistoryEntryInput,
  type ProjectInput,
  type WorkItemInput,
} from '@/lib/business-types';
import {
  authenticateRequest,
  authenticationResponse,
} from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validReferenceUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseProjectInput(value: unknown): ProjectInput | string {
  if (!value || typeof value !== 'object') return '사업 정보를 확인해 주세요.';
  const body = value as Record<string, unknown>;
  const name = textValue(body.name);
  const client = textValue(body.client);
  const manager = textValue(body.manager);
  const description = textValue(body.description);
  const status = body.status;

  if (!name || name.length > 120) return '사업명은 1~120자로 입력해 주세요.';
  if (!client || client.length > 80) return '거래처는 1~80자로 입력해 주세요.';
  if (!manager || manager.length > 40) return '사업 담당자는 1~40자로 입력해 주세요.';
  if (description.length > 1000) return '사업 설명은 1,000자 이내로 입력해 주세요.';
  if (!PROJECT_STATUSES.includes(status as ProjectInput['status'])) return '사업 상태를 확인해 주세요.';

  return { name, client, manager, description, status: status as ProjectInput['status'] };
}

function parseWorkItemInput(value: unknown): WorkItemInput | string {
  if (!value || typeof value !== 'object') return '업무 정보를 확인해 주세요.';
  const body = value as Record<string, unknown>;
  const projectId = textValue(body.projectId);
  const title = textValue(body.title);
  const category = textValue(body.category);
  const owner = textValue(body.owner);
  const dueDate = textValue(body.dueDate);
  const description = textValue(body.description);
  const status = body.status;
  const priority = body.priority;

  if (!projectId) return '업무를 등록할 사업을 선택해 주세요.';
  if (!title || title.length > 140) return '업무명은 1~140자로 입력해 주세요.';
  if (!category || category.length > 40) return '업무 분류는 1~40자로 입력해 주세요.';
  if (!owner || owner.length > 40) return '담당자는 1~40자로 입력해 주세요.';
  if (!validDate(dueDate)) return '기한을 올바르게 선택해 주세요.';
  if (description.length > 1200) return '업무 설명은 1,200자 이내로 입력해 주세요.';
  if (!WORK_STATUSES.includes(status as WorkItemInput['status'])) return '업무 상태를 확인해 주세요.';
  if (!WORK_PRIORITIES.includes(priority as WorkItemInput['priority'])) return '우선순위를 확인해 주세요.';

  return {
    projectId,
    title,
    category,
    owner,
    dueDate,
    description,
    status: status as WorkItemInput['status'],
    priority: priority as WorkItemInput['priority'],
  };
}

function parseHistoryInput(
  value: unknown,
  workItemIdOverride?: string,
): HistoryEntryInput | string {
  if (!value || typeof value !== 'object') return '히스토리 정보를 확인해 주세요.';
  const body = value as Record<string, unknown>;
  const workItemId = workItemIdOverride ?? textValue(body.workItemId);
  const channel = body.channel;
  const sourceSender = textValue(body.sourceSender);
  const receivedContent = textValue(body.receivedContent);
  const actionContent = textValue(body.actionContent);
  const recorder = textValue(body.recorder);
  const referenceUrl = textValue(body.referenceUrl);
  const occurredAt = typeof body.occurredAt === 'number' ? body.occurredAt : Number.NaN;
  const newStatus = body.newStatus;

  if (!workItemId) return '히스토리를 추가할 업무를 찾을 수 없습니다.';
  if (!HISTORY_CHANNELS.includes(channel as HistoryEntryInput['channel'])) return '수신 경로를 확인해 주세요.';
  if (!receivedContent && !actionContent) return '받은 내용 또는 처리 내용을 입력해 주세요.';
  if (receivedContent && !sourceSender) return '내용을 전달한 사람이나 기관을 입력해 주세요.';
  if (sourceSender.length > 100) return '전달자는 100자 이내로 입력해 주세요.';
  if (receivedContent.length > 3000 || actionContent.length > 3000) return '기록 내용은 각각 3,000자 이내로 입력해 주세요.';
  if (!recorder || recorder.length > 40) return '기록자는 1~40자로 입력해 주세요.';
  if (!Number.isFinite(occurredAt) || occurredAt < 946684800000 || occurredAt > Date.now() + 365 * 86400000) {
    return '발생 일시를 올바르게 입력해 주세요.';
  }
  if (!validReferenceUrl(referenceUrl)) return '참고 링크는 http:// 또는 https:// 주소로 입력해 주세요.';
  if (newStatus !== undefined && !WORK_STATUSES.includes(newStatus as NonNullable<HistoryEntryInput['newStatus']>)) {
    return '변경할 업무 상태를 확인해 주세요.';
  }

  return {
    workItemId,
    channel: channel as HistoryEntryInput['channel'],
    sourceSender,
    receivedContent,
    actionContent,
    recorder,
    occurredAt,
    referenceUrl,
    ...(newStatus === undefined ? {} : { newStatus: newStatus as NonNullable<HistoryEntryInput['newStatus']> }),
  };
}

export async function GET(request: Request) {
  const unauthorized = authenticationResponse(await authenticateRequest(request));
  if (unauthorized) return unauthorized;
  try {
    const workspace = await listBusinessWorkspace();
    return Response.json(workspace, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to list business workspace', error);
    return errorResponse('사업 업무를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function POST(request: Request) {
  const unauthorized = authenticationResponse(await authenticateRequest(request));
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = body.kind;

    if (kind === 'project') {
      const input = parseProjectInput(body.project);
      if (typeof input === 'string') return errorResponse(input);
      const project = await createProject(input);
      return Response.json({ project }, { status: 201 });
    }

    if (kind === 'work_item') {
      const workItemInput = parseWorkItemInput(body.workItem);
      if (typeof workItemInput === 'string') return errorResponse(workItemInput);
      const historyInput = parseHistoryInput(body.history, 'new-work-item');
      if (typeof historyInput === 'string') return errorResponse(historyInput);
      const { workItem, historyEntry } = await createWorkItem(workItemInput, {
        channel: historyInput.channel,
        sourceSender: historyInput.sourceSender,
        receivedContent: historyInput.receivedContent,
        actionContent: historyInput.actionContent,
        recorder: historyInput.recorder,
        occurredAt: historyInput.occurredAt,
        referenceUrl: historyInput.referenceUrl,
      });
      return Response.json({ workItem, historyEntry }, { status: 201 });
    }

    if (kind === 'history') {
      const input = parseHistoryInput(body.history);
      if (typeof input === 'string') return errorResponse(input);
      const historyEntry = await addHistoryEntry(input);
      return Response.json({ historyEntry }, { status: 201 });
    }

    return errorResponse('저장할 정보 종류를 확인해 주세요.');
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
      return errorResponse('업무를 등록할 사업을 찾을 수 없습니다.', 404);
    }
    if (error instanceof Error && error.message === 'WORK_ITEM_NOT_FOUND') {
      return errorResponse('히스토리를 추가할 업무를 찾을 수 없습니다.', 404);
    }
    console.error('Failed to update business workspace', error);
    return errorResponse('내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
