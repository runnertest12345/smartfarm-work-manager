export type DashboardView =
  | 'overview'
  | 'work'
  | 'farms'
  | 'projects'
  | 'business'
  | 'subscriptions'
  | 'service'
  | 'quality'
  | 'organization';

export type DetailTarget =
  | { kind: 'project'; projectId: string }
  | { kind: 'farm'; farmId: string; projectId?: string }
  | { kind: 'work'; farmId: string; workItemId: string; projectId?: string };

export interface NavigationTrailEntry {
  target: DetailTarget;
  scrollY: number;
  projectTab: string;
  farmTab: string;
}

export interface DetailNavigationSnapshot {
  view: DashboardView;
  target: DetailTarget | null;
  projectTab: string;
  farmTab: string;
  trail: NavigationTrailEntry[];
  scrollY: number;
  listScrollY: number;
}

const HISTORY_KEY = '__farmLedgerDetailNavigation';
interface NavigationEntry {
  version: 1;
  id: string;
  previousId: string | null;
  position: number;
  snapshot: DetailNavigationSnapshot;
}
type HistoryPort = Pick<
  History,
  'state' | 'pushState' | 'replaceState' | 'back' | 'go'
>;
const views: DashboardView[] = [
  'overview',
  'work',
  'farms',
  'projects',
  'business',
  'subscriptions',
  'service',
  'quality',
  'organization',
];
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const position = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
function validTarget(value: unknown): boolean {
  if (!object(value)) return false;
  if (value.kind === 'project') return typeof value.projectId === 'string';
  return (
    (value.kind === 'farm' || value.kind === 'work') &&
    typeof value.farmId === 'string' &&
    (value.projectId === undefined || typeof value.projectId === 'string') &&
    (value.kind !== 'work' || typeof value.workItemId === 'string')
  );
}

export function readDetailNavigation(state: unknown): NavigationEntry | null {
  if (!object(state) || !object(state[HISTORY_KEY])) return null;
  const entry = state[HISTORY_KEY];
  const snapshot = entry.snapshot;
  if (
    entry.version !== 1 ||
    typeof entry.id !== 'string' ||
    !position(entry.position) ||
    !Number.isInteger(entry.position) ||
    !(entry.previousId === null || typeof entry.previousId === 'string') ||
    !object(snapshot)
  )
    return null;
  if (
    !views.includes(snapshot.view as DashboardView) ||
    !(snapshot.target === null || validTarget(snapshot.target)) ||
    typeof snapshot.projectTab !== 'string' ||
    typeof snapshot.farmTab !== 'string' ||
    !position(snapshot.scrollY) ||
    !position(snapshot.listScrollY) ||
    !Array.isArray(snapshot.trail) ||
    !snapshot.trail.every(
      (row) =>
        object(row) &&
        validTarget(row.target) &&
        position(row.scrollY) &&
        typeof row.projectTab === 'string' &&
        typeof row.farmTab === 'string',
    )
  )
    return null;
  return entry as unknown as NavigationEntry;
}

/** Same-document history only; no URL changes, DOM objects, or data mutations. */
export function createDetailNavigation(
  history: HistoryPort,
  capture: () => DetailNavigationSnapshot,
  restore: (snapshot: DetailNavigationSnapshot) => void,
  newId: () => string,
  canGoBack: () => boolean = () => true,
) {
  const existing = readDetailNavigation(history.state);
  let active: NavigationEntry = existing || {
    version: 1,
    id: newId(),
    previousId: null,
    position: 0,
    snapshot: capture(),
  };
  const cache = new Map<string, NavigationEntry>([[active.id, active]]);
  let pendingBack = false;
  let awaitingCommit: DetailNavigationSnapshot | null =
    existing?.snapshot ?? null;
  function write(entry: NavigationEntry, push = false) {
    const state = {
      ...(object(history.state) ? history.state : {}),
      [HISTORY_KEY]: entry,
    };
    // Preserve Next.js and other host-owned fields, as well as the current release URL.
    if (push) history.pushState(state, '');
    else history.replaceState(state, '');
    cache.set(entry.id, entry);
  }
  function saveCurrent() {
    // React may not have committed a previous popstate yet. Never save the old
    // rendered screen under the newly restored history entry.
    if (!awaitingCommit) active = { ...active, snapshot: capture() };
    write(active);
  }
  write(active);
  if (existing) restore(existing.snapshot);
  return {
    committed(snapshot: DetailNavigationSnapshot) {
      if (awaitingCommit === snapshot) awaitingCommit = null;
    },
    push(next: DetailNavigationSnapshot) {
      if (pendingBack || awaitingCommit) return false;
      saveCurrent();
      active = {
        version: 1,
        id: newId(),
        previousId: active.id,
        position: active.position + 1,
        snapshot: next,
      };
      write(active, true);
      awaitingCommit = next;
      return true;
    },
    replace(next: DetailNavigationSnapshot, resetTrail = false) {
      if (pendingBack || awaitingCommit) return false;
      active = {
        ...active,
        snapshot: next,
        previousId: resetTrail ? null : active.previousId,
      };
      write(active);
      awaitingCommit = next;
      return true;
    },
    save() {
      if (!pendingBack && readDetailNavigation(history.state)?.id === active.id)
        saveCurrent();
    },
    back() {
      if (pendingBack || awaitingCommit) return true;
      if (!canGoBack()) return true;
      if (!active.previousId) return false;
      saveCurrent();
      pendingBack = true;
      history.back();
      return true;
    },
    pop(state: unknown) {
      const entry = readDetailNavigation(state);
      pendingBack = false;
      if (!entry) return false; // Do not trap the user at the application's starting page.
      if (entry.id === active.id) return true; // Restored after a blocked navigation.
      if (!canGoBack()) {
        pendingBack = true;
        history.go(active.position - entry.position);
        return true;
      }
      if (!awaitingCommit)
        cache.set(active.id, { ...active, snapshot: capture() });
      active = cache.get(entry.id) || entry;
      write(active);
      awaitingCommit = active.snapshot;
      restore(active.snapshot);
      return true;
    },
  };
}
