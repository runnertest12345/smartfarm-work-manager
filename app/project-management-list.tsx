'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FarmProject } from '@/lib/farm-types';

export type ProjectListFocus =
  | 'all'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'attention';
export type ProjectQuickEditField = 'status' | 'manager' | 'endDate';

export type ProjectManagementRow = {
  id: string;
  name: string;
  context: string;
  manager: string;
  status: FarmProject['status'];
  statusLabel: string;
  statusClass: string;
  stageLabel: string;
  farmCount: number;
  internal?: boolean;
  riskCount: number;
  riskLabel: string;
  endDate?: string;
  subscriptionCount?: number;
  installationRate?: number | null;
  commissioningRate?: number | null;
  educationRate?: number | null;
  canEdit?: boolean;
};

const FOCUS_LABELS: Record<ProjectListFocus, string> = {
  all: '전체 프로젝트',
  active: '진행 중',
  on_hold: '보류',
  completed: '완료',
  attention: '확인 필요',
};
const FIELD_LABELS: Record<ProjectQuickEditField, string> = {
  status: '상태',
  manager: '담당자',
  endDate: '종료 예정일',
};

export function ProjectManagementList({
  rows,
  onOpen,
  showSummary = true,
  showStatusFilters = true,
  focus: controlledFocus,
  onFocusChange,
  selectedId,
  onQuickEdit,
}: {
  rows: ProjectManagementRow[];
  onOpen: (id: string) => void;
  showSummary?: boolean;
  showStatusFilters?: boolean;
  focus?: ProjectListFocus;
  onFocusChange?: (focus: ProjectListFocus) => void;
  selectedId?: string;
  onQuickEdit?: (id: string, field: ProjectQuickEditField) => void;
}) {
  const [localFocus, setLocalFocus] = useState<ProjectListFocus>('all');
  const focus = controlledFocus ?? localFocus;
  const selectFocus = (next: ProjectListFocus) => {
    if (controlledFocus === undefined) setLocalFocus(next);
    onFocusChange?.(next);
  };
  // The parent supplies the shared year/type/search scope. A selected status
  // narrows the list, never the totals used to switch to another status.
  const counts: Record<ProjectListFocus, number> = {
    all: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    on_hold: rows.filter((row) => row.status === 'on_hold').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    attention: rows.filter((row) => row.riskCount > 0).length,
  };
  const statuses: ProjectListFocus[] = [
    'all',
    'active',
    'on_hold',
    'completed',
  ];
  const visible = rows.filter(
    (row) =>
      focus === 'all' ||
      (focus === 'attention' ? row.riskCount > 0 : row.status === focus),
  );
  const editable = Boolean(onQuickEdit && rows.some((row) => row.canEdit));
  const quickField = (
    row: ProjectManagementRow,
    field: ProjectQuickEditField,
    children: ReactNode,
  ) =>
    row.canEdit && onQuickEdit ? (
      <button
        type="button"
        aria-label={`${row.name} ${FIELD_LABELS[field]} 수정`}
        onClick={() => onQuickEdit(row.id, field)}
        className="-mx-1 inline-flex min-h-8 max-w-full items-center rounded-md px-1 text-left hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        {children}
      </button>
    ) : (
      <span className="inline-flex min-h-8 max-w-full items-center">
        {children}
      </span>
    );

  return (
    <div className="space-y-3">
      {showSummary && (
        <section aria-label="프로젝트 관리 핵심 요약">
          <p className="mb-2 text-xs text-slate-500">
            선택한 연도·유형·검색 기준 · 숫자를 누르면 해당 프로젝트를
            조회합니다.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {statuses.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => selectFocus(key)}
                className={`rounded-xl border bg-white px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${focus === key ? 'border-emerald-700 ring-1 ring-emerald-700' : 'border-slate-200 hover:border-emerald-300'}`}
              >
                <p className="text-xs font-medium text-slate-600">
                  {FOCUS_LABELS[key]}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {counts[key]}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    개
                  </span>
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
      <section
        aria-label="프로젝트 목록"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold" aria-live="polite">
              {FOCUS_LABELS[focus]} · {visible.length}개
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              이름을 누르면 이 화면에서 상세 조회
              {editable ? ' · 상태·담당자·기한을 누르면 수정' : ''}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={focus === 'attention'}
            onClick={() =>
              selectFocus(focus === 'attention' ? 'all' : 'attention')
            }
            className={`min-h-8 rounded-full border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${focus === 'attention' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            확인 필요 {counts.attention}개
          </button>
        </div>
        {!showSummary && showStatusFilters && (
          <div
            className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2"
            aria-label="프로젝트 상태 필터"
          >
            {statuses.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={focus === key}
                onClick={() => selectFocus(key)}
                className={`min-h-8 rounded-md px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${focus === key ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {FOCUS_LABELS[key]} {counts[key]}
              </button>
            ))}
          </div>
        )}
        {visible.length ? (
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[32%] pl-4">프로젝트</TableHead>
                <TableHead className="w-[16%]">상태 · 단계</TableHead>
                <TableHead className="w-[18%]">담당자 · 종료 예정일</TableHead>
                <TableHead className="w-[14%]">농가 · 구독</TableHead>
                <TableHead className="w-[20%] pr-4">
                  설치 · 시운전 · 교육
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selectedId === row.id ? 'selected' : undefined}
                >
                  <TableCell className="py-3 pl-4 whitespace-normal">
                    <button
                      type="button"
                      aria-label={`${row.name} 프로젝트 상세`}
                      aria-current={selectedId === row.id ? 'true' : undefined}
                      className="min-h-8 rounded-sm text-left font-semibold break-words text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      onClick={() => onOpen(row.id)}
                    >
                      {row.name}
                    </button>
                    <p
                      className="truncate text-xs text-slate-500"
                      title={row.context}
                    >
                      {row.context}
                    </p>
                    {row.riskCount > 0 && (
                      <p
                        className="mt-1 truncate text-xs text-amber-800"
                        title={row.riskLabel}
                      >
                        확인 필요 · {row.riskLabel || `${row.riskCount}건`}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {quickField(
                      row,
                      'status',
                      <Badge variant="outline" className={row.statusClass}>
                        {row.statusLabel}
                      </Badge>,
                    )}
                    <p className="text-xs text-slate-500">{row.stageLabel}</p>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div>
                      {quickField(
                        row,
                        'manager',
                        <span className="break-words">
                          {row.manager || '미지정'}
                        </span>,
                      )}
                    </div>
                    <div className="text-xs tabular-nums text-slate-500">
                      {quickField(row, 'endDate', row.endDate || '기한 미지정')}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-normal">
                    {row.internal ? (
                      <span className="text-slate-400">해당 없음</span>
                    ) : (
                      <div className="space-y-1">
                        <p>
                          농가{' '}
                          <span className="font-semibold text-slate-900">
                            {row.farmCount}곳
                          </span>
                        </p>
                        <p className="text-slate-500">
                          구독{' '}
                          {row.subscriptionCount == null
                            ? '집계 전'
                            : `${row.subscriptionCount}곳`}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 whitespace-normal">
                    {row.internal ? (
                      <span className="text-xs text-slate-400">해당 없음</span>
                    ) : (
                      <div className="grid grid-cols-3 gap-1 text-center text-xs tabular-nums">
                        {[
                          { label: '설치', rate: row.installationRate },
                          { label: '시운전', rate: row.commissioningRate },
                          { label: '교육', rate: row.educationRate },
                        ].map(({ label, rate }) => (
                          <div key={label}>
                            <p className="mb-1 text-[11px] text-slate-500">
                              {label}
                            </p>
                            <p
                              className={
                                rate != null && Number.isFinite(rate)
                                  ? rate < 100
                                    ? 'font-semibold text-red-700'
                                    : 'font-semibold text-emerald-800'
                                  : 'text-slate-400'
                              }
                            >
                              {rate != null && Number.isFinite(rate)
                                ? `${Math.round(rate)}%`
                                : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="font-semibold">조건에 맞는 프로젝트가 없습니다.</p>
            <p className="mt-2 text-sm text-slate-500">
              연도·검색 조건을 변경하거나 ‘전체 프로젝트’를 선택해 주세요.
            </p>
            {focus !== 'all' && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => selectFocus('all')}
              >
                전체 프로젝트 보기
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
