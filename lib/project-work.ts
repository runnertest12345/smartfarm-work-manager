import type { FarmWorkItem, FarmRecord, FarmHistoryEntry } from './farm-types';

/** Keep real farm operations visible, without counting billing or ledger audit logs. */
export function isOperationalWork(
  item: FarmWorkItem,
  history: FarmHistoryEntry[] = [],
) {
  if (item.workType === 'payment' || item.workType === 'subscription')
    return false;
  const automaticLedgerNote =
    item.workType === 'note' &&
    item.status === 'completed' &&
    item.respondedAt === 0 &&
    ['농가 관리대장 등록', '사업 참여 등록', '사업 참여 정보 수정'].includes(
      item.title,
    ) &&
    history.some(
      (entry) =>
        entry.channel === 'system' &&
        !entry.receivedContent &&
        entry.occurredAt === item.createdAt,
    );
  return !automaticLedgerNote;
}

/** Project execution tasks are not farm billing or automatic ledger audit records. */
export function isProjectTask(
  item: Pick<FarmWorkItem, 'projectId' | 'farmRecordId' | 'workType'>,
) {
  return (
    Boolean(item.projectId) &&
    !item.farmRecordId &&
    item.workType !== 'payment' &&
    item.workType !== 'subscription'
  );
}

export function workProjectId(
  item: FarmWorkItem,
  records: ReadonlyMap<string, FarmRecord>,
) {
  return records.get(item.farmRecordId)?.projectId || item.projectId || '';
}
