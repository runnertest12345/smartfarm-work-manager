'use client';

import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import {
  FARM_WORK_STATUSES,
  FARM_WORK_STATUS_LABELS,
  type FarmWorkItem,
  type FarmWorkStatus,
} from '@/lib/farm-types';
import { buildWorkBoardGroups } from '@/lib/work-board';
import { isHeadPriority } from '@/lib/project-work';

const childStatusClasses: Record<FarmWorkStatus, string> = {
  open: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-50 text-blue-700',
  waiting: 'bg-amber-100 text-amber-900',
  completed: 'bg-emerald-50 text-emerald-700',
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
  onOver,
  onDrop,
  onDragStart,
  onDragEnd,
  handle,
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
  const boardId = useId();
  const [expandedChildren, setExpandedChildren] = useState<
    Record<string, boolean>
  >({});
  const groups = buildWorkBoardGroups(allItems, items);
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      aria-label="상위 업무별 보드"
    >
      {FARM_WORK_STATUSES.map((column) => {
        const cards = groups.filter((group) => group.lane === column);
        return (
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Each task has a keyboard-accessible detail popup with a status editor.
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
                const waitingChildren = group.waiting.filter(
                  (task) => task.id !== item.id,
                );
                // Keep parents immediately before descendants so indentation reflects real links.
                const childrenExpanded = Boolean(expandedChildren[item.id]);
                const childListId = `${boardId}-children-${item.id}`;
                const familyById = new Map(
                  rows.map((row) => [row.item.id, row.item]),
                );
                const priority = rows.some((row) => isHeadPriority(row.item));
                return (
                  // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Drag also has a keyboard-accessible status editor in the detail popup.
                  <article
                    key={item.id}
                    data-board-root={item.id}
                    draggable={!busy && canEdit(item)}
                    onDragStart={(event) => {
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
                    className={`space-y-3 rounded-xl border bg-white p-3 shadow-sm ${priority ? 'border-l-4 border-amber-600' : 'border-slate-200'} ${savingId && rows.some((row) => row.item.id === savingId) ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {handle(item)}
                      <div className="min-w-0 flex-1">
                        <p
                          className="break-words text-sm text-slate-500"
                          data-board-context={item.id}
                        >
                          {projectLabel(item)}
                        </p>
                        <button
                          type="button"
                          data-work-title
                          aria-label={`${item.title} 업무 상세 열기`}
                          aria-haspopup="dialog"
                          disabled={busy}
                          onClick={() => onOpen(item, Date.now())}
                          title={item.title}
                          className="min-h-9 w-full cursor-grab rounded-sm break-words text-left text-base font-semibold hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:cursor-grabbing"
                        >
                          {item.title}
                        </button>
                      </div>
                    </div>
                    {priority && (
                      <p className="w-fit rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                        부서장 지시 · 최우선
                      </p>
                    )}
                    <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">담당자</dt>
                        <dd className="mt-1 break-words font-medium text-slate-700">
                          {item.owner || '미지정'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-500">기한</dt>
                        <dd className="mt-1 font-medium tabular-nums text-slate-700">
                          {item.dueDate ? (
                            <time dateTime={item.dueDate}>{item.dueDate}</time>
                          ) : (
                            '미지정'
                          )}
                        </dd>
                      </div>
                    </dl>
                    {group.missing ? (
                      <output
                        className="block rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-900"
                        data-board-connection={item.id}
                      >
                        업무 연결 확인 필요 · 완료율 집계 제외
                      </output>
                    ) : hasChildren ? (
                      <div
                        className="space-y-1.5"
                        aria-label="하위 실행 업무 진행 요약"
                      >
                        <p className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-600">
                            하위 실행 업무 {group.counts.completed}/
                            {group.total} 완료
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${group.rate === 100 ? 'text-emerald-700' : 'text-red-600'}`}
                          >
                            {group.rate === null ? '—' : `${group.rate}%`}
                          </span>
                        </p>
                        {group.rate !== null && (
                          <Progress
                            value={group.rate}
                            aria-label="하위 실행 업무 완료율"
                            className="h-1.5"
                          />
                        )}
                      </div>
                    ) : null}
                    {waitingChildren.length > 0 ? (
                      <p
                        className="rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-900"
                        data-board-waiting={item.id}
                      >
                        하위 대기·막힘 {waitingChildren.length}건 · 상위{' '}
                        {FARM_WORK_STATUS_LABELS[item.status]}
                        {!childrenExpanded && (
                          <span
                            data-board-blocker-names={item.id}
                            className="mt-1 block line-clamp-2 break-words text-xs"
                            title={waitingChildren
                              .map((task) => task.title)
                              .join(' · ')}
                          >
                            막힌 업무:{' '}
                            {waitingChildren
                              .slice(0, 2)
                              .map((task) => task.title)
                              .join(' · ')}
                            {waitingChildren.length > 2
                              ? ` 외 ${waitingChildren.length - 2}개`
                              : ''}
                          </span>
                        )}
                      </p>
                    ) : item.status === 'waiting' ? (
                      <p className="rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
                        이 업무 대기·막힘
                      </p>
                    ) : null}
                    {children.length > 0 && (
                      <div className="border-t border-slate-100 pt-3">
                        <h3>
                          <button
                            type="button"
                            data-board-children-toggle={item.id}
                            aria-label={`${item.title} 하위 업무 ${childrenExpanded ? '접기' : '펼치기'}`}
                            aria-expanded={childrenExpanded}
                            aria-controls={childListId}
                            onClick={() =>
                              setExpandedChildren((current) => ({
                                ...current,
                                [item.id]: !current[item.id],
                              }))
                            }
                            className="flex min-h-9 w-full items-center gap-1.5 rounded-md px-1 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          >
                            <span
                              aria-hidden="true"
                              className="w-3 text-slate-500"
                            >
                              {childrenExpanded ? '▾' : '▸'}
                            </span>
                            <span>하위 업무 {children.length}개</span>
                            <span className="ml-auto font-normal text-slate-500">
                              {childrenExpanded ? '접기' : '펼치기'}
                            </span>
                          </button>
                        </h3>
                        <div id={childListId} hidden={!childrenExpanded}>
                          {childrenExpanded && (
                            <ul
                              aria-label="하위 업무 목록"
                              className="mt-2 max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1"
                            >
                              {children.map(({ item: child, depth }) => {
                                const waiting = child.status === 'waiting';
                                const parent = familyById.get(
                                  child.parentWorkItemId || '',
                                );
                                return (
                                  <li
                                    key={child.id}
                                    data-board-task={child.id}
                                    data-board-depth={depth}
                                    style={{
                                      marginLeft:
                                        Math.min(Math.max(depth - 1, 0), 4) *
                                        16,
                                    }}
                                    className={`relative rounded-md border-l-2 px-2 py-2 ${waiting ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50/70'}`}
                                  >
                                    {depth > 1 && (
                                      <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute -left-[9px] top-4 w-2 border-t border-slate-300"
                                      />
                                    )}
                                    <div className="flex items-start gap-2">
                                      <button
                                        type="button"
                                        aria-label={`${child.title} 하위 업무 상세 열기`}
                                        aria-haspopup="dialog"
                                        disabled={busy}
                                        onClick={() =>
                                          onOpen(child, Date.now())
                                        }
                                        title={child.title}
                                        className="min-h-8 min-w-0 flex-1 rounded-sm text-left text-sm font-medium text-slate-800 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
                                      >
                                        <span className="line-clamp-2 break-words">
                                          <span
                                            aria-hidden="true"
                                            className="mr-1 text-slate-400"
                                          >
                                            ↳
                                          </span>
                                          {child.title}
                                        </span>
                                      </button>
                                      <span
                                        className={`mt-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${childStatusClasses[child.status]}`}
                                      >
                                        {FARM_WORK_STATUS_LABELS[child.status]}
                                      </span>
                                    </div>
                                    {depth > 1 && (
                                      <p
                                        className="mb-1 line-clamp-1 break-words text-xs text-slate-500"
                                        title={`하위 ${depth}단계 · 상위: ${parent?.title || '연결 확인 필요'}`}
                                      >
                                        하위 {depth}단계 · 상위:{' '}
                                        {parent?.title || '연결 확인 필요'}
                                      </p>
                                    )}
                                    {waiting && (
                                      <div className="mt-1 space-y-1 text-xs text-amber-900">
                                        <p
                                          className="line-clamp-2 whitespace-pre-wrap break-words"
                                          title={
                                            child.blockedReason ||
                                            '막힘 사유 미입력'
                                          }
                                        >
                                          사유:{' '}
                                          {child.blockedReason ||
                                            '막힘 사유 미입력'}
                                        </p>
                                        <p
                                          className="line-clamp-1 break-words text-amber-800"
                                          title={
                                            child.blockedBy ||
                                            '확인 대상 미지정'
                                          }
                                        >
                                          확인 대상:{' '}
                                          {child.blockedBy ||
                                            '확인 대상 미지정'}
                                        </p>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                    {group.needsConfirmation && (
                      <p
                        className="text-sm font-medium text-emerald-800"
                        data-board-confirmation={item.id}
                      >
                        {group.readyToConfirm
                          ? '하위 완료 · 상위 완료 확인 필요'
                          : group.confirmations.length
                            ? `중간 상위 업무 ${group.confirmations.length}건 완료 확인 필요`
                            : '완료 연결 확인 필요'}
                      </p>
                    )}
                    {matchedChildren > 0 && (
                      <p
                        className="text-xs text-blue-800"
                        data-board-search={item.id}
                      >
                        검색 일치 하위 업무 {matchedChildren}건 · 제목을 눌러
                        확인
                      </p>
                    )}
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
