import type {
  FarmProject,
  FarmRecord,
  FarmSubscriptionEvent,
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
  outcome: RenewalOutcome;
  upcoming: boolean;
  futureResultDate: string | null;
}
export interface RenewalMetrics {
  target: number;
  renewed: number;
  churned: number;
  pending: number;
  conflict: number;
  upcoming: number;
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
  const due = cycles.filter((cycle) => !cycle.upcoming);
  const count = (outcome: RenewalOutcome) =>
    due.filter((cycle) => cycle.outcome === outcome).length;
  const renewed = count('renewed');
  return {
    target: due.length,
    renewed,
    churned: count('churned'),
    pending: count('pending'),
    conflict: count('conflict'),
    upcoming: cycles.length - due.length,
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
    endMonth: number;
    today: string;
    projectType?: string;
  },
) {
  const { year, endMonth, today, projectType = 'all' } = options;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${new Date(year, endMonth, 0).getDate()}`;
  const cutoffDate = endDate < today ? endDate : today;
  const recordById = new Map(records.map((record) => [record.id, record]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
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
      ]),
    );
    identities.set(event.id, signatures);
  }
  const resolved = (cycle: { events: FarmSubscriptionEvent[] }) => {
    const observed = cycle.events.filter((event) => event.processedAt <= today);
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
  const previousRenewals = new Map<string, FarmSubscriptionEvent[]>();
  for (const [key, cycle] of candidates) {
    if (outcomes.get(key) !== 'renewed') continue;
    for (const event of cycle.events.filter(
      (event) => event.processedAt <= today && event.eventType === 'renewed',
    )) {
      const nextKey = `${event.farmRecordId}:${event.newExpiryDate}`;
      previousRenewals.set(nextKey, [
        ...(previousRenewals.get(nextKey) ?? []),
        event,
      ]);
    }
  }
  const cycles: RenewalCycle[] = [];
  for (const [key, cycle] of candidates) {
    if (
      !matches(cycle.projectId) ||
      cycle.expiryDate < startDate ||
      cycle.expiryDate > endDate
    )
      continue;
    const counts = new Set(
      cycle.events
        .filter((event) => event.processedAt <= today)
        .map((event) => event.basisRenewalCount)
        .filter(validCount),
    );
    // A linked, confirmed previous renewal proves repeat membership without guessing an exact count.
    const outcomeDates = cycle.events
      .filter((event) => event.processedAt <= today)
      .map((event) => event.processedAt)
      .sort();
    const previousRenewal = (previousRenewals.get(key) ?? []).some(
      (prior) =>
        prior.projectId === cycle.projectId &&
        prior.basisExpiryDate < cycle.expiryDate &&
        prior.processedAt <= (outcomeDates[0] ?? today),
    );
    let stage: RenewalStage = 'unknown';
    if (counts.size === 1) {
      const count = [...counts][0];
      stage = count === 0 ? (previousRenewal ? 'unknown' : 'first') : 'repeat';
    } else if (counts.size === 0 && previousRenewal) {
      stage = 'repeat';
    } else if (
      counts.size === 0 &&
      cycle.current &&
      cycle.events.length === 0 &&
      validCount(cycle.record.renewalCount)
    ) {
      stage = cycle.record.renewalCount === 0 ? 'first' : 'repeat';
    }
    cycles.push({
      key,
      farmRecordId: cycle.record.id,
      projectId: cycle.projectId,
      expiryDate: cycle.expiryDate,
      stage,
      outcome: outcomes.get(key) ?? 'pending',
      upcoming: cycle.expiryDate > today,
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
    cycles,
    startDate,
    endDate,
    cutoffDate,
    today,
    excluded,
    rejoined,
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
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const groups = new Map<string, RenewalCycle[]>();
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
