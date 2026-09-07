import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

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
      Response,
      Date,
      console,
      require: (name) => {
        if (name in overrides) return overrides[name];
        if (name.startsWith('@/'))
          return load(name.slice(2) + '.ts', overrides, '', globals, cache);
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
