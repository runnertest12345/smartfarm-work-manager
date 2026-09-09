'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectFarmProgress } from '@/lib/project-farm-progress';

export function ProjectStageFigures({
  stage,
}: {
  stage: ProjectFarmProgress['stages'][number];
}) {
  return (
    <div aria-label={`${stage.label} 농가 진행 현황`}>
      <p className="text-sm font-semibold text-slate-600">{stage.label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800">
        {stage.rate === null ? '-' : `${stage.rate}%`}
      </p>
      <p className="mt-2 text-sm tabular-nums text-slate-600">
        완료 {stage.completed}개소
      </p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${stage.remaining ? 'text-amber-800' : 'text-slate-600'}`}
      >
        미완료 {stage.remaining}개소
      </p>
    </div>
  );
}

export function ProjectFarmProgressCard({
  progress,
  farmName,
}: {
  progress: ProjectFarmProgress;
  farmName: (farmId: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <section
      aria-label="농가 진행상황"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">
            농가 진행상황{' '}
            <span className="ml-2 text-sm font-medium text-slate-600">
              참여 {progress.total}개소
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            완료율 = 완료일이 입력된 농가 ÷ 참여 농가. 완료일이 없으면 미완료로
            집계합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '세부 접기' : '세부 보기'}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {progress.stages.map((stage) => (
          <div
            key={stage.key}
            className="rounded-xl border border-slate-200 p-4"
          >
            <ProjectStageFigures stage={stage} />
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${stage.rate ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {!progress.total && (
        <p className="mt-3 text-sm text-slate-600">
          참여 농가를 등록하면 설치·시운전·교육 진행률이 표시됩니다.
        </p>
      )}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent id={detailsId}>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="mb-3 text-base font-semibold">
              농가별 설치·시운전·교육 현황 · {progress.total}개소
            </h3>
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>농가</TableHead>
                  <TableHead>작목</TableHead>
                  <TableHead>설치</TableHead>
                  <TableHead>시운전</TableHead>
                  <TableHead>교육</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {farmName(record.farmId)}
                    </TableCell>
                    <TableCell>{record.crop || '미입력'}</TableCell>
                    {progress.stages.map((stage) => (
                      <TableCell
                        key={stage.key}
                        className={
                          record[stage.key]
                            ? 'text-emerald-800'
                            : 'font-semibold text-amber-800'
                        }
                      >
                        {record[stage.key] ? (
                          <>
                            <span className="block">완료</span>
                            <span className="text-sm">{record[stage.key]}</span>
                          </>
                        ) : (
                          '미완료'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!progress.total && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-slate-500"
                    >
                      등록된 참여 농가가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
