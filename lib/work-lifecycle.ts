import type { FarmWorkItem } from './farm-types';
import { isPersonalMember, type AppMember } from './organization';

export function isActiveWork(item: Pick<FarmWorkItem, 'deletedAt'>) {
  return !item.deletedAt;
}

/** The same UID-based policy is enforced by Firestore, never by display name. */
export function canManageWorkDeletion(
  item: FarmWorkItem,
  member: AppMember | null | undefined,
  workspaceId?: string,
) {
  return Boolean(
    isPersonalMember(member, workspaceId) &&
    (member?.admin || member?.id === item.createdByUid) &&
    !['payment', 'subscription'].includes(item.workType),
  );
}

export function assertWorkActive(item: FarmWorkItem) {
  if (!isActiveWork(item))
    throw new Error(
      '삭제된 업무입니다. 삭제된 업무 목록에서 먼저 복원해 주세요.',
    );
}
