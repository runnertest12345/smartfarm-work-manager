import type { FarmWorkItem, FarmRecord, FarmHistoryEntry } from './farm-types';

/** Imported replacement results remain in the farm ledger, not the work queue. */
export function isFarmBoxReplacementHistory(
  item: FarmWorkItem,
  history: FarmHistoryEntry[] = [],
) {
  if (
    item.workType !== 'service' ||
    item.status !== 'completed' ||
    !item.farmRecordId ||
    item.title !== 'A/S 기록 이관' ||
    !/^work_service_[a-f0-9]{32}$/.test(item.id) ||
    !item.migrationRunId ||
    !/^[a-f0-9]{64}$/.test(item.sourceFingerprint || '') ||
    history.length !== 1
  )
    return false;
  const entry = history[0];
  return (
    entry.workItemId === item.id &&
    entry.id === item.id.replace(/^work_/, 'history_') &&
    entry.channel === 'system' &&
    entry.occurredAt === item.createdAt &&
    /^파모스\s*박스\s*교체(?:\s*완료)?$/.test(entry.actionContent.trim())
  );
}

/** Keep real farm operations visible, without counting billing or ledger audit logs. */
export function isOperationalWork(
  item: FarmWorkItem,
  history: FarmHistoryEntry[] = [],
) {
  if (item.workType === 'payment' || item.workType === 'subscription')
    return false;
  if (isFarmBoxReplacementHistory(item, history)) return false;
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
