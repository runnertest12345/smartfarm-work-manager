import type { FarmWorkItem } from './farm-types';
import { isPersonalMember, type AppMember } from './organization';

export const MAX_WORK_TITLE_LENGTH = 200;

/** Renaming follows ordinary personal-member editing, without changing evidence titles. */
export function canRenameWork(
  work: Pick<FarmWorkItem, 'deletedAt' | 'workType'>,
  member: AppMember | null | undefined,
  workspaceId?: string,
) {
  return Boolean(
    isPersonalMember(member, workspaceId) &&
    !work.deletedAt &&
    !['payment', 'subscription'].includes(work.workType),
  );
}

export function validateWorkTitle(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('업무명을 입력해 주세요.');
  const title = value.trim();
  if (!title || title.length > MAX_WORK_TITLE_LENGTH)
    throw new Error(`업무명은 1~${MAX_WORK_TITLE_LENGTH}자로 입력해 주세요.`);
  return title;
}
