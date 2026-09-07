import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FARM_PROJECT_TYPES, FARM_PROJECT_TYPE_LABELS } from '@/lib/farm-types';
import {
  filterProjectsByScope,
  type ProjectTypeScope,
} from '@/lib/dashboard-kpis';
import type { FarmProject } from '@/lib/farm-types';
import type {
  ProjectKpis,
  summarizeSubscriptionCycles,
} from '@/lib/dashboard-kpis';

const rateLabel = (value: number | null) =>
  value === null ? '-' : `${value}%`;

export function ProjectTypeSelector({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ProjectTypeScope;
  onChange: (value: ProjectTypeScope) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>사업 타입</FieldLabel>
      <Select
        value={value}
        onValueChange={(next) => {
          if (
            next === 'all' ||
            FARM_PROJECT_TYPES.some((type) => type === next)
          )
            onChange(next as ProjectTypeScope);
        }}
      >
        <SelectTrigger id={id} className="h-10 w-full bg-white">
          <SelectValue>
            {value === 'all'
              ? '전체 사업 타입'
              : FARM_PROJECT_TYPE_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 사업 타입</SelectItem>
          {FARM_PROJECT_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {FARM_PROJECT_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ProjectYearSummary({
  projects,
  selectedYear,
  onYearChange,
  projectType,
}: {
  projects: FarmProject[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  projectType: ProjectTypeScope;
}) {
  const years = [...new Set(projects.map((project) => project.year))].sort(
    (a, b) => b - a,
  );
  return (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="연도별 사업 집계">
      {['all', ...years.map(String)].map((year) => {
        const scoped = filterProjectsByScope(projects, year, projectType);
        return (
          <button
            key={year}
            type="button"
            aria-pressed={selectedYear === year}
            onClick={() => onYearChange(year)}
            title={`진행 ${scoped.filter((project) => project.status === 'active').length} · 완료 ${scoped.filter((project) => project.status === 'completed').length} · 보류 ${scoped.filter((project) => project.status === 'on_hold').length}`}
            className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${selectedYear === year ? 'border-[#176448] bg-[#e4f1eb] text-[#125638]' : 'border-[#d8e0e7] bg-white text-[#526172] hover:bg-[#f2f7f1]'}`}
          >
            <span className="block text-sm font-semibold">
              {year === 'all' ? '전체 연도' : `${year}년 사업`}
            </span>
            <span className="rounded bg-black/5 px-1.5 text-sm font-bold">
              {scoped.length}개
            </span>
            <span className="sr-only">
              진행{' '}
              {scoped.filter((project) => project.status === 'active').length} ·
              완료{' '}
              {
                scoped.filter((project) => project.status === 'completed')
                  .length
              }{' '}
              · 보류{' '}
              {scoped.filter((project) => project.status === 'on_hold').length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ProjectKpiPanel({
  summary,
  year,
  projectType,
  onSelect,
}: {
  summary: ProjectKpis;
  year: string;
  projectType: ProjectTypeScope;
  onSelect?: (target: 'projects' | 'tasks' | 'attention') => void;
}) {
  const metrics = [
    {
      label: '전체 프로젝트',
      value: `${summary.projects}개`,
      note: `일반 ${summary.general} · 연구 ${summary.research}`,
    },
    {
      label: '진행 중 사업',
      value: `${summary.active}개`,
      note: '선택 연도·사업 타입 기준',
    },
    {
      label: '완료 사업',
      value: `${summary.completed}개`,
      note: '사업 상태 완료',
    },
    {
      label: '보류 사업',
      value: `${summary.onHold}개`,
      note: `프로젝트 막힘 ${summary.blockers}건`,
    },
    {
      label: '프로젝트 하위 업무',
      value: `${summary.tasks}건`,
      note: `완료 ${summary.completedTasks} · 미완료 ${summary.incompleteTasks}`,
    },
    {
      label: '하위 업무 완료율',
      value: rateLabel(summary.taskCompletionRate),
      note: `완료 ${summary.completedTasks}/${summary.tasks}건`,
    },
    {
      label: '처리 필요 업무',
      value: `${summary.incompleteTasks}건`,
      note: `대기·막힘 ${summary.waitingTasks} · 기한 지연 ${summary.overdueTasks}`,
      warning: summary.overdueTasks > 0 || summary.waitingTasks > 0,
    },
    {
      label: '참여 농가',
      value: `${summary.farms}곳`,
      note: `농가×사업 참여 ${summary.participations}건`,
    },
    {
      label: '설치 · 시운전 · 교육',
      value: `${rateLabel(summary.installationRate)} / ${rateLabel(summary.commissioningRate)} / ${rateLabel(summary.educationRate)}`,
      note: '사업 참여별 완료일 입력 기준',
      compact: true,
    },
    {
      label: '유효 구독률',
      value: rateLabel(summary.subscriptionRate),
      note: `사용 중 ${summary.subscriptions}/${summary.participations}개소`,
    },
    {
      label: '필수서류 승인율',
      value: rateLabel(summary.documentRate),
      note: `승인 ${summary.approved}/${summary.required}건 · 확인 필요 ${summary.documentRisks}건`,
    },
    {
      label: '정산 완료',
      value: `${summary.settled}/${summary.projects}개`,
      note: `입금 완료·정산 마감 ${rateLabel(summary.settlementRate)}`,
    },
  ];
  return (
    <section className="mb-5" aria-label="사업연도 핵심 지표">
      <p className="mb-2 text-sm text-[#617166]">
        {year === 'all' ? '전체 연도' : `${year}년 사업`} ·{' '}
        {projectType === 'all'
          ? '전체 사업 타입'
          : FARM_PROJECT_TYPE_LABELS[projectType]}{' '}
        집계 · 검색 조건은 목록에만 적용
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 4, 5, 6].map((index) => (
          <button
            key={metrics[index].label}
            type="button"
            className="metric-link"
            onClick={() =>
              onSelect?.(
                index === 0 ? 'projects' : index === 6 ? 'attention' : 'tasks',
              )
            }
            aria-label={`${metrics[index].label} ${metrics[index].value}, 해당 목록 보기`}
          >
            <span className="metric-label">
              {metrics[index].label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </span>
            <span
              className="metric-value"
              style={
                index === 6 && metrics[index].warning
                  ? { color: '#ad432b' }
                  : undefined
              }
            >
              {metrics[index].value}
            </span>
            <span className="metric-note">{metrics[index].note}</span>
          </button>
        ))}
      </div>
      <Collapsible className="mt-2">
        <CollapsibleTrigger className="flex min-h-10 items-center gap-2 text-sm font-semibold text-[#176448]">
          설치·구독·서류·정산 지표{' '}
          <ChevronDown className="size-4" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 pb-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics
              .filter((_, index) => ![0, 4, 5, 6].includes(index))
              .map((metric) => (
                <div key={metric.label} className="metric-link">
                  <p className="metric-label">{metric.label}</p>
                  <p className="text-xl font-bold">{metric.value}</p>
                  <p className="metric-note">{metric.note}</p>
                </div>
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

export function SubscriptionCyclePanel({
  counts,
}: {
  counts: ReturnType<typeof summarizeSubscriptionCycles>;
}) {
  const metrics = [
    [
      '최초 구독 · 입금 확인',
      counts.initial,
      '구독 등록 · 연장 0회 · 입금 이력 있음',
    ],
    ['1차 연장', counts.first, '등록된 갱신횟수 1회'],
    ['2차 연장', counts.second, '등록된 갱신횟수 2회'],
    ['3차 이상 연장', counts.thirdPlus, '등록된 갱신횟수 3회 이상'],
    [
      '최초 입금·회차 미확인',
      counts.unverified,
      '입금일만 입력된 경우는 미확인',
    ],
  ] as const;
  return (
    <Collapsible
      className="mb-4 rounded-lg border border-[#d8e0e7] bg-white px-4"
      aria-label="현재 구독 회차 현황"
    >
      <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-2 text-left">
        <h2 className="text-base font-bold">현재 구독 회차</h2>
        <span className="flex items-center gap-2 text-sm text-[#586777]">
          {counts.total}개소 · 상세 보기 <ChevronDown className="size-4" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(([label, value, note]) => (
            <Card
              key={label}
              className="border-0 bg-white shadow-sm ring-[#dfe6dd]"
            >
              <CardContent className="px-4 py-0">
                <p className="text-sm text-[#627269]">{label}</p>
                <p className="mt-1 text-2xl font-bold text-[#255f43]">
                  {value}개소
                </p>
                <p className="mt-1 text-xs leading-5 text-[#718077]">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[#718077]">
          선택한 사업 범위의 전체 구독을 현재 등록 회차로 분류합니다(만료 포함).
          최초 구독은 해당 농가·사업에 연결된 양수 입금 이력으로 확인하며, 연장
          회차는 등록된 갱신횟수 기준입니다.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
