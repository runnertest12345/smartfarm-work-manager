'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FARM_WORK_TYPE_LABELS, type FarmWorkItem } from '@/lib/farm-types';
import {
  buildWorkDisplayGroups,
  type WorkDisplayGroup,
} from '@/lib/work-hierarchy';

const GROUP_LIMIT = 8;

export function ProjectWorkTree({
  items,
  matchedItems,
  searching,
  expanded,
  onToggleExpanded,
  onOpen,
  renderStatus,
  renderDueDate,
  latestAction,
  farmName,
}: {
  items: FarmWorkItem[];
  matchedItems: FarmWorkItem[];
  searching: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpen: (item: FarmWorkItem) => void;
  renderStatus: (item: FarmWorkItem) => ReactNode;
  renderDueDate: (item: FarmWorkItem) => ReactNode;
  latestAction: (item: FarmWorkItem) => string;
  farmName: (item: FarmWorkItem) => string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = buildWorkDisplayGroups(items, matchedItems);
  const visible = expanded ? groups : groups.slice(0, GROUP_LIMIT);

  function renderRows(
    node: WorkDisplayGroup,
    depth: number,
    parentTitle = '',
  ): ReactNode[] {
    const { item, children } = node;
    // Search always exposes matching descendants with their ancestor path.
    const open = searching || !collapsed.has(item.id);
    const child = depth > 0 || Boolean(item.parentWorkItemId);
    const summary = latestAction(item) || item.nextAction || '처리 내용 없음';
    const farm = farmName(item);
    const row = (
      <TableRow
        key={item.id}
        data-work-id={item.id}
        data-work-depth={depth}
        data-parent-work-id={item.parentWorkItemId || undefined}
        // Keep the family divider when the table primitive removes a final row's borders.
        style={depth ? undefined : { borderTopWidth: 2 }}
        className={
          depth
            ? 'border-[#e3e9e5] bg-white hover:bg-[#f2f7f4] has-aria-expanded:bg-white'
            : 'border-t-2 border-t-[#d2dfd7] bg-[#edf5ef] hover:bg-[#e4f0e8] has-aria-expanded:bg-[#edf5ef]'
        }
      >
        <TableCell className="px-3 py-3 align-top whitespace-normal">
          <div
            style={{ marginLeft: `${Math.min(depth, 3) * 20}px` }}
            className={depth ? 'relative border-l-2 border-[#98b7a4] pl-3' : ''}
          >
            <div className="flex items-start gap-1">
              {children.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`${item.title} 세부 업무 ${searching ? '검색 중 펼침' : open ? '접기' : '펼치기'}`}
                  disabled={searching}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#3f7052] hover:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-70"
                >
                  {open ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center text-[#739681]"
                  aria-hidden="true"
                >
                  {child && <CornerDownRight className="size-4" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  aria-label={`${item.title} 업무 상세 열기`}
                  className={`min-h-8 break-words text-left text-base text-[#213f2e] hover:underline focus-visible:outline-2 focus-visible:outline-emerald-700 ${depth ? 'font-medium' : 'font-semibold'}`}
                >
                  {item.title}
                </button>
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#60746a]">
                  <span>
                    {child
                      ? depth > 1
                        ? `세부 업무 · ${depth}단계`
                        : '세부 업무'
                      : '하위 업무'}
                  </span>
                  {children.length > 0 && (
                    <span>
                      {searching ? '검색된 세부' : '세부'} {children.length}건
                    </span>
                  )}
                  {farm && <span>{farm}</span>}
                  <span>{FARM_WORK_TYPE_LABELS[item.workType]}</span>
                </div>
                {parentTitle && (
                  <span className="sr-only">상위 업무: {parentTitle}</span>
                )}
                {!depth && item.parentWorkItemId && (
                  <p className="mt-1 text-xs text-amber-800">
                    상위 업무 연결 확인 필요
                  </p>
                )}
                {!node.matched && (
                  <p className="mt-1 text-xs text-[#52735e]">
                    검색된 세부 업무의 상위 업무
                  </p>
                )}
                {node.missingChildren > 0 && (
                  <p className="mt-1 text-xs text-amber-800">
                    세부 업무 {node.missingChildren}건을 아직 불러오지
                    못했습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="px-3 py-3 align-top">
          {renderStatus(item)}
        </TableCell>
        <TableCell className="break-words px-3 py-3 align-top text-sm whitespace-normal">
          {item.owner || '미지정'}
        </TableCell>
        <TableCell className="px-3 py-3 align-top text-sm whitespace-normal">
          {renderDueDate(item)}
        </TableCell>
        <TableCell className="px-3 py-3 align-top whitespace-normal">
          <p
            className="line-clamp-2 break-words text-sm leading-6 text-[#4d6054]"
            title={summary}
          >
            {summary}
          </p>
        </TableCell>
      </TableRow>
    );
    return [
      row,
      ...(open
        ? children.flatMap((child) => renderRows(child, depth + 1, item.title))
        : []),
    ];
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-500 lg:hidden">
        표를 좌우로 이동하면 최근 처리 내용까지 확인할 수 있습니다.
      </p>
      <Table
        aria-label="프로젝트 하위 업무와 세부 업무"
        className="min-w-[1000px] table-fixed"
        containerClassName="rounded-xl border border-[#d8e2da] bg-white"
      >
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[16%]" />
          <col className="w-[28%]" />
        </colgroup>
        <TableHeader className="bg-[#f5f7f5]">
          <TableRow className="hover:bg-transparent">
            {['업무명', '상태', '담당자', '기한', '최근 처리 내용'].map(
              (label) => (
                <TableHead
                  key={label}
                  scope="col"
                  className="px-3 py-3 text-sm font-semibold text-[#425b4a]"
                >
                  {label}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        {visible.map((node) => (
          <TableBody
            key={node.item.id}
            data-work-group={node.item.id}
            aria-label={`${node.item.title} 업무 묶음`}
          >
            {renderRows(node, 0)}
          </TableBody>
        ))}
      </Table>
      {groups.length > GROUP_LIMIT && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="min-h-10 w-full rounded-lg border border-dashed border-[#cfd9ce] py-2.5 text-sm font-semibold text-[#39795b] hover:bg-[#f2f8f2]"
        >
          {expanded
            ? '하위 업무 묶음 접기'
            : `나머지 하위 업무 ${groups.length - GROUP_LIMIT}개 묶음 더 보기`}
        </button>
      )}
    </div>
  );
}
