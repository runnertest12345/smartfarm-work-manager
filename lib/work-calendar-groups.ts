import type { FarmWorkItem } from './farm-types';
import type { WorkCalendarEntry } from './work-calendar';

export interface CalendarGroupRow {
  work: FarmWorkItem;
  depth: number;
  entries: WorkCalendarEntry[];
  /** Ancestor needed for orientation, not an extra match or counted task. */
  contextOnly: boolean;
}

export interface CalendarWorkGroup {
  id: string;
  date: string;
  root: FarmWorkItem;
  entries: WorkCalendarEntry[];
  workCount: number;
  waitingCount: number;
  status: FarmWorkItem['status'];
  rows: CalendarGroupRow[];
}

const statusRank: Record<FarmWorkItem['status'], number> = {
  waiting: 3,
  in_progress: 2,
  open: 1,
  completed: 0,
};

/** IDs are the boundary: matching names alone never prove a shared work scope. */
function sameWorkScope(
  work: FarmWorkItem,
  parent: FarmWorkItem,
  entryProjects: Map<string, Set<string>>,
) {
  const projectFor = (item: FarmWorkItem) => {
    const projects = entryProjects.get(item.id);
    return projects?.size === 1 ? [...projects][0] : item.projectId || '';
  };
  // Conflicting resolved project evidence is not safe to join to an ancestor.
  if ((entryProjects.get(work.id)?.size || 0) > 1 || (entryProjects.get(parent.id)?.size || 0) > 1)
    return false;
  const projectId = projectFor(work);
  const parentProjectId = projectFor(parent);
  if (projectId && parentProjectId && projectId !== parentProjectId) return false;
  if (work.scope === 'internal' || parent.scope === 'internal') {
    return work.scope === 'internal' && parent.scope === 'internal' &&
      !work.farmRecordId && !parent.farmRecordId &&
      !work.farmId && !parent.farmId &&
      projectId === parentProjectId &&
      (work.departmentId || '') === (parent.departmentId || '');
  }
  if (work.farmRecordId || parent.farmRecordId) {
    return Boolean(work.farmRecordId && work.farmRecordId === parent.farmRecordId) &&
      (!work.farmId || !parent.farmId || work.farmId === parent.farmId);
  }
  if (work.farmId || parent.farmId) {
    return Boolean(work.farmId && work.farmId === parent.farmId) &&
      Boolean(projectId && projectId === parentProjectId);
  }
  return Boolean(projectId && projectId === parentProjectId);
}

/**
 * Group already-filtered calendar entries without restoring filtered schedules.
 * Only ancestors from the complete authorized work collection may be attached.
 * Invalid cross-scope links stop the path; a path reaching a cycle stands alone.
 */
export function groupWorkCalendarEntries(
  entries: WorkCalendarEntry[],
  workItems: FarmWorkItem[],
): CalendarWorkGroup[] {
  const byId = new Map<string, FarmWorkItem>();
  const duplicateIds = new Set<string>();
  for (const work of workItems) {
    if (byId.has(work.id)) duplicateIds.add(work.id);
    else byId.set(work.id, work);
  }
  const entryProjects = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.projectId) continue;
    const projects = entryProjects.get(entry.work.id) || new Set<string>();
    projects.add(entry.projectId);
    entryProjects.set(entry.work.id, projects);
  }
  const parents = new Map<string, FarmWorkItem>();
  for (const work of workItems) {
    if (work.deletedAt || duplicateIds.has(work.id)) continue;
    const parent = byId.get(work.parentWorkItemId || '');
    if (!parent || parent.deletedAt || duplicateIds.has(parent.id) || !sameWorkScope(work, parent, entryProjects))
      continue;
    parents.set(work.id, parent);
  }
  const pathCache = new Map<string, FarmWorkItem[]>();
  const pathFor = (entry: WorkCalendarEntry) => {
    const work = byId.get(entry.work.id);
    // Preserve an already-authorized entry missing from the full snapshot, but
    // never use its asserted parent to fetch or expose absent ancestor content.
    if (!work || work.deletedAt || duplicateIds.has(work.id)) return [entry.work];
    const cached = pathCache.get(work.id);
    if (cached) return cached;
    const path = [work];
    const seen = new Set([work.id]);
    let parent = parents.get(work.id);
    while (parent) {
      if (seen.has(parent.id)) {
        const isolated = [work];
        pathCache.set(work.id, isolated);
        return isolated;
      }
      seen.add(parent.id);
      path.unshift(parent);
      parent = parents.get(parent.id);
    }
    pathCache.set(work.id, path);
    return path;
  };
  type Draft = {
    root: FarmWorkItem;
    date: string;
    entries: WorkCalendarEntry[];
    paths: Map<string, FarmWorkItem[]>;
    firstIndex: number;
  };
  const draftsByDate = new Map<string, Map<string, Draft>>();
  entries.forEach((entry, index) => {
    const path = pathFor(entry);
    const root = path[0];
    const byRoot = draftsByDate.get(entry.date) || new Map<string, Draft>();
    const draft: Draft = byRoot.get(root.id) || {
      root, date: entry.date, entries: [], paths: new Map(), firstIndex: index,
    };
    draft.entries.push(entry);
    draft.paths.set(entry.work.id, path);
    byRoot.set(root.id, draft);
    draftsByDate.set(entry.date, byRoot);
  });
  const drafts = [...draftsByDate.values()].flatMap((byRoot) => [...byRoot.values()])
    .sort((a, b) => a.date.localeCompare(b.date) || a.firstIndex - b.firstIndex);
  return drafts.map((draft): CalendarWorkGroup => {
    const rowWorks = new Map<string, FarmWorkItem>();
    const children = new Map<string, string[]>();
    const entryRows = new Map<string, WorkCalendarEntry[]>();
    const matchedWorks = new Map<string, FarmWorkItem>();
    for (const entry of draft.entries) {
      const workEntries = entryRows.get(entry.work.id) || [];
      workEntries.push(entry);
      entryRows.set(entry.work.id, workEntries);
      matchedWorks.set(entry.work.id, entry.work);
    }
    for (const path of draft.paths.values()) {
      path.forEach((work, index) => {
        rowWorks.set(work.id, work);
        if (!index) return;
        const siblings = children.get(path[index - 1].id) || [];
        if (!siblings.includes(work.id)) siblings.push(work.id);
        children.set(path[index - 1].id, siblings);
      });
    }
    const rows: CalendarGroupRow[] = [];
    const pending = [{ id: draft.root.id, depth: 0 }];
    const visited = new Set<string>();
    while (pending.length) {
      const { id, depth } = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const work = rowWorks.get(id);
      if (!work) continue;
      const rowEntries = entryRows.get(id) || [];
      rows.push({ work, depth, entries: rowEntries, contextOnly: rowEntries.length === 0 });
      const childIds = children.get(id) || [];
      for (let index = childIds.length - 1; index >= 0; index--)
        pending.push({ id: childIds[index], depth: depth + 1 });
    }
    const matched = [...matchedWorks.values()];
    const status = matched.reduce<FarmWorkItem['status']>((current, work) =>
      statusRank[work.status] > statusRank[current] ? work.status : current,
    'completed');
    return {
      id: `calendar-group:${draft.date}:${draft.root.id}`,
      date: draft.date,
      root: draft.root,
      entries: draft.entries,
      workCount: matched.length,
      waitingCount: matched.filter((work) => work.status === 'waiting').length,
      status,
      rows,
    };
  });
}
