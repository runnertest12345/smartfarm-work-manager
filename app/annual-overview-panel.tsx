'use client';

import { ArrowUpRight } from 'lucide-react';
import type { ProjectKpiSnapshot } from '@/lib/dashboard-kpis';
import type { FarmProject } from '@/lib/farm-types';
import {
  summarizeAnnualOverview,
  type AnnualOverviewMetric,
  type AnnualProjectStatus,
} from '@/lib/annual-overview';

export interface AnnualOverviewPanelProps {
  projects: FarmProject[];
  snapshots: ReadonlyMap<string, ProjectKpiSnapshot>;
  year: string;
  selectedStatus?: AnnualProjectStatus;
  onProjectStatus: (status: AnnualProjectStatus) => void;
  onMetric: (metric: AnnualOverviewMetric) => void;
}

export function AnnualOverviewPanel({ projects, snapshots, year, selectedStatus, onProjectStatus, onMetric }: AnnualOverviewPanelProps) {
  const summary = summarizeAnnualOverview(projects, snapshots, year);
  const projectMetrics = [
    { status: 'all', label: '전체 프로젝트', value: summary.projects },
    { status: 'active', label: '진행 중', value: summary.active },
    { status: 'on_hold', label: '보류', value: summary.onHold },
    { status: 'completed', label: '완료', value: summary.completed },
  ] as const;
  const linkClass = 'group min-w-0 rounded-xl px-4 py-3 text-left transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2';
  return (
    <section aria-label="연도별 핵심 현황" className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold">{year === 'all' ? '전체 연도' : `${year}년`} 프로젝트 현황</h2>
        <p className="text-xs text-slate-500">일반 {summary.general} · 연구 {summary.research} · 내부 {summary.internal} · 현재 저장 상태 기준</p>
      </div>
      <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 xl:grid-cols-6">
        {projectMetrics.map((metric) => (
          <button key={metric.status} type="button" className={`${linkClass}${selectedStatus === metric.status ? ' bg-emerald-50 ring-1 ring-inset ring-emerald-200' : ''}`} onClick={() => onProjectStatus(metric.status)} aria-pressed={selectedStatus === undefined ? undefined : selectedStatus === metric.status} aria-label={`${metric.label} ${metric.value}개, 프로젝트 목록 보기`}>
            <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">{metric.label}<ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700" /></span>
            <span className={`mt-1 block text-2xl font-bold tabular-nums ${metric.status === 'active' ? 'text-emerald-800' : 'text-slate-900'}`}>{metric.value}<span className="ml-1 text-xs font-normal text-slate-500">개</span></span>
          </button>
        ))}
        <button type="button" className={linkClass} onClick={() => onMetric('farms')} aria-label={`농가 수 ${summary.farms}곳, 농가 목록 보기`}>
          <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">농가 수<ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700" /></span>
          <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-900">{summary.farms}<span className="ml-1 text-xs font-normal text-slate-500">곳</span></span>
        </button>
        <button type="button" className={linkClass} onClick={() => onMetric('subscriptions')} aria-label={`유효 구독 농가 ${summary.subscribedFarms}곳, 구독 목록 보기`}>
          <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">구독 농가 수<ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 group-hover:text-emerald-700" /></span>
          <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-900">{summary.subscribedFarms}<span className="ml-1 text-xs font-normal text-slate-500">곳</span></span>
        </button>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/60 p-2">
        <div className="grid gap-1 sm:grid-cols-3">
          {summary.stages.map((stage) => (
            <button key={stage.key} type="button" className={linkClass} onClick={() => onMetric(stage.key)} aria-label={`${stage.label} 완료 ${stage.completed}/${stage.total}건, ${stage.rate === null ? '대상 없음' : `${stage.rate}%`}, 해당 목록 보기`}>
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">{stage.label} 완료<ArrowUpRight aria-hidden="true" className="size-3.5 text-slate-400 group-hover:text-emerald-700" /></span>
              <span className="mt-2 flex items-baseline justify-between gap-2">
                <span className={`text-lg font-bold tabular-nums ${stage.remaining > 0 ? 'text-red-700' : 'text-emerald-800'}`}>{stage.completed}<span className="text-sm font-medium text-slate-500"> / {stage.total}건</span></span>
                <span className={`text-sm font-semibold tabular-nums ${stage.remaining > 0 ? 'text-red-700' : 'text-slate-600'}`}>{stage.rate === null ? '대상 없음' : `${stage.rate}%`}</span>
              </span>
              <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${stage.rate ?? 0}%` }} /></span>
              <span className="mt-1.5 block text-xs text-slate-500">{stage.total === 0 ? '참여 농가 없음' : stage.remaining > 0 ? `미완료 ${stage.remaining}건` : '모두 완료'}</span>
            </button>
          ))}
        </div>
        <p className="px-4 pb-2 pt-1 text-xs leading-relaxed text-slate-500">농가·구독은 중복 농가 제외 · 설치·시운전·교육은 농가 참여 기록 {summary.participations}건 기준 · 내부 프로젝트는 농가 지표 제외</p>
      </div>
    </section>
  );
}
