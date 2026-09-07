import type {
  FarmProject,
  FarmRecord,
  FarmSubscriptionEvent,
  FarmWorkItem,
  FarmHistoryEntry,
} from './farm-types';

export type RenewalStage = 'first' | 'repeat' | 'unknown';
export type RenewalOutcome = 'renewed' | 'churned' | 'pending' | 'conflict';
export type RenewalGrouping = 'year' | 'month' | 'type' | 'project';
export interface RenewalCycle {
  key: string;
  farmRecordId: string;
  projectId: string;
  expiryDate: string;
  stage: RenewalStage;
  paymentCount: number;
  paymentOrdinal: number | null;
  outcome: RenewalOutcome;
  upcoming: boolean;
  dueToday: boolean;
  futureResultDate: string | null;
}
export interface RenewalMetrics {
  annualTarget: number;
  target: number;
  renewed: number;
  churned: number;
  pending: number;
  notRenewed: number;
  conflict: number;
  upcoming: number;
  dueToday: number;
  rate: number | null;
}

export function validRenewalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Snapshot only the current cycle. Historical backfills must not copy today's count. */
export function renewalCountBeforeEvent(
  record: Pick<FarmRecord, 'currentSubscriptionExpiresAt' | 'renewalCount'>,
  basisExpiryDate: string,
  explicitCount?: number | null,
): number | null {
  if (basisExpiryDate === record.currentSubscriptionExpiresAt) {
    return validCount(record.renewalCount) ? record.renewalCount : null;
  }
  return validCount(explicitCount) ? explicitCount : null;
}

export function summarizeRenewalCycles(cycles: RenewalCycle[]): RenewalMetrics {
  const due = cycles.filter((cycle) => !cycle.upcoming && !cycle.dueToday);
  const count = (outcome: RenewalOutcome) =>
    due.filter((cycle) => cycle.outcome === outcome).length;
  const renewed = count('renewed');
  return {
    annualTarget: cycles.length,
    target: due.length,
    renewed,
    churned: count('churned'),
    pending: count('pending'),
    notRenewed: count('pending') + count('churned'),
    conflict: count('conflict'),
    upcoming: cycles.filter((cycle) => cycle.upcoming).length,
    dueToday: cycles.filter((cycle) => cycle.dueToday).length,
    rate: due.length ? Math.round((renewed / due.length) * 10000) / 100 : null,
  };
}

/** Known expiry cycles, not reconstructed contracts. Initial/corrected dates are not extra cycles. */
export function buildRenewalReport(
  records: FarmRecord[],
  events: FarmSubscriptionEvent[],
  projects: FarmProject[],
  options: {
    year: number;
    today: string;
    projectType?: string;
    workItems?: FarmWorkItem[];
    historyEntries?: FarmHistoryEntry[];
  },
) {
  const { year, today, projectType = 'all' } = options;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const cutoffDate = endDate < today ? endDate : today;
  const recordById = new Map(records.map((record) => [record.id, record]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const workById = new Map(
    (options.workItems ?? []).map((work) => [work.id, work]),
  );
  const paymentsByRecord = new Map<
    string,
    { id: string; occurredAt: number; date: string }[]
  >();
  const seenPayments = new Set<string>();
  for (const entry of options.historyEntries ?? []) {
    const work = workById.get(entry.workItemId);
    if (
      seenPayments.has(entry.id) ||
      !work ||
      work.workType !== 'payment' ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0 ||
      !Number.isFinite(entry.occurredAt) ||
      entry.occurredAt <= 0
    )
      continue;
    const occurred = new Date(entry.occurredAt);
    const date = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, '0')}-${String(occurred.getDate()).padStart(2, '0')}`;
    if (date > today) continue;
    seenPayments.add(entry.id);
    paymentsByRecord.set(work.farmRecordId, [
      ...(paymentsByRecord.get(work.farmRecordId) ?? []),
      { id: entry.id, occurredAt: entry.occurredAt, date },
    ]);
  }
  const matches = (projectId: string) =>
    (projectById.has(projectId) || projectId === '') &&
    (projectType === 'all' ||
      projectById.get(projectId)?.projectType === projectType);
  const candidates = new Map<
    string,
    {
      record: FarmRecord;
      projectId: string;
      expiryDate: string;
      events: FarmSubscriptionEvent[];
      current: boolean;
    }
  >();
  let excluded = 0;
  const eventIds = new Set<string>();
  const observedEvents: FarmSubscriptionEvent[] = [];
  for (const event of events) {
    // Exact duplicate delivery is harmless; contradictory copies stay visible as a conflict.
    const signature = JSON.stringify([
      event.id,
      event.farmRecordId,
      event.projectId,
      event.eventType,
      event.basisExpiryDate,
      event.processedAt,
      event.newExpiryDate,
      event.basisRenewalCount,
      event.basisPaymentCount,
      event.paymentHistoryEntryId,
      event.supersedesEventIds,
    ]);
    if (eventIds.has(signature)) continue;
    eventIds.add(signature);
    const record = recordById.get(event.farmRecordId);
    if (
      !record ||
      !projectById.has(event.projectId) ||
      !validRenewalDate(event.basisExpiryDate) ||
      !validRenewalDate(event.processedAt)
    ) {
      excluded += 1;
      continue;
    }
    observedEvents.push(event);
    if (event.eventType === 'rejoined') continue;
    const key = `${record.id}:${event.basisExpiryDate}`;
    const cycle = candidates.get(key) ?? {
      record,
      projectId: event.projectId,
      expiryDate: event.basisExpiryDate,
      events: [],
      current: false,
    };
    cycle.events.push(event);
    candidates.set(key, cycle);
  }
  for (const record of records) {
    if (!record.currentSubscriptionExpiresAt) continue;
    if (
      !validRenewalDate(record.currentSubscriptionExpiresAt) ||
      !projectById.has(record.projectId)
    ) {
      excluded += 1;
      continue;
    }
    const key = `${record.id}:${record.currentSubscriptionExpiresAt}`;
    const cycle = candidates.get(key) ?? {
      record,
      projectId: record.projectId,
      expiryDate: record.currentSubscriptionExpiresAt,
      events: [],
      current: true,
    };
    cycle.current = true;
    candidates.set(key, cycle);
  }
  const identities = new Map<string, Set<string>>();
  for (const cycle of candidates.values()) {
    const observedProjects = new Set(
      cycle.events
        .filter((event) => event.processedAt <= today)
        .map((event) => event.projectId),
    );
    const recordedProjects = new Set(
      cycle.events.map((event) => event.projectId),
    );
    cycle.projectId =
      observedProjects.size === 1
        ? [...observedProjects][0]
        : observedProjects.size > 1
          ? ''
          : recordedProjects.size === 1
            ? [...recordedProjects][0]
            : cycle.record.projectId;
  }
  for (const event of observedEvents.filter(
    (event) => event.processedAt <= today,
  )) {
    const signatures = identities.get(event.id) ?? new Set<string>();
    signatures.add(
      JSON.stringify([
        event.farmRecordId,
        event.projectId,
        event.basisExpiryDate,
        event.eventType,
        event.newExpiryDate,
        event.processedAt,
        event.basisRenewalCount,
        event.basisPaymentCount,
      ]),
    );
    identities.set(event.id, signatures);
  }
  const resolved = (cycle: { events: FarmSubscriptionEvent[] }) => {
    const eligible = cycle.events.filter((event) => event.processedAt <= today);
    const observed = eligible.filter(
      (event) =>
        event.eventType !== 'churned' ||
        !eligible.some(
          (next) =>
            next.eventType === 'renewed' &&
            next.paymentHistoryEntryId &&
            next.supersedesEventIds?.includes(event.id) &&
            next.processedAt >= event.processedAt &&
            validRenewalDate(next.newExpiryDate) &&
            next.newExpiryDate > next.basisExpiryDate,
        ),
    );
    const signatures = new Set(
      observed.map((event) =>
        JSON.stringify([event.eventType, event.projectId, event.newExpiryDate]),
      ),
    );
    const invalidRenewal = observed.some(
      (event) =>
        event.eventType === 'renewed' &&
        (!validRenewalDate(event.newExpiryDate) ||
          event.newExpiryDate <= event.basisExpiryDate),
    );
    const idConflict = observed.some(
      (event) => (identities.get(event.id)?.size ?? 0) > 1,
    );
    if (signatures.size > 1 || invalidRenewal || idConflict)
      return 'conflict' as const;
    return observed[0]?.eventType === 'renewed'
      ? ('renewed' as const)
      : observed[0]?.eventType === 'churned'
        ? ('churned' as const)
        : ('pending' as const);
  };
  const outcomes = new Map(
    [...candidates].map(([key, cycle]) => [key, resolved(cycle)]),
  );
  const cycles: RenewalCycle[] = [];
  for (const [key, cycle] of candidates) {
    if (
      !matches(cycle.projectId) ||
      cycle.expiryDate < startDate ||
      cycle.expiryDate > endDate
    )
      continue;
    const payments = paymentsByRecord.get(cycle.record.id) ?? [];
    const savedCount =
      validCount(cycle.record.subscriptionPaymentCount) &&
      validRenewalDate(cycle.record.lastPaymentDate ?? '') &&
      cycle.record.lastPaymentDate <= today
        ? cycle.record.subscriptionPaymentCount
        : 0;
    const paymentCount = Math.max(payments.length, savedCount);
    const counts = new Set<number>();
    for (const event of cycle.events.filter(
      (event) => event.processedAt <= today,
    )) {
      if (validCount(event.basisPaymentCount)) {
        counts.add(event.basisPaymentCount);
        continue;
      }
      const matching = payments.filter((payment) =>
        event.paymentHistoryEntryId
          ? payment.id === event.paymentHistoryEntryId
          : payment.date === event.processedAt,
      );
      if (
        matching.length === 1 &&
        payments.length >= savedCount &&
        payments.filter(
          (payment) => payment.occurredAt === matching[0].occurredAt,
        ).length === 1
      ) {
        counts.add(
          payments.filter(
            (payment) => payment.occurredAt < matching[0].occurredAt,
          ).length,
        );
      }
    }
    let stage: RenewalStage = 'unknown';
    if (counts.size === 1) {
      const count = [...counts][0];
      stage = count === 0 ? 'first' : 'repeat';
    } else if (
      counts.size === 0 &&
      cycle.current &&
      cycle.events.length === 0
    ) {
      stage = paymentCount === 0 ? 'first' : 'repeat';
    }
    cycles.push({
      key,
      farmRecordId: cycle.record.id,
      projectId: cycle.projectId,
      expiryDate: cycle.expiryDate,
      stage,
      paymentCount,
      paymentOrdinal: counts.size === 1 ? [...counts][0] + 1 : null,
      outcome: outcomes.get(key) ?? 'pending',
      upcoming: cycle.expiryDate > today,
      dueToday: cycle.expiryDate === today,
      futureResultDate:
        cycle.events
          .filter((event) => event.processedAt > today)
          .map((event) => event.processedAt)
          .sort()[0] ?? null,
    });
  }
  cycles.sort(
    (a, b) =>
      a.expiryDate.localeCompare(b.expiryDate) || a.key.localeCompare(b.key),
  );
  const rejoined = new Set(
    observedEvents
      .filter(
        (event) =>
          event.eventType === 'rejoined' &&
          matches(event.projectId) &&
          event.processedAt >= startDate &&
          event.processedAt <= cutoffDate,
      )
      .map((event) => event.id),
  ).size;
  return {
    year,
    cycles,
    startDate,
    endDate,
    cutoffDate,
    today,
    excluded,
    rejoined,
    currentNonRenewed: [...candidates.entries()].filter(
      ([key, cycle]) =>
        cycle.current &&
        matches(cycle.record.projectId) &&
        cycle.expiryDate < today &&
        outcomes.get(key) !== 'renewed',
    ).length,
    overall: summarizeRenewalCycles(cycles),
    first: summarizeRenewalCycles(
      cycles.filter((cycle) => cycle.stage === 'first'),
    ),
    repeat: summarizeRenewalCycles(
      cycles.filter((cycle) => cycle.stage === 'repeat'),
    ),
    unknown: summarizeRenewalCycles(
      cycles.filter((cycle) => cycle.stage === 'unknown'),
    ),
  };
}

export function groupRenewalCycles(
  cycles: RenewalCycle[],
  grouping: RenewalGrouping,
  projects: FarmProject[],
  year?: number,
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const groups = new Map<string, RenewalCycle[]>();
  if (year !== undefined && grouping === 'month') {
    for (let month = 1; month <= 12; month += 1)
      groups.set(`${year}-${String(month).padStart(2, '0')}`, []);
  }
  if (year !== undefined && grouping === 'year') groups.set(String(year), []);
  for (const cycle of cycles) {
    const key =
      grouping === 'year'
        ? cycle.expiryDate.slice(0, 4)
        : grouping === 'month'
          ? cycle.expiryDate.slice(0, 7)
          : grouping === 'type'
            ? (projectById.get(cycle.projectId)?.projectType ?? 'unknown')
            : cycle.projectId;
    groups.set(key, [...(groups.get(key) ?? []), cycle]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([key, rows]) => ({
      key,
      cycles: rows,
      ...summarizeRenewalCycles(rows),
    }));
}
