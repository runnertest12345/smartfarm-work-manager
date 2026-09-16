import type { Farm, FarmProject, FarmRecord } from './farm-types';

export const MAX_PROJECT_INSTALLATION_FARMS = 500;
// Each site writes a farm, participation record and two uniqueness claims.
export const PROJECT_INSTALLATION_FARM_CHUNK_SIZE = 10;

export function validateInstallationFarmCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_PROJECT_INSTALLATION_FARMS) {
    throw new Error(`설치 개소는 0~${MAX_PROJECT_INSTALLATION_FARMS} 사이의 정수로 입력해 주세요.`);
  }
  return value;
}

export function installationFarmProgress(project: FarmProject) {
  const setup = project.installationFarmSetup;
  if (!setup) throw new Error('자동 생성 요청이 없는 프로젝트입니다.');
  validateInstallationFarmCount(setup.requestedCount);
  if (!Number.isSafeInteger(setup.completedCount) || setup.completedCount < 0 || setup.completedCount > setup.requestedCount) {
    throw new Error('설치 개소 생성 상태를 확인해 주세요.');
  }
  return setup;
}

/** Stable identities make retries safe even after a successful commit response is lost. */
export function projectInstallationFarm(project: FarmProject, index: number, now: number) {
  if (project.projectType === 'internal') throw new Error('내부 프로젝트에는 농가를 자동 생성하지 않습니다.');
  const setup = installationFarmProgress(project);
  if (!Number.isSafeInteger(index) || index < 0 || index >= setup.requestedCount) {
    throw new Error('설치 개소 순서를 확인해 주세요.');
  }
  const ordinal = String(index + 1).padStart(3, '0');
  const farm: Farm = {
    id: `site-${project.id}-${ordinal}`,
    farmCode: `TEMP-${project.id}-${ordinal}`,
    name: `미입력 농가 ${ordinal}`,
    phone: '', address: '', region: '미입력', businessNumber: '',
    folderUrl: '', locationUrl: '', locationImageIds: [], specialNotes: '',
    createdAt: now, updatedAt: now,
  };
  const record: FarmRecord = {
    id: `site-record-${project.id}-${ordinal}`,
    farmId: farm.id, projectId: project.id,
    crop: '', deviceType: '', productType: '', vendor: '',
    productionSetupDate: '', installationDate: '', commissioningDate: '', educationDate: '',
    internetType: '', warrantyYears: 0, warrantyExpiresAt: '', subscriptionYears: 0,
    initialSubscriptionExpiresAt: '', currentSubscriptionExpiresAt: '', lastPaymentDate: '',
    renewalCount: 0, subscriptionStatus: 'unregistered', notes: '',
    lastActivityAt: now, createdAt: now, updatedAt: now,
  };
  return { farm, record };
}

export function projectRegistrationRequestId(value?: unknown) {
  if (value === undefined) return crypto.randomUUID();
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) {
    throw new Error('프로젝트 등록 요청 ID를 확인해 주세요.');
  }
  return value.toLowerCase();
}

/** Only a digest is retained, not a second copy of business input. */
export async function projectRegistrationSignature(input: unknown) {
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, field]) => [key, canonical(field)]))
      : value;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(input)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}
