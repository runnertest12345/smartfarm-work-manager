import type { FarmRecord } from './farm-types';

export function isFarmStageComplete(
  record: FarmRecord,
  key: 'installationDate' | 'commissioningDate' | 'educationDate',
) {
  return Boolean(
    record[key] || record.stageCompletionConfirmed?.[key] === true,
  );
}

export function farmStageCompletionLabel(
  record: FarmRecord,
  key: 'installationDate' | 'commissioningDate' | 'educationDate',
) {
  return (
    record[key] ||
    (isFarmStageComplete(record, key) ? '완료 확인 · 일자 미기록' : '미완료')
  );
}

const stages = [
  { key: 'installationDate', label: '설치' },
  { key: 'commissioningDate', label: '시운전' },
  { key: 'educationDate', label: '교육' },
] as const;

export function summarizeProjectFarms(
  allRecords: FarmRecord[],
  projectId: string,
) {
  // Preserve the ledger's existing one-latest-record-per-farm denominator.
  const byFarm = new Map<string, FarmRecord>();
  for (const record of allRecords) {
    if (record.projectId !== projectId) continue;
    const previous = byFarm.get(record.farmId);
    if (!previous || record.lastActivityAt > previous.lastActivityAt)
      byFarm.set(record.farmId, record);
  }
  const records = [...byFarm.values()];
  const total = records.length;
  return {
    records,
    total,
    stages: stages.map((stage) => {
      const completed = records.filter((record) =>
        isFarmStageComplete(record, stage.key),
      ).length;
      return {
        ...stage,
        completed,
        remaining: total - completed,
        total,
        rate: total ? Math.round((completed / total) * 100) : null,
      };
    }),
  };
}

export type ProjectFarmProgress = ReturnType<typeof summarizeProjectFarms>;
