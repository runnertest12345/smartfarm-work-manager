import {
  addFarmHistoryEntry,
  createFarmProject,
  createFarmRecord,
  createFarmWithRecord,
  createFarmWorkItem,
  listFarmLedgerWorkspace,
  updateFarm,
  updateFarmRecord,
} from '@/db/farm-ledger';
import {
  FARM_HISTORY_CHANNELS,
  FARM_PROJECT_STATUSES,
  FARM_PROJECT_TYPES,
  FARM_WORK_STATUSES,
  FARM_WORK_TYPES,
  SUBSCRIPTION_STATUSES,
  type AddFarmHistoryEntryInput,
  type FarmInitialHistoryEntryInput,
  type FarmInput,
  type FarmProjectInput,
  type FarmRecordInput,
  type FarmWorkItemInput,
  type FarmWorkStatus,
} from '@/lib/farm-types';

export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function objectValue(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function hasStringFields(body: JsonObject, fields: readonly string[]) {
  return fields.every((field) => typeof body[field] === 'string');
}

function trimmed(body: JsonObject, field: string) {
  return (body[field] as string).trim();
}

function integerValue(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : Number.NaN;
}

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function validUrl(value: string) {
  if (!value) return true;
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function parseId(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label}을(를) 문자열로 입력해 주세요.`);
  const id = value.trim();
  if (!id || id.length > 100) throw new Error(`${label}을(를) 확인해 주세요.`);
  return id;
}

function parseRecorder(value: unknown) {
  if (typeof value !== 'string') return '담당자를 1~50자로 입력해 주세요.';
  const recorder = value.trim();
  return !recorder || recorder.length > 50 ? '담당자를 1~50자로 입력해 주세요.' : recorder;
}

function parseProjectInput(value: unknown): FarmProjectInput | string {
  const body = objectValue(value);
  if (!body) return '사업 정보를 확인해 주세요.';
  if (!hasStringFields(body, ['name', 'institution', 'description'])) {
    return '사업명, 주관기관, 사업 설명은 문자열로 입력해 주세요.';
  }

  const name = trimmed(body, 'name');
  const institution = trimmed(body, 'institution');
  const description = trimmed(body, 'description');
  const projectType = body.projectType;
  const status = body.status;
  const year = integerValue(body.year);
  const targetFarmCount = integerValue(body.targetFarmCount);

  if (!name || name.length > 140) return '사업명은 1~140자로 입력해 주세요.';
  if (!institution || institution.length > 100) return '주관기관은 1~100자로 입력해 주세요.';
  if (description.length > 1500) return '사업 설명은 1,500자 이내로 입력해 주세요.';
  if (!FARM_PROJECT_TYPES.includes(projectType as FarmProjectInput['projectType'])) {
    return '사업 유형을 확인해 주세요.';
  }
  if (!FARM_PROJECT_STATUSES.includes(status as FarmProjectInput['status'])) {
    return '사업 상태를 확인해 주세요.';
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return '사업 연도를 확인해 주세요.';
  if (!Number.isInteger(targetFarmCount) || targetFarmCount < 0 || targetFarmCount > 100000) {
    return '목표 농가 수를 확인해 주세요.';
  }

  return {
    name,
    institution,
    description,
    projectType: projectType as FarmProjectInput['projectType'],
    status: status as FarmProjectInput['status'],
    year,
    targetFarmCount,
  };
}

function parseFarmInput(value: unknown): FarmInput | string {
  const body = objectValue(value);
  if (!body) return '농가 기본정보를 확인해 주세요.';
  const fields = [
    'farmCode', 'name', 'phone', 'address', 'region', 'businessNumber',
    'folderUrl', 'locationUrl', 'specialNotes',
  ] as const;
  if (!hasStringFields(body, fields)) return '농가 기본정보는 문자열로 입력해 주세요.';

  const farmCode = trimmed(body, 'farmCode');
  const name = trimmed(body, 'name');
  const phone = trimmed(body, 'phone');
  const address = trimmed(body, 'address');
  const region = trimmed(body, 'region');
  const businessNumber = trimmed(body, 'businessNumber');
  const folderUrl = trimmed(body, 'folderUrl');
  const locationUrl = trimmed(body, 'locationUrl');
  const specialNotes = trimmed(body, 'specialNotes');

  if (!farmCode || farmCode.length > 40) return '농장번호는 1~40자로 입력해 주세요.';
  if (!name || name.length > 100) return '농장명은 1~100자로 입력해 주세요.';
  if (phone.length > 30) return '연락처는 30자 이내로 입력해 주세요.';
  if (address.length > 300) return '주소는 300자 이내로 입력해 주세요.';
  if (!region || region.length > 50) return '지역은 1~50자로 입력해 주세요.';
  if (businessNumber.length > 60) return '경영체번호는 60자 이내로 입력해 주세요.';
  if (!validUrl(folderUrl) || !validUrl(locationUrl)) {
    return '농장 폴더와 위치도 링크는 2,000자 이내의 http:// 또는 https:// 주소로 입력해 주세요.';
  }
  if (specialNotes.length > 3000) return '특이사항은 3,000자 이내로 입력해 주세요.';

  return { farmCode, name, phone, address, region, businessNumber, folderUrl, locationUrl, specialNotes };
}

function parseRecordInput(value: unknown): FarmRecordInput | string {
  const body = objectValue(value);
  if (!body) return '사업·설치 정보를 확인해 주세요.';
  const stringFields = [
    'projectId', 'crop', 'deviceType', 'productType', 'vendor', 'productionSetupDate',
    'installationDate', 'commissioningDate', 'educationDate', 'internetType',
    'warrantyExpiresAt', 'initialSubscriptionExpiresAt', 'currentSubscriptionExpiresAt',
    'lastPaymentDate', 'notes',
  ] as const;
  if (!hasStringFields(body, stringFields)) return '사업·설치 정보의 문자 항목을 확인해 주세요.';

  const projectId = trimmed(body, 'projectId');
  const crop = trimmed(body, 'crop');
  const deviceType = trimmed(body, 'deviceType');
  const productType = trimmed(body, 'productType');
  const vendor = trimmed(body, 'vendor');
  const productionSetupDate = trimmed(body, 'productionSetupDate');
  const installationDate = trimmed(body, 'installationDate');
  const commissioningDate = trimmed(body, 'commissioningDate');
  const educationDate = trimmed(body, 'educationDate');
  const internetType = trimmed(body, 'internetType');
  const warrantyExpiresAt = trimmed(body, 'warrantyExpiresAt');
  const initialSubscriptionExpiresAt = trimmed(body, 'initialSubscriptionExpiresAt');
  const currentSubscriptionExpiresAt = trimmed(body, 'currentSubscriptionExpiresAt');
  const lastPaymentDate = trimmed(body, 'lastPaymentDate');
  const notes = trimmed(body, 'notes');
  const warrantyYears = integerValue(body.warrantyYears);
  const subscriptionYears = integerValue(body.subscriptionYears);
  const renewalCount = integerValue(body.renewalCount);
  const subscriptionStatus = body.subscriptionStatus;

  if (!projectId || projectId.length > 100) return '참여 사업을 선택해 주세요.';
  for (const [label, text, max] of [
    ['작물', crop, 60], ['장비 종류', deviceType, 80], ['제품 종류', productType, 80],
    ['장비업체', vendor, 100], ['인터넷 유형', internetType, 60],
  ] as const) {
    if (text.length > max) return `${label}은 ${max}자 이내로 입력해 주세요.`;
  }

  const dates = [
    productionSetupDate, installationDate, commissioningDate, educationDate,
    warrantyExpiresAt, initialSubscriptionExpiresAt, currentSubscriptionExpiresAt, lastPaymentDate,
  ];
  if (dates.some((date) => !validDate(date))) return '날짜를 YYYY-MM-DD 형식으로 올바르게 입력해 주세요.';

  const installStages = [
    ['제작·세팅일', productionSetupDate],
    ['설치일', installationDate],
    ['시운전일', commissioningDate],
    ['교육일', educationDate],
  ].filter((stage): stage is [string, string] => Boolean(stage[1]));
  for (let index = 1; index < installStages.length; index += 1) {
    if (installStages[index - 1][1] > installStages[index][1]) {
      return `${installStages[index][0]}은 ${installStages[index - 1][0]}보다 빠를 수 없습니다.`;
    }
  }

  if (!Number.isInteger(warrantyYears) || warrantyYears < 0 || warrantyYears > 20) {
    return '보증기간은 0~20년으로 입력해 주세요.';
  }
  if (!Number.isInteger(subscriptionYears) || subscriptionYears < 0 || subscriptionYears > 20) {
    return '구독기간은 0~20년으로 입력해 주세요.';
  }
  if (!Number.isInteger(renewalCount) || renewalCount < 0 || renewalCount > 100) {
    return '갱신횟수는 0~100회로 입력해 주세요.';
  }
  if (!SUBSCRIPTION_STATUSES.includes(subscriptionStatus as FarmRecordInput['subscriptionStatus'])) {
    return '구독 상태를 확인해 주세요.';
  }
  if (installationDate && warrantyYears > 0 && !warrantyExpiresAt) {
    return '설치일과 보증기간이 있으면 보증 만료일을 입력해 주세요.';
  }
  if (installationDate && warrantyExpiresAt && warrantyExpiresAt < installationDate) {
    return '보증 만료일은 설치일보다 빠를 수 없습니다.';
  }
  if (initialSubscriptionExpiresAt && currentSubscriptionExpiresAt
    && initialSubscriptionExpiresAt > currentSubscriptionExpiresAt) {
    return '현재 구독 만료일은 최초 구독 만료일보다 빠를 수 없습니다.';
  }

  const today = todayInSeoul();
  if (subscriptionStatus === 'active'
    && (!currentSubscriptionExpiresAt || currentSubscriptionExpiresAt < today)) {
    return '사용중 구독은 오늘 이후(오늘 포함)의 현재 만료일이 필요합니다.';
  }
  if (subscriptionStatus === 'expired'
    && (!currentSubscriptionExpiresAt || currentSubscriptionExpiresAt >= today)) {
    return '만료 구독은 오늘보다 이전인 현재 만료일이 필요합니다.';
  }
  if (subscriptionStatus === 'unregistered' && currentSubscriptionExpiresAt) {
    return '미등록 구독에는 현재 구독 만료일을 입력할 수 없습니다.';
  }
  if (lastPaymentDate && lastPaymentDate > today) return '최근 입금일은 미래 날짜일 수 없습니다.';
  if (notes.length > 3000) return '사업 비고는 3,000자 이내로 입력해 주세요.';

  return {
    projectId,
    crop,
    deviceType,
    productType,
    vendor,
    productionSetupDate,
    installationDate,
    commissioningDate,
    educationDate,
    internetType,
    warrantyYears,
    warrantyExpiresAt,
    subscriptionYears,
    initialSubscriptionExpiresAt,
    currentSubscriptionExpiresAt,
    lastPaymentDate,
    renewalCount,
    subscriptionStatus: subscriptionStatus as FarmRecordInput['subscriptionStatus'],
    notes,
  };
}

function parseWorkItemInput(value: unknown): FarmWorkItemInput | string {
  const body = objectValue(value);
  if (!body) return '업무 정보를 확인해 주세요.';
  if (!hasStringFields(body, ['farmRecordId', 'title', 'owner', 'dueDate', 'description'])) {
    return '업무의 문자 항목을 확인해 주세요.';
  }

  const farmRecordId = trimmed(body, 'farmRecordId');
  const title = trimmed(body, 'title');
  const owner = trimmed(body, 'owner');
  const dueDate = trimmed(body, 'dueDate');
  const description = trimmed(body, 'description');
  const workType = body.workType;
  const status = body.status;

  if (!farmRecordId || farmRecordId.length > 100) return '업무의 농가 사업 정보를 확인해 주세요.';
  if (!FARM_WORK_TYPES.includes(workType as FarmWorkItemInput['workType'])) return '업무 유형을 확인해 주세요.';
  if (!title || title.length > 140) return '업무 제목은 1~140자로 입력해 주세요.';
  if (!FARM_WORK_STATUSES.includes(status as FarmWorkItemInput['status'])) return '업무 상태를 확인해 주세요.';
  if (!owner || owner.length > 50) return '담당자는 1~50자로 입력해 주세요.';
  if (!validDate(dueDate)) return '마감일은 YYYY-MM-DD 형식으로 입력해 주세요.';
  if (description.length > 3000) return '업무 설명은 3,000자 이내로 입력해 주세요.';

  return {
    farmRecordId,
    workType: workType as FarmWorkItemInput['workType'],
    title,
    status: status as FarmWorkItemInput['status'],
    owner,
    dueDate,
    description,
  };
}

function parseInitialHistoryInput(value: unknown): FarmInitialHistoryEntryInput | string {
  const body = objectValue(value);
  if (!body) return '히스토리 정보를 확인해 주세요.';
  if (!hasStringFields(body, [
    'sender', 'receivedContent', 'actionContent', 'recorder', 'referenceUrl',
  ])) return '히스토리의 문자 항목을 확인해 주세요.';

  const channel = body.channel;
  const sender = trimmed(body, 'sender');
  const receivedContent = trimmed(body, 'receivedContent');
  const actionContent = trimmed(body, 'actionContent');
  const recorder = trimmed(body, 'recorder');
  const referenceUrl = trimmed(body, 'referenceUrl');
  const amount = integerValue(body.amount);
  const occurredAt = integerValue(body.occurredAt);

  if (!FARM_HISTORY_CHANNELS.includes(channel as FarmInitialHistoryEntryInput['channel'])) {
    return '수신 경로를 확인해 주세요.';
  }
  if (!receivedContent && !actionContent) return '받은 내용 또는 처리 내용을 입력해 주세요.';
  if (receivedContent && !sender) return '받은 내용의 전달자나 기관을 입력해 주세요.';
  if (sender.length > 100) return '전달자는 100자 이내로 입력해 주세요.';
  if (receivedContent.length > 3000 || actionContent.length > 3000) {
    return '히스토리 내용은 각각 3,000자 이내로 입력해 주세요.';
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000000000) return '금액을 확인해 주세요.';
  if (!recorder || recorder.length > 50) return '기록자는 1~50자로 입력해 주세요.';
  if (!Number.isSafeInteger(occurredAt)
    || occurredAt < 946684800000
    || occurredAt > Date.now() + 365 * 86400000) return '발생 일시를 확인해 주세요.';
  if (!validUrl(referenceUrl)) return '참고 링크는 2,000자 이내의 http:// 또는 https:// 주소로 입력해 주세요.';

  return {
    channel: channel as FarmInitialHistoryEntryInput['channel'],
    sender,
    receivedContent,
    actionContent,
    amount,
    recorder,
    occurredAt,
    referenceUrl,
  };
}

function parseHistoryInput(value: unknown): AddFarmHistoryEntryInput | string {
  const body = objectValue(value);
  if (!body) return '히스토리 정보를 확인해 주세요.';
  let workItemId: string;
  try {
    workItemId = parseId(body.workItemId, '업무 ID');
  } catch (error) {
    return error instanceof Error ? error.message : '업무 ID를 확인해 주세요.';
  }
  const fields = parseInitialHistoryInput(body);
  if (typeof fields === 'string') return fields;
  let newStatus: FarmWorkStatus | undefined;
  if (body.newStatus !== undefined) {
    if (!FARM_WORK_STATUSES.includes(body.newStatus as FarmWorkStatus)) {
      return '변경할 업무 상태를 확인해 주세요.';
    }
    newStatus = body.newStatus as FarmWorkStatus;
  }
  return { workItemId, ...fields, ...(newStatus ? { newStatus } : {}) };
}

function knownErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const responses: Record<string, [string, number]> = {
    SMARTFARM_PROJECT_NOT_FOUND: ['선택한 사업을 찾을 수 없습니다.', 404],
    FARM_NOT_FOUND: ['농가를 찾을 수 없습니다.', 404],
    FARM_RECORD_NOT_FOUND: ['농가의 사업 참여 정보를 찾을 수 없습니다.', 404],
    FARM_WORK_ITEM_NOT_FOUND: ['업무를 찾을 수 없습니다.', 404],
    FARM_CODE_EXISTS: ['이미 사용 중인 농장번호입니다.', 409],
  };
  const known = responses[error.message];
  if (known) return errorResponse(known[0], known[1]);
  if (error.message.includes('UNIQUE constraint failed: farms.farm_code')) {
    return errorResponse('이미 사용 중인 농장번호입니다.', 409);
  }
  return null;
}

export async function GET() {
  try {
    const workspace = await listFarmLedgerWorkspace();
    return Response.json(workspace, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to list farm ledger', error);
    return errorResponse('농가 관리대장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = objectValue(await request.json());
    if (!body || typeof body.kind !== 'string') return errorResponse('저장할 정보 종류를 확인해 주세요.');

    if (body.kind === 'project') {
      const input = parseProjectInput(body.project);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json({ project: await createFarmProject(input) }, { status: 201 });
    }

    if (body.kind === 'farm') {
      const farmInput = parseFarmInput(body.farm);
      if (typeof farmInput === 'string') return errorResponse(farmInput);
      const recordInput = parseRecordInput(body.record);
      if (typeof recordInput === 'string') return errorResponse(recordInput);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(
        await createFarmWithRecord(farmInput, recordInput, recorder),
        { status: 201 },
      );
    }

    if (body.kind === 'record') {
      let farmId: string;
      try {
        farmId = parseId(body.farmId, '농가 ID');
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : '농가 ID를 확인해 주세요.');
      }
      const input = parseRecordInput(body.record);
      if (typeof input === 'string') return errorResponse(input);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(await createFarmRecord(farmId, input, recorder), { status: 201 });
    }

    if (body.kind === 'work_item') {
      const input = parseWorkItemInput(body.workItem);
      if (typeof input === 'string') return errorResponse(input);
      const history = parseInitialHistoryInput(body.history);
      if (typeof history === 'string') return errorResponse(history);
      return Response.json(await createFarmWorkItem(input, history), { status: 201 });
    }

    if (body.kind === 'history') {
      const input = parseHistoryInput(body.history);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json(await addFarmHistoryEntry(input), { status: 201 });
    }

    return errorResponse('저장할 정보 종류를 확인해 주세요.');
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse('요청 본문은 올바른 JSON이어야 합니다.');
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error('Failed to save farm ledger', error);
    return errorResponse('관리대장을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = objectValue(await request.json());
    if (!body || typeof body.kind !== 'string') return errorResponse('수정할 정보 종류를 확인해 주세요.');

    if (body.kind === 'farm') {
      let farmId: string;
      try {
        farmId = parseId(body.farmId, '농가 ID');
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : '농가 ID를 확인해 주세요.');
      }
      const input = parseFarmInput(body.farm);
      if (typeof input === 'string') return errorResponse(input);
      return Response.json({ farm: await updateFarm(farmId, input) });
    }

    if (body.kind === 'record') {
      let recordId: string;
      try {
        recordId = parseId(body.recordId, '사업 참여 ID');
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : '사업 참여 ID를 확인해 주세요.');
      }
      const input = parseRecordInput(body.record);
      if (typeof input === 'string') return errorResponse(input);
      const recorder = parseRecorder(body.recorder);
      if (recorder.includes('입력해 주세요')) return errorResponse(recorder);
      return Response.json(await updateFarmRecord(recordId, input, recorder));
    }

    return errorResponse('수정할 정보 종류를 확인해 주세요.');
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse('요청 본문은 올바른 JSON이어야 합니다.');
    const known = knownErrorResponse(error);
    if (known) return known;
    console.error('Failed to update farm ledger', error);
    return errorResponse('관리대장을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500);
  }
}
