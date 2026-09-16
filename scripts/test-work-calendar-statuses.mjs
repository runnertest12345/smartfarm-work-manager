import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, aliases = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (name) => aliases[name] || require(name),
  });
  return loadedModule.exports;
}
const organization = load('lib/organization.ts');
const lifecycle = load('lib/work-lifecycle.ts', { './organization': organization });
const projectWork = load('lib/project-work.ts', { './work-lifecycle': lifecycle });
const hierarchy = load('lib/work-hierarchy.ts');
const { summarizeCalendarWorkStatuses, filterWorkCalendar } = load('lib/work-calendar.ts', {
  './project-work': projectWork, './work-hierarchy': hierarchy,
});
const work = (id, status, extra = {}) => ({ id, title: id, status, ...extra });
const entry = (item, extra = {}) => ({
  id: `deadline:${item.id}`, kind: 'deadline', date: '2026-09-18',
  work: item, owner: '담호', projectId: 'p1', completed: item.status === 'completed',
  ...extra,
});
const summary = (entries) => ({ ...summarizeCalendarWorkStatuses(entries) });

test('empty entries return all four zero-valued status counts', () => {
  assert.deepEqual(summary([]), { open: 0, in_progress: 0, waiting: 0, completed: 0 });
});
test('each original work status is counted independently', () => {
  const entries = ['open', 'in_progress', 'waiting', 'completed'].map((status) => entry(work(status, status)));
  assert.deepEqual(summary(entries), { open: 1, in_progress: 1, waiting: 1, completed: 1 });
});
test('deadline and multiple visits for one work produce only one status count', () => {
  const item = work('same-work', 'in_progress');
  const entries = [entry(item), entry(item, { id: 'visit:1', kind: 'visit' }), entry(item, { id: 'visit:2', kind: 'visit' })];
  assert.deepEqual(summary(entries), { open: 0, in_progress: 1, waiting: 0, completed: 0 });
});
test('ID deduplication works across copied objects while duplicate titles remain separate', () => {
  const a = work('a', 'waiting', { title: '같은 이름' });
  const b = work('b', 'waiting', { title: '같은 이름' });
  assert.deepEqual(summary([entry(a), entry({ ...a }, { id: 'visit:a', kind: 'visit' }), entry(b)]), {
    open: 0, in_progress: 0, waiting: 2, completed: 0,
  });
});
test('completed visit flags do not change an open, waiting or in-progress work status', () => {
  const entries = ['open', 'in_progress', 'waiting'].map((status) => entry(work(status, status), {
    id: `visit:${status}`, kind: 'visit', completed: true, visit: { status: 'completed' },
  }));
  assert.deepEqual(summary(entries), { open: 1, in_progress: 1, waiting: 1, completed: 0 });
});
test('a scheduled visit still counts as completed when the original work is completed', () => {
  assert.deepEqual(summary([entry(work('done', 'completed'), {
    id: 'visit:done', kind: 'visit', completed: false, visit: { status: 'scheduled' },
  })]), { open: 0, in_progress: 0, waiting: 0, completed: 1 });
});
test('caller date, owner, project and completed filters are respected without restoring excluded work', () => {
  const entries = [
    entry(work('included', 'in_progress')),
    entry(work('different-day', 'waiting'), { date: '2026-09-19' }),
    entry(work('different-owner', 'waiting'), { owner: '평화' }),
    entry(work('different-project', 'open'), { projectId: 'p2' }),
    entry(work('done', 'completed')),
  ];
  const calendar = { entries, unscheduled: [], ownerOptions: [], projectOptions: [] };
  const filtered = filterWorkCalendar(calendar, { owner: '담호', projectId: 'p1' }, '2026-09-18');
  assert.deepEqual(summary(filtered.entries.filter((item) => item.date === '2026-09-18')), {
    open: 0, in_progress: 1, waiting: 0, completed: 0,
  });
  const includingCompleted = filterWorkCalendar(calendar, { owner: '담호', projectId: 'p1', showCompleted: true }, '2026-09-18');
  assert.deepEqual(summary(includingCompleted.entries.filter((item) => item.date === '2026-09-18')), {
    open: 0, in_progress: 1, waiting: 0, completed: 1,
  });
});
test('parents and descendants use their own statuses instead of a rolled-up parent status', () => {
  const parent = work('parent', 'in_progress');
  const child = work('child', 'waiting', { parentWorkItemId: 'parent' });
  const grandchild = work('grandchild', 'completed', { parentWorkItemId: 'child' });
  const secondParent = work('parent-2', 'open');
  assert.deepEqual(summary([entry(parent), entry(child), entry(grandchild), entry(secondParent)]), {
    open: 1, in_progress: 1, waiting: 1, completed: 1,
  });
  assert.equal(parent.status, 'in_progress');
});
test('context-only ancestors are not invented when only a descendant has a matching schedule', () => {
  const descendant = work('child', 'completed', { parentWorkItemId: 'waiting-parent' });
  assert.deepEqual(summary([entry(descendant)]), { open: 0, in_progress: 0, waiting: 0, completed: 1 });
});
test('input entries and work objects remain unchanged, including frozen inputs', () => {
  const item = Object.freeze(work('frozen', 'waiting'));
  const entries = Object.freeze([Object.freeze(entry(item)), Object.freeze(entry(item, { id: 'visit:frozen', kind: 'visit' }))]);
  const before = JSON.stringify(entries);
  assert.deepEqual(summary(entries), { open: 0, in_progress: 0, waiting: 1, completed: 0 });
  assert.equal(JSON.stringify(entries), before);
  const first = summarizeCalendarWorkStatuses([]);
  first.open = 10;
  assert.equal(summarizeCalendarWorkStatuses([]).open, 0, 'counts are not shared between calls');
});
