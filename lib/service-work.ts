import type { FarmHistoryEntry, FarmWorkItem } from './farm-types';

/** After-sales support continues after a farm's project has finished. */
export function isFarmServiceWork(
  work: Pick<FarmWorkItem, 'workType' | 'farmRecordId' | 'scope'>,
) {
  return (
    work.workType === 'service' &&
    Boolean(work.farmRecordId) &&
    work.scope !== 'internal'
  );
}

function validTimestamp(value: number) {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

/** Reception is fixed by the first saved history, not later backdated updates. */
export function serviceReceivedAt(
  work: Pick<FarmWorkItem, 'createdAt'>,
  entries: Pick<FarmHistoryEntry, 'createdAt' | 'occurredAt'>[],
): number {
  const first = entries
    .filter((entry) => validTimestamp(entry.createdAt))
    .sort(
      (a, b) =>
        a.createdAt - b.createdAt ||
        (validTimestamp(a.occurredAt) ? a.occurredAt : Infinity) -
          (validTimestamp(b.occurredAt) ? b.occurredAt : Infinity),
    )[0];
  if (first && validTimestamp(first.occurredAt)) return first.occurredAt;
  return validTimestamp(work.createdAt) ? work.createdAt : 0;
}

export function serviceYear(timestamp: number): string {
  if (!validTimestamp(timestamp)) return 'unknown';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(timestamp);
}

export function serviceDateLabel(timestamp: number): string {
  if (!validTimestamp(timestamp)) return '접수일 미지정';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
}

export function serviceYearOptions(dates: number[], currentYear: string) {
  const years = new Set(dates.map(serviceYear));
  const hasUnknown = years.delete('unknown');
  years.add(currentYear);
  return [...years]
    .sort((a, b) => Number(b) - Number(a))
    .concat(hasUnknown ? ['unknown'] : []);
}
