import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const loadedModule = { exports: {} };
const code = ts.transpileModule(
  readFileSync(new URL('../lib/work-calendar-groups.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports });
const { groupWorkCalendarEntries } = loadedModule.exports;

const task = (id, extra = {}) => ({
  id, title: id, status: 'open', projectId: 'project-a', farmId: '', farmRecordId: '',
  workType: 'communication', owner: '담호', dueDate: '2026-09-15', ...extra,
});
const entry = (work, extra = {}) => ({
  id: `deadline:${work.id}`, kind: 'deadline', date: '2026-09-15', time: '', scheduledAt: 0,
  work, projectId: work.projectId || '', projectLabel: '프로젝트', sourceLabel: '프로젝트 업무',
  parentPath: '', owner: work.owner, completed: work.status === 'completed', ...extra,
});
const rowIds = (group) => group.rows.map((row) => `${row.work.id}:${row.depth}:${row.contextOnly}`).join(',');
const entryIds = (entries) => entries.map((item) => item.id).join(',');

test('same-date root and descendants become one group, keeping deadline and visit entries', () => {
  const root = task('root');
  const child = task('child', { parentWorkItemId: root.id });
  const deadline = entry(child);
  const visit = entry(child, { id: 'visit:v1', kind: 'visit', time: '10:30', scheduledAt: 100 });
  const groups = groupWorkCalendarEntries([entry(root), deadline, visit], [root, child]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].root, root);
  assert.equal(groups[0].workCount, 2);
  assert.equal(groups[0].entries.length, 3);
  assert.equal(groups[0].entries[1], deadline);
  assert.equal(groups[0].entries[2], visit);
  assert.equal(rowIds(groups[0]), 'root:0:false,child:1:false');
  assert.equal(entryIds(groups[0].rows[1].entries), 'deadline:child,visit:v1');
});
test('different dates always produce separate groups with stable date-root IDs', () => {
  const root = task('root');
  const child = task('child', { parentWorkItemId: root.id });
  const entries = [entry(child, { date: '2026-09-16' }), entry(root)];
  const groups = groupWorkCalendarEntries(entries, [root, child]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-09-15');
  assert.equal(groups[1].date, '2026-09-16');
  assert.notEqual(groups[0].id, groups[1].id);
  assert.equal(rowIds(groups[1]), 'root:0:true,child:1:false');
  assert.equal(groups[1].workCount, 1);
  assert.equal(groupWorkCalendarEntries([entries[1], entries[0]], [child, root])[0].id, groups[0].id);
});
test('filtered ancestors are context only, never restore other dates or siblings', () => {
  const root = task('root', { status: 'waiting', dueDate: '2026-09-10' });
  const middle = task('middle', { parentWorkItemId: 'root', status: 'completed', owner: '평화' });
  const child = task('child', { parentWorkItemId: 'middle', status: 'in_progress' });
  const sibling = task('sibling', { parentWorkItemId: 'root' });
  const [group] = groupWorkCalendarEntries([entry(child)], [root, middle, child, sibling]);
  assert.equal(rowIds(group), 'root:0:true,middle:1:true,child:2:false');
  assert.equal(group.entries.length, 1);
  assert.equal(group.workCount, 1);
  assert.equal(group.waitingCount, 0);
  assert.equal(group.status, 'in_progress');
  assert.equal(group.rows[0].entries.length, 0);
  assert.equal(group.rows[1].entries.length, 0);
});
test('parent always precedes descendants, with real depth and distinct sibling branches', () => {
  const root = task('root');
  const a = task('a', { parentWorkItemId: 'root' });
  const b = task('b', { parentWorkItemId: 'root' });
  const a1 = task('a1', { parentWorkItemId: 'a' });
  const b1 = task('b1', { parentWorkItemId: 'b' });
  const [group] = groupWorkCalendarEntries([entry(b1), entry(a1), entry(root)], [a1, b1, b, a, root]);
  assert.equal(rowIds(group), 'root:0:false,b:1:true,b1:2:false,a:1:true,a1:2:false');
});
test('matching names with different IDs never merge separate roots', () => {
  const a = task('root-a', { title: '동일 업무' });
  const b = task('root-b', { title: '동일 업무' });
  const groups = groupWorkCalendarEntries([entry(a), entry(b)], [a, b]);
  assert.equal(groups.length, 2);
  assert.notEqual(groups[0].id, groups[1].id);
});
test('missing parent IDs do not combine unrelated orphan tasks', () => {
  const a = task('a', { parentWorkItemId: 'missing' });
  const b = task('b', { parentWorkItemId: 'missing' });
  const groups = groupWorkCalendarEntries([entry(a), entry(b)], [a, b]);
  assert.equal(groups.length, 2);
  assert.equal(rowIds(groups[0]), 'a:0:false');
  assert.equal(rowIds(groups[1]), 'b:0:false');
});
test('valid descendants of an orphan still retain their own known branch', () => {
  const orphan = task('orphan', { parentWorkItemId: 'missing' });
  const child = task('child', { parentWorkItemId: 'orphan' });
  const [group] = groupWorkCalendarEntries([entry(child)], [orphan, child]);
  assert.equal(rowIds(group), 'orphan:0:true,child:1:false');
});
test('self cycles, multi-node cycles and their descendants are isolated without recursion', () => {
  const self = task('self', { parentWorkItemId: 'self' });
  const a = task('a', { parentWorkItemId: 'b' });
  const b = task('b', { parentWorkItemId: 'a' });
  const child = task('child', { parentWorkItemId: 'a' });
  const works = [self, a, b, child];
  const groups = groupWorkCalendarEntries(works.map((work) => entry(work)), works);
  assert.equal(groups.length, 4);
  assert.equal(groups.every((group) => group.rows.length === 1 && group.workCount === 1), true);
  assert.equal(groups.map((group) => group.root.id).join(','), 'self,a,b,child');
});
test('different direct projects break invalid parent links', () => {
  const root = task('root');
  const child = task('child', { parentWorkItemId: 'root', projectId: 'project-b' });
  const groups = groupWorkCalendarEntries([entry(root), entry(child)], [root, child]);
  assert.equal(groups.length, 2);
  assert.equal(rowIds(groups[1]), 'child:0:false');
});
test('farm record identity prevents linking tasks across different farms or project participations', () => {
  const root = task('root', { farmRecordId: 'r1', farmId: 'f1' });
  const otherRecord = task('other-record', { parentWorkItemId: 'root', farmRecordId: 'r2', farmId: 'f1' });
  const otherFarm = task('other-farm', { parentWorkItemId: 'root', farmRecordId: 'r1', farmId: 'f2' });
  const direct = task('direct', { parentWorkItemId: 'root' });
  const works = [root, otherRecord, otherFarm, direct];
  assert.equal(groupWorkCalendarEntries(works.map((work) => entry(work)), works).length, 4);
});
test('legacy farm work with the same record can group without duplicated project IDs', () => {
  const root = task('root', { farmRecordId: 'r1', farmId: 'f1', projectId: undefined });
  const child = task('child', { farmRecordId: 'r1', farmId: 'f1', projectId: undefined, parentWorkItemId: 'root' });
  const [group] = groupWorkCalendarEntries([entry(child, { projectId: 'resolved-project' })], [root, child]);
  assert.equal(rowIds(group), 'root:0:true,child:1:false');
});
test('resolved calendar projects override stale direct fields for matching and isolation', () => {
  const root = task('root', { farmRecordId: 'r1', farmId: 'f1' });
  const child = task('child', { parentWorkItemId: 'root', farmRecordId: 'r1', farmId: 'f1' });
  assert.equal(groupWorkCalendarEntries([entry(root, { projectId: 'resolved-a' }), entry(child, { projectId: 'resolved-b' })], [root, child]).length, 2);
});
test('internal roots and children group only within the same project and department', () => {
  const root = task('root', { scope: 'internal', projectId: '', departmentId: 'common' });
  const child = task('child', { scope: 'internal', projectId: '', departmentId: 'common', parentWorkItemId: 'root' });
  const otherDepartment = task('department', { scope: 'internal', projectId: '', departmentId: 'another', parentWorkItemId: 'root' });
  const otherProject = task('project', { scope: 'internal', projectId: 'internal-p', departmentId: 'common', parentWorkItemId: 'root' });
  const external = task('external', { projectId: '', parentWorkItemId: 'root' });
  const works = [root, child, otherDepartment, otherProject, external];
  const groups = groupWorkCalendarEntries(works.map((work) => entry(work)), works);
  assert.equal(groups.length, 4);
  assert.equal(rowIds(groups[0]), 'root:0:false,child:1:false');
});
test('work and waiting counts deduplicate deadline and multiple visits by work ID', () => {
  const root = task('root', { status: 'waiting' });
  const child = task('child', { parentWorkItemId: 'root', status: 'waiting' });
  const [group] = groupWorkCalendarEntries([entry(root), entry(child), entry(root, { id: 'visit:1', kind: 'visit' }), entry(root, { id: 'visit:2', kind: 'visit' }), entry(child, { id: 'visit:3', kind: 'visit' })], [root, child]);
  assert.equal(group.entries.length, 5);
  assert.equal(group.workCount, 2);
  assert.equal(group.waitingCount, 2);
  assert.equal(group.status, 'waiting');
});
test('status priority comes only from matched work and does not overwrite the original root', () => {
  for (const [statuses, expected] of [
    [['completed'], 'completed'],
    [['completed', 'open'], 'open'],
    [['open', 'in_progress'], 'in_progress'],
    [['in_progress', 'waiting'], 'waiting'],
  ]) {
    const root = task('root', { status: 'completed' });
    const children = statuses.map((status, index) => task(`child-${index}`, { parentWorkItemId: root.id, status }));
    const [group] = groupWorkCalendarEntries(children.map((work) => entry(work)), [root, ...children]);
    assert.equal(group.status, expected);
    assert.equal(root.status, 'completed');
    assert.equal(group.root, root);
    assert.equal(group.rows[0].contextOnly, true);
  }
});
test('already-filtered completed visit retains the source work state and every original event', () => {
  const root = task('root', { status: 'in_progress' });
  const doneVisit = entry(root, { id: 'visit:done', kind: 'visit', completed: true });
  const [group] = groupWorkCalendarEntries([doneVisit], [root]);
  assert.equal(group.status, 'in_progress');
  assert.equal(group.entries[0], doneVisit);
});
test('absent or deleted ancestors are never attached from entry claims', () => {
  const deleted = task('deleted', { deletedAt: 100 });
  const absent = task('absent', { parentWorkItemId: 'deleted' });
  const child = task('child', { parentWorkItemId: 'deleted' });
  const groups = groupWorkCalendarEntries([entry(absent), entry(child)], [deleted, child]);
  assert.equal(groups.length, 2);
  assert.equal(rowIds(groups[0]), 'absent:0:false');
  assert.equal(rowIds(groups[1]), 'child:0:false');
});
test('ambiguous duplicate work IDs do not attach arbitrary ancestor trees', () => {
  const a = task('root');
  const duplicate = task('root', { projectId: 'other' });
  const child = task('child', { parentWorkItemId: 'root' });
  const groups = groupWorkCalendarEntries([entry(a), entry(child)], [a, duplicate, child]);
  assert.equal(groups.length, 2);
  assert.equal(rowIds(groups[1]), 'child:0:false');
});
test('conflicting resolved project evidence isolates a task rather than joining its parent', () => {
  const root = task('root');
  const child = task('child', { parentWorkItemId: 'root' });
  const groups = groupWorkCalendarEntries([entry(root), entry(child), entry(child, { id: 'visit:other', projectId: 'other' })], [root, child]);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].entries.length, 2);
  assert.equal(groups[1].workCount, 1);
});
test('group order keeps chronological dates and first matching entry order within each date', () => {
  const a = task('a');
  const b = task('b');
  const groups = groupWorkCalendarEntries([entry(b, { date: '2026-09-16' }), entry(b), entry(a)], [a, b]);
  assert.equal(groups.map((group) => `${group.date}:${group.root.id}`).join(','), '2026-09-15:b,2026-09-15:a,2026-09-16:b');
});
test('empty input yields no groups and building does not mutate any input collection or object', () => {
  assert.equal(groupWorkCalendarEntries([], []).length, 0);
  const root = task('root');
  const child = task('child', { parentWorkItemId: root.id });
  const works = [child, root];
  const entries = [entry(child), entry(root)];
  const before = JSON.stringify({ works, entries });
  groupWorkCalendarEntries(entries, works);
  assert.equal(JSON.stringify({ works, entries }), before);
});
test('deep valid hierarchy is traversed iteratively and preserves ancestor indentation', () => {
  const works = Array.from({ length: 500 }, (_, index) => task(`task-${index}`, { parentWorkItemId: index ? `task-${index - 1}` : undefined }));
  const [group] = groupWorkCalendarEntries([entry(works.at(-1))], works);
  assert.equal(group.rows.length, 500);
  assert.equal(group.rows.at(-1).depth, 499);
  assert.equal(group.workCount, 1);
  assert.equal(group.rows[0].contextOnly, true);
});
