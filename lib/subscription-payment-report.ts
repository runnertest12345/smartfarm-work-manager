import type {
  FarmHistoryEntry,
  FarmProject,
  FarmRecord,
  FarmWorkItem,
} from './farm-types';

export interface PaymentYearEntry {
  id: string;
  farmRecordId: string;
  projectId: string;
  workItemId: string;
  year: number;
  amount: number;
  ordinal: number | null;
}

/** Determine ordinals before year/type filtering. Never renumber a saved payment. */
export function buildPaymentYearReport(
  records: FarmRecord[],
  projects: FarmProject[],
  workItems: FarmWorkItem[],
  historyEntries: FarmHistoryEntry[],
  options: { asOf: number; projectType?: string },
) {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const workById = new Map(workItems.map((work) => [work.id, work]));
  const byRecord = new Map<string, FarmHistoryEntry[]>();
  const seen = new Set<string>();
  const possiblyLimited =
    historyEntries.length >= 5000 || workItems.length >= 5000;
  const incompleteRecords = new Set<string>();
  const matches = (projectId: string) =>
    projectById.has(projectId) &&
    (!options.projectType ||
      options.projectType === 'all' ||
      projectById.get(projectId)?.projectType === options.projectType);
  for (const entry of historyEntries) {
    const work = workById.get(entry.workItemId);
    if (
      seen.has(entry.id) ||
      !work ||
      work.workType !== 'payment' ||
      !recordById.has(work.farmRecordId) ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0 ||
      !Number.isFinite(entry.occurredAt) ||
      entry.occurredAt <= 0 ||
      entry.occurredAt > options.asOf ||
      !Number.isFinite(new Date(entry.occurredAt).getTime())
    )
      continue;
    seen.add(entry.id);
    const list = byRecord.get(work.farmRecordId) ?? [];
    list.push(entry);
    byRecord.set(work.farmRecordId, list);
  }
  const entries: PaymentYearEntry[] = [];
  const positiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  for (const record of records) {
    if (!matches(record.projectId)) continue;
    const payments = (byRecord.get(record.id) ?? []).sort(
      (a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id),
    );
    const savedCounts = new Map<number, number>();
    const timeCounts = new Map<number, number>();
    for (const payment of payments) {
      const ordinal = payment.subscriptionPaymentOrdinal;
      if (positiveInteger(ordinal))
        savedCounts.set(ordinal, (savedCounts.get(ordinal) ?? 0) + 1);
      timeCounts.set(
        payment.occurredAt,
        (timeCounts.get(payment.occurredAt) ?? 0) + 1,
      );
    }
    const missing =
      positiveInteger(record.subscriptionPaymentCount) &&
      record.subscriptionPaymentCount > payments.length;
    const reversedIds = new Set<string>();
    const timeGroups = new Map<
      number,
      { payment: FarmHistoryEntry; index: number }[]
    >();
    for (const [index, payment] of payments.entries()) {
      const group = timeGroups.get(payment.occurredAt) ?? [];
      group.push({ payment, index });
      timeGroups.set(payment.occurredAt, group);
    }
    const orderedGroups = [...timeGroups.values()];
    let greatestEarlier = 0;
    for (const group of orderedGroups) {
      let groupMax = greatestEarlier;
      for (const { payment } of group) {
        const ordinal = payment.subscriptionPaymentOrdinal;
        if (!positiveInteger(ordinal)) continue;
        if (ordinal < greatestEarlier) reversedIds.add(payment.id);
        groupMax = Math.max(groupMax, ordinal);
      }
      greatestEarlier = groupMax;
    }
    let smallestLater = Number.POSITIVE_INFINITY;
    for (let i = orderedGroups.length - 1; i >= 0; i--) {
      let groupMin = smallestLater;
      for (const { payment } of orderedGroups[i]) {
        const ordinal = payment.subscriptionPaymentOrdinal;
        if (!positiveInteger(ordinal)) continue;
        if (ordinal > smallestLater) reversedIds.add(payment.id);
        groupMin = Math.min(groupMin, ordinal);
      }
      smallestLater = groupMin;
    }
    const misaligned = orderedGroups.some((group) =>
      group.some(
        ({ payment }) =>
          positiveInteger(payment.subscriptionPaymentOrdinal) &&
          (payment.subscriptionPaymentOrdinal < group[0].index + 1 ||
            payment.subscriptionPaymentOrdinal >
              group[group.length - 1].index + 1),
      ),
    );
    if (missing) incompleteRecords.add(record.id);
    for (const [index, payment] of payments.entries()) {
      const saved = payment.subscriptionPaymentOrdinal;
      const ordinal = positiveInteger(saved)
        ? savedCounts.get(saved) === 1 && !reversedIds.has(payment.id)
          ? saved
          : null
        : saved !== undefined ||
            missing ||
            misaligned ||
            possiblyLimited ||
            timeCounts.get(payment.occurredAt)! > 1
          ? null
          : index + 1;
      entries.push({
        id: payment.id,
        farmRecordId: record.id,
        projectId: record.projectId,
        workItemId: payment.workItemId,
        year: new Date(payment.occurredAt).getFullYear(),
        amount: payment.amount,
        ordinal,
      });
    }
  }
  // Keep very high legacy ordinals from creating thousands of columns.
  const maxOrdinal = Math.max(
    3,
    ...entries.map((entry) => Math.min(entry.ordinal ?? 0, 11)),
  );
  const columns = Array.from({ length: maxOrdinal }, (_, i) => i + 1);
  const summarize = (items: PaymentYearEntry[]) => ({
    count: items.length,
    amount: items.reduce((sum, entry) => sum + entry.amount, 0),
    unknown: items.filter((entry) => entry.ordinal === null).length,
    ordinals: columns.map((ordinal) => ({
      ordinal,
      count: items.filter((entry) =>
        ordinal === 11
          ? entry.ordinal !== null && entry.ordinal >= 11
          : entry.ordinal === ordinal,
      ).length,
    })),
  });
  const years = [
    ...new Set([
      new Date(options.asOf).getFullYear(),
      ...entries.map((entry) => entry.year),
    ]),
  ].sort((a, b) => b - a);
  return {
    entries,
    columns,
    years: years.map((year) => ({
      year,
      ...summarize(entries.filter((entry) => entry.year === year)),
    })),
    total: summarize(entries),
    incompleteRecords: incompleteRecords.size,
    possiblyLimited,
  };
}

export const paymentOrdinalLabel = (ordinal: number) =>
  ordinal === 11 ? '11차 이상' : `${ordinal}차`;

export function paymentYearReportLines(
  report: ReturnType<typeof buildPaymentYearReport>,
  projectTypeLabel: string,
) {
  const line = (label: string, row: typeof report.total) =>
    `${label}: ${row.ordinals.map((cell) => `${paymentOrdinalLabel(cell.ordinal)} ${cell.count}건`).join(' / ')} / 차수 연결 필요 ${row.unknown}건 / 전체 입금 ${row.count}건`;
  return [
    '전체 연도 · 입금연도별 갱신 차수',
    `사업 타입: ${projectTypeLabel}`,
    '실제 입금일 기준 · 농가×사업별 전체 입금 순서로 차수 계산 · 사업 타입은 현재 연결 사업 기준 · 단위: 입금 건',
    line('전체 기간 총계', report.total),
    ...report.years.map((row) => line(`${row.year}년`, row)),
    ...(report.incompleteRecords || report.possiblyLimited
      ? [
          '일부 입금 이력이 누락되거나 조회 한도에 도달하여 불러온 기록 범위만 표시합니다.',
        ]
      : []),
  ];
}
