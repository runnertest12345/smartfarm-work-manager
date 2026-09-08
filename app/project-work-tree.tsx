'use client';

import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderOpen,
} from 'lucide-react';
import type { FarmWorkItem } from '@/lib/farm-types';
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
  renderItem,
}: {
  items: FarmWorkItem[];
  matchedItems: FarmWorkItem[];
  searching: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  renderItem: (item: FarmWorkItem) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = buildWorkDisplayGroups(items, matchedItems);
  const visible = expanded ? groups : groups.slice(0, GROUP_LIMIT);

  function renderGroup(node: WorkDisplayGroup, depth: number): ReactNode {
    const { item, children } = node;
    // Search results must remain visible even if an ancestor was collapsed before searching.
    const open = searching || !collapsed.has(item.id);
    const child = depth > 0 || Boolean(item.parentWorkItemId);
    return (
      <li
        key={item.id}
        data-work-id={item.id}
        data-work-depth={depth}
        className={
          depth
            ? `relative min-w-0 rounded-xl border border-[#d4e3d9] bg-[#f6faf7] before:absolute before:-left-4 before:top-6 before:h-px before:w-4 before:bg-[#91b8a0] sm:before:-left-6 sm:before:w-6 ${depth > 4 ? 'before:hidden' : depth > 2 ? 'before:hidden sm:before:block' : ''}`
            : 'min-w-0 overflow-hidden rounded-xl border border-[#cddcd2] bg-white shadow-sm'
        }
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs ${depth ? 'text-[#52735e]' : 'border-b border-[#e3ece6] bg-[#edf5ef] text-[#285c3d]'}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-semibold">
            {child ? (
              <CornerDownRight className="size-4 shrink-0" />
            ) : (
              <FolderOpen className="size-4 shrink-0" />
            )}
            <span>
              {child
                ? depth > 1
                  ? `세부 업무 · ${depth}단계`
                  : '세부 업무'
                : '하위 업무'}
            </span>
            {!depth && item.parentWorkItemId && (
              <span className="font-normal text-amber-800">
                상위 업무 연결 확인 필요
              </span>
            )}
            {!node.matched && (
              <span className="font-normal">검색된 세부 업무의 상위 업무</span>
            )}
          </div>
          {children.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`project-task-children-${item.id}`}
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
              className="flex min-h-8 items-center gap-1 rounded-md px-2 font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-70"
            >
              {open ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              {searching ? '검색된 세부 업무' : '세부 업무'} {children.length}건
              · {searching ? '검색 중 펼침' : open ? '접기' : '펼치기'}
            </button>
          )}
        </div>
        {renderItem(item)}
        {node.missingChildren > 0 && (
          <p className="px-3 pb-3 text-xs text-amber-800">
            세부 업무 {node.missingChildren}건을 아직 불러오지 못했습니다.
          </p>
        )}
        {children.length > 0 && (
          <div
            id={`project-task-children-${item.id}`}
            hidden={!open}
            className={`border-t border-[#e1eae4] bg-[#f0f6f2] ${depth < 2 ? 'p-3 sm:p-4' : depth < 4 ? 'p-0 pt-3 sm:p-4' : 'p-0 pt-3'}`}
          >
            <p className="mb-3 flex items-center gap-1 text-xs font-semibold text-[#52735e]">
              <CornerDownRight className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                ‘{item.title}’에 속한 세부 업무
              </span>
            </p>
            <ul
              aria-label={`${item.title}의 세부 업무`}
              className={
                depth < 2
                  ? 'ml-1 space-y-3 border-l-2 border-[#91b8a0] pl-4 sm:ml-2 sm:pl-6'
                  : depth < 4
                    ? 'space-y-3 sm:ml-2 sm:border-l-2 sm:border-[#91b8a0] sm:pl-6'
                    : 'space-y-3'
              }
            >
              {children.map((node) => renderGroup(node, depth + 1))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <ul aria-label="프로젝트 하위 업무와 세부 업무" className="space-y-4">
        {visible.map((node) => renderGroup(node, 0))}
      </ul>
      {groups.length > GROUP_LIMIT && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="min-h-10 w-full rounded-xl border border-dashed border-[#cfd9ce] py-2.5 text-xs font-semibold text-[#39795b] hover:bg-[#f2f8f2]"
        >
          {expanded
            ? '하위 업무 묶음 접기'
            : `나머지 하위 업무 ${groups.length - GROUP_LIMIT}개 묶음 더 보기`}
        </button>
      )}
    </div>
  );
}
