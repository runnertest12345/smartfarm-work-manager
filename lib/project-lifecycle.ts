import type { FarmProject } from './farm-types';

export function projectLifecyclePatch(
  project: FarmProject,
  expectedUpdatedAt: number,
  deleted: boolean,
  now: number,
  uid: string,
  updateId: string,
) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt <= 0)
    throw new Error(
      '프로젝트 확인 시각이 올바르지 않습니다. 다시 열어 주세요.',
    );
  if (Boolean(project.deletedAt) === deleted) return null;
  if (project.updatedAt !== expectedUpdatedAt)
    throw new Error(
      '다른 변경이 먼저 저장됐습니다. 프로젝트를 다시 확인한 뒤 시도해 주세요.',
    );
  const updatedAt = Math.max(now, project.updatedAt + 1);
  return {
    deletedAt: deleted ? updatedAt : 0,
    deletedByUid: deleted ? uid : '',
    lifecycleUpdateId: updateId,
    updatedAt,
    updatedByUid: uid,
  };
}
