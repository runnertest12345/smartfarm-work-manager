'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FARM_WORK_STATUS_LABELS, type FarmWorkItem } from '@/lib/farm-types';
import { calendarDayLabel } from '@/lib/work-calendar';
import type { CalendarWorkGroup } from '@/lib/work-calendar-groups';

export interface CalendarPreviewProps {
  open: boolean;
  date: string;
  groups: CalendarWorkGroup[];
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
  onOpenWork: (work: FarmWorkItem) => void;
  returnFocus: () => HTMLElement | false;
}

export function WorkCalendarPreview({ open, date, groups, onOpenChange, onClosed, onOpenWork, returnFocus }: CalendarPreviewProps) {
  const entries = groups.flatMap((group) => group.entries);
  const count = new Set(entries.map((entry) => entry.work.id)).size;
  const waiting = new Set(entries.filter((entry) => entry.work.status === 'waiting').map((entry) => entry.work.id)).size;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={(isOpen) => { if (!isOpen) onClosed(); }}>
      <DialogContent showCloseButton={false} finalFocus={returnFocus} className="farm-app flex max-h-[92dvh] w-[96vw] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div className="min-w-0 space-y-2">
            <DialogTitle className="text-lg font-bold">{calendarDayLabel(date)} 업무 목록</DialogTitle>
            <DialogDescription>업무 {count}건 · 마감 {entries.filter((entry) => entry.kind === 'deadline').length}건 · 방문 {entries.filter((entry) => entry.kind === 'visit').length}건{waiting > 0 ? ` · 대기·막힘 ${waiting}건` : ''}</DialogDescription>
            <p className="text-xs text-slate-500">이 날짜와 조회 조건에 맞는 업무만 표시합니다. ‘상위 참고’는 구조 안내이며 일정 건수에는 포함하지 않습니다. 업무명을 누르면 조회·수정 화면으로 이동합니다.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} aria-label="업무 목록 닫기" className="shrink-0"><X aria-hidden="true" />닫기</Button>
        </header>
        <div className="min-h-0 overflow-y-auto bg-slate-50 p-3 sm:p-5">
          {groups.length ? <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.id} aria-label={`${group.root.title} 업무 계층`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden grid-cols-[minmax(0,1fr)_100px_minmax(180px,0.7fr)] gap-3 border-b bg-slate-50 px-4 py-2 text-xs text-slate-500 md:grid"><span>업무 · 하위 · 세부</span><span>상태</span><span>이 날짜의 일정 · 담당자</span></div>
                {group.rows.map((row) => (
                  <div key={row.work.id} data-calendar-row={row.work.id} data-context-only={row.contextOnly} className={`grid gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_100px_minmax(180px,0.7fr)] md:items-center md:gap-3 md:px-4 ${row.contextOnly ? 'bg-slate-50/70' : row.work.status === 'waiting' ? 'bg-amber-50/60' : ''}`}>
                    <div className={`min-w-0 ${row.depth ? 'border-l-2 border-slate-200 pl-3' : ''}`} style={{ marginLeft: `${Math.min(row.depth, 4) * 16}px` }}>
                      <p className="mb-1 text-[11px] text-slate-500">{row.contextOnly ? '상위 참고' : row.depth === 0 ? '상위 업무' : row.depth === 1 ? '하위 업무' : `세부 업무 · ${row.depth}단계`}</p>
                      <button type="button" onClick={() => onOpenWork(row.work)} aria-label={`${row.work.title} 업무 조회·수정`} className="min-h-8 max-w-full rounded text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">{row.work.title}</button>
                      {!row.contextOnly && row.work.status === 'waiting' && <p className="mt-1 break-words text-xs text-amber-800">막힘: {row.work.blockedReason || '사유 미입력'}</p>}
                    </div>
                    <span className={`w-fit rounded-md px-2 py-1 text-xs ${row.contextOnly ? 'text-slate-400' : row.work.status === 'waiting' ? 'bg-amber-100 text-amber-900' : row.work.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : row.work.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{row.contextOnly ? '구조 안내' : FARM_WORK_STATUS_LABELS[row.work.status]}</span>
                    <div className="space-y-1 text-xs text-slate-600">
                      {row.contextOnly ? <p className="text-slate-400">이 날짜의 표시 대상 아님</p> : row.entries.map((entry) => <p key={entry.id} data-calendar-entry={entry.id}><span className="font-medium">{entry.kind === 'visit' ? `${entry.time} 방문${entry.visit?.status === 'completed' ? ' 완료' : ''}` : '마감 · 종일'}</span> · {entry.owner || '담당 미지정'}</p>)}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div> : <output className="block rounded-xl border bg-white p-6 text-center text-sm text-slate-500">업무가 변경되어 표시할 일정이 없습니다. 달력에서 다시 확인해 주세요.</output>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
