'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  FARM_WORK_STATUSES,
  FARM_WORK_STATUS_LABELS,
  type FarmWorkItem,
  type FarmWorkStatus,
} from '@/lib/farm-types';
import { buildWorkBoardGroups } from '@/lib/work-board';
import { isHeadPriority } from '@/lib/project-work';

const statusColors: Record<FarmWorkStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-800',
  waiting: 'bg-amber-50 text-amber-900',
  completed: 'bg-emerald-50 text-emerald-800',
};

export function WorkBoard({
  items,
  allItems,
  searching = false,
  busy,
  dragged,
  over,
  savingId,
  projectLabel,
  onOpen,
  onEdit,
  onOver,
  onDrop,
  onDragStart,
  onDragEnd,
  handle,
  actions,
  historySummary,
  canEdit,
}: {
  items: FarmWorkItem[];
  allItems: FarmWorkItem[];
  searching?: boolean;
  busy: boolean;
  dragged: boolean;
  over: FarmWorkStatus | null;
  savingId: string;
  projectLabel: (item: FarmWorkItem) => string;
  onOpen: (item: FarmWorkItem, occurredAt: number) => void;
  onEdit: (item: FarmWorkItem, status?: FarmWorkStatus) => void;
  onOver: (status: FarmWorkStatus | null) => void;
  onDrop: (status: FarmWorkStatus, occurredAt: number) => void;
  onDragStart: (
    item: FarmWorkItem,
    event: DragEvent<HTMLElement>,
    occurredAt: number,
  ) => void;
  onDragEnd: (occurredAt: number) => void;
  handle: (item: FarmWorkItem) => ReactNode;
  actions: (item: FarmWorkItem) => ReactNode;
  historySummary: (item: FarmWorkItem) => ReactNode;
  canEdit: (item: FarmWorkItem) => boolean;
}) {
  const groups = buildWorkBoardGroups(allItems, items);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState<Set<string>>(new Set());
  const toggle = (id: string, open: boolean) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  const status = (
    value: FarmWorkStatus,
    label = FARM_WORK_STATUS_LABELS[value],
  ) => (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-sm font-medium ${statusColors[value]}`}
    >
      {label}
    </span>
  );
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      aria-label="상위 업무별 보드"
    >
      {FARM_WORK_STATUSES.map((column) => {
        const cards = groups.filter((group) => group.lane === column);
        return (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Each task also has a keyboard-accessible status editor.
          <section
            key={column}
            aria-label={`${FARM_WORK_STATUS_LABELS[column]} 열`}
            onDragOver={(event) => {
              if (dragged && !busy) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                onOver(column);
              }
            }}
            onDragLeave={(event) => {
              if (
                !(
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                )
              )
                onOver(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDrop(column, Date.now());
            }}
            className={`w-[min(360px,85vw)] shrink-0 rounded-xl border p-3 xl:flex-1 ${over === column ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500' : 'border-slate-200 bg-slate-50'}`}
          >
            <h2 className="mb-3 flex items-center justify-between gap-2 text-base font-semibold">
              {FARM_WORK_STATUS_LABELS[column]}
              <span className="text-sm font-normal text-slate-600">
                카드 {cards.length}개
              </span>
            </h2>
            <div className="space-y-3">
              {cards.map((group) => {
                const { item, rows, hasChildren } = group;
                const children = rows.slice(1);
                const matchedChildren = searching
                  ? children.filter((row) => row.matched).length
                  : 0;
                const isExpanded = expanded.has(item.id);
                const completeLabel = group.missing
                  ? '연결 확인 필요'
                  : group.needsConfirmation
                    ? '최종 확인 필요'
                    : FARM_WORK_STATUS_LABELS[group.lane];
                return (
                  // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Drag also has a keyboard-accessible status editor.
                  <article
                    key={item.id}
                    data-board-root={item.id}
                    draggable={!busy && canEdit(item)}
                    onDragStart={(event) => {
                      // Buttons inside expanded details retain their own interaction.
                      const target = event.target as HTMLElement;
                      if (
                        target.closest(
                          'button, a, input, textarea, select, [role="combobox"]',
                        ) &&
                        !target.closest('[data-work-title]')
                      ) {
                        event.preventDefault();
                        return;
                      }
                      onDragStart(item, event, Date.now());
                    }}
                    onDragEnd={() => onDragEnd(Date.now())}
                    className={`space-y-1 rounded-xl border bg-white p-3 ${rows.some((row) => isHeadPriority(row.item)) ? 'border-l-4 border-amber-600' : 'border-slate-200'} ${savingId && rows.some((row) => row.item.id === savingId) ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {handle(item)}
                      <div className="min-w-0 flex-1">
                        <p
                          className="break-words text-sm text-emerald-800"
                          data-board-context={item.id}
                        >
                          {projectLabel(item)}
                        </p>
                        <button
                          type="button"
                          data-work-title
                          aria-label={`${item.title} 업무 상세 열기`}
                          disabled={busy}
                          onClick={() => onOpen(item, Date.now())}
                          title={item.title}
                          className="min-h-9 w-full cursor-grab break-words text-left text-base font-semibold hover:text-emerald-800 hover:underline active:cursor-grabbing"
                        >
                          {item.title}
                        </button>
                      </div>
                    </div>
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={(open) => toggle(item.id, open)}
                    >
                      <CollapsibleTrigger
                        aria-label={`${item.title} 상세 ${isExpanded ? '접기' : '보기'}`}
                        className="flex min-h-10 w-full items-center gap-1 text-left text-sm font-medium text-emerald-800"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                        {isExpanded ? '상세 접기' : '상세 보기'}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {isExpanded && (
                          <div
                            className="space-y-3 border-t border-slate-200 pt-3"
                            data-board-details={item.id}
                          >
                            {rows.some((row) => isHeadPriority(row.item)) && (
                              <p className="rounded-md bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-900">
                                부서장 지시 · 최우선
                              </p>
                            )}
                            {status(group.lane, completeLabel)}
                            <p className="text-sm text-slate-600">
                              총괄 {item.owner || '미지정'} · 마감{' '}
                              {item.dueDate || '미지정'}
                            </p>
                            {hasChildren && (
                              <p
                                className="text-sm text-slate-600"
                                aria-label="세부 업무 진행 요약"
                              >
                                완료 {group.counts.completed}/{group.total} ·
                                처리 중 {group.counts.in_progress} · 대기{' '}
                                {group.counts.waiting}
                              </p>
                            )}
                            {group.waiting.length > 0 && (
                              <p className="text-sm font-medium text-amber-900">
                                대기 사유 {group.waiting.length}건
                              </p>
                            )}
                            {matchedChildren > 0 && (
                              <p className="text-sm text-blue-800">
                                조건에 맞는 세부 업무 {matchedChildren}건 ·
                                상세에서 확인
                              </p>
                            )}
                            {group.needsConfirmation && (
                              <div className="space-y-2 text-sm text-emerald-950">
                                <p>
                                  {group.readyToConfirm
                                    ? '세부 업무 완료 · 총괄 담당자의 최종 확인이 필요합니다.'
                                    : group.confirmations.length
                                      ? `중간 상위 업무 ${group.confirmations.length}건의 완료 확인이 남아 있습니다.`
                                      : '완료 연결 정보를 확인해 주세요.'}
                                </p>
                                {group.readyToConfirm && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={busy || !canEdit(item)}
                                    onClick={() => onEdit(item, 'completed')}
                                  >
                                    상위 업무 완료 확인
                                  </Button>
                                )}
                              </div>
                            )}
                            {actions(item)}

                            {hasChildren && (
                              <>
                                <div
                                  className="flex flex-wrap gap-1.5"
                                  aria-label="세부 실행 업무 상태별 개수"
                                >
                                  {FARM_WORK_STATUSES.map((key) => (
                                    <span
                                      key={key}
                                      className={`rounded-md px-2 py-1 text-sm ${statusColors[key]}`}
                                    >
                                      {FARM_WORK_STATUS_LABELS[key]}{' '}
                                      {group.counts[key]}
                                    </span>
                                  ))}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm text-slate-600">
                                    세부 실행 업무 {group.counts.completed}/
                                    {group.total}개 완료
                                    {children.some((row) => row.depth > 1)
                                      ? ' · 최하위 업무 기준'
                                      : ''}
                                  </p>
                                  {group.rate !== null && (
                                    <Progress
                                      value={group.rate}
                                      aria-label="세부 실행 업무 완료 비율"
                                    />
                                  )}
                                </div>
                                {group.missing && (
                                  <output className="block text-sm text-amber-900">
                                    일부 업무 연결이나 완료 상태를 확인해야
                                    합니다. 전체 완료로 집계하지 않습니다.
                                  </output>
                                )}
                              </>
                            )}
                            {group.active.length > 0 ? (
                              <div
                                className="space-y-1 text-sm"
                                aria-label="현재 처리 중인 업무"
                              >
                                <p className="font-medium text-blue-800">
                                  현재 처리 중 {group.active.length}건
                                </p>
                                {group.active.map((task) => (
                                  <button
                                    key={task.id}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onOpen(task, Date.now())}
                                    className="block min-h-9 w-full break-words text-left hover:underline"
                                  >
                                    {task.title} · {task.owner || '담당 미지정'}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              hasChildren &&
                              !group.needsConfirmation &&
                              item.status !== 'completed' && (
                                <p className="text-sm text-slate-600">
                                  현재 처리 중인 세부 실행 업무 없음
                                </p>
                              )
                            )}
                            {group.waiting.length > 0 && (
                              <div
                                className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
                                aria-label="대기 업무와 사유"
                              >
                                <p className="font-medium">
                                  대기 사유 {group.waiting.length}건
                                </p>
                                {group.waiting.map((task) => (
                                  <div key={task.id}>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => onOpen(task, Date.now())}
                                      className="min-h-9 break-words text-left font-medium hover:underline"
                                    >
                                      {task.title}
                                    </button>
                                    <p className="break-words">
                                      {task.blockedReason || '대기 사유 미입력'}
                                    </p>
                                    <p className="mt-1 break-words">
                                      확인 대상 {task.blockedBy || '미지정'} ·
                                      담당 {task.owner || '미지정'} · 확인일{' '}
                                      {task.expectedUnblockDate ||
                                        task.reviewDate ||
                                        '미지정'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.nextAction && (
                              <p className="break-words text-sm text-slate-600">
                                다음: {item.nextAction}
                              </p>
                            )}
                            {historySummary(item)}
                            {hasChildren && item.status === 'completed' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy || !canEdit(item)}
                                onClick={() => onEdit(item, 'in_progress')}
                              >
                                상위 업무 다시 열기
                              </Button>
                            )}
                            {children.length > 0 && (
                              <div>
                                <h3 className="text-sm font-semibold">
                                  세부 업무 {children.length}개
                                </h3>
                                <div className="mb-2 flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    aria-pressed={showHistory.has(item.id)}
                                    onClick={() =>
                                      setShowHistory((previous) => {
                                        const next = new Set(previous);
                                        if (next.has(item.id))
                                          next.delete(item.id);
                                        else next.add(item.id);
                                        return next;
                                      })
                                    }
                                  >
                                    {showHistory.has(item.id)
                                      ? '처리 내용 접기'
                                      : '처리 내용 함께 보기'}
                                  </Button>
                                </div>
                                <ol
                                  className="space-y-3 border-l-2 border-emerald-200 pl-3"
                                  aria-label={`${item.title} 세부 업무`}
                                >
                                  {children.map(
                                    ({ item: child, depth, matched }) => (
                                      <li
                                        key={child.id}
                                        data-board-task={child.id}
                                        data-work-depth={depth}
                                        style={{
                                          marginLeft: `${Math.min(depth - 1, 2) * 12}px`,
                                        }}
                                        className={`space-y-2 border-b border-slate-200 pb-3 last:border-0 ${searching && matched ? 'rounded-md bg-blue-50 p-2' : ''}`}
                                      >
                                        <div className="flex items-start gap-1">
                                          {handle(child)}
                                          <div className="min-w-0 flex-1">
                                            {depth > 1 && (
                                              <p className="break-words text-xs text-slate-600">
                                                ↳ {depth}단계 · 상위{' '}
                                                {rows.find(
                                                  (row) =>
                                                    row.item.id ===
                                                    child.parentWorkItemId,
                                                )?.item.title || '확인 필요'}
                                              </p>
                                            )}
                                            <button
                                              type="button"
                                              aria-label={`${child.title} 업무 상세 열기`}
                                              disabled={busy}
                                              onClick={() =>
                                                onOpen(child, Date.now())
                                              }
                                              className="min-h-9 w-full break-words text-left text-base font-medium hover:text-emerald-800 hover:underline"
                                            >
                                              {child.title}
                                            </button>
                                            <p className="break-words text-sm text-slate-600">
                                              {child.owner || '담당 미지정'} ·{' '}
                                              {child.dueDate || '기한 미지정'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Select
                                            value={child.status}
                                            disabled={busy || !canEdit(child)}
                                            onValueChange={(value) => {
                                              if (
                                                FARM_WORK_STATUSES.includes(
                                                  value as FarmWorkStatus,
                                                ) &&
                                                value !== child.status
                                              )
                                                onEdit(
                                                  child,
                                                  value as FarmWorkStatus,
                                                );
                                            }}
                                          >
                                            <SelectTrigger
                                              aria-label={`${child.title} 상태 수정`}
                                              className="h-10 w-auto min-w-28 bg-white"
                                            >
                                              <SelectValue>
                                                {
                                                  FARM_WORK_STATUS_LABELS[
                                                    child.status
                                                  ]
                                                }
                                              </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                              {FARM_WORK_STATUSES.map(
                                                (value) => (
                                                  <SelectItem
                                                    key={value}
                                                    value={value}
                                                  >
                                                    {
                                                      FARM_WORK_STATUS_LABELS[
                                                        value
                                                      ]
                                                    }
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                          {actions(child)}
                                        </div>
                                        {!canEdit(child) && (
                                          <p className="text-sm text-slate-600">
                                            완료된 사업 또는 상위 업무의 상태
                                            변경은 잠겨 있습니다. 처리 내용은
                                            빠른 수정에서 남길 수 있습니다.
                                          </p>
                                        )}
                                        {showHistory.has(item.id) &&
                                          historySummary(child)}
                                      </li>
                                    ),
                                  )}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </article>
                );
              })}
              {!cards.length && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                  이 상태의 상위 업무가 없습니다.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
