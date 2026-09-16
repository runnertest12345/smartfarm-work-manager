import type { FarmRecord, FarmWorkItem } from './farm-types';

export interface WorkListScope {
  source?: 'internal';
  projectIds: string[];
  label: string;
  status: 'all' | 'open' | 'overdue';
}

/** Match the same project and date scope as the KPI that opened the list. */
export function workMatchesScope(
  item: Pick<FarmWorkItem, 'status' | 'dueDate'> & Partial<Pick<FarmWorkItem, 'scope' | 'farmRecordId' | 'workType'>>,
  projectId: string | undefined,
  scope: WorkListScope | null,
  today: string,
) {
  if (!scope) return true;
  if (scope.source === 'internal') {
    if (item.scope !== 'internal' || item.farmRecordId || ['payment', 'subscription'].includes(item.workType || '')) return false;
  } else if (!projectId || !scope.projectIds.includes(projectId)) return false;
  if (scope.status !== 'all' && item.status === 'completed') return false;
  return (
    scope.status !== 'overdue' || Boolean(item.dueDate && item.dueDate < today)
  );
}

/** Presentation scope only. Duplicate participation validation must use all records. */
export function farmRecordsInContext(records: FarmRecord[], projectId: string) {
  return records.filter(
    (record) => !projectId || record.projectId === projectId,
  );
}

export function hasProjectParticipation(
  allFarmRecords: FarmRecord[],
  projectId: string,
  excludingRecordId = '',
) {
  return allFarmRecords.some(
    (record) =>
      record.id !== excludingRecordId && record.projectId === projectId,
  );
}
