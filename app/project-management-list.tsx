'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
  riskCount: number;
  riskLabel: string;
};
type Focus = 'all' | 'active' | 'completed' | 'attention';

export function ProjectManagementList({
  rows,
  onOpen,
}: {
  rows: ProjectManagementRow[];
  onOpen: (id: string) => void;
}) {
  const [focus, setFocus] = useState<Focus>('all');
  const completed = rows.filter((row) => row.status === 'completed').length;
  const onHold = rows.filter((row) => row.status === 'on_hold').length;
  const metrics: { key: Focus; label: string; value: number; note: string }[] =
    [
      {
        key: 'all',
        label: '전체 프로젝트',
        value: rows.length,
        note: `보류 ${onHold}개 포함`,
      },
      {
        key: 'active',
        label: '진행 중',
        value: rows.filter((row) => row.status === 'active').length,
        note: '현재 진행 중인 프로젝트',
      },
      {
        key: 'completed',
        label: '완료',
        value: completed,
        note: rows.length
          ? `프로젝트 완료율 ${Math.round((completed / rows.length) * 100)}%`
          : '프로젝트 완료율 -',
      },
      {
        key: 'attention',
        label: '확인 필요',
        value: rows.filter((row) => row.riskCount > 0).length,
        note: '막힘·서류·구독·정산 확인',
      },
    ];
  const visible = rows.filter(
    (row) =>
      focus === 'all' ||
      (focus === 'attention' ? row.riskCount > 0 : row.status === focus),
  );
  const selected = metrics.find((metric) => metric.key === focus)!;
  return (
    <div className="space-y-5">
      <section aria-label="프로젝트 관리 핵심 요약">
        <p className="mb-2 text-xs text-slate-500">
          위 조회 조건 기준 · 요약을 누르면 해당 프로젝트만 표시합니다.
        </p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              aria-pressed={focus === metric.key}
              onClick={() => setFocus(metric.key)}
              className={`rounded-xl border bg-white p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${focus === metric.key ? 'border-emerald-700 ring-1 ring-emerald-700' : 'border-slate-200 hover:border-emerald-300'}`}
            >
              <p className="text-sm font-medium text-slate-600">
                {metric.label}
              </p>
              <p
                className={`mt-2 text-2xl font-bold tabular-nums ${metric.key === 'attention' && metric.value ? 'text-amber-800' : 'text-slate-900'}`}
              >
                {metric.value}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  개
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-500">{metric.note}</p>
            </button>
          ))}
        </div>
      </section>
      <section
        aria-label="프로젝트 목록"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold" role="status">
            {selected.label} · {visible.length}개
          </h2>
          <p className="text-xs text-slate-500">
            프로젝트명 선택 → 설치·교육·서류·정산 상세
          </p>
        </div>
        {visible.length ? (
          <Table className="min-w-[720px] table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[34%]">프로젝트</TableHead>
                <TableHead className="w-[120px]">상태 · 단계</TableHead>
                <TableHead className="w-[100px]">담당자</TableHead>
                <TableHead className="w-[80px]">농가</TableHead>
                <TableHead>확인 필요</TableHead>
                <TableHead className="w-[60px]">
                  <span className="sr-only">상세 열기</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="py-3 whitespace-normal">
                    <button
                      type="button"
                      className="text-left font-semibold break-words text-emerald-800 hover:underline"
                      onClick={() => onOpen(row.id)}
                    >
                      {row.name}
                    </button>
                    <p
                      className="mt-1 truncate text-xs text-slate-500"
                      title={row.context}
                    >
                      {row.context}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={row.statusClass}>
                      {row.statusLabel}
                    </Badge>
                    <p className="mt-1 text-xs whitespace-normal text-slate-500">
                      {row.stageLabel}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words">
                    {row.manager || '미지정'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.farmCount}개소
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <p
                      className={`line-clamp-2 text-xs break-words ${row.riskCount ? 'text-amber-800' : 'text-slate-400'}`}
                      title={row.riskLabel}
                    >
                      {row.riskCount ? row.riskLabel : '없음'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${row.name} 프로젝트 상세`}
                      onClick={() => onOpen(row.id)}
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="font-semibold">조건에 맞는 프로젝트가 없습니다.</p>
            <p className="mt-2 text-sm text-slate-500">
              연도·검색 조건을 변경하거나 ‘전체 프로젝트’를 선택해 주세요.
            </p>
            {focus !== 'all' && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setFocus('all')}
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
