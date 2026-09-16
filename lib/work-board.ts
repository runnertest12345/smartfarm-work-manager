import type { FarmWorkItem, FarmWorkStatus } from './farm-types';
import { sameWorkContext } from './project-work';
import {
  buildWorkDisplayGroups,
  type WorkDisplayGroup,
} from './work-hierarchy';

export type BoardTaskRow = {
  item: FarmWorkItem;
  depth: number;
  matched: boolean;
};
export type WorkBoardGroup = {
  item: FarmWorkItem;
  rows: BoardTaskRow[];
  hasChildren: boolean;
  counts: Record<FarmWorkStatus, number>;
  total: number;
  rate: number | null;
  lane: FarmWorkStatus;
  active: FarmWorkItem[];
  waiting: FarmWorkItem[];
  missing: boolean;
  confirmations: FarmWorkItem[];
  readyToConfirm: boolean;
  needsConfirmation: boolean;
};

/** Move only the dragged task; completion still requires every child to finish. */
export function workBoardDropIntent(
  group: WorkBoardGroup,
  target: FarmWorkStatus,
) {
  if (group.missing) return 'blocked';
  if (group.item.status === target) return 'none';
  if (!group.hasChildren) return 'move';
  if (group.item.status === 'completed') return 'reopen';
  if (target === 'completed')
    return group.readyToConfirm ? 'confirm' : 'incomplete';
  return 'move';
}

/** The board is a projection only. Never rewrite parent or child statuses here. */
export function buildWorkBoardGroups(
  allItems: FarmWorkItem[],
  matchedItems = allItems,
): WorkBoardGroup[] {
  const byId = new Map(allItems.map((item) => [item.id, item]));
  const ranks = new Map(matchedItems.map((item, index) => [item.id, index]));
  const families = buildWorkDisplayGroups(allItems)
    .map((node) => {
      const rows: BoardTaskRow[] = [];
      const parents = new Set<string>();
      const visit = (group: WorkDisplayGroup, depth: number) => {
        rows.push({
          item: group.item,
          depth,
          matched: ranks.has(group.item.id),
        });
        if (group.children.length || group.item.childWorkItemIds?.length)
          parents.add(group.item.id);
        group.children.forEach((child) => visit(child, depth + 1));
      };
      visit(node, 0);
      return {
        rows,
        parents,
        rank: Math.min(
          ...rows.map((row) => ranks.get(row.item.id) ?? Infinity),
        ),
      };
    })
    .filter((family) => family.rank !== Infinity)
    .sort((a, b) => a.rank - b.rank);

  return families.map(({ rows, parents }) => {
    const item = rows[0].item;
    const descendants = rows.slice(1).map((row) => row.item);
    const hasChildren = parents.has(item.id);
    const leaves = (hasChildren ? descendants : [item]).filter(
      (task) => !parents.has(task.id),
    );
    const counts: Record<FarmWorkStatus, number> = {
      open: 0,
      in_progress: 0,
      waiting: 0,
      completed: 0,
    };
    leaves.forEach((task) => counts[task.status]++);
    // Missing, mismatched, cyclic and contradictory legacy links must never look complete.
    const missing =
      Boolean(item.parentWorkItemId) ||
      rows.some(
        ({ item: task }) =>
          (task.parentWorkItemId &&
            (!byId.has(task.parentWorkItemId) ||
              !sameWorkContext(byId.get(task.parentWorkItemId)!, task))) ||
          task.childWorkItemIds?.some((id) => {
            const child = byId.get(id);
            return (
              !child ||
              child.parentWorkItemId !== task.id ||
              !sameWorkContext(child, task)
            );
          }) ||
          ((task.openChildCount || 0) > 0 &&
            (task.status === 'completed' ||
              (task.childWorkItemIds?.length &&
                task.childWorkItemIds.every(
                  (id) => byId.get(id)?.status === 'completed',
                )))),
      ) ||
      (item.status === 'completed' &&
        descendants.some((task) => task.status !== 'completed'));
    const allDone =
      hasChildren && leaves.length > 0 && counts.completed === leaves.length;
    const confirmations = descendants.filter(
      (task) => parents.has(task.id) && task.status !== 'completed',
    );
    const readyToConfirm =
      hasChildren &&
      !missing &&
      item.status !== 'completed' &&
      descendants.length > 0 &&
      descendants.every((task) => task.status === 'completed') &&
      !(item.openChildCount || 0);
    const needsConfirmation =
      allDone && !missing && item.status !== 'completed';
    const active = leaves.filter((task) => task.status === 'in_progress');
    const waiting = rows
      .map((row) => row.item)
      .filter((task) => task.status === 'waiting');
    let lane: FarmWorkStatus;
    // Waiting anywhere in the family takes priority, without rewriting stored status.
    if (waiting.length) lane = 'waiting';
    else if (missing && (hasChildren || item.status === 'completed'))
      lane = 'in_progress';
    else lane = item.status;
    return {
      item,
      rows,
      hasChildren,
      counts,
      total: leaves.length,
      rate:
        missing || !leaves.length
          ? null
          : Math.round((counts.completed / leaves.length) * 100),
      lane,
      active,
      waiting,
      missing,
      confirmations,
      readyToConfirm,
      needsConfirmation,
    };
  });
}
