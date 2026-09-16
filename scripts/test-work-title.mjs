import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = new Map();
function load(path, overrides = {}, extra = '', cache = new Map()) {
  if (cache.has(path)) return cache.get(path);
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const result = {};
  cache.set(path, result);
  vm.runInNewContext(compiled.get(path) + extra, {
    exports: result, module: { exports: result }, crypto: webcrypto, TextEncoder, TextDecoder, Date, Error, Response,
    console: { error() {} },
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', overrides, '', cache);
      if (name.startsWith('.')) return load(posix.normalize(posix.join(posix.dirname(path), name + '.ts')), overrides, '', cache);
      throw new Error('Unexpected dependency ' + name);
    },
  }, { filename: path });
  return result;
}
const { canRenameWork, validateWorkTitle, MAX_WORK_TITLE_LENGTH } = load('lib/work-title.ts');
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const operationId = '12345678-1234-4321-9876-123456789012';
const member = (patch = {}) => ({
  id: 'member1', email: 'member@example.test', displayName: '서버 담당자',
  active: true, admin: false, workspaceId: 'test', departmentId: 'dept1', ...patch,
});
const work = (patch = {}) => ({
  id: 'work1', title: '1회차 초안 작성', workType: 'note', status: 'open',
  scope: 'internal', projectId: 'project1', farmRecordId: '', farmId: '',
  parentWorkItemId: 'parent1', childWorkItemIds: ['child1'], openChildCount: 1,
  lastChildMutationId: 'child1', owner: '원래 담당자', assigneeUid: 'another-user',
  assignedByUid: 'creator', departmentId: 'dept1', headAssigned: true, assignedAt: 10,
  description: '원본 설명', expectedOutcome: '완료 기준', nextAction: '다음 행동',
  priority: 'medium', dueDate: '2026-09-15', reviewDate: '2026-09-16',
  responseDueAt: 25, respondedAt: 0, blockedAt: 0, blockedReason: '', blockedBy: '',
  expectedUnblockDate: '', completedAt: 0, lastActivityAt: 80, createdAt: 10, updatedAt: 100,
  createdByUid: 'creator', updatedByUid: 'previous-user', ...patch,
});
function harness(initial = work()) {
  let state = new Map(), queue = Promise.resolve(), failure = false, loseResponse = false, actorUid = 'member1';
  const commits = [], reads = [];
  const firestore = {
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    collection: (_db, ...parts) => ({ path: parts.join('/') }),
    runTransaction: (_db, callback) => {
      const task = queue.then(async () => {
        const operations = [];
        const transaction = {
          get: async ({ path }) => {
            assert.equal(operations.length, 0, 'Every authoritative read precedes every write');
            reads.push(path);
            const data = clone(state.get(path));
            return { exists: () => data !== undefined, data: () => clone(data) };
          },
          set: ({ path }, data) => operations.push(['set', path, clone(data)]),
          update: ({ path }, data) => operations.push(['update', path, clone(data)]),
        };
        const result = await callback(transaction);
        if (failure) { failure = false; throw new Error('simulated rejected commit'); }
        const next = new Map(state);
        for (const [kind, path, data] of operations) {
          if (kind === 'update') {
            assert.ok(next.has(path));
            next.set(path, { ...next.get(path), ...data });
          } else {
            assert.ok(!next.has(path), 'Never replace an existing history entry');
            next.set(path, data);
          }
        }
        state = next;
        commits.push(operations);
        if (loseResponse) { loseResponse = false; throw new Error('simulated lost response'); }
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
  const api = load('lib/firebase/farm-ledger-store.ts', {
    'firebase/firestore': firestore,
    react: { useEffect() {}, useState() {} },
    './client': {
      firebaseWorkspaceId: 'test', getFirebaseServices: () => ({ db: {} }),
      requireSignedInUser: () => ({ uid: actorUid, displayName: '클라이언트 이름 사용 금지', email: 'client@example.test' }),
    },
  }, '\nexports.mutate = (body, method = "PATCH") => mutateFarmLedger(method, body);');
  const put = (collection, value) => state.set(`workspaces/test/${collection}/${value.id}`, clone(value));
  const get = (collection, id) => clone(state.get(`workspaces/test/${collection}/${id}`));
  const setMember = (value) => value ? state.set(`appMembers/${actorUid}`, clone(value)) : state.delete(`appMembers/${actorUid}`);
  if (initial) put('workItems', initial);
  setMember(member());
  put('historyEntries', { id: 'existing-history', workItemId: 'work1', actionContent: '원본 감사 기록' });
  for (const [collection, id] of [['workItems', 'parent1'], ['workItems', 'child1'], ['blockerEpisodes', 'episode1'], ['visits', 'visit1'], ['subscriptionEvents', 'event1'], ['projects', 'project1'], ['farmRecords', 'record1']]) {
    put(collection, { id, sentinel: 'must not change' });
  }
  return {
    api, put, get, setMember, commits, reads,
    dump: () => clone([...state.entries()]),
    failNext: () => { failure = true; },
    loseNextResponse: () => { loseResponse = true; },
    actor: (uid) => { actorUid = uid; },
    rename: (patch = {}) => api.mutate({ kind: 'work_title', workItemId: 'work1', title: '수정한 업무명', expectedUpdatedAt: 100, operationId, ...patch }),
  };
}

test('title validation trims, permits 1–200 characters, and rejects invalid input', () => {
  assert.equal(MAX_WORK_TITLE_LENGTH, 200);
  assert.equal(validateWorkTitle(' \t업무명\n '), '업무명');
  assert.equal(validateWorkTitle('가'.repeat(200)).length, 200);
  for (const value of [undefined, null, 123, {}, [], '', ' \t\r\n ', '가'.repeat(201)]) assert.throws(() => validateWorkTitle(value));
});

test('rename policy permits ordinary personal members and protects shared/financial/deleted work', () => {
  assert.equal(canRenameWork(work(), member(), 'test'), true);
  assert.equal(canRenameWork(work({ status: 'completed' }), member(), 'test'), true);
  assert.equal(canRenameWork(work({ status: 'waiting' }), member(), 'test'), true);
  for (const denied of [null, undefined, member({ active: false }), member({ workspaceId: 'other' }), member({ email: '' }), member({ email: 'team-access@smartfarm-work-manager.firebaseapp.com' })]) assert.equal(canRenameWork(work(), denied, 'test'), false);
  for (const patch of [{ deletedAt: 200 }, { workType: 'payment' }, { workType: 'subscription' }]) assert.equal(canRenameWork(work(patch), member({ admin: true }), 'test'), false);
});

for (const scenario of [
  { label: 'nested internal task', patch: {} },
  { label: 'root business project task', patch: { scope: undefined, parentWorkItemId: '', departmentId: undefined } },
  { label: 'farm service task', patch: { scope: undefined, projectId: undefined, parentWorkItemId: '', childWorkItemIds: [], openChildCount: 0, farmRecordId: 'record1', farmId: 'farm1', workType: 'service' } },
  { label: 'waiting task without blocker episode', patch: { status: 'waiting', blockedAt: 50, blockedReason: '승인 대기', blockedBy: '기관', expectedUnblockDate: '2026-09-20' } },
  { label: 'completed task', patch: { status: 'completed', completedAt: 75, openChildCount: 0, respondedAt: 30 } },
]) test(`${scenario.label}: changes only title/version/editor and appends one audit`, async () => {
  const initial = clone(work(scenario.patch));
  const h = harness(initial);
  const before = h.dump();
  const result = await h.rename({ title: '  새 업무명  ', recorder: '위조 이름', newStatus: 'completed', parentWorkItemId: 'wrong' });
  assert.equal(result.workItem.title, '새 업무명');
  const saved = h.get('workItems', 'work1');
  const changed = Object.keys(saved).filter((key) => JSON.stringify(saved[key]) !== JSON.stringify(initial[key]));
  assert.deepEqual(changed.sort((a, b) => a.localeCompare(b)), ['title', 'updatedAt', 'updatedByUid']);
  assert.equal(saved.updatedByUid, 'member1');
  assert.ok(saved.updatedAt > initial.updatedAt);
  for (const [path, value] of before) {
    if (path === 'workspaces/test/workItems/work1') continue;
    assert.deepEqual(new Map(h.dump()).get(path), value);
  }
  const audit = h.get('historyEntries', operationId);
  assert.equal(audit.recorder, '서버 담당자');
  assert.equal(audit.actionContent, '업무명 변경: ‘1회차 초안 작성’ → ‘새 업무명’');
  assert.equal(audit.channel, 'system');
  assert.equal(audit.amount, 0);
  assert.equal(audit.createdByUid, 'member1');
  assert.equal(audit.occurredAt, saved.updatedAt);
  assert.deepEqual(h.commits[0].map(([kind, path]) => [kind, path]), [
    ['update', 'workspaces/test/workItems/work1'], ['set', `workspaces/test/historyEntries/${operationId}`],
  ]);
  assert.deepEqual(h.reads.sort((a, b) => a.localeCompare(b)), ['appMembers/member1', `workspaces/test/historyEntries/${operationId}`, 'workspaces/test/workItems/work1'].sort((a, b) => a.localeCompare(b)));
});

test('invalid route, blank title, IDs, versions, and operations reject before writing', async () => {
  for (const patch of [
    { title: '' }, { title: ' '.repeat(10) }, { title: 2 }, { title: '가'.repeat(201) },
    { workItemId: '' }, { workItemId: 'bad/path' },
    ...[undefined, 0, -1, 1.5, '100', Infinity, Number.MAX_SAFE_INTEGER + 1].map((expectedUpdatedAt) => ({ expectedUpdatedAt })),
    ...['', 'short', 'bad/path-1234567890', 'x'.repeat(81), 42].map((operationId) => ({ operationId })),
  ]) {
    const h = harness(); const before = h.dump();
    await assert.rejects(h.rename(patch));
    assert.deepEqual(h.dump(), before);
    assert.equal(h.commits.length, 0);
  }
  const h = harness();
  await assert.rejects(h.api.mutate({ kind: 'work_title', workItemId: 'work1', title: '새 제목', expectedUpdatedAt: 100, operationId }, 'POST'));
  assert.equal(h.commits.length, 0);
});

test('server membership, not client identity, determines rename authority', async () => {
  for (const denied of [null, member({ active: false }), member({ workspaceId: 'other' }), member({ email: '' }), member({ email: 'team-access@smartfarm-work-manager.firebaseapp.com' })]) {
    const h = harness(); h.setMember(denied); const before = h.dump();
    await assert.rejects(h.rename(), /승인된 개인 계정/);
    assert.deepEqual(h.dump(), before);
  }
});

test('missing/deleted work and payment/subscription evidence are protected', async () => {
  for (const initial of [null, work({ deletedAt: 50 }), work({ workType: 'payment' }), work({ workType: 'subscription' })]) {
    const h = harness(initial); const before = h.dump();
    await assert.rejects(h.rename());
    assert.deepEqual(h.dump(), before);
  }
});

test('stale version rejects even for an unchanged title', async () => {
  const h = harness();
  h.put('workItems', work({ updatedAt: 101 }));
  const before = h.dump();
  await assert.rejects(h.rename({ title: '1회차 초안 작성' }), /다른 변경/);
  assert.deepEqual(h.dump(), before);
});

test('unchanged normalized title is a no-op with no history or updated timestamp', async () => {
  const h = harness(); const before = h.dump();
  const result = await h.rename({ title: ' 1회차 초안 작성 ' });
  assert.equal(result.historyEntry, undefined);
  assert.deepEqual(h.dump(), before);
  assert.deepEqual(h.commits, [[]]);
});

test('rejected transaction never leaves a title or orphan audit behind', async () => {
  const h = harness(); const before = h.dump(); h.failNext();
  await assert.rejects(h.rename(), /rejected commit/);
  assert.deepEqual(h.dump(), before);
  await h.rename();
  assert.equal(h.commits.length, 1);
});

test('lost response and exact duplicate requests produce one audit only', async () => {
  const h = harness(); h.loseNextResponse();
  await assert.rejects(h.rename(), /lost response/);
  const saved = h.dump();
  await h.rename();
  assert.deepEqual(h.dump(), saved);
  assert.equal(h.commits.flat().length, 2);
});

test('replay never overwrites a newer rename, and conflicting reuse is rejected', async () => {
  const h = harness();
  await h.rename();
  const prior = h.get('workItems', 'work1');
  await h.rename({ title: '더 최신 제목', expectedUpdatedAt: prior.updatedAt, operationId: 'abcdefgh-1234-4321-9876-123456789012' });
  const before = h.dump();
  assert.equal((await h.rename()).workItem.title, '더 최신 제목');
  await assert.rejects(h.rename({ title: '충돌 제목' }), /다른 요청/);
  await assert.rejects(h.rename({ expectedUpdatedAt: prior.updatedAt }), /다른 요청/);
  h.actor('member2'); h.setMember(member({ id: 'member2' }));
  await assert.rejects(h.rename(), /다른 요청/);
  assert.deepEqual(h.dump().filter(([path]) => path !== 'appMembers/member2'), before);
});

test('concurrent renames with the same version cannot clobber each other', async () => {
  const h = harness();
  const results = await Promise.allSettled([
    h.rename(),
    h.rename({ title: '경쟁 제목', operationId: 'abcdefgh-1234-4321-9876-123456789012' }),
  ]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected']);
  assert.equal(h.get('workItems', 'work1').title, '수정한 업무명');
  assert.equal(h.commits.flat().length, 2);
});

test('audit recorder falls back to server email when member display name is empty', async () => {
  const h = harness(); h.setMember(member({ displayName: '' }));
  await h.rename();
  assert.equal(h.get('historyEntries', operationId).recorder, 'member@example.test');
});
