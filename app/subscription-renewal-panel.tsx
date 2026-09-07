import { Fragment, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  FARM_PROJECT_TYPE_LABELS,
  type Farm,
  type FarmProject,
  type FarmRecord,
} from '@/lib/farm-types';
import {
  buildRenewalReport,
  groupRenewalCycles,
  summarizeRenewalCycles,
  type RenewalGrouping,
  type RenewalStage,
} from '@/lib/subscription-renewal-report';

const rateLabel = (rate: number | null) =>
  rate === null
    ? '-'
    : `${rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;
const stageLabels = {
  all: '전체 구독',
  first: '첫 갱신 대상 · 1차',
  repeat: '반복 갱신 대상 · 2차 이상',
  unknown: '과거 입금 연결 필요',
};
const outcomeLabels = {
  renewed: '갱신 완료',
  churned: '미갱신 · 이탈 기록',
  pending: '미갱신',
  conflict: '기록 확인 필요',
};

const renewalTermHelp: Record<string, { meaning: string; formula: string }> = {
  '만료 농가': {
    meaning:
      '선택한 연도·월에 기준 만료일이 있는 전체 대상입니다. 이미 갱신한 대상과 앞으로 만료될 대상도 포함합니다. 같은 농가라도 사업·만료 회차가 다르면 각각 집계합니다.',
    formula: '만료 농가 = 만료 경과 + 만료 예정',
  },
  '만료 경과': {
    meaning:
      '기준 만료일이 오늘보다 이전인 대상입니다. 이미 갱신한 농가도 포함하므로 미갱신 농가 수와는 다릅니다. 갱신율의 분모로 사용합니다.',
    formula:
      '만료 경과 = 갱신 완료 + 미갱신 + 기록 확인 대상. 기록 확인 대상은 갱신·이탈 기록이 서로 상충하는 경우입니다.',
  },
  '갱신 완료': {
    meaning:
      '만료 경과 대상 중 오늘까지 갱신이 확인된 대상입니다. 미리 갱신했더라도 기준 만료일이 아직 지나지 않았다면 만료 예정에 포함합니다. 재가입은 별도 실적입니다.',
    formula: '갱신율의 분자이며, 만료 경과 대상 안에서만 집계합니다.',
  },
  미갱신: {
    meaning:
      '기준 만료일이 지났지만 갱신이 확인되지 않은 대상입니다. 이탈 기록이 있거나 결과를 등록하지 않은 대상도 포함하며, 나중에 갱신이 확인되면 갱신 완료로 바뀝니다.',
    formula:
      '미갱신 = 만료 경과 − 갱신 완료 − 기록 확인 대상. 상충하는 기록은 별도로 구분합니다.',
  },
  갱신율: {
    meaning:
      '만료일이 지난 전체 대상 중 갱신을 완료한 비율입니다. 오늘 만료와 미래 만료는 제외하고, 재가입은 갱신에 더하지 않습니다. 대상이 없으면 -, 대상은 있지만 갱신이 없으면 0%입니다.',
    formula: '갱신율 = 갱신 완료 ÷ 만료 경과 × 100',
  },
  '만료 예정': {
    meaning:
      '선택한 연도·월의 대상 중 기준 만료일이 오늘이거나 이후인 대상입니다. 오늘 만료도 당일까지 유효하므로 포함합니다. 미리 갱신한 대상도 기준 만료일이 지나기 전에는 이 열에 포함합니다.',
    formula: '만료 예정 = 만료 농가 − 만료 경과. 현재 갱신율에서는 제외합니다.',
  },
};

export function SubscriptionRenewalPanel({
  report,
  projects,
  records,
  farms,
  onOpenRecord,
  onRegister,
}: {
  report: ReturnType<typeof buildRenewalReport>;
  projects: FarmProject[];
  records: FarmRecord[];
  farms: Farm[];
  onOpenRecord: (record: FarmRecord, projectId: string) => void;
  onRegister: (record: FarmRecord, expiryDate: string) => void;
}) {
  const [stage, setStage] = useState<RenewalStage | 'all'>('all');
  const [grouping, setGrouping] = useState<RenewalGrouping>('month');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [groupPage, setGroupPage] = useState(0);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const recordById = new Map(records.map((record) => [record.id, record]));
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  const filtered = report.cycles.filter(
    (cycle) => stage === 'all' || cycle.stage === stage,
  );
  const groups = groupRenewalCycles(filtered, grouping, projects, report.year);
  const summary = summarizeRenewalCycles(filtered);
  const selected = groups.find((group) => group.key === selectedGroup);
  const groupName = (key: string) =>
    grouping === 'project'
      ? (projectById.get(key)?.name ?? '사업 미확인')
      : grouping === 'type'
        ? (FARM_PROJECT_TYPE_LABELS[
            key as keyof typeof FARM_PROJECT_TYPE_LABELS
          ] ?? '사업 타입 미확인')
        : grouping === 'year'
          ? `${key}년`
          : `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil((selected?.cycles.length ?? 0) / 10) - 1),
  );
  const currentGroupPage = Math.min(
    groupPage,
    Math.max(0, Math.ceil(groups.length / 12) - 1),
  );
  const chooseStage = (next: RenewalStage | 'all') => {
    setStage(next);
    setSelectedGroup(null);
    setPage(0);
    setGroupPage(0);
  };
  const cells = (metric: typeof summary) => (
    <>
      <td className="p-3 text-right font-semibold">{metric.annualTarget}</td>
      <td className="p-3 text-right font-semibold">{metric.target}</td>
      <td className="p-3 text-right text-emerald-800">{metric.renewed}</td>
      <td className="p-3 text-right text-amber-800">{metric.notRenewed}</td>
      <td className="p-3 text-right font-bold">{rateLabel(metric.rate)}</td>
      <td className="p-3 text-right">{metric.upcoming + metric.dueToday}</td>
    </>
  );
  return (
    <section
      className="mb-6 space-y-4"
      aria-labelledby="renewal-performance-heading"
    >
      <div>
        <h2 id="renewal-performance-heading" className="text-lg font-bold">
          {report.year}년 구독 실적 · 1월~12월
        </h2>
        <p className="mt-1 text-sm text-[#627269]">
          연간 만료 대상 {report.overall.annualTarget}개소 · 기준일{' '}
          {report.today}. 만료일이 지났고 갱신 완료가 없으면 미갱신입니다.
        </p>
      </div>
      <Card className="border-0 bg-white ring-[#dfe6dd]">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold">
                {grouping === 'month'
                  ? '1월~12월 월별 만료 농가'
                  : '연간 구독 실적 집계표'}
              </h3>
              <p className="mt-1 text-xs text-[#627269]">
                {stageLabels[stage]} · 농가×사업×만료 회차 기준(개소). 같은
                농가도 회차가 다르면 각각 집계됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm font-medium">
                구독 구분
                <select
                  aria-label="갱신 집계 구독 구분"
                  className="mt-1 block min-h-10 rounded-lg border bg-white px-3 text-sm"
                  value={stage}
                  onChange={(event) =>
                    chooseStage(event.target.value as RenewalStage | 'all')
                  }
                >
                  {Object.entries(stageLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                묶어 보기
                <select
                  aria-label="갱신 집계 기준"
                  className="mt-1 block min-h-10 rounded-lg border bg-white px-3 text-sm"
                  value={grouping}
                  onChange={(event) => {
                    setGrouping(event.target.value as RenewalGrouping);
                    setSelectedGroup(null);
                    setPage(0);
                    setGroupPage(0);
                  }}
                >
                  <option value="year">연도별</option>
                  <option value="month">월별</option>
                  <option value="type">사업 타입별</option>
                  <option value="project">사업별</option>
                </select>
              </label>
            </div>
          </div>
          <p className="mb-3 text-sm text-[#627269]">
            만료 예정에는 오늘 만료되는 농가도 포함합니다. 아직 만료일이 지나지
            않은 대상은 갱신율에서 제외합니다.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[840px] text-sm tabular-nums">
              <caption className="sr-only">
                {report.year}년 1월부터 12월 {stageLabels[stage]} 갱신 실적.
                오늘 만료와 만료 예정은 갱신율 분모에서 제외.
              </caption>
              <thead className="bg-[#f3f6f3] text-xs">
                <tr>
                  {[
                    '구분',
                    '만료 농가',
                    '만료 경과',
                    '갱신 완료',
                    '미갱신',
                    '갱신율',
                    '만료 예정',
                    '농가',
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`p-3 ${index === 0 ? 'text-left' : 'text-right'}`}
                    >
                      <span
                        className={`inline-flex items-center gap-1 ${index === 0 ? '' : 'justify-end'}`}
                      >
                        {heading}
                        {renewalTermHelp[heading] && (
                          <Popover>
                            <PopoverTrigger
                              type="button"
                              aria-label={`${heading} 용어 설명`}
                              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#b9c9bd] bg-white text-sm font-semibold text-[#53645a] hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                            >
                              <span aria-hidden="true">?</span>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-80 max-w-[calc(100vw-2rem)] p-4 text-left font-normal leading-6"
                            >
                              <PopoverTitle className="text-base font-semibold">
                                {heading}
                              </PopoverTitle>
                              <PopoverDescription className="text-sm text-[#53645a]">
                                {renewalTermHelp[heading].meaning}
                              </PopoverDescription>
                              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
                                {renewalTermHelp[heading].formula}
                              </p>
                            </PopoverContent>
                          </Popover>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-emerald-200 bg-emerald-50">
                  <th scope="row" className="p-3 text-left">
                    {String(report.year).slice(-2)}년 총계
                  </th>
                  {cells(summary)}
                  <td className="p-3 text-right" aria-label="연간 총계">
                    —
                  </td>
                </tr>

                {groups
                  .slice(currentGroupPage * 12, currentGroupPage * 12 + 12)
                  .map((group) => (
                    <Fragment key={group.key}>
                      <tr className="border-t">
                        <th scope="row" className="p-3 text-left font-medium">
                          {groupName(group.key)}
                        </th>
                        {cells(group)}
                        <td className="p-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-expanded={selectedGroup === group.key}
                            aria-controls={
                              selectedGroup === group.key
                                ? `renewal-farms-${grouping}-${group.key}`
                                : undefined
                            }
                            disabled={group.cycles.length === 0}
                            onClick={() => {
                              setSelectedGroup(
                                selectedGroup === group.key ? null : group.key,
                              );
                              setPage(0);
                            }}
                          >
                            {selectedGroup === group.key
                              ? '농가 접기'
                              : '농가 보기'}
                          </Button>
                        </td>
                      </tr>
                      {selectedGroup === group.key && selected && (
                        <tr className="border-t bg-emerald-50/30">
                          <td colSpan={8} className="p-3">
                            <section
                              className="rounded-lg border bg-white p-4"
                              id={`renewal-farms-${grouping}-${selected.key}`}
                              aria-label="만료 회차 대상 상세"
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <h4 className="font-bold">
                                  {groupName(selected.key)} ·{' '}
                                  {stageLabels[stage]} {selected.cycles.length}
                                  개소
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedGroup(null)}
                                >
                                  농가 접기
                                </Button>
                              </div>
                              <ul className="divide-y">
                                {selected.cycles
                                  .slice(
                                    currentPage * 10,
                                    currentPage * 10 + 10,
                                  )
                                  .map((cycle) => {
                                    const record = recordById.get(
                                      cycle.farmRecordId,
                                    );
                                    return (
                                      <li
                                        key={cycle.key}
                                        className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                                      >
                                        <div>
                                          <button
                                            type="button"
                                            className="font-semibold text-emerald-800 underline underline-offset-4"
                                            onClick={() =>
                                              record &&
                                              onOpenRecord(
                                                record,
                                                cycle.projectId,
                                              )
                                            }
                                          >
                                            {record
                                              ? (farmById.get(record.farmId)
                                                  ?.name ?? '농가 미확인')
                                              : '농가 미확인'}
                                          </button>
                                          <p className="mt-1 text-xs text-[#627269]">
                                            {projectById.get(cycle.projectId)
                                              ?.name ?? '사업 미확인'}{' '}
                                            · 만료 {cycle.expiryDate} ·{' '}
                                            {cycle.paymentCount === 0
                                              ? '갱신 이력 없음'
                                              : `현재 ${cycle.paymentCount}차 갱신`}
                                            {' · '}입금 {cycle.paymentCount}건
                                            {cycle.paymentCount > 0 &&
                                            cycle.outcome === 'renewed' &&
                                            cycle.paymentOrdinal !== null
                                              ? ` · 해당 만료 건 갱신 ${cycle.paymentOrdinal}차`
                                              : cycle.stage === 'unknown'
                                                ? ' · 해당 만료 건과 입금 연결 필요'
                                                : ''}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                          <span>
                                            {cycle.upcoming || cycle.dueToday
                                              ? `${cycle.dueToday ? '오늘 만료' : '만료 예정'}${cycle.outcome === 'renewed' ? ' · 선갱신 완료' : ''}`
                                              : outcomeLabels[cycle.outcome]}
                                          </span>
                                          {cycle.outcome === 'pending' &&
                                            cycle.futureResultDate && (
                                              <span className="text-xs text-amber-900">
                                                미래 처리 기록{' '}
                                                {cycle.futureResultDate} ·
                                                상세에서 확인
                                              </span>
                                            )}
                                          {record &&
                                            cycle.outcome === 'pending' &&
                                            !cycle.futureResultDate && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                  onRegister(
                                                    record,
                                                    cycle.expiryDate,
                                                  )
                                                }
                                              >
                                                결과 등록
                                              </Button>
                                            )}
                                        </div>
                                      </li>
                                    );
                                  })}
                              </ul>
                              {selected.cycles.length > 10 && (
                                <div className="mt-3 flex items-center justify-end gap-3 text-sm">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 0}
                                    onClick={() => setPage(currentPage - 1)}
                                  >
                                    이전
                                  </Button>
                                  <span>
                                    {currentPage + 1} /{' '}
                                    {Math.ceil(selected.cycles.length / 10)}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                      (currentPage + 1) * 10 >=
                                      selected.cycles.length
                                    }
                                    onClick={() => setPage(currentPage + 1)}
                                  >
                                    다음
                                  </Button>
                                </div>
                              )}
                            </section>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                {!groups.length && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#627269]">
                      선택 조건에 해당하는 만료 회차가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {groups.length > 12 && (
            <div className="mt-3 flex items-center justify-end gap-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={currentGroupPage === 0}
                onClick={() => setGroupPage(currentGroupPage - 1)}
              >
                이전
              </Button>
              <span>
                {currentGroupPage + 1} / {Math.ceil(groups.length / 12)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(currentGroupPage + 1) * 12 >= groups.length}
                onClick={() => setGroupPage(currentGroupPage + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            {
              key: 'first',
              title: '첫 갱신율 · 1차',
              description: '첫 번째 입금 대상 · 이전 입금 0회',
              metric: report.first,
            },
            {
              key: 'repeat',
              title: '반복 갱신율 · 2차 이상',
              description: '두 번째 이후 입금 대상 · 이전 입금 1회 이상',
              metric: report.repeat,
            },
            {
              key: 'all',
              title: '전체 갱신율',
              description: '과거 입금 연결 필요 건까지 포함한 만료 경과 대상',
              metric: report.overall,
            },
          ] as const
        ).map(({ key, title, description, metric }) => (
          <button
            key={key}
            type="button"
            onClick={() => chooseStage(key)}
            aria-pressed={stage === key}
            className={`rounded-xl border bg-white p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${stage === key ? 'border-emerald-700 ring-1 ring-emerald-700' : 'border-[#dfe6dd] hover:border-emerald-600'}`}
          >
            <span className="block font-semibold">{title}</span>
            <span className="mt-2 block text-3xl font-bold tabular-nums text-emerald-800">
              {rateLabel(metric.rate)}
            </span>
            <span className="mt-2 block text-sm">
              갱신 {metric.renewed} / 만료 경과 {metric.target}개소
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#627269]">
              {description}
            </span>
            <span className="mt-2 block text-xs font-medium text-amber-800">
              {metric.conflict > 0
                ? `미갱신 ${metric.notRenewed} · 기록 확인 ${metric.conflict}`
                : metric.target
                  ? `미갱신 ${metric.notRenewed}개소`
                  : '만료 경과 대상 없음'}{' '}
              · 표 보기
            </span>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-[#dfe6dd] bg-white p-4 text-sm leading-6">
        <p>
          연간 만료 대상 <strong>{report.overall.annualTarget}개소</strong> 중
          만료 경과 <strong>{report.overall.target}개소</strong>입니다. 갱신{' '}
          {report.overall.renewed}, 미갱신 {report.overall.notRenewed}개소이며
          별도 결과 등록이 없어도 만료일 경과 시 미갱신으로 집계합니다.
          {report.overall.conflict > 0 &&
            ` 상충하는 기록 ${report.overall.conflict}개소는 갱신으로 인정하지 않고 기록 확인 대상으로 구분합니다.`}
        </p>
        <p>
          오늘 만료 <strong>{report.overall.dueToday}개소</strong>와 만료 예정{' '}
          <strong>{report.overall.upcoming}개소</strong>는 아직 만료일이 지나지
          않아 갱신율 분모에서 제외합니다. 재가입{' '}
          <strong>{report.rejoined}개소</strong>는 별도 실적이며 갱신에 합산하지
          않습니다.
        </p>
        {report.unknown.annualTarget > 0 && (
          <p className="mt-1 text-amber-900">
            과거 입금 연결 필요: 경과 {report.unknown.target} / 오늘{' '}
            {report.unknown.dueToday} / 예정 {report.unknown.upcoming}개소.
            전체에는 포함되지만 첫·반복 비교에는 포함되지 않습니다.{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => chooseStage('unknown')}
            >
              입금 연결 대상 보기
            </button>
          </p>
        )}
        {report.excluded > 0 && (
          <p className="text-amber-900">
            전체 원자료에서 날짜·연결 오류 {report.excluded}건을 제외했습니다.
            관리대장의 원자료 확인이 필요합니다.
          </p>
        )}
      </div>
      <details className="rounded-xl border bg-white p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">
          집계 기준과 원본 검토 내용
        </summary>
        <div className="mt-3 space-y-2 text-[#53645a]">
          <p>
            매년 1월~12월 전체를 조회합니다. 갱신율 = 만료 경과 대상의 갱신 완료
            ÷ 만료 경과 대상 × 100. 대상이 있고 갱신이 없으면 0%, 대상이 없으면
            -입니다. 오늘 만료는 당일까지 유효하므로 아직 미갱신으로 보지 않고
            내일부터 반영합니다.
          </p>
          <p>
            첫 입금이 첫 갱신이며 두 번째 입금부터 반복 갱신입니다. 금액이
            아니라 입금 기록 건수로 구분하므로 132,000원 한 번은 2년 연장·1회
            입금입니다. 앞으로 입금 전 횟수를 갱신 이력에 고정 저장합니다. 과거
            갱신은 연결 입금 또는 같은 날의 유일한 입금으로 회차를 확인하며,
            연결 근거가 없으면 과거 입금 연결 필요로 표시합니다. 수기 갱신
            횟수는 KPI 분류에 사용하지 않습니다.
          </p>
          <p>
            기록으로 확인된 만료 회차만 계산합니다. 최초 만료일이나 계약
            기간으로 누락된 과거 회차를 임의 복원하지 않습니다. 현재 미처리
            회차는 현재까지의 실제 입금 내역 건수를 기준으로 다음 입금 회차를
            정합니다. 과거 기간 조회도 그 시점의 상태 복원이 아니라 오늘까지
            확인된 결과입니다.
          </p>
          <p>
            미갱신은 만료일이 지났고 갱신 완료가 없는 경우이며 이탈 기록과
            무기록 대상을 포함합니다. 나중에 갱신을 등록하면 갱신으로 바뀝니다.
            상충하는 기록은 확인 대상으로 분리하되 분모에는 포함합니다. 재가입은
            선택 연도의 처리일 기준 별도 집계입니다. 만료 예정은 선택 연도 중
            내일부터 도래하는 회차이며, 아래 전체 만료 예정 목록은 기간과 무관한
            현재 사용 중 구독입니다.
          </p>
          <p>
            농가 수·입금액·현재 계약 회차는 보조 현황입니다. ‘한 번 갱신하면
            다음에도 갱신한다’는 가설은 첫·반복 갱신율과 분모를 함께 보고
            검증해야 합니다. 산식 없는 영향 요인·예상 갱신율은 실적 KPI로
            표시하지 않습니다. 회차별 입금 연결이 없는 데이터로 입금 완료를
            추정하지 않습니다.
          </p>
          <p>
            <a
              className="font-medium underline underline-offset-4"
              href="https://docs.google.com/spreadsheets/d/1temWavcrQ3806ri132TlW4KbUUbEXq1fTqFyLet2X9k/edit#gid=940158464"
              target="_blank"
              rel="noreferrer"
            >
              참고 스프레드시트
            </a>
            의 검토 예시: 연간 만료 22, 갱신 15, 재가입 2일 때
            (15+2)/22=77.27%는 재가입을 합산한 비율입니다. 갱신만은
            15/22=68.18%이며, 미래 만료가 포함된 연간 분모이므로 오늘 기준
            실적으로 단정하지 않습니다. 이 숫자는 원본 검토 예시이며 프로그램
            실적에 입력하지 않았습니다.
          </p>
        </div>
      </details>
    </section>
  );
}
