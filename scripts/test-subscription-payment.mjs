import assert from 'node:assert/strict';
function projectWork(h, parentId = '', operationId = '') {
  const base = h.body();
  return {
    ...base,
    paymentRequest: undefined,
    operationId,
    workItem: {
      ...base.workItem,
      farmRecordId: '',
      projectId: 'p1',
      parentWorkItemId: parentId,
      workType: 'communication',
      title: parentId ? '세부 실행' : '상위 견적 제출',
      status: 'open',
    },
    history: h.history(0),
  };
}
async function changeTask(h, id, newStatus, extra = {}) {
  h.sync();
  const task = h.list('workItems').find((item) => item.id === id);
  return h.api.post({
    kind: 'history',
    history: {
      ...h.history(0),
      workItemId: id,
      expectedUpdatedAt: task.updatedAt,
      newStatus,
      ...extra,
    },
  });
}
test('3단계 업무의 부모 연결·완료 방지·완료 후 다시 열기 순서를 지킨다', async () => {
  const h = harness();
  const parent = (await h.api.post(projectWork(h))).workItem;
  h.sync();
  const child = (
    await h.api.post(projectWork(h, parent.id, 'child-operation-0001'))
  ).workItem;
  h.sync();
  const grandchild = (
    await h.api.post(projectWork(h, child.id, 'child-operation-0002'))
  ).workItem;
  assert.equal(
    h.list('workItems').find((x) => x.id === parent.id).openChildCount,
    1,
  );
  assert.equal(
    h.list('workItems').find((x) => x.id === child.id).openChildCount,
    1,
  );
  await assert.rejects(changeTask(h, parent.id, 'completed'), /세부|하위/);
  await assert.rejects(changeTask(h, child.id, 'completed'), /세부|하위/);
  await changeTask(h, grandchild.id, 'completed');
  assert.equal(
    h.list('workItems').find((x) => x.id === child.id).openChildCount,
    0,
  );
  await changeTask(h, child.id, 'completed');
  await changeTask(h, parent.id, 'completed');
  await assert.rejects(changeTask(h, grandchild.id, 'open'), /상위/);
  await changeTask(h, parent.id, 'open');
  await changeTask(h, child.id, 'open');
  await changeTask(h, grandchild.id, 'open');
  assert.equal(
    h.list('workItems').find((x) => x.id === parent.id).openChildCount,
    1,
  );
  assert.equal(
    h.list('workItems').find((x) => x.id === child.id).openChildCount,
    1,
  );
  assert.equal(h.list('subscriptionEvents').length, 0);
});
test('자식 생성 동시 재전송·응답 실패 재시도는 부모와 자식을 한 번만 변경한다', async () => {
  const h = harness();
  const parent = (await h.api.post(projectWork(h))).workItem;
  h.sync();
  const body = projectWork(h, parent.id, 'child-operation-retry1');
  const results = await Promise.all([h.api.post(body), h.api.post(body)]);
  h.sync();
  await h.api.post(body);
  assert.equal(results[0].workItem.id, results[1].workItem.id);
  assert.equal(h.list('workItems').length, 2);
  assert.equal(
    h.list('workItems').find((x) => x.id === parent.id).openChildCount,
    1,
  );
  assert.equal(
    h.list('historyEntries').filter((x) => x.id === body.operationId).length,
    1,
  );
  await assert.rejects(
    h.api.post({ ...body, workItem: { ...body.workItem, title: '다른 제목' } }),
    /이미 저장/,
  );
});
test('자식 생성 저장 실패는 자식·상위 카운터·이미지를 함께 되돌린다', async () => {
  const h = harness();
  const parent = (await h.api.post(projectWork(h))).workItem;
  h.sync();
  const body = {
    ...projectWork(h, parent.id, 'child-operation-fail1'),
    images: [screenshot()],
  };
  h.fail();
  await assert.rejects(h.api.post(body), /Simulated/);
  assert.equal(h.list('workItems').length, 1);
  assert.equal(h.list('imageAttachments').length, 0);
  assert.equal(h.list('workItems')[0].openChildCount, 0);
  await h.api.post(body);
  assert.equal(h.list('workItems').length, 2);
});
test('빠른 상태 변경은 전후 상태 이력을 추가하며 재시도와 오래된 초안을 방어한다', async () => {
  const h = harness();
  const item = (await h.api.post(projectWork(h))).workItem;
  h.sync();
  const command = {
    kind: 'history',
    history: {
      ...h.history(0),
      actionContent: '',
      receivedContent: '',
      workItemId: item.id,
      newStatus: 'in_progress',
      expectedUpdatedAt: item.updatedAt,
      operationId: 'quick-operation-0001',
    },
  };
  await h.api.post(command);
  await h.api.post(command);
  const saved = h
    .list('historyEntries')
    .find((x) => x.id === command.history.operationId);
  assert.equal(saved.previousWorkStatus, 'open');
  assert.equal(saved.newWorkStatus, 'in_progress');
  assert.match(saved.actionContent, /→/);
  h.sync();
  await assert.rejects(
    h.api.post({
      ...command,
      history: {
        ...command.history,
        operationId: 'quick-operation-0002',
        newStatus: 'completed',
      },
    }),
    /먼저 저장/,
  );
  assert.equal(h.list('workItems')[0].status, 'in_progress');
});
test('집계는 부모 중복 없이 실행 업무를 세며 누락된 자식은 100%로 표시하지 않는다', () => {
  const { buildWorkHierarchy, summarizeWorkHierarchy } = load(
    'lib/work-hierarchy.ts',
  );
  const items = [
    { id: 'a', status: 'open', childWorkItemIds: ['b', 'c'] },
    { id: 'b', parentWorkItemId: 'a', status: 'completed' },
    {
      id: 'c',
      parentWorkItemId: 'a',
      status: 'waiting',
      childWorkItemIds: ['d'],
    },
    { id: 'd', parentWorkItemId: 'c', status: 'open' },
  ];
  const stats = summarizeWorkHierarchy(items);
  assert.equal(stats.rootCount, 1);
  assert.equal(stats.subtaskCount, 3);
  assert.equal(stats.leafCount, 2);
  assert.equal(stats.completionRate, 50);
  assert.equal(buildWorkHierarchy(items).progress('a').blocked, 1);
  assert.equal(summarizeWorkHierarchy(items.slice(0, 2)).completionRate, null);
  assert.equal(
    buildWorkHierarchy([
      { id: 'x', parentWorkItemId: 'y' },
      { id: 'y', parentWorkItemId: 'x' },
    ]).descendants('x').length,
    1,
  );
});
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { posix } from 'node:path';

const compile = (path) =>
  ts.transpileModule(
    readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
const scripts = new Map(
  [
    'lib/farm-types.ts',
    'lib/subscription-payment.ts',
    'lib/subscription-renewal-report.ts',
    'lib/project-work.ts',
    'lib/work-hierarchy.ts',
    'lib/received-images.ts',
    'lib/firebase/received-images-store.ts',
    'lib/firebase/farm-ledger-store.ts',
  ].map((path) => [path, compile(path)]),
);
function load(
  path,
  overrides = {},
  extra = '',
  globals = {},
  cache = new Map(),
) {
  if (cache.has(path)) return cache.get(path);
  const result = {};
  cache.set(path, result);
  vm.runInNewContext(
    scripts.get(path) + extra,
    {
      exports: result,
      module: { exports: result },
      crypto: webcrypto,
      TextEncoder,
      atob,
      Response,
      Date,
      console,
      require: (name) => {
        if (name in overrides) return overrides[name];
        if (name.startsWith('@/'))
          return load(name.slice(2) + '.ts', overrides, '', globals, cache);
        if (name.startsWith('.'))
          return load(
            posix.normalize(posix.join(posix.dirname(path), name + '.ts')),
            overrides,
            '',
            globals,
            cache,
          );
        throw new Error('Unexpected dependency ' + name);
      },
      ...globals,
    },
    { filename: path },
  );
  return result;
}
const { calculateSubscriptionPayment } = load('lib/subscription-payment.ts');
for (const [expiry, paid, amount, expected] of [
  ['2026-01-31', '2026-03-31', 66000, '2027-01-31'],
  ['2026-01-31', '2026-04-01', 66000, '2027-04-30'],
  ['2026-12-31', '2027-02-28', 66000, '2027-12-31'],
  ['2026-12-31', '2027-03-01', 66000, '2028-03-31'],
  ['2023-12-31', '2024-02-29', 66000, '2024-12-31'],
  ['2024-02-29', '2024-03-01', 66000, '2025-02-28'],
  ['2024-02-29', '2024-03-01', 132000, '2026-02-28'],
  ['2024-02-29', '2024-05-10', 132000, '2026-05-31'],
  ['2026-12-31', '2026-09-07', 66000, '2027-12-31'],
])
  test('기간 계산: ' + expiry + ' / ' + paid + ' / ' + amount, () => {
    assert.equal(
      calculateSubscriptionPayment({
        amount,
        currentExpiryDate: expiry,
        paymentDate: paid,
        today: paid,
      }).newExpiryDate,
      expected,
    );
  });
test('미달·배수 외·소수·잘못된 날짜·미래 결제는 거부', () => {
  const valid = {
    amount: 66000,
    currentExpiryDate: '2026-08-31',
    paymentDate: '2026-09-06',
    today: '2026-09-07',
  };
  for (const amount of [
    0,
    -66000,
    33000,
    99000,
    66000.5,
    NaN,
    Infinity,
    66000 * 100000000,
  ])
    assert.throws(() => calculateSubscriptionPayment({ ...valid, amount }));
  for (const patch of [
    { currentExpiryDate: '' },
    { currentExpiryDate: '2026-02-30' },
    { paymentDate: '2026-09-08' },
  ])
    assert.throws(() => calculateSubscriptionPayment({ ...valid, ...patch }));
});

const fixedNow = Date.parse('2026-09-07T12:00:00+09:00');
const paidAt = Date.parse('2026-09-06T10:00:00+09:00');
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }
  static now() {
    return fixedNow;
  }
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const workspacePath = 'workspaces/test/';
const persistedCollections = {
  projects: 'projects',
  farms: 'farms',
  records: 'farmRecords',
  workItems: 'workItems',
  historyEntries: 'historyEntries',
  subscriptionEvents: 'subscriptionEvents',
  inboxItems: 'inboxItems',
  blockerEpisodes: 'blockerEpisodes',
  checklistItems: 'checklistItems',
  visits: 'visits',
  projectDocuments: 'projectDocuments',
  projectUpdates: 'projectUpdates',
};
function harness() {
  let state = new Map();
  let queue = Promise.resolve();
  let failCommit = false;
  const snapshot = (path) => ({
    id: path.split('/').at(-1),
    exists: () => state.has(path),
    data: () => clone(state.get(path)),
  });
  const writer = () => {
    const operations = [];
    return {
      operations,
      get: async (ref) => {
        assert.equal(
          operations.length,
          0,
          'All transaction reads precede writes',
        );
        return snapshot(ref.path);
      },
      set: (ref, data) => {
        assert.ok(!JSON.stringify(data).includes('undefined'));
        operations.push(['set', ref.path, clone(data)]);
      },
      update: (ref, data) => operations.push(['update', ref.path, clone(data)]),
      commit: async () => {
        if (operations.length && failCommit) {
          failCommit = false;
          throw new Error('Simulated commit failure');
        }
        const next = new Map(state);
        for (const [kind, path, value] of operations) {
          if (kind === 'update') {
            if (!next.has(path)) throw new Error('Missing update target');
            next.set(path, { ...next.get(path), ...value });
          } else {
            if (
              next.has(path) &&
              /\/(historyEntries|subscriptionEvents)\//.test(path)
            )
              throw new Error('Immutable history overwrite');
            next.set(path, value);
          }
        }
        state = next;
      },
    };
  };
  const firestore = {
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    collection: (_db, ...parts) => ({ path: parts.join('/') }),
    where: (field, op, value) => ({ field, op, value }),
    limit: (count) => ({ count }),
    query: (collection, ...conditions) => ({ ...collection, conditions }),
    getDocsFromServer: async (query) => {
      let paths = [...state.keys()].filter(
        (path) =>
          path.startsWith(query.path + '/') &&
          path.split('/').length === query.path.split('/').length + 1,
      );
      for (const condition of query.conditions)
        if (condition.field)
          paths = paths.filter((path) =>
            condition.op === 'in'
              ? condition.value.includes(state.get(path)[condition.field])
              : state.get(path)[condition.field] === condition.value,
          );
      paths = paths.slice(
        0,
        query.conditions.find((condition) => condition.count)?.count ??
          Infinity,
      );
      return { size: paths.length, docs: paths.map(snapshot) };
    },
    runTransaction: (_db, callback) => {
      const result = queue.then(async () => {
        const batch = writer();
        const value = await callback(batch);
        await batch.commit();
        return value;
      });
      queue = result.catch(() => {});
      return result;
    },
    writeBatch: () => writer(),
    waitForPendingWrites: async () => {},
  };
  const api = load(
    'lib/firebase/farm-ledger-store.ts',
    {
      'firebase/firestore': firestore,
      './client': {
        firebaseWorkspaceId: 'test',
        getFirebaseServices: () => ({ db: {} }),
        requireSignedInUser: () => ({ uid: 'tester' }),
      },
    },
    '\nexports.seedWorkspace = value => { latestWorkspace = value; }; exports.post = body => mutateFarmLedger("POST", body);',
    { Date: FixedDate, console: { error() {} } },
  );
  const put = (collection, value) =>
    state.set(workspacePath + collection + '/' + value.id, clone(value));
  const list = (collection) =>
    [...state.entries()]
      .filter(([path]) => path.startsWith(workspacePath + collection + '/'))
      .map(([, value]) => clone(value));
  const sync = (patch = {}) =>
    api.seedWorkspace({
      ...Object.fromEntries(
        Object.entries(persistedCollections).map(([key, collection]) => [
          key,
          list(collection),
        ]),
      ),
      ...patch,
    });
  const base = {
    createdAt: fixedNow - 10000,
    updatedAt: fixedNow - 1000,
    lastActivityAt: fixedNow - 1000,
  };
  put('projects', { ...base, id: 'p1', status: 'active', name: '사업' });
  put('farms', { ...base, id: 'f1', name: '농가' });
  put('farmRecords', {
    ...base,
    id: 'r1',
    farmId: 'f1',
    projectId: 'p1',
    renewalCount: 0,
    currentSubscriptionExpiresAt: '2026-08-31',
    initialSubscriptionExpiresAt: '2026-08-31',
    subscriptionStatus: 'expired',
    lastPaymentDate: '',
  });
  sync();
  const request = (id = 'operation-00000001') => ({
    operationId: id,
    expectedCurrentExpiryDate:
      list('farmRecords')[0].currentSubscriptionExpiresAt,
    expectedUpdatedAt: list('farmRecords')[0].updatedAt,
  });
  const history = (amount = 66000) => ({
    channel: 'phone',
    sender: '',
    receivedContent: '입금 확인',
    actionContent: '확인',
    amount,
    recorder: '담당자',
    occurredAt: paidAt,
    referenceUrl: '',
  });
  const workInput = {
    farmRecordId: 'r1',
    workType: 'payment',
    title: '구독 입금',
    status: 'completed',
    owner: '담당자',
    dueDate: '',
    description: '',
    expectedOutcome: '',
    nextAction: '',
    priority: 'medium',
    reviewDate: '',
    responseDueAt: 0,
    blockedReason: '',
    blockedBy: '',
    expectedUnblockDate: '',
  };
  const body = (id, amount = 66000) => ({
    kind: 'work_item',
    workItem: { ...workInput },
    history: history(amount),
    checklist: [],
    sourceInboxId: '',
    paymentRequest: request(id),
  });
  return {
    api,
    put,
    list,
    sync,
    request,
    body,
    history,
    fail: () => {
      failCommit = true;
    },
  };
}
const capture = (patch = {}) => ({
  kind: 'inbox',
  inboxItem: {
    operationId: 'capture-0000000001',
    projectId: 'p1',
    taskTitle: '견적서 제출',
    channel: 'email',
    sender: '태백 사업단',
    content: '문의사항 피드백 후 견적서를 제출해 주세요.',
    capturedBy: '담당자',
    receivedAt: paidAt,
    referenceUrl: '',
    ...patch,
  },
});
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl2sAAAAASUVORK5CYII=';
const screenshot = () => ({
  id: 'screenshot-00000001',
  name: '캡처.png',
  mimeType: 'image/png',
  dataUrl: 'data:image/png;base64,' + png,
  size: Buffer.from(png, 'base64').length,
  width: 1,
  height: 1,
});

test('농가가 없는 프로젝트도 빠른 수신으로 하위 업무와 원문을 함께 생성한다', async () => {
  const h = harness();
  h.put('projects', {
    id: 'no-farms',
    status: 'active',
    createdAt: fixedNow - 100,
    updatedAt: fixedNow - 100,
  });
  h.sync();
  const result = await h.api.post(capture({ projectId: 'no-farms' }));
  assert.equal(result.inboxItem.status, 'converted');
  const task = h.list('workItems')[0];
  assert.equal(task.projectId, 'no-farms');
  assert.equal(task.farmRecordId, '');
  assert.equal(task.title, '견적서 제출');
  assert.equal(task.status, 'open');
  assert.equal(
    h.list('historyEntries')[0].receivedContent,
    capture().inboxItem.content,
  );
  assert.equal(h.list('subscriptionEvents').length, 0);
});

test('프로젝트 미지정 수신은 업무를 만들지 않고 나중에 원문·이미지를 이어받는다', async () => {
  const h = harness();
  await h.api.post(
    capture({ projectId: '', content: '', images: [screenshot()] }),
  );
  assert.equal(h.list('workItems').length, 0);
  assert.equal(h.list('imageAttachments').length, 1);
  h.sync();
  const base = h.body();
  const result = await h.api.post({
    ...base,
    paymentRequest: undefined,
    sourceInboxId: 'capture-0000000001',
    workItem: {
      ...base.workItem,
      farmRecordId: '',
      projectId: 'p1',
      workType: 'communication',
      status: 'open',
    },
    history: h.history(0),
  });
  assert.equal(result.historyEntry.imageIds[0], screenshot().id);
  assert.equal(h.list('imageAttachments').length, 1);
  assert.equal(h.list('inboxItems')[0].status, 'converted');
  await assert.rejects(
    h.api.post({
      ...base,
      paymentRequest: undefined,
      sourceInboxId: 'capture-0000000001',
      workItem: {
        ...base.workItem,
        farmRecordId: '',
        projectId: 'p1',
        workType: 'communication',
      },
      history: h.history(0),
    }),
    /이미 정리/,
  );
});

test('빠른 수신 재시도·동시 전송은 한 업무만 생성하고 이미지 저장 실패는 원자적으로 되돌린다', async () => {
  const h = harness();
  const body = capture({ images: [screenshot()] });
  h.fail();
  await assert.rejects(h.api.post(body), /Simulated/);
  for (const collection of [
    'inboxItems',
    'workItems',
    'historyEntries',
    'imageAttachments',
  ])
    assert.equal(h.list(collection).length, 0);
  await Promise.all([h.api.post(body), h.api.post(body)]);
  for (const collection of [
    'inboxItems',
    'workItems',
    'historyEntries',
    'imageAttachments',
  ])
    assert.equal(h.list(collection).length, 1);
  assert.ok(!('dataUrl' in h.list('inboxItems')[0]));
  assert.equal(h.list('historyEntries')[0].imageIds[0], screenshot().id);
});

test('프로젝트 업무는 처리 기록·막힘·완료 상태를 갱신하며 구독에는 영향을 주지 않는다', async () => {
  const h = harness();
  await h.api.post(capture());
  h.sync();
  const id = h.list('workItems')[0].id;
  await h.api.post({
    kind: 'history',
    history: {
      ...h.history(0),
      workItemId: id,
      newStatus: 'waiting',
      blockedReason: '사업단 회신 대기',
      blockedBy: '사업단',
    },
  });
  assert.equal(h.list('workItems')[0].status, 'waiting');
  h.sync();
  await h.api.post({
    kind: 'history',
    images: [{ ...screenshot(), id: 'screenshot-00000002' }],
    history: {
      ...h.history(0),
      workItemId: id,
      newStatus: 'completed',
      actionContent: '회신 확인 후 견적서 제출 완료',
    },
  });
  assert.equal(h.list('workItems')[0].status, 'completed');
  assert.ok(h.list('blockerEpisodes')[0].closedAt > 0);
  assert.equal(h.list('imageAttachments').length, 1);
  assert.equal(h.list('subscriptionEvents').length, 0);
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2026-08-31',
  );
});

test('잘못된 프로젝트·완료 프로젝트·농가 없는 입금 업무는 저장하지 않는다', async () => {
  const h = harness();
  await assert.rejects(
    h.api.post(capture({ projectId: 'missing' })),
    /찾을 수 없습니다/,
  );
  h.put('projects', { id: 'closed', status: 'completed' });
  h.sync();
  await assert.rejects(h.api.post(capture({ projectId: 'closed' })), /완료/);
  const body = h.body();
  await assert.rejects(
    h.api.post({
      ...body,
      workItem: { ...body.workItem, farmRecordId: '', projectId: 'p1' },
    }),
    /구독·입금/,
  );
  assert.equal(h.list('inboxItems').length, 0);
});

test('이미지 형식·개수·크기와 위장 파일을 검증한다', () => {
  const { parseReceivedImages } = load('lib/received-images.ts');
  assert.equal(parseReceivedImages([screenshot()]).length, 1);
  assert.throws(
    () => parseReceivedImages(Array.from({ length: 4 }, screenshot)),
    /최대 3장/,
  );
  assert.throws(
    () =>
      parseReceivedImages([
        { ...screenshot(), dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' },
      ]),
    /형식/,
  );
  assert.throws(
    () =>
      parseReceivedImages([
        {
          ...screenshot(),
          dataUrl: 'data:image/png;base64,PHNjcmlwdD4=',
          size: 8,
        },
      ]),
    /일치하지 않습니다/,
  );
  assert.throws(
    () =>
      parseReceivedImages([
        {
          ...screenshot(),
          dataUrl: 'data:image/png;base64,' + 'a'.repeat(600000),
        },
      ]),
    /크기/,
  );
});

test('프로젝트 하위 업무 판정에서 농가 입금·구독·자동 관리 메모를 제외한다', () => {
  const { isProjectTask } = load('lib/project-work.ts');
  assert.equal(
    isProjectTask({
      projectId: 'p1',
      farmRecordId: '',
      workType: 'communication',
    }),
    true,
  );
  assert.equal(
    isProjectTask({ projectId: 'p1', farmRecordId: '', workType: 'payment' }),
    false,
  );
  assert.equal(
    isProjectTask({ farmRecordId: 'r1', workType: 'payment' }),
    false,
  );
  assert.equal(
    isProjectTask({ farmRecordId: 'r1', workType: 'subscription' }),
    false,
  );
  assert.equal(isProjectTask({ farmRecordId: 'r1', workType: 'note' }), false);
});

test('입금·업무·갱신 이력·만료일을 한 번에 저장하고 첫 입금1회', async () => {
  const h = harness();
  await h.api.post(h.body());
  assert.equal(h.list('historyEntries').length, 1);
  assert.equal(h.list('subscriptionEvents').length, 1);
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2027-08-31',
  );
  assert.equal(h.list('farmRecords')[0].subscriptionStatus, 'active');
  assert.equal(h.list('subscriptionEvents')[0].paymentOrdinal, 1);
  assert.equal(
    h.list('historyEntries').find((entry) => entry.subscriptionEventId)
      ?.subscriptionPaymentOrdinal,
    1,
  );
  assert.equal(h.list('subscriptionEvents')[0].basisPaymentCount, 0);
  assert.equal(
    h.list('historyEntries')[0].subscriptionNewExpiryDate,
    '2027-08-31',
  );
});
test('같은 요청 재전송은 재입금·재연장하지 않는다', async () => {
  const h = harness();
  const body = h.body();
  const a = await h.api.post(body);
  h.sync();
  const b = await h.api.post(body);
  assert.equal(a.workItem.id, b.workItem.id);
  assert.equal(h.list('historyEntries').length, 1);
  assert.equal(h.list('subscriptionEvents').length, 1);
  await assert.rejects(
    h.api.post({ ...body, history: { ...body.history, amount: 132000 } }),
    /변경/,
  );
});
test('저장 실패는 부분 입금·부분 연장 없이 같은 요청 재시도 가능', async () => {
  const h = harness();
  const body = h.body();
  h.fail();
  await assert.rejects(h.api.post(body), /Simulated/);
  assert.equal(h.list('historyEntries').length, 0);
  assert.equal(h.list('subscriptionEvents').length, 0);
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2026-08-31',
  );
  await h.api.post(body);
  assert.equal(h.list('subscriptionEvents').length, 1);
});
test('동시 입금 두 요청은 이전 만료일을 중복 연장하지 않는다', async () => {
  const h = harness();
  const results = await Promise.allSettled([
    h.api.post(h.body('operation-00000001')),
    h.api.post(h.body('operation-00000002')),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(h.list('historyEntries').length, 1);
});
test('132000원은24개월이지만 입금·갱신은1회', async () => {
  const h = harness();
  await h.api.post(h.body(undefined, 132000));
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2028-08-31',
  );
  assert.equal(h.list('farmRecords')[0].subscriptionPaymentCount, 1);
});
test('기존 입금 업무에 추가한 두 번째 입금은 반복 갱신', async () => {
  const h = harness();
  const first = await h.api.post(h.body());
  h.sync();
  await h.api.post({
    kind: 'history',
    history: { ...h.history(), workItemId: first.workItem.id },
    paymentRequest: h.request('operation-00000002'),
  });
  assert.equal(h.list('historyEntries').length, 2);
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2028-08-31',
  );
  assert.equal(h.list('subscriptionEvents')[1].paymentOrdinal, 2);
  assert.equal(
    h
      .list('historyEntries')
      .filter((entry) => entry.subscriptionPaymentOrdinal === 2).length,
    1,
  );
});
test('캐시에서 이전 입금이 누락돼도 서버 자료로2회차 판정', async () => {
  const h = harness();
  h.put('workItems', {
    id: 'legacy-work',
    farmRecordId: 'r1',
    workType: 'payment',
    updatedAt: fixedNow - 2000,
  });
  h.put('historyEntries', {
    id: 'legacy-payment',
    workItemId: 'legacy-work',
    amount: 66000,
    occurredAt: paidAt - 86400000,
  });
  await h.api.post(h.body());
  assert.equal(h.list('subscriptionEvents')[0].paymentOrdinal, 2);
  assert.equal(h.list('subscriptionEvents')[0].basisPaymentCount, 1);
});
test('캐시에 없는 이탈도 서버에서 찾아 자동갱신에 대체 연결', async () => {
  const h = harness();
  h.put('subscriptionEvents', {
    id: 'legacy-churn',
    farmRecordId: 'r1',
    projectId: 'p1',
    eventType: 'churned',
    basisExpiryDate: '2026-08-31',
    newExpiryDate: '',
    processedAt: '2026-08-31',
  });
  await h.api.post(h.body());
  assert.deepEqual(h.list('subscriptionEvents')[1].supersedesEventIds, [
    'legacy-churn',
  ]);
});
test('수신함 전환 입금은 실제 결제일로1회만 저장하고 재시도 안전', async () => {
  const h = harness();
  h.put('inboxItems', {
    id: 'inbox',
    status: 'unprocessed',
    channel: 'phone',
    sender: '',
    content: '입금',
    capturedBy: '담당자',
    receivedAt: paidAt,
    referenceUrl: '',
  });
  h.sync();
  const body = { ...h.body(), sourceInboxId: 'inbox' };
  await h.api.post(body);
  h.sync();
  await h.api.post(body);
  assert.equal(h.list('historyEntries').length, 2);
  assert.equal(
    h.list('historyEntries').reduce((n, e) => n + e.amount, 0),
    66000,
  );
  assert.equal(h.list('subscriptionEvents')[0].processedAt, '2026-09-06');
});
test('미달 입금·미래 시각·오래된 구독 버전은 아무것도 저장하지 않는다', async () => {
  for (const modify of [
    (b) => ({ ...b, history: { ...b.history, amount: 33000 } }),
    (b) => ({ ...b, history: { ...b.history, occurredAt: fixedNow + 1000 } }),
    (b) => ({
      ...b,
      paymentRequest: { ...b.paymentRequest, expectedUpdatedAt: 1 },
    }),
  ]) {
    const h = harness();
    await assert.rejects(h.api.post(modify(h.body())));
    assert.equal(h.list('historyEntries').length, 0);
    assert.equal(h.list('subscriptionEvents').length, 0);
  }
});
test('0원 업무계획이나 다른 업무 금액은 구독 자동연장 대상이 아니다', async () => {
  const h = harness();
  await h.api.post({ ...h.body(undefined, 0), paymentRequest: undefined });
  await h.api.post({
    ...h.body(undefined, 33000),
    workItem: { ...h.body().workItem, workType: 'communication' },
    paymentRequest: undefined,
  });
  assert.equal(h.list('subscriptionEvents').length, 0);
  assert.equal(
    h.list('farmRecords')[0].currentSubscriptionExpiresAt,
    '2026-08-31',
  );
});
