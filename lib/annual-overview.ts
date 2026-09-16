import type { ProjectKpiSnapshot } from './dashboard-kpis';
import type { FarmProject, FarmRecord } from './farm-types';
import { isFarmStageComplete } from './project-farm-progress';

export type AnnualProjectStatus = 'all' | 'active' | 'on_hold' | 'completed';
export type AnnualOverviewMetric =
  | 'farms'
  | 'subscriptions'
  | 'installation'
  | 'commissioning'
  | 'education';

const stages = [
  { key: 'installation', field: 'installationDate', label: '설치' },
  { key: 'commissioning', field: 'commissioningDate', label: '시운전' },
  { key: 'education', field: 'educationDate', label: '교육' },
] as const;

function projectsInYear(projects: readonly FarmProject[], year: string) {
  return [
    ...new Map(
      projects
        .filter((project) => !project.deletedAt && (year === 'all' || project.year === Number(year)))
        .map((project) => [project.id, project] as const),
    ).values(),
  ];
}

/** Same scoped participation records used by both headline counts and drilldown. */
export function annualOverviewRecords(
  projects: readonly FarmProject[],
  snapshots: ReadonlyMap<string, ProjectKpiSnapshot>,
  year: string,
): FarmRecord[] {
  const records = new Map<string, FarmRecord>();
  for (const project of projectsInYear(projects, year)) {
    // Internal projects contribute to project status, never farm/business KPIs.
    if (project.projectType === 'internal') continue;
    const snapshot = snapshots.get(project.id);
    if (!snapshot) continue;
    for (const record of snapshot.records) {
      if (record.projectId !== project.id || !record.farmId) continue;
      // Preserve distinct contracts/participations even for the same farm.
      if (!records.has(record.id)) records.set(record.id, record);
    }
  }
  return [...records.values()];
}

/**
 * Current saved state of projects in the selected business year, not a historic
 * year-end snapshot. Callers may supply an already type-scoped project list.
 * Subscription validity is supplied by the existing snapshot calculation.
 */
export function summarizeAnnualOverview(
  projects: readonly FarmProject[],
  snapshots: ReadonlyMap<string, ProjectKpiSnapshot>,
  year: string,
) {
  const selectedProjects = projectsInYear(projects, year);
  const records = annualOverviewRecords(selectedProjects, snapshots, year);
  const recordById = new Map(records.map((record) => [record.id, record]));
  const subscribedFarmIds = new Set<string>();
  for (const project of selectedProjects) {
    if (project.projectType === 'internal') continue;
    for (const activeRecord of snapshots.get(project.id)?.activeSubscriptions ?? []) {
      const includedRecord = recordById.get(activeRecord.id);
      if (activeRecord.projectId === project.id && includedRecord?.projectId === project.id)
        subscribedFarmIds.add(includedRecord.farmId);
    }
  }
  return {
    projects: selectedProjects.length,
    active: selectedProjects.filter((project) => project.status === 'active').length,
    onHold: selectedProjects.filter((project) => project.status === 'on_hold').length,
    completed: selectedProjects.filter((project) => project.status === 'completed').length,
    general: selectedProjects.filter((project) => project.projectType === 'general').length,
    research: selectedProjects.filter((project) => project.projectType === 'research').length,
    internal: selectedProjects.filter((project) => project.projectType === 'internal').length,
    farms: new Set(records.map((record) => record.farmId)).size,
    subscribedFarms: subscribedFarmIds.size,
    participations: records.length,
    stages: stages.map(({ key, field, label }) => {
      const completed = records.filter((record) => isFarmStageComplete(record, field)).length;
      const total = records.length;
      return { key, label, completed, total, remaining: total - completed, rate: total ? Math.round((completed / total) * 100) : null };
    }),
  };
}

export type AnnualOverview = ReturnType<typeof summarizeAnnualOverview>;
