import type { FarmWorkItem } from './farm-types';

/** Always build from the complete scope, before applying search/status filters. */
export function buildWorkHierarchy(items: FarmWorkItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string, FarmWorkItem[]>();
  for (const item of items) {
    if (
      item.parentWorkItemId &&
      item.parentWorkItemId !== item.id &&
      byId.has(item.parentWorkItemId)
    ) {
      children.set(item.parentWorkItemId, [
        ...(children.get(item.parentWorkItemId) || []),
        item,
      ]);
    }
  }
  const roots = items.filter(
    (item) => !item.parentWorkItemId || !byId.has(item.parentWorkItemId),
  );
  const leaves = items.filter(
    (item) => !children.get(item.id)?.length && !item.childWorkItemIds?.length,
  );
  const leafIds = new Set(leaves.map((item) => item.id));
  function descendants(id: string) {
    const result: FarmWorkItem[] = [],
      seen = new Set([id]);
    const pending = [...(children.get(id) || [])];
    while (pending.length) {
      const item = pending.shift()!;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      pending.push(...(children.get(item.id) || []));
    }
    return result;
  }
  function ancestors(id: string) {
    const result: FarmWorkItem[] = [],
      seen = new Set([id]);
    let parentId = byId.get(id)?.parentWorkItemId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      result.unshift(parent);
      parentId = parent.parentWorkItemId;
    }
    return result;
  }
  function progress(id: string) {
    const nested = descendants(id);
    const executable = nested.filter((item) => leafIds.has(item.id));
    const completed = executable.filter(
      (item) => item.status === 'completed',
    ).length;
    const blocked = nested.filter((item) => item.status === 'waiting').length;
    const missing = [byId.get(id), ...nested].some((item) =>
      item?.childWorkItemIds?.some((childId) => !byId.has(childId)),
    );
    return {
      total: executable.length,
      completed,
      blocked,
      missing,
      rate:
        executable.length && !missing
          ? Math.round((completed / executable.length) * 100)
          : null,
    };
  }
  return { byId, children, roots, leaves, descendants, ancestors, progress };
}

export function summarizeWorkHierarchy(items: FarmWorkItem[]) {
  const tree = buildWorkHierarchy(items);
  const completed = tree.leaves.filter(
    (item) => item.status === 'completed',
  ).length;
  const missing = items.some((item) =>
    item.childWorkItemIds?.some((id) => !tree.byId.has(id)),
  );
  return {
    rootCount: items.filter((item) => !item.parentWorkItemId).length,
    subtaskCount: items.filter((item) => Boolean(item.parentWorkItemId)).length,
    leafCount: tree.leaves.length,
    completed,
    missing,
    completionRate:
      tree.leaves.length && !missing
        ? Math.round((completed / tree.leaves.length) * 100)
        : null,
    leaves: tree.leaves,
  };
}
