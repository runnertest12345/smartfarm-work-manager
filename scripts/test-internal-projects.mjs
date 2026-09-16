import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  cache.set(path, module.exports);
  const code = ts.transpileModule(
    readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(name.startsWith('.'), 'local dependency only');
      return load(
        posix.normalize(posix.join(posix.dirname(path), name + '.ts')),
      );
    },
  });
  return module.exports;
}
const internal = load('lib/internal-projects.ts');
const work = load('lib/project-work.ts');
const dashboard = load('lib/dashboard-kpis.ts');
const navigation = load('lib/workspace-navigation.ts');
const task = (id, patch = {}) => ({
  id,
  scope: 'internal',
  projectId: '',
  farmId: '',
  farmRecordId: '',
  workType: 'communication',
  departmentId: 'department',
  assigneeUid: 'person',
  status: 'open',
  parentWorkItemId: '',
  childWorkItemIds: [],
  dueDate: '',
  ...patch,
});
const project = (id, patch = {}) => ({
  id,
  projectType: 'internal',
  year: 2026,
  status: 'active',
  ...patch,
});

test('linked and unlinked internal tasks stay disjoint from business tasks', () => {
  for (const projectId of ['', 'internal-project']) {
    assert.equal(work.isInternalTask(task('task', { projectId })), true);
    assert.equal(work.isProjectTask(task('task', { projectId })), false);
  }
  assert.equal(
    work.isInternalTask(task('invalid', { farmRecordId: 'farm-record' })),
    false,
  );
  assert.equal(
    work.isInternalTask(task('invalid', { workType: 'payment' })),
    false,
  );
  assert.equal(
    work.isProjectTask(task('business', { scope: '', projectId: 'business' })),
    true,
  );
  assert.equal(
    work.sameWorkContext(
      task('a', { projectId: 'one' }),
      task('b', { projectId: 'two' }),
    ),
    false,
  );
  assert.equal(
    work.sameWorkContext(
      task('a', { projectId: 'one' }),
      task('b', { projectId: 'one' }),
    ),
    true,
  );
  assert.equal(
    work.sameWorkContext(task('a'), task('b', { departmentId: 'other' })),
    false,
  );
});

test('internal KPI counts complete cross-year families once and excludes deleted/business tasks', () => {
  const root = task('root', {
    projectId: 'old-project',
    createdAt: 1,
    childWorkItemIds: ['child'],
    status: 'waiting',
  });
  const child = task('child', {
    projectId: 'old-project',
    parentWorkItemId: 'root',
    status: 'completed',
    createdAt: 999999,
  });
  const waiting = task('waiting', { status: 'waiting', dueDate: '2026-09-10' });
  const summary = internal.summarizeInternalWorkKpis(
    [
      root,
      child,
      child,
      waiting,
      task('deleted', { deletedAt: 1 }),
      task('business', { scope: '', projectId: 'business' }),
    ],
    [
      project('old-project', { year: 2025 }),
      project('new-project', { status: 'completed' }),
      project('deleted-project', { deletedAt: 1 }),
      project('business', { projectType: 'general' }),
    ],
    '2026-09-11',
  );
  assert.equal(summary.projects, 2);
  assert.equal(summary.activeProjects, 1);
  assert.equal(summary.completedProjects, 1);
  assert.equal(summary.tasks, 3);
  assert.equal(summary.rootTasks, 2);
  assert.equal(summary.subtasks, 1);
  assert.equal(summary.executableTasks, 2);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.completionRate, 50);
  assert.equal(summary.incompleteTasks, 1);
  assert.equal(summary.waitingTasks, 1);
  assert.equal(summary.overdueTasks, 1);
});

test('internal completion rate distinguishes missing children and parent final approval', () => {
  assert.equal(
    internal.summarizeInternalWorkKpis([], [], '2026-09-11').completionRate,
    null,
  );
  const root = task('root', { childWorkItemIds: ['child'] });
  assert.equal(
    internal.summarizeInternalWorkKpis([root], [], '2026-09-11').completionRate,
    null,
  );
  const summary = internal.summarizeInternalWorkKpis(
    [root, task('child', { parentWorkItemId: 'root', status: 'completed' })],
    [],
    '2026-09-11',
  );
  assert.equal(summary.completionRate, 100);
  assert.equal(root.status, 'open', 'KPI never completes the parent');
});

test('business KPI excludes internal projects even when caller provides both types', () => {
  const snapshot = {
    records: [],
    workItems: [],
    activeSubscriptions: [],
    requiredDocuments: [],
    approvedDocuments: [],
    openProjectBlockers: [],
    documentRisks: [],
  };
  const summaries = new Map([
    ['business', snapshot],
    ['internal', { ...snapshot, workItems: [task('hidden')] }],
  ]);
  const summary = dashboard.summarizeProjectKpis(
    [project('business', { projectType: 'general' }), project('internal')],
    summaries,
    '2026-09-11',
  );
  assert.equal(summary.projects, 1);
  assert.equal(summary.tasks, 0);
  assert.equal(summary.general, 1);
});

test('internal normalization clears business measures without changing general projects', () => {
  const normal = project('business', {
    projectType: 'general',
    contractAmount: 1000,
  });
  assert.equal(internal.normalizeInternalProject(normal), normal);
  const clean = internal.normalizeInternalProject(
    project('internal', {
      status: 'completed',
      contractAmount: 1000,
      targetFarmCount: 10,
      settlementPaidAmount: 300,
      settlementRounds: {},
    }),
  );
  assert.equal(clean.contractAmount, 0);
  assert.equal(clean.targetFarmCount, 0);
  assert.equal(clean.settlementPaidAmount, 0);
  assert.equal(clean.settlementRounds, undefined);
  assert.equal(clean.currentStage, 'closed');
  assert.throws(() => internal.assertProjectKindTransition(normal, clean, { records: [], workItems: [], projectDocuments: [], projectUpdates: [] }));
  assert.throws(() => internal.assertBusinessProject(clean));
  assert.throws(() => internal.assertWorkProjectKind(task('task'), normal));
});

test('internal KPI drilldown includes unlinked tasks but not business work', () => {
  const scope = { source: 'internal', projectIds: [], status: 'open' };
  assert.equal(
    navigation.workMatchesScope(task('old'), '', scope, '2026-09-11'),
    true,
  );
  assert.equal(
    navigation.workMatchesScope(
      task('linked', { projectId: 'internal' }),
      'internal',
      scope,
      '2026-09-11',
    ),
    true,
  );
  assert.equal(
    navigation.workMatchesScope(
      task('done', { status: 'completed' }),
      '',
      scope,
      '2026-09-11',
    ),
    false,
  );
  assert.equal(
    navigation.workMatchesScope(
      task('business', { scope: '' }),
      'business',
      scope,
      '2026-09-11',
    ),
    false,
  );
});

const noRelated = { records: [], workItems: [], projectDocuments: [], projectUpdates: [] };
const emptyRound = () => ({ status: 'not_started', dueDate: '', claimAmount: 0, approvedAmount: 0, paidAmount: 0, settledAt: '', owner: '', evidenceUrl: '', note: '' });
test('unused general/research projects can become internal without mutating the draft', () => {
  for (const projectType of ['general', 'research']) {
    const before = project('convert', { projectType, name: '홍보 게시', manager: '담호', targetFarmCount: 3, currentStage: 'verification', settlementRounds: { first: emptyRound(), second: emptyRound() } });
    const draft = { ...before, projectType: 'internal' };
    assert.doesNotThrow(() => internal.assertProjectKindTransition(before, draft, noRelated));
    assert.equal(draft.targetFarmCount, 3);
    assert.equal(draft.settlementRounds, before.settlementRounds);
    const normalized = internal.normalizeInternalProject(draft);
    assert.equal(normalized.name, before.name);
    assert.equal(normalized.manager, before.manager);
    assert.equal(normalized.targetFarmCount, 0);
    assert.equal(normalized.settlementRounds, undefined);
    assert.equal(normalized.currentStage, 'operation');
  }
});

test('conversion protects contracts, settlement plans, evidence and every settlement round', () => {
  const before = project('convert', { projectType: 'general' });
  for (const patch of [
    { contractAmount: 100 }, { settlementPaidAmount: 1 }, { settlementStatus: 'collecting' },
    { settlementNote: '보존할 내용' }, { settlementOwner: '담당자' },
    { settlementRounds: { first: { ...emptyRound(), note: '보존' }, second: emptyRound() } },
    { settlementRounds: { first: emptyRound(), second: emptyRound(), unassigned: { ...emptyRound(), paidAmount: 5 } } },
  ]) {
    assert.throws(() => internal.assertProjectKindTransition({ ...before, ...patch }, { ...before, projectType: 'internal' }, noRelated), /정산/);
    assert.throws(() => internal.assertProjectKindTransition(before, { ...before, ...patch, projectType: 'internal' }, noRelated), /정산/);
  }
});

test('conversion refuses linked farms, deleted tasks and written documents or updates', () => {
  const before = project('convert', { projectType: 'general' });
  const after = { ...before, projectType: 'internal' };
  for (const patch of [
    { records: [{ projectId: before.id }] },
    { workItems: [task('existing', { projectId: before.id, deletedAt: 1 })] },
    { projectDocuments: [{ projectId: before.id, status: 'approved' }] },
    { projectDocuments: [{ projectId: before.id, status: 'not_started', note: '수정 기록' }] },
    { projectUpdates: [{ projectId: before.id, kind: 'communication' }] },
  ]) assert.throws(() => internal.assertProjectKindTransition(before, after, { ...noRelated, ...patch }));
  assert.doesNotThrow(() => internal.assertProjectKindTransition(before, after, {
    ...noRelated, projectDocuments: [{ projectId: before.id, category: 'agreement', title: '협약서·계약서', isRequired: true, status: 'not_started', revision: 1 }],
    projectUpdates: [{ projectId: before.id, kind: 'system' }],
  }));
  assert.throws(() => internal.assertProjectKindTransition(before, after, { ...noRelated, projectDocuments: [{ projectId: before.id, title: '사용자 작성 서류', status: 'not_started', revision: 1 }] }));
  assert.throws(() => internal.assertProjectKindTransition(before, after, { ...noRelated, projectUpdates: [{ projectId: before.id, kind: 'system', title: '제출서류 수정' }] }));
  assert.doesNotThrow(() => internal.assertProjectKindTransition({ ...before, manager: '새 담당자', createdAt: 100 }, after, {
    ...noRelated,
    projectDocuments: [{ projectId: before.id, category: 'agreement', title: '협약서·계약서', isRequired: true, status: 'not_started', revision: 1, owner: '이전 담당자', currentHandler: '이전 담당자', createdAt: 100, updatedAt: 100 }],
  }), 'untouched templates remain eligible after only the project manager changes');
});

test('conversion cannot also complete a project, cross deleted state or reverse existing internal projects', () => {
  const before = project('convert', { projectType: 'general' });
  const after = { ...before, projectType: 'internal' };
  assert.throws(() => internal.assertProjectKindTransition({ ...before, status: 'completed' }, after, noRelated));
  assert.throws(() => internal.assertProjectKindTransition(before, { ...after, status: 'completed' }, noRelated));
  assert.throws(() => internal.assertProjectKindTransition({ ...before, deletedAt: 1 }, after, noRelated));
  assert.throws(() => internal.assertProjectKindTransition(after, before, noRelated));
});

test('project editor keeps the internal option enabled and leaves the draft intact until save', () => {
  const source = readFileSync(new URL('../app/farm-ledger-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /<SelectItem value="internal">내부 프로젝트<\/SelectItem>/);
  const editor = source.slice(source.indexOf('<FieldLabel htmlFor="project-type">'), source.indexOf('<FieldLabel htmlFor="project-year">'));
  assert.doesNotMatch(editor, /normalizeInternalProject/);
  assert.match(editor, /isInternalProject\(projectById.get\(editingProjectId\)\)/);
  const store = readFileSync(new URL('../lib/firebase/farm-ledger-store.ts', import.meta.url), 'utf8');
  const update = store.slice(store.indexOf('async function updateProject('), store.indexOf('async function changeProjectDeletion('));
  assert.match(update, /assertProjectKindTransition\(existing, submittedInput, workspace\);\s+input = normalizeInternalProject\(input\)/);
  assert.match(update, /transaction.get\(documentRef\('projects', projectId\)\)/);
  assert.match(update, /getDocsFromServer/);
  assert.match(update, /if \(convertingToInternal\) delete project.settlementRounds/);
});
