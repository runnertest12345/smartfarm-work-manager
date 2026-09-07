import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  first: '첫 갱신',
  repeat: '반복 갱신',
  unknown: '회차 미확인',
};
const outcomeLabels = {
  renewed: '갱신 완료',
  churned: '이탈 확정',
  pending: '결과 미확인',
  conflict: '결과 충돌',
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
  const groups = groupRenewalCycles(filtered, grouping, projects);
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
      <td className="p-3 text-right font-semibold">{metric.target}</td>
      <td className="p-3 text-right text-emerald-800">{metric.renewed}</td>
      <td className="p-3 text-right">{metric.churned}</td>
      <td className="p-3 text-right">{metric.pending}</td>
      <td className="p-3 text-right">{metric.conflict}</td>
      <td className="p-3 text-right font-bold">
        {rateLabel(metric.rate)}
        {metric.target > 0 && metric.pending + metric.conflict > 0 && (
          <span className="ml-1 text-xs font-normal text-amber-800">잠정</span>
        )}
      </td>
      <td className="p-3 text-right">{metric.upcoming}</td>
    </>
  );
  return (
    <section
      className="mb-6 space-y-4"
      aria-labelledby="renewal-performance-heading"
    >
      <div>
        <h2 id="renewal-performance-heading" className="text-lg font-bold">
          첫 갱신과 반복 갱신 비교
        </h2>
        <p className="mt-1 text-sm text-[#627269]">
          {report.startDate} ~ {report.endDate} 만료 회차 · 오늘({report.today}
          )까지 도래한 대상과 오늘까지 확인된 결과
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            {
              key: 'first',
              title: '첫 갱신율',
              description: '첫 만료 회차 · 이전 갱신 0회',
              metric: report.first,
            },
            {
              key: 'repeat',
              title: '반복 갱신율',
              description: '다시 만료되는 회차 · 이전 갱신 1회 이상',
              metric: report.repeat,
            },
            {
              key: 'all',
              title: '전체 갱신율',
              description: '회차 미확인을 포함한 모든 만료 도래 대상',
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
              갱신 {metric.renewed} / 만료 도래 {metric.target}개소
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#627269]">
              {description}
            </span>
            <span className="mt-2 block text-xs font-medium text-amber-800">
              {metric.pending + metric.conflict > 0
                ? `잠정 실적 · 미확인 ${metric.pending} · 충돌 ${metric.conflict}`
                : metric.target
                  ? '등록 결과 기준'
                  : '도래 대상 없음'}{' '}
              · 표 보기
            </span>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-[#dfe6dd] bg-white p-4 text-sm leading-6">
        <p>
          선택 기간 만료 도래 <strong>{report.overall.target}개소</strong> 중
          갱신 {report.overall.renewed}, 이탈 {report.overall.churned}, 결과
          미확인 {report.overall.pending}, 결과 충돌 {report.overall.conflict}
          개소입니다.
        </p>
        <p>
          만료 예정 <strong>{report.overall.upcoming}개소</strong>는 분모에서
          제외합니다. 재가입 <strong>{report.rejoined}개소</strong>는 별도
          실적이며 갱신에 합산하지 않습니다.
        </p>
        {report.unknown.target + report.unknown.upcoming > 0 && (
          <p className="mt-1 text-amber-900">
            회차 미확인: 도래 {report.unknown.target} / 예정{' '}
            {report.unknown.upcoming}개소. 전체에는 포함되지만 첫·반복 비교에는
            포함되지 않습니다.{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-4"
              onClick={() => chooseStage('unknown')}
            >
              미확인 회차 보기
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
      <Card className="border-0 bg-white ring-[#dfe6dd]">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold">갱신 실적 집계표</h3>
              <p className="mt-1 text-xs text-[#627269]">
                {stageLabels[stage]} · 농가×사업×만료 회차 기준(개소). 같은
                농가도 회차가 다르면 각각 집계됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-xs font-medium">
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
              <label className="text-xs font-medium">
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[840px] text-sm tabular-nums">
              <caption className="sr-only">
                {stageLabels[stage]} 갱신 실적. 만료 예정은 현재 갱신율 분모에서
                제외.
              </caption>
              <thead className="bg-[#f3f6f3] text-xs">
                <tr>
                  {[
                    '구분',
                    '만료 도래 대상',
                    '갱신 완료',
                    '이탈 확정',
                    '결과 미확인',
                    '결과 충돌',
                    '갱신율',
                    '만료 예정',
                    '상세',
                  ].map((heading, index) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`p-3 ${index === 0 ? 'text-left' : 'text-right'}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups
                  .slice(currentGroupPage * 12, currentGroupPage * 12 + 12)
                  .map((group) => (
                    <tr key={group.key} className="border-t">
                      <th scope="row" className="p-3 text-left font-medium">
                        {groupName(group.key)}
                      </th>
                      {cells(group)}
                      <td className="p-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-expanded={selectedGroup === group.key}
                          onClick={() => {
                            setSelectedGroup(
                              selectedGroup === group.key ? null : group.key,
                            );
                            setPage(0);
                          }}
                        >
                          대상 보기
                        </Button>
                      </td>
                    </tr>
                  ))}
                {!groups.length && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#627269]">
                      선택 조건에 해당하는 만료 회차가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t bg-[#f3f6f3]">
                <tr>
                  <th scope="row" className="p-3 text-left">
                    합계
                  </th>
                  {cells(summary)}
                  <td
                    className="p-3 text-right"
                    aria-label="합계에는 상세 동작 없음"
                  >
                    —
                  </td>
                </tr>
              </tfoot>
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
          {selected && (
            <section
              className="mt-5 rounded-lg border p-4"
              aria-label="만료 회차 대상 상세"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-bold">
                  {groupName(selected.key)} · {stageLabels[stage]}{' '}
                  {selected.cycles.length}개소
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGroup(null)}
                >
                  닫기
                </Button>
              </div>
              <ul className="divide-y">
                {selected.cycles
                  .slice(currentPage * 10, currentPage * 10 + 10)
                  .map((cycle) => {
                    const record = recordById.get(cycle.farmRecordId);
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
                              record && onOpenRecord(record, cycle.projectId)
                            }
                          >
                            {record
                              ? (farmById.get(record.farmId)?.name ??
                                '농가 미확인')
                              : '농가 미확인'}
                          </button>
                          <p className="mt-1 text-xs text-[#627269]">
                            {projectById.get(cycle.projectId)?.name ??
                              '사업 미확인'}{' '}
                            · 만료 {cycle.expiryDate} ·{' '}
                            {stageLabels[cycle.stage]}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            {cycle.upcoming
                              ? `만료 예정${cycle.outcome === 'renewed' ? ' · 선갱신 완료' : ''}`
                              : outcomeLabels[cycle.outcome]}
                          </span>
                          {cycle.outcome === 'pending' &&
                            cycle.futureResultDate && (
                              <span className="text-xs text-amber-900">
                                미래 처리 기록 {cycle.futureResultDate} ·
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
                                  onRegister(record, cycle.expiryDate)
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
                    {currentPage + 1} / {Math.ceil(selected.cycles.length / 10)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(currentPage + 1) * 10 >= selected.cycles.length}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    다음
                  </Button>
                </div>
              )}
            </section>
          )}
        </CardContent>
      </Card>
      <details className="rounded-xl border bg-white p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">
          집계 기준과 원본 검토 내용
        </summary>
        <div className="mt-3 space-y-2 text-[#53645a]">
          <p>
            갱신율 = 갱신 완료 ÷ 만료 도래 대상 × 100. 대상이 있고 갱신이 없으면
            0%, 대상이 없으면 -입니다. 미확인·충돌도 분모에 포함하므로 해당
            결과가 남으면 잠정 실적입니다.
          </p>
          <p>
            첫·반복 집단은 해당 만료 회차 이전 갱신 이력으로 고정합니다. 앞으로
            현재 회차를 처리할 때 갱신 전 횟수를 저장합니다. 과거 처리 건은
            저장된 횟수 또는 연결된 이전 갱신 근거가 없으면 회차 미확인입니다.
            현재 횟수로 과거 회차를 역산하지 않습니다.
          </p>
          <p>
            기록으로 확인된 만료 회차만 계산합니다. 최초 만료일이나 계약
            기간으로 누락된 과거 회차를 임의 복원하지 않습니다. 현재 미처리
            회차는 관리대장에 등록된 갱신 횟수를 기준으로 합니다. 과거 기간
            조회도 그 시점의 상태 복원이 아니라 오늘까지 확인된 결과입니다.
          </p>
          <p>
            재가입은 선택 기간의 처리일 기준 별도 집계입니다. 결과 미확인은
            이탈이 아닙니다. 만료 예정은 선택 기간 중 내일부터 도래하는
            회차이며, 아래 전체 만료 예정 목록은 기간과 무관한 현재 사용 중
            구독입니다.
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
