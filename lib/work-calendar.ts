import type {
  Farm,
  FarmHistoryEntry,
  FarmProject,
  FarmRecord,
  FarmWorkItem,
  FarmWorkVisit,
} from './farm-types';
import { isOperationalWork, workProjectId } from './project-work';
import { buildWorkHierarchy } from './work-hierarchy';

export const WORK_CALENDAR_TIME_ZONE = 'Asia/Seoul';
export type WorkCalendarView = 'month' | 'week' | 'day';

export interface WorkCalendarInput {
  workItems: FarmWorkItem[];
  visits: FarmWorkVisit[];
  projects: FarmProject[];
  farmRecords: FarmRecord[];
  farms: Farm[];
  historyEntries?: FarmHistoryEntry[];
}

export interface WorkCalendarContext {
  work: FarmWorkItem;
  projectId: string;
  projectLabel: string;
  sourceLabel: string;
  parentPath: string;
}

export interface WorkCalendarEntry extends WorkCalendarContext {
  id: string;
  kind: 'deadline' | 'visit';
  date: string;
  time: string;
  scheduledAt: number;
  owner: string;
  completed: boolean;
  visit?: FarmWorkVisit;
}

export interface WorkCalendarFilter {
  projectId?: string;
  owner?: string;
  showCompleted?: boolean;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORK_CALENDAR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WORK_CALENDAR_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function calendarDateAt(timestamp: number): string {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime()))
    return '';
  // formatToParts avoids locale-dependent slash ordering in some browser builds.
  const parts = dayFormatter.formatToParts(timestamp);
  const value = (name: string) => parts.find((part) => part.type === name)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function calendarTimeAt(timestamp: number): string {
  return calendarDateAt(timestamp) ? timeFormatter.format(timestamp) : '';
}

export function shiftCalendarDate(date: string, offset: number): string {
  if (!isCalendarDate(date) || !Number.isSafeInteger(offset)) return '';
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  if (!Number.isFinite(shifted.getTime())) return '';
  const result = shifted.toISOString().slice(0, 10);
  return isCalendarDate(result) ? result : '';
}

/** Change the month, retaining the day when possible and clamping to its last day. */
export function shiftCalendarMonth(date: string, offset: number): string {
  if (!isCalendarDate(date) || !Number.isSafeInteger(offset)) return '';
  // Move from day one so January 31 never rolls through February into March.
  const shifted = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  shifted.setUTCMonth(shifted.getUTCMonth() + offset);
  if (!Number.isFinite(shifted.getTime()) || shifted.getUTCFullYear() < 0 || shifted.getUTCFullYear() > 9999)
    return '';
  const lastDay = new Date(shifted.getTime());
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  shifted.setUTCDate(Math.min(Number(date.slice(8, 10)), lastDay.getUTCDate()));
  const result = shifted.toISOString().slice(0, 10);
  return isCalendarDate(result) ? result : '';
}

/** Monday-first weeks; a month always uses six weeks, independent of timezone. */
export function calendarVisibleDates(date: string, view: WorkCalendarView) {
  if (!isCalendarDate(date)) return [];
  if (view === 'day') return [date];
  const anchor = view === 'month' ? `${date.slice(0, 7)}-01` : date;
  const weekday = new Date(`${anchor}T00:00:00Z`).getUTCDay();
  const monday = shiftCalendarDate(anchor, -((weekday + 6) % 7));
  const dates = Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => shiftCalendarDate(monday, index));
  // Out-of-range years cannot be represented by the four-digit calendar input.
  return dates.every(isCalendarDate) ? dates : [];
}

export function calendarDayLabel(date: string) {
  if (!isCalendarDate(date)) return '';
  // ICU builds differ on Korean numeric punctuation ("9. 23." vs "9월 23일").
  // This is a Korean calendar date, not an instant: format its parts explicitly.
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(`${date}T00:00:00Z`).getUTCDay()
  ];
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`;
}

function compareEntries(a: WorkCalendarEntry, b: WorkCalendarEntry) {
  return (
    a.date.localeCompare(b.date) ||
    Number(a.kind === 'visit') - Number(b.kind === 'visit') ||
    a.scheduledAt - b.scheduledAt ||
    Number(b.work.status === 'waiting') - Number(a.work.status === 'waiting') ||
    a.work.title.localeCompare(b.work.title, 'ko') ||
    a.id.localeCompare(b.id)
  );
}

/** A read-only projection. No inferred visit duration, end time, or date writes. */
export function buildWorkCalendar(input: WorkCalendarInput) {
  const { workItems, visits, projects, farmRecords, farms, historyEntries = [] } = input;
  const recordsById = new Map(farmRecords.map((record) => [record.id, record]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const farmsById = new Map(farms.map((farm) => [farm.id, farm]));
  const historyByWork = new Map<string, FarmHistoryEntry[]>();
  for (const entry of historyEntries) {
    const entries = historyByWork.get(entry.workItemId) || [];
    entries.push(entry);
    historyByWork.set(entry.workItemId, entries);
  }
  // Use the complete authorized collection before filtering to retain ancestors.
  const hierarchy = buildWorkHierarchy(workItems);
  const contexts = workItems
    .filter((work) => isOperationalWork(work, historyByWork.get(work.id) || []))
    .map((work): WorkCalendarContext => {
      const projectId = workProjectId(work, recordsById);
      const project = projectsById.get(projectId);
      const farmId = recordsById.get(work.farmRecordId)?.farmId || work.farmId;
      const farm = farmsById.get(farmId);
      const projectLabel = project
        ? `${project.name}${project.deletedAt ? ' (삭제된 프로젝트)' : ''}`
        : projectId ? '프로젝트 연결 확인 필요' : '프로젝트 미연결';
      const sourceLabel = [
        work.scope === 'internal' ? '내부 업무' : work.farmRecordId ? '농가 업무' : '프로젝트 업무',
        projectId ? projectLabel : '',
        farm?.name || (work.farmRecordId ? '농가 연결 확인 필요' : ''),
      ].filter(Boolean).join(' · ');
      const ancestors = hierarchy.ancestors(work.id);
      return {
        work,
        projectId,
        projectLabel,
        sourceLabel,
        parentPath: ancestors.length
          ? ancestors.map((parent) => parent.title).join(' › ')
          : work.parentWorkItemId ? '상위 업무 연결 확인 필요' : '',
      };
    });
  const byWorkId = new Map(contexts.map((context) => [context.work.id, context]));
  const entries: WorkCalendarEntry[] = [];
  const pendingVisitWorkIds = new Set<string>();
  for (const context of contexts) {
    if (!isCalendarDate(context.work.dueDate)) continue;
    entries.push({
      ...context,
      id: `deadline:${context.work.id}`,
      kind: 'deadline',
      date: context.work.dueDate,
      time: '',
      scheduledAt: 0,
      owner: context.work.owner.trim(),
      completed: context.work.status === 'completed',
    });
  }
  for (const visit of visits) {
    const context = byWorkId.get(visit.workItemId);
    if (!context || visit.status === 'canceled' || !Number.isFinite(visit.scheduledAt) || visit.scheduledAt <= 0)
      continue;
    const date = calendarDateAt(visit.scheduledAt);
    if (!isCalendarDate(date)) continue;
    if (visit.status === 'scheduled') pendingVisitWorkIds.add(visit.workItemId);
    entries.push({
      ...context,
      id: `visit:${visit.id}`,
      kind: 'visit',
      date,
      time: calendarTimeAt(visit.scheduledAt),
      scheduledAt: visit.scheduledAt,
      owner: visit.assignedTo.trim() || context.work.owner.trim(),
      completed: visit.status === 'completed' || context.work.status === 'completed',
      visit,
    });
  }
  entries.sort(compareEntries);
  const unscheduled = contexts.filter(({ work }) =>
    !isCalendarDate(work.dueDate) && !pendingVisitWorkIds.has(work.id),
  );
  const ownerOptions = [...new Set([
    ...contexts.map(({ work }) => work.owner.trim()),
    ...entries.map((entry) => entry.owner),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const projectOptions = [...new Map(contexts.filter((context) => context.projectId)
    .map((context) => [context.projectId, { id: context.projectId, name: context.projectLabel }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return { entries, unscheduled, ownerOptions, projectOptions };
}

export function filterWorkCalendar(
  calendar: ReturnType<typeof buildWorkCalendar>,
  filter: WorkCalendarFilter,
  today: string,
) {
  const matches = (context: WorkCalendarContext, owner: string, completed: boolean) =>
    (!filter.projectId || (filter.projectId === '__unlinked__' ? !context.projectId : context.projectId === filter.projectId)) &&
    (!filter.owner || (filter.owner === '__unassigned__' ? !owner : owner === filter.owner)) &&
    (filter.showCompleted || !completed);
  const entries = calendar.entries.filter((entry) => matches(entry, entry.owner, entry.completed));
  const unscheduled = calendar.unscheduled.filter((context) =>
    matches(context, context.work.owner.trim(), context.work.status === 'completed'),
  );
  const overdue = entries.filter((entry) =>
    entry.kind === 'deadline' && !entry.completed && isCalendarDate(today) && entry.date < today,
  );
  return { entries, unscheduled, overdue };
}

/** Count original work states once per ID after the caller's date/view filters. */
export function summarizeCalendarWorkStatuses(entries: WorkCalendarEntry[]) {
  const counts: Record<FarmWorkItem['status'], number> = {
    open: 0,
    in_progress: 0,
    waiting: 0,
    completed: 0,
  };
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.work.id)) continue;
    seen.add(entry.work.id);
    // A completed visit does not mark the underlying work as completed.
    counts[entry.work.status] += 1;
  }
  return counts;
}
