import { ArrowUpRight } from 'lucide-react';
import type { InternalWorkKpis } from '@/lib/internal-projects';

export function InternalWorkKpiPanel({
  summary,
  onSelect,
}: {
  summary: InternalWorkKpis;
  onSelect: (target: 'projects' | 'tasks' | 'incomplete') => void;
}) {
  const metrics = [
    {
      label: '내부 프로젝트',
      value: `${summary.projects}개`,
      note: `진행 ${summary.activeProjects} · 완료 ${summary.completedProjects}`,
      target: 'projects',
    },
    {
      label: '전체 내부 업무',
      value: `${summary.tasks}건`,
      note: `상위 ${summary.rootTasks} · 세부 ${summary.subtasks}건`,
      target: 'tasks',
    },
    {
      label: '미완료 실행 업무',
      value: `${summary.incompleteTasks}건`,
      note: `대기·막힘 ${summary.waitingTasks} · 기한 지연 ${summary.overdueTasks}`,
      target: 'incomplete',
    },
    {
      label: '내부 실행 업무 완료율',
      value:
        summary.completionRate === null ? '-' : `${summary.completionRate}%`,
      note: `완료 ${summary.completedTasks}/${summary.executableTasks}건 · 상위 최종 완료와 별도`,
      target: 'tasks',
    },
  ] as const;
  return (
    <section className="mb-5" aria-label="내부 업무 핵심 지표">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-bold">내부 프로젝트·업무</h2>
        <p className="text-sm text-slate-600">
          전체 기간 · 사업연도·타입·검색 조건과 별도 집계
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            type="button"
            className="metric-link"
            onClick={() => onSelect(metric.target)}
            aria-label={`${metric.label} ${metric.value}, 해당 목록 보기`}
          >
            <span className="metric-label">
              {metric.label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </span>
            <span
              className={`metric-value ${metric.target === 'incomplete' && (summary.waitingTasks || summary.overdueTasks) ? 'text-red-700' : ''}`}
            >
              {metric.value}
            </span>
            <span className="metric-note">{metric.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
