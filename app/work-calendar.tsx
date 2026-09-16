'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FARM_WORK_STATUS_LABELS, type FarmWorkItem } from '@/lib/farm-types';
import { groupWorkCalendarEntries, type CalendarWorkGroup } from '@/lib/work-calendar-groups';
import { WorkCalendarPreview } from './work-calendar-preview';
import {
  buildWorkCalendar,
  calendarDateAt,
  calendarDayLabel,
  calendarVisibleDates,
  filterWorkCalendar,
  isCalendarDate,
  shiftCalendarDate,
  shiftCalendarMonth,
  summarizeCalendarWorkStatuses,
  type WorkCalendarContext,
  type WorkCalendarEntry,
  type WorkCalendarInput,
  type WorkCalendarView,
} from '@/lib/work-calendar';

export interface WorkCalendarProps extends WorkCalendarInput {
  onOpenWork: (work: FarmWorkItem) => void;
}

const statusClasses = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-700',
  waiting: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-50 text-emerald-700',
};

const GROUP_PREVIEW_LIMIT = 3;
const WEEK_STATUS_SUMMARY = [
  { status: 'in_progress', label: '처리 중' },
  { status: 'completed', label: '완료' },
  { status: 'waiting', label: '막힘' },
] as const;

function CalendarGroupSummary({ group, onSelect }: { group: CalendarWorkGroup; onSelect: (group: CalendarWorkGroup, trigger: HTMLButtonElement) => void }) {
  const description = [
    group.root.title,
    `업무 ${group.workCount}건`,
    group.waitingCount ? `대기·막힘 ${group.waitingCount}건` : FARM_WORK_STATUS_LABELS[group.status],
  ].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      data-calendar-group={group.id}
      onClick={(event) => onSelect(group, event.currentTarget)}
      aria-label={`${description} 묶음 보기`}
      title={description}
      className={`flex min-h-8 w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs transition hover:ring-1 hover:ring-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-600 ${statusClasses[group.status]}`}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{group.root.title}</span>
      <span className="shrink-0 text-[10px]">{group.workCount}건</span>
      {group.waitingCount > 0 && <span className="shrink-0 text-[10px] font-semibold">막힘 {group.waitingCount}</span>}
    </button>
  );
}

function CalendarWorkCard({
  context,
  entry,
  today,
  showDate = false,
  onOpenWork,
}: {
  context: WorkCalendarContext;
  entry?: WorkCalendarEntry;
  today: string;
  showDate?: boolean;
  onOpenWork: WorkCalendarProps['onOpenWork'];
}) {
  const work = context.work;
  const overdue = entry?.kind === 'deadline' && !entry.completed && entry.date < today;
  return (
    <button
      type="button"
      data-calendar-entry={entry?.id || `unscheduled:${work.id}`}
      onClick={() => onOpenWork(work)}
      aria-label={`${entry?.kind === 'visit' ? `${entry.time} 방문` : entry ? '마감' : '일정 미지정'} · ${work.title} 업무 상세 열기`}
      className={`w-full min-w-0 rounded-xl border bg-white p-3 text-left text-xs transition hover:border-emerald-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${work.status === 'waiting' ? 'border-amber-300' : overdue ? 'border-rose-200' : 'border-slate-200'}`}
    >
      <span className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <span className={`font-semibold ${entry?.kind === 'visit' ? 'text-blue-700' : overdue ? 'text-rose-700' : 'text-slate-600'}`}>
          {showDate && entry ? `${calendarDayLabel(entry.date)} · ` : ''}
          {entry?.kind === 'visit'
            ? `${entry.time} · ${entry.visit?.status === 'completed' ? '방문 완료' : '방문 예정'}`
            : entry ? `마감${overdue ? ' 지연' : ''}` : '일정 미지정'}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${statusClasses[work.status]}`}>
          {FARM_WORK_STATUS_LABELS[work.status]}
        </span>
      </span>
      <span className="line-clamp-2 break-words text-sm font-semibold text-slate-900" title={work.title}>{work.title}</span>
      {context.parentPath && (
        <span className="mt-1 line-clamp-2 break-words border-l-2 border-slate-200 pl-2 text-slate-600" title={`상위: ${context.parentPath}`}>
          하위 업무 · 상위: {context.parentPath}
        </span>
      )}
      <span className="mt-2 block truncate text-slate-500" title={context.sourceLabel}>{context.sourceLabel}</span>
      <span className="mt-1 block text-slate-600">
        {entry?.kind === 'visit' ? '방문 담당' : '담당'} {entry ? entry.owner || '미지정' : work.owner.trim() || '미지정'}
      </span>
      {work.status === 'waiting' && (
        <span className="mt-2 line-clamp-2 break-words rounded-md bg-amber-50 px-2 py-1 text-amber-900" title={work.blockedReason || undefined}>
          {work.blockedReason || '대기·막힘 사유를 상세에서 확인하세요.'}
        </span>
      )}
    </button>
  );
}

export function WorkCalendar(props: WorkCalendarProps) {
  const { workItems, visits, projects, farmRecords, farms, historyEntries } = props;
  const calendarId = useId();
  const [today, setToday] = useState(() => calendarDateAt(Date.now()));
  const [selectedDate, setSelectedDate] = useState(() => calendarDateAt(Date.now()));
  const [view, setView] = useState<WorkCalendarView>('week');
  const [projectId, setProjectId] = useState('');
  const [owner, setOwner] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [preview, setPreview] = useState<{ date: string; groupId?: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const pendingWorkId = useRef<string | null>(null);
  useEffect(() => {
    // Keep the Korean "today" marker correct in long-running desktop sessions.
    const timer = window.setInterval(() => setToday(calendarDateAt(Date.now())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const calendar = useMemo(() => buildWorkCalendar({ workItems, visits, projects, farmRecords, farms, historyEntries }), [
    workItems, visits, projects, farmRecords, farms, historyEntries,
  ]);
  const filtered = useMemo(() => filterWorkCalendar(calendar, {
    projectId, owner, showCompleted,
  }, today), [calendar, projectId, owner, showCompleted, today]);
  const groups = useMemo(() => groupWorkCalendarEntries(filtered.entries, workItems), [filtered.entries, workItems]);
  const previewGroups = preview ? groups.filter((group) => group.date === preview.date && (!preview.groupId || group.id === preview.groupId)) : [];
  useEffect(() => {
    if (!previewOpen) return;
    // Read-only lookup is transient: don't add another navigation controller or
    // leave it over a page restored by the app's existing Back/Forward handler.
    const dismissForNavigation = () => { pendingWorkId.current = null; setPreviewOpen(false); setPreview(null); };
    window.addEventListener('popstate', dismissForNavigation);
    return () => window.removeEventListener('popstate', dismissForNavigation);
  }, [previewOpen]);
  const openPreview = (date: string, trigger: HTMLButtonElement, groupId?: string) => {
    previewTrigger.current = trigger;
    pendingWorkId.current = null;
    setPreview({ date, groupId });
    setPreviewOpen(true);
  };
  const onGroupSelect = (group: CalendarWorkGroup, trigger: HTMLButtonElement) => openPreview(group.date, trigger, group.id);
  const finishPreviewClose = () => {
    const nextId = pendingWorkId.current;
    pendingWorkId.current = null;
    if (!nextId) return;
    const work = workItems.find((item) => item.id === nextId && !item.deletedAt);
    // Restore the calendar button before the existing detail controller captures
    // its return-focus target. Never open two modal focus traps concurrently.
    if (previewTrigger.current?.isConnected) previewTrigger.current.focus({ preventScroll: true });
    if (work) props.onOpenWork(work);
  };
  const dates = calendarVisibleDates(selectedDate, view);
  const dateSet = new Set(dates);
  const visibleEntries = filtered.entries.filter((entry) => dateSet.has(entry.date));
  const selectedMonth = selectedDate.slice(0, 7);
  const periodEntries = view === 'month'
    ? visibleEntries.filter((entry) => entry.date.startsWith(`${selectedMonth}-`))
    : visibleEntries;
  const deadlineCount = periodEntries.filter((entry) => entry.kind === 'deadline').length;
  const visitCount = periodEntries.length - deadlineCount;
  const periodLabel = view === 'month'
    ? `${selectedDate.slice(0, 4)}년 ${Number(selectedDate.slice(5, 7))}월`
    : view === 'week'
    ? `${dates[0]} ~ ${dates[6]}`
    : `${selectedDate} ${calendarDayLabel(selectedDate).split(' ').at(-1) || ''}`;
  const movePeriod = (direction: number) => {
    const nextDate = view === 'month'
      ? shiftCalendarMonth(selectedDate, direction)
      : shiftCalendarDate(selectedDate, direction * (view === 'week' ? 7 : 1));
    if (isCalendarDate(nextDate)) setSelectedDate(nextDate);
  };
  const openDay = (date: string) => { setSelectedDate(date); setView('day'); };
  const inputClass = 'h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-600';
  const renderEntry = (entry: WorkCalendarEntry, showDate = false) => (
    <CalendarWorkCard key={entry.id} context={entry} entry={entry} today={today} showDate={showDate} onOpenWork={props.onOpenWork} />
  );

  return (
    <section aria-label="업무 달력" className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold">업무 달력</h2>
            <span className="text-xs text-slate-500">한국 시간</span>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="달력 보기 전환">
            <Button type="button" variant={view === 'month' ? 'default' : 'ghost'} aria-pressed={view === 'month'} onClick={() => setView('month')}>월간</Button>
            <Button type="button" variant={view === 'week' ? 'default' : 'ghost'} aria-pressed={view === 'week'} onClick={() => setView('week')}>주간</Button>
            <Button type="button" variant={view === 'day' ? 'default' : 'ghost'} aria-pressed={view === 'day'} onClick={() => setView('day')}>일간</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label={view === 'month' ? '이전 달' : view === 'week' ? '이전 주' : '이전 날'} onClick={() => movePeriod(-1)}><ChevronLeft aria-hidden="true" /></Button>
            <Button type="button" variant="outline" onClick={() => { const current = calendarDateAt(Date.now()); setToday(current); setSelectedDate(current); }}>오늘</Button>
            <Button type="button" variant="outline" size="icon" aria-label={view === 'month' ? '다음 달' : view === 'week' ? '다음 주' : '다음 날'} onClick={() => movePeriod(1)}><ChevronRight aria-hidden="true" /></Button>
            <label htmlFor={`${calendarId}-date`} className="sr-only">달력 기준 날짜</label>
            <input id={`${calendarId}-date`} type="date" className={inputClass} value={selectedDate} onChange={(event) => { if (isCalendarDate(event.target.value)) setSelectedDate(event.target.value); }} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid max-w-full gap-1 text-xs text-slate-600" htmlFor={`${calendarId}-project`}>
              프로젝트
              <select id={`${calendarId}-project`} className={`${inputClass} w-52 max-w-full`} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">전체 프로젝트</option>
                <option value="__unlinked__">프로젝트 미연결</option>
                {calendar.projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-slate-600" htmlFor={`${calendarId}-owner`}>
              담당자
              <select id={`${calendarId}-owner`} className={`${inputClass} w-36`} value={owner} onChange={(event) => setOwner(event.target.value)}>
                <option value="">전체 담당자</option>
                <option value="__unassigned__">담당 미지정</option>
                {calendar.ownerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-600" htmlFor={`${calendarId}-completed`}>
              <input id={`${calendarId}-completed`} type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} className="size-4 accent-emerald-700" />
              완료 포함
            </label>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          월간·주간은 같은 날짜의 관련 업무를 묶습니다. 묶음을 누르면 팝업에서 하위·세부 업무와 마감·방문 시각을 확인합니다.
        </p>
        <span className="sr-only">방문 종료 예정 시각은 등록된 정보가 없어 표시하지 않습니다.</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="font-semibold text-slate-800" aria-live="polite">{periodLabel}</h3>
        <p className="text-xs text-slate-600">{view === 'month' ? '선택한 달 · ' : ''}마감 {deadlineCount}건 · 방문 {visitCount}건 <span className="text-slate-400">(같은 업무도 각각 표시)</span></p>
      </div>

      {view === 'month' ? (
        <section aria-label="월간 업무 일정" className="space-y-2">
          <p className="px-1 text-xs text-slate-500">날짜당 최대 3묶음만 표시합니다. 더보기는 해당 날짜의 전체 업무 목록을 엽니다.</p>
          <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="min-w-[840px]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => (
                  <div key={day} className={`py-2 text-center text-xs font-semibold ${index === 5 ? 'text-blue-600' : index === 6 ? 'text-rose-600' : 'text-slate-600'}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dates.map((date, index) => {
                  const entries = visibleEntries.filter((entry) => entry.date === date);
                  const dayGroups = groups.filter((group) => group.date === date);
                  const inMonth = date.startsWith(`${selectedMonth}-`);
                  const waitingCount = new Set(entries.filter((entry) => entry.work.status === 'waiting').map((entry) => entry.work.id)).size;
                  const remaining = Math.max(0, dayGroups.length - GROUP_PREVIEW_LIMIT);
                  return (
                    <section key={date} data-calendar-date={date} aria-label={calendarDayLabel(date)} className={`min-h-[152px] min-w-0 border-b border-r border-slate-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-slate-50'} ${date === today ? 'ring-2 ring-inset ring-emerald-500' : ''}`}>
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <button type="button" aria-label={`${calendarDayLabel(date)} 일간 보기`} onClick={() => openDay(date)} className={`grid min-h-7 min-w-7 place-items-center rounded-full px-1 text-xs font-semibold hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 ${date === today ? 'bg-emerald-700 text-white hover:bg-emerald-800' : !inMonth ? 'text-slate-400' : index % 7 === 6 ? 'text-rose-600' : index % 7 === 5 ? 'text-blue-600' : 'text-slate-800'}`}>
                          {!inMonth && date.endsWith('-01') ? `${Number(date.slice(5, 7))}/1` : Number(date.slice(8, 10))}
                        </button>
                        {waitingCount > 0 && <span className="truncate rounded bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-800" title={`대기·막힘 업무 ${waitingCount}건`}>막힘 {waitingCount}</span>}
                      </div>
                      <div className="space-y-1">
                        {dayGroups.slice(0, GROUP_PREVIEW_LIMIT).map((group) => <CalendarGroupSummary key={group.id} group={group} onSelect={onGroupSelect} />)}
                        {remaining > 0 && <button type="button" aria-label={`${calendarDayLabel(date)} 업무 ${dayGroups.reduce((sum, group) => sum + group.workCount, 0)}건 모두 보기`} onClick={(event) => openPreview(date, event.currentTarget)} className="min-h-7 w-full rounded-md px-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">+{remaining}묶음 더보기</button>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : view === 'week' ? (
        <section className="max-w-full overflow-x-auto rounded-xl pb-2" aria-label="주간 업무 일정 · 화면이 좁으면 좌우로 이동">
        <div className="grid grid-cols-1 gap-3 md:min-w-[1120px] md:grid-cols-7">
          {dates.map((date) => {
            const entries = visibleEntries.filter((entry) => entry.date === date);
            const dayGroups = groups.filter((group) => group.date === date);
            const statuses = summarizeCalendarWorkStatuses(entries);
            return (
              <section key={date} aria-label={calendarDayLabel(date)} className={`min-w-0 rounded-xl border ${date === today ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/70'}`}>
                <button type="button" onClick={() => { setSelectedDate(date); setView('day'); }} aria-label={`${calendarDayLabel(date)} 일간 보기`} className="flex min-h-12 w-full items-center justify-between gap-1 border-b border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  <span>{calendarDayLabel(date)}</span>
                  {date === today && <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 text-[11px] text-white">오늘</span>}
                </button>
                <div className="space-y-2 p-2">
                  <dl aria-label={`${calendarDayLabel(date)} 업무 상태`} title="현재 조회 조건에 맞는 업무 상태입니다. 같은 업무의 마감·방문은 한 건으로 셉니다. 완료 업무는 ‘완료 포함’을 켜면 집계됩니다." className="grid grid-cols-3 gap-1 text-center">
                    {WEEK_STATUS_SUMMARY.map(({ status, label }) => (
                      <div key={status} data-calendar-status={status} className={`min-w-0 rounded-md px-0.5 py-1 ${statuses[status] > 0 ? statusClasses[status] : 'bg-slate-100/70 text-slate-400'}`}>
                        <dt className="text-[10px]">{label}</dt>
                        <dd className="m-0 text-xs font-semibold tabular-nums">{statuses[status]}건</dd>
                      </div>
                    ))}
                  </dl>
                  {dayGroups.slice(0, GROUP_PREVIEW_LIMIT).map((group) => <CalendarGroupSummary key={group.id} group={group} onSelect={onGroupSelect} />)}
                  {!dayGroups.length && <p className="px-1 py-3 text-xs text-slate-400">일정 없음</p>}
                  {dayGroups.length > GROUP_PREVIEW_LIMIT && <button type="button" aria-label={`${calendarDayLabel(date)} 업무 ${dayGroups.reduce((sum, group) => sum + group.workCount, 0)}건 모두 보기`} onClick={(event) => openPreview(date, event.currentTarget)} className="min-h-8 w-full rounded px-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50">+{dayGroups.length - GROUP_PREVIEW_LIMIT}묶음 더보기</button>}
                </div>
              </section>
            );
          })}
        </div>
        </section>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <section aria-label="종일 마감 업무" className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">마감 · 종일</h4>
            {deadlineCount ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleEntries.filter((entry) => entry.kind === 'deadline').map((entry) => renderEntry(entry))}</div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">이 날짜에 마감되는 업무가 없습니다.</p>}
          </section>
          <section aria-label="시간순 방문 일정" className="space-y-3 border-t border-slate-200 pt-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock3 className="size-4" aria-hidden="true" />방문 일정 · 시간순</h4>
            {visitCount ? (
              <ol className="space-y-3">
                {visibleEntries.filter((entry) => entry.kind === 'visit').map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
                    <time dateTime={new Date(entry.scheduledAt).toISOString()} className="pt-3 text-sm font-semibold tabular-nums text-blue-700">{entry.time}</time>
                    <div className="border-l-2 border-blue-100 pl-3">{renderEntry(entry)}</div>
                  </li>
                ))}
              </ol>
            ) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">이 날짜에 예정된 방문이 없습니다.</p>}
          </section>
        </div>
      )}

      {preview && <WorkCalendarPreview
        open={previewOpen}
        date={preview.date}
        groups={previewGroups}
        onOpenChange={(open) => { if (!open) pendingWorkId.current = null; setPreviewOpen(open); }}
        onClosed={finishPreviewClose}
        onOpenWork={(work) => { pendingWorkId.current = work.id; setPreviewOpen(false); }}
        returnFocus={() => previewTrigger.current?.isConnected ? previewTrigger.current : false}
      />}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-rose-100 bg-white">
          <button type="button" aria-expanded={showOverdue} aria-controls={`${calendarId}-overdue`} onClick={() => setShowOverdue(!showOverdue)} className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-500">
            <span className="font-medium text-rose-800">기한 지연 {filtered.overdue.length}건</span><span className="text-xs text-slate-500">전체 기간 · {showOverdue ? '접기' : '펼치기'}</span>
          </button>
          <div id={`${calendarId}-overdue`} hidden={!showOverdue} className="space-y-3 border-t border-rose-100 p-3">
            <p className="text-xs text-slate-500">오늘(한국 시간) 이전에 마감됐지만 아직 완료하지 않은 업무입니다. 위 담당자·프로젝트 조건이 적용됩니다.</p>
            {filtered.overdue.length ? filtered.overdue.map((entry) => renderEntry(entry, true)) : <p className="py-2 text-sm text-slate-500">기한이 지난 미완료 업무가 없습니다.</p>}
          </div>
        </section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button type="button" aria-expanded={showUnscheduled} aria-controls={`${calendarId}-unscheduled`} onClick={() => setShowUnscheduled(!showUnscheduled)} className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
            <span className="font-medium text-slate-700">일정 미지정 {filtered.unscheduled.length}건</span><span className="text-xs text-slate-500">전체 기간 · {showUnscheduled ? '접기' : '펼치기'}</span>
          </button>
          <div id={`${calendarId}-unscheduled`} hidden={!showUnscheduled} className="space-y-3 border-t border-slate-200 p-3">
            <p className="text-xs text-slate-500">유효한 마감일과 예약된 방문이 없는 업무입니다. 업무를 열어 마감일을 지정하세요.</p>
            {filtered.unscheduled.length ? filtered.unscheduled.map((context) => <CalendarWorkCard key={context.work.id} context={context} today={today} onOpenWork={props.onOpenWork} />) : <p className="py-2 text-sm text-slate-500">일정 미지정 업무가 없습니다.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
