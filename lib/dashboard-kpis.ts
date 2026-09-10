import type {
  FarmHistoryEntry,
  FarmProject,
  FarmProjectType,
  FarmRecord,
  FarmSubscriptionEvent,
  FarmWorkItem,
} from './farm-types';

import { summarizeWorkHierarchy } from './work-hierarchy';
import { isFarmStageComplete } from './project-farm-progress';

export type ProjectTypeScope = 'all' | FarmProjectType;

export function filterProjectsByScope(
  projects: FarmProject[],
  year: string,
  projectType: ProjectTypeScope,
) {
  return projects.filter(
    (project) =>
      (year === 'all' || project.year === Number(year)) &&
      (projectType === 'all' || project.projectType === projectType),
  );
}

export function filterSubscriptionsByScope(
  records: FarmRecord[],
  projects: FarmProject[],
  projectType: ProjectTypeScope,
  projectId: string,
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return records.filter(
    (record) =>
      (projectId === 'all' || record.projectId === projectId) &&
      (projectType === 'all' ||
        projectById.get(record.projectId)?.projectType === projectType),
  );
}

export interface ProjectKpiSnapshot {
  records: FarmRecord[];
  workItems: FarmWorkItem[];
  activeSubscriptions: FarmRecord[];
  requiredDocuments: unknown[];
  approvedDocuments: unknown[];
  openProjectBlockers: unknown[];
  documentRisks: unknown[];
}

const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : null;

export function summarizeProjectKpis(
  projects: FarmProject[],
  snapshots: ReadonlyMap<string, ProjectKpiSnapshot>,
  today: string,
) {
  const selected = projects.flatMap((project) => {
    const snapshot = snapshots.get(project.id);
    return snapshot ? [snapshot] : [];
  });
  const records = selected.flatMap((snapshot) => snapshot.records);
  const tasks = [
    ...new Map(
      selected.flatMap((snapshot) =>
        snapshot.workItems.map((item) => [item.id, item] as const),
      ),
    ).values(),
  ];
  const hierarchy = summarizeWorkHierarchy(tasks);
  const completedTasks = hierarchy.leaves.filter(
    (item) => item.status === 'completed',
  ).length;
  const incompleteTasks = hierarchy.leaves.filter(
    (item) => item.status !== 'completed',
  );
  const required = selected.reduce(
    (sum, item) => sum + item.requiredDocuments.length,
    0,
  );
  const approved = selected.reduce(
    (sum, item) => sum + item.approvedDocuments.length,
    0,
  );
  const subscriptions = selected.reduce(
    (sum, item) => sum + item.activeSubscriptions.length,
    0,
  );
  const settled = projects.filter((project) =>
    ['paid', 'closed'].includes(project.settlementStatus),
  ).length;
  return {
    projects: projects.length,
    projectCompletionRate: percent(
      projects.filter((project) => project.status === 'completed').length,
      projects.length,
    ),
    active: projects.filter((project) => project.status === 'active').length,
    completed: projects.filter((project) => project.status === 'completed')
      .length,
    onHold: projects.filter((project) => project.status === 'on_hold').length,
    general: projects.filter((project) => project.projectType === 'general')
      .length,
    research: projects.filter((project) => project.projectType === 'research')
      .length,
    farms: new Set(records.map((record) => record.farmId)).size,
    participations: records.length,
    tasks: tasks.length,
    rootTasks: hierarchy.rootCount,
    subtasks: hierarchy.subtaskCount,
    executableTasks: hierarchy.leafCount,
    completedTasks,
    taskCompletionRate: hierarchy.completionRate,
    incompleteTasks: incompleteTasks.length,
    waitingTasks: hierarchy.leaves.filter((item) => item.status === 'waiting')
      .length,
    overdueTasks: incompleteTasks.filter(
      (item) => item.dueDate && item.dueDate < today,
    ).length,
    blockers: selected.reduce(
      (sum, item) => sum + item.openProjectBlockers.length,
      0,
    ),
    installationRate: percent(
      records.filter((record) =>
        isFarmStageComplete(record, 'installationDate'),
      ).length,
      records.length,
    ),
    commissioningRate: percent(
      records.filter((record) =>
        isFarmStageComplete(record, 'commissioningDate'),
      ).length,
      records.length,
    ),
    educationRate: percent(
      records.filter((record) => isFarmStageComplete(record, 'educationDate'))
        .length,
      records.length,
    ),
    subscriptions,
    subscriptionRate: percent(subscriptions, records.length),
    required,
    approved,
    documentRate: percent(approved, required),
    documentRisks: selected.reduce(
      (sum, item) => sum + item.documentRisks.length,
      0,
    ),
    settled,
    settlementRate: percent(settled, projects.length),
  };
}

export type ProjectKpis = ReturnType<typeof summarizeProjectKpis>;

export interface PaymentEvidence {
  count: number;
  total: number;
  firstPaidAt: number;
  latestPaidAt: number;
  latestPaymentAmount: number;
  latestHistoryEntryId: string;
  latestWorkItemId: string;
}

export function paymentEvidenceByRecord(
  workItems: FarmWorkItem[],
  entries: FarmHistoryEntry[],
  asOf: number,
) {
  const workById = new Map(workItems.map((item) => [item.id, item]));
  const result = new Map<string, PaymentEvidence>();
  const seen = new Set<string>();
  for (const entry of entries) {
    const work = workById.get(entry.workItemId);
    if (
      seen.has(entry.id) ||
      !work ||
      work.workType !== 'payment' ||
      !Number.isFinite(entry.amount) ||
      entry.amount <= 0 ||
      !Number.isFinite(entry.occurredAt) ||
      entry.occurredAt <= 0 ||
      entry.occurredAt > asOf
    )
      continue;
    seen.add(entry.id);
    const current = result.get(work.farmRecordId);
    const isLatest =
      !current ||
      entry.occurredAt > current.latestPaidAt ||
      (entry.occurredAt === current.latestPaidAt &&
        entry.id.localeCompare(current.latestHistoryEntryId) > 0);
    result.set(work.farmRecordId, {
      count: (current?.count ?? 0) + 1,
      total: (current?.total ?? 0) + entry.amount,
      firstPaidAt: Math.min(
        current?.firstPaidAt ?? entry.occurredAt,
        entry.occurredAt,
      ),
      latestPaidAt: Math.max(current?.latestPaidAt ?? 0, entry.occurredAt),
      latestPaymentAmount: isLatest
        ? entry.amount
        : current.latestPaymentAmount,
      latestHistoryEntryId: isLatest ? entry.id : current.latestHistoryEntryId,
      latestWorkItemId: isLatest ? work.id : current.latestWorkItemId,
    });
  }
  return result;
}

export function subscriptionPaymentCount(
  record: FarmRecord,
  evidenceCount: number,
) {
  const saved = record.subscriptionPaymentCount;
  return Math.max(
    Number.isSafeInteger(saved) && saved! >= 0 ? saved! : 0,
    Number.isSafeInteger(evidenceCount) && evidenceCount >= 0
      ? evidenceCount
      : 0,
  );
}

export function subscriptionCycle(record: FarmRecord, evidenceCount: number) {
  const count = subscriptionPaymentCount(record, evidenceCount);
  if (count >= 3) return 'thirdPlus' as const;
  if (count === 2) return 'second' as const;
  if (count === 1) return 'first' as const;
  return 'noPayment' as const;
}

export function summarizeSubscriptionCycles(
  records: FarmRecord[],
  payments: ReadonlyMap<string, PaymentEvidence>,
) {
  const counts = {
    noPayment: 0,
    first: 0,
    second: 0,
    thirdPlus: 0,
    total: records.length,
  };
  for (const record of records)
    counts[subscriptionCycle(record, payments.get(record.id)?.count ?? 0)] += 1;
  return counts;
}

/** A due-today subscription remains valid until the end of its expiry day. */
export function unresolvedExpiryCohorts(
  records: FarmRecord[],
  events: FarmSubscriptionEvent[],
  year: number,
  endMonth: number,
  today: string,
) {
  const endKey = `${year}-${String(endMonth).padStart(2, '0')}`;
  const inPeriod = (date: string) =>
    Boolean(date) &&
    date.slice(0, 4) === String(year) &&
    date.slice(0, 7) <= endKey;
  const cohort = new Map<string, string>();
  const resolved = new Set<string>();
  for (const event of events) {
    if (event.eventType === 'rejoined' || !inPeriod(event.basisExpiryDate))
      continue;
    const key = `${event.farmRecordId}:${event.basisExpiryDate}`;
    cohort.set(key, event.basisExpiryDate);
    resolved.add(key);
  }
  for (const record of records) {
    if (inPeriod(record.currentSubscriptionExpiresAt)) {
      cohort.set(
        `${record.id}:${record.currentSubscriptionExpiresAt}`,
        record.currentSubscriptionExpiresAt,
      );
    }
  }
  const pendingDates = [...cohort]
    .filter(([key]) => !resolved.has(key))
    .map(([, date]) => date);
  return {
    target: cohort.size,
    pending: pendingDates.length,
    expiredPending: pendingDates.filter((date) => date < today).length,
    scheduledPending: pendingDates.filter((date) => date >= today).length,
    dueTodayPending: pendingDates.filter((date) => date === today).length,
  };
}

export function summarizeCurrentExpiry(
  records: FarmRecord[],
  events: FarmSubscriptionEvent[],
  today: string,
) {
  const resolved = new Set(
    events
      .filter(
        (event) => event.eventType !== 'rejoined' && event.processedAt <= today,
      )
      .map((event) => `${event.farmRecordId}:${event.basisExpiryDate}`),
  );
  const upcoming = records.filter(
    (record) =>
      record.subscriptionStatus === 'active' &&
      Boolean(record.currentSubscriptionExpiresAt) &&
      record.currentSubscriptionExpiresAt >= today,
  );
  return {
    expiredPending: records.filter(
      (record) =>
        record.currentSubscriptionExpiresAt &&
        record.currentSubscriptionExpiresAt < today &&
        !resolved.has(`${record.id}:${record.currentSubscriptionExpiresAt}`),
    ).length,
    upcoming: upcoming.length,
    dueToday: upcoming.filter(
      (record) => record.currentSubscriptionExpiresAt === today,
    ).length,
    missingExpiry: records.filter(
      (record) =>
        record.subscriptionStatus !== 'unregistered' &&
        !record.currentSubscriptionExpiresAt,
    ).length,
  };
}
