'use client';

import { useId, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnnualOverviewMetric } from '@/lib/annual-overview';
import type { Farm, FarmProject, FarmRecord } from '@/lib/farm-types';
import { isFarmStageComplete } from '@/lib/project-farm-progress';

export interface AnnualMetricListProps {
  metric: AnnualOverviewMetric;
  records: FarmRecord[];
  farmById: ReadonlyMap<string, Farm>;
  projectById: ReadonlyMap<string, FarmProject>;
  onOpen: (record: FarmRecord) => void;
  onClose: () => void;
}

const metricLabels = {
  farms: '농가 목록',
  subscriptions: '구독 농가 목록',
  installation: '설치 현황',
  commissioning: '시운전 현황',
  education: '교육 현황',
} as const;

const stageFields = {
  installation: 'installationDate',
  commissioning: 'commissioningDate',
  education: 'educationDate',
} as const;

const PAGE_SIZE = 20;
type CompletionFilter = 'all' | 'pending' | 'completed';

export function AnnualMetricList(props: AnnualMetricListProps) {
  // A different metric starts at its complete first page, not a stale filter.
  return <AnnualMetricListContent key={props.metric} {...props} />;
}

function AnnualMetricListContent({ metric, records, farmById, projectById, onOpen, onClose }: AnnualMetricListProps) {
  const [page, setPage] = useState(1);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const filterId = useId();
  const stageField = metric === 'farms' || metric === 'subscriptions' ? null : stageFields[metric];
  const uniqueFarmList = stageField === null;
  const groups = new Map<string, FarmRecord[]>();
  for (const record of records) {
    const key = uniqueFarmList ? record.farmId : record.id;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const allRows = [...groups.values()].map((group) => {
    const record = group[0];
    const farm = farmById.get(record.farmId);
    return {
      record,
      name: farm?.name || '농가명 미등록',
      code: farm?.farmCode || '',
      projectNames: [...new Set(group.map((item) => projectById.get(item.projectId)?.name || '프로젝트 미등록'))].join(' · '),
      complete: stageField ? isFarmStageComplete(record, stageField) : false,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR') || a.record.id.localeCompare(b.record.id));
  const rows = allRows.filter((row) => uniqueFarmList || completionFilter === 'all' || row.complete === (completionFilter === 'completed'));
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(offset, offset + PAGE_SIZE);
  const unit = uniqueFarmList ? '곳' : '건';
  const buttonClass = 'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <section aria-label={metricLabels[metric]} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-bold">{metricLabels[metric]} <span className="ml-1 text-sm font-medium text-slate-500">{allRows.length}{unit}</span></h2>
          <p className="mt-1 text-xs text-slate-500">{uniqueFarmList ? '중복 농가 제외 · 농가명을 누르면 상세 내용을 확인합니다.' : '농가 참여 기록 기준 · 농가명을 누르면 해당 프로젝트의 기록을 확인합니다.'}</p>
        </div>
        <button type="button" className={buttonClass} onClick={onClose}><ArrowLeft aria-hidden="true" className="size-4" />프로젝트 목록</button>
      </div>
      {!uniqueFarmList && (
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
          <label htmlFor={filterId} className="text-sm font-medium text-slate-600">완료 상태</label>
          <select id={filterId} value={completionFilter} onChange={(event) => { setCompletionFilter(event.target.value as CompletionFilter); setPage(1); }} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
            <option value="all">전체</option>
            <option value="pending">미완료</option>
            <option value="completed">완료</option>
          </select>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{metricLabels[metric]} 조회 결과</caption>
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-600">
            <tr><th scope="col" className="min-w-40 px-4 py-3 font-medium">농가</th><th scope="col" className="min-w-48 px-4 py-3 font-medium">{uniqueFarmList ? '참여 프로젝트' : '프로젝트 · 장비'}</th>{stageField && <th scope="col" className="min-w-32 px-4 py-3 font-medium">완료 상태</th>}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <tr key={uniqueFarmList ? row.record.farmId : row.record.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2.5 align-top">
                  <button type="button" onClick={() => onOpen(row.record)} className="min-h-9 text-left font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" aria-label={`${row.name} 농가 상세 보기`}>{row.name}</button>
                  {row.code && <p className="text-xs text-slate-500">{row.code}</p>}
                </td>
                <td className="px-4 py-3.5 align-top leading-relaxed text-slate-600">{row.projectNames}{!uniqueFarmList && row.record.deviceType && <p className="mt-1 text-xs text-slate-500">{row.record.deviceType}</p>}</td>
                {stageField && <td className="px-4 py-3.5 align-top"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${row.complete ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{row.complete ? '완료' : '미완료'}</span>{row.complete && <p className="mt-1 text-xs text-slate-500">{row.record[stageField] || '완료 확인 · 일자 미기록'}</p>}</td>}
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td colSpan={stageField ? 3 : 2} className="px-4 py-10 text-center text-sm text-slate-500">조건에 맞는 {uniqueFarmList ? '농가가' : '참여 기록이'} 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5">
        <output className="text-xs text-slate-500">{rows.length}{unit} 중 {rows.length ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, rows.length)} 표시 · 한 페이지 {PAGE_SIZE}{unit}</output>
        <nav aria-label={`${metricLabels[metric]} 페이지`} className="flex items-center gap-1">
          <button type="button" aria-label="이전 페이지" className={buttonClass} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" className="size-4" />이전</button>
          <span className="px-2 text-xs tabular-nums text-slate-600">{currentPage} / {pageCount}</span>
          <button type="button" aria-label="다음 페이지" className={buttonClass} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>다음<ChevronRight aria-hidden="true" className="size-4" /></button>
        </nav>
      </div>
    </section>
  );
}
