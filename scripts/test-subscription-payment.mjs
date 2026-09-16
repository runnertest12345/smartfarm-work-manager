import assert from 'node:assert/strict';
async function deleteOrRestoreTask(
  h,
  task,
  deleted = true,
  operationId = crypto.randomUUID(),
) {
  h.sync();
  return h.api.patch({
    kind: 'work_lifecycle',
    workItemId: task.id,
    expectedUpdatedAt: task.updatedAt,
    deleted,
    operationId,
  });
}

test('업무 삭제·복원은 원본 상태·이력·첨부를 보존하고 실패·중복 요청에 안전하다', async () => {
  const h = organizationHarness('head');
  const task = (await h.api.post(internalWork(h))).workItem;
  const histories = h.list('historyEntries');
  h.fail();
  await assert.rejects(
    deleteOrRestoreTask(h, task, true, 'delete-task-failure'),
    /Simulated/,
  );
  assert.equal(h.list('workItems')[0].deletedAt, undefined);
  assert.deepEqual(h.list('historyEntries'), histories);
  const result = await deleteOrRestoreTask(
    h,
    task,
    true,
    'delete-task-success',
  );
  assert.ok(result.workItem.deletedAt);
  assert.equal(result.workItem.status, task.status);
  assert.equal(result.workItem.title, task.title);
  await deleteOrRestoreTask(h, task, true, 'delete-task-success');
  assert.equal(h.list('historyEntries').length, histories.length + 1);
  await assert.rejects(changeTask(h, task.id, 'in_progress'), /삭제된/);
  await assert.rejects(
    h.api.post(internalWork(h, 'deleted-parent-new-child', task.id)),
    /삭제된/,
  );
  const restored = await deleteOrRestoreTask(h, result.workItem, false);
  assert.equal(restored.workItem.deletedAt, 0);
  assert.equal(restored.workItem.status, task.status);
  for (const original of histories)
    assert.deepEqual(
      h.list('historyEntries').find((x) => x.id === original.id),
      original,
    );
  assert.equal(h.list('historyEntries').length, histories.length + 2);
  assert.equal(h.list('subscriptionEvents').length, 0);
});

test('등록자·관리자만 삭제하고 입금·타인·비활성·오래된 초안은 거부한다', async () => {
  for (const actor of ['head', 'staff', 'admin']) {
    const h = organizationHarness(actor);
    const task = (await h.api.post(internalWork(h))).workItem;
    h.put('workItems', { ...task, createdByUid: 'head' });
    h.sync();
    if (actor === 'staff')
      await assert.rejects(deleteOrRestoreTask(h, task), /등록자/);
    else {
      await assert.rejects(
        deleteOrRestoreTask(h, { ...task, updatedAt: task.updatedAt - 1 }),
        /다른 변경/,
      );
      await deleteOrRestoreTask(h, task);
    }
  }
  const h = organizationHarness('admin');
  const task = (await h.api.post(internalWork(h))).workItem;
  for (const workType of ['payment', 'subscription']) {
    h.put('workItems', { ...task, workType });
    await assert.rejects(deleteOrRestoreTask(h, task), /증빙/);
  }
  h.put('workItems', task);
  h.putMember({ ...h.getMember('admin'), active: false });
  await assert.rejects(deleteOrRestoreTask(h, task), /등록자/);
});

test('완료 자식도 먼저 삭제하고 부모·자식 순서로 복원하며 카운터를 복구한다', async () => {
  for (const completed of [false, true]) {
    const h = organizationHarness('head');
    const parent = (await h.api.post(internalWork(h))).workItem;
    h.sync();
    let child = (
      await h.api.post(internalWork(h, 'delete-child-create', parent.id))
    ).workItem;
    if (completed) {
      await changeTask(h, child.id, 'completed');
      child = h.list('workItems').find((x) => x.id === child.id);
    }
    const current = (id) => h.list('workItems').find((x) => x.id === id);
    await assert.rejects(
      deleteOrRestoreTask(h, current(parent.id)),
      /세부 업무/,
    );
    await deleteOrRestoreTask(h, child);
    assert.deepEqual(current(parent.id).childWorkItemIds, []);
    assert.equal(current(parent.id).openChildCount, 0);
    await deleteOrRestoreTask(h, current(parent.id));
    await assert.rejects(
      deleteOrRestoreTask(h, current(child.id), false),
      /상위 업무를 먼저 복원/,
    );
    await deleteOrRestoreTask(h, current(parent.id), false);
    await deleteOrRestoreTask(h, current(child.id), false);
    assert.deepEqual(current(parent.id).childWorkItemIds, [child.id]);
    assert.equal(current(parent.id).openChildCount, completed ? 0 : 1);
    assert.equal(current(child.id).parentWorkItemId, parent.id);
  }
});

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
    'lib/project-settlements.ts',
    'lib/subscription-payment.ts',
    'lib/subscription-renewal-report.ts',
    'lib/project-work.ts',
    'lib/internal-projects.ts',
    'lib/project-installation-farms.ts',
    'lib/service-work.ts',
    'lib/work-lifecycle.ts',
    'lib/work-title.ts',
    'lib/organization.ts',
    'lib/login-identity.ts',
    'lib/firebase/organization-store.ts',
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
      TextDecoder,
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
const settlementTools = load('lib/project-settlements.ts');
const internalProjectTools = load('lib/internal-projects.ts');

test('회차 원본에서 기한·마감일·금액을 재계산하여 오래된 요약이 위험 KPI를 숨기지 않는다', () => {
  const first = {
    ...settlementTools.emptySettlement(),
    status: 'paid',
    approvedAmount: 100,
    paidAmount: 100,
    settledAt: '2026-01-01',
  };
  const second = {
    ...settlementTools.emptySettlement(),
    dueDate: '2026-02-01',
  };
  const project = settlementProject({
    settlementDueDate: '',
    settlementPaidAmount: 999,
    settlementStatus: 'closed',
    settlementRounds: { first, second },
  });
  const result = settlementTools.normalizeProjectSettlement(project);
  assert.equal(result.settlementDueDate, '2026-02-01');
  assert.equal(result.settlementPaidAmount, 100);
  assert.equal(result.settlementStatus, 'collecting');
  assert.equal(result.settledAt, '');
});

function settlementProject(patch = {}) {
  return {
    name: '정산 시험 사업',
    projectType: 'general',
    year: 2026,
    institution: '시험 기관',
    status: 'active',
    description: '',
    targetFarmCount: 0,
    manager: '담당',
    startDate: '',
    endDate: '',
    currentStage: 'operation',
    settlementStatus: 'closed',
    settlementDueDate: '',
    contractAmount: 1000,
    settlementClaimAmount: 300,
    settlementApprovedAmount: 300,
    settlementPaidAmount: 300,
    settledAt: '2025-12-31',
    settlementOwner: '담당',
    settlementEvidenceUrl: '',
    settlementNote: '기존 내역',
    ...patch,
  };
}

test('정산 회차는 금액을 중복하지 않고 미지정 보존·빈 회차 지정·전체 상태를 계산한다', () => {
  const {
    emptySettlement,
    legacySettlement,
    withSettlementRounds,
    assignLegacySettlement,
    assertSettlementTransition,
    parseSettlementRounds,
  } = settlementTools;
  const old = settlementProject();
  const split = withSettlementRounds(old, {
    first: emptySettlement(),
    second: emptySettlement(),
    unassigned: legacySettlement(old),
  });
  assertSettlementTransition(old, split);
  assert.equal(split.settlementPaidAmount, 300);
  const assigned = withSettlementRounds(
    split,
    assignLegacySettlement(split.settlementRounds, 'first'),
  );
  assertSettlementTransition(split, assigned);
  assert.equal(assigned.settlementPaidAmount, 300);
  assert.equal(assigned.settlementStatus, 'collecting');
  assert.equal(assigned.settlementRounds.unassigned, undefined);
  const complete = withSettlementRounds(assigned, {
    ...assigned.settlementRounds,
    second: {
      ...emptySettlement(),
      status: 'paid',
      approvedAmount: 200,
      paidAmount: 200,
    },
  });
  assert.equal(complete.settlementStatus, 'paid');
  assert.equal(complete.settlementPaidAmount, 500);
  assert.equal(complete.contractAmount, 1000);
  assert.equal(complete.settledAt, '');
  assert.throws(
    () =>
      assertSettlementTransition(
        split,
        withSettlementRounds(split, {
          first: emptySettlement(),
          second: emptySettlement(),
        }),
      ),
    /기존 내역/,
  );
  assert.throws(
    () =>
      assignLegacySettlement(
        { ...split.settlementRounds, first: legacySettlement(old) },
        'first',
      ),
    /이미 입력/,
  );
  for (const patch of [
    { paidAmount: -1 },
    { paidAmount: 301 },
    { claimAmount: 0.5 },
    { dueDate: '2026-02-30' },
    { evidenceUrl: 'javascript:alert(1)' },
  ])
    assert.throws(() =>
      parseSettlementRounds({
        first: { ...legacySettlement(old), ...patch },
        second: emptySettlement(),
      }),
    );
});

test('정산은 1차만 완료 가능하며 추가 차수와 미지정 원본을 합계에 한 번만 포함한다', () => {
  const { emptySettlement, withSettlementRounds, addSettlementRound, removeLastSettlementRound, parseSettlementRounds, assertSettlementTransition } = settlementTools;
  const done = { ...emptySettlement(), status: 'paid', claimAmount: 100, approvedAmount: 100, paidAmount: 100, settledAt: '2026-09-11' };
  let rounds = { first: done };
  assert.equal(withSettlementRounds(settlementProject(), rounds).settlementStatus, 'paid');
  rounds = addSettlementRound(addSettlementRound(rounds));
  assert.equal(withSettlementRounds(settlementProject(), rounds).settlementStatus, 'collecting');
  rounds.second = done;
  rounds.third = { ...done, status: 'submitted', paidAmount: 0, settledAt: '', dueDate: '2026-10-01' };
  const project = withSettlementRounds(settlementProject(), rounds);
  assert.equal(project.settlementPaidAmount, 200);
  assert.equal(project.settlementClaimAmount, 300);
  assert.equal(project.settlementDueDate, '2026-10-01');
  assert.equal(project.settledAt, '');
  assert.throws(() => removeLastSettlementRound(rounds), /비어 있는/);
  assert.throws(() => assertSettlementTransition(project, withSettlementRounds(project, { first: done, second: done })), /삭제/);
  assert.throws(() => parseSettlementRounds({ first: done, third: done }), /순서/);
  assert.throws(() => parseSettlementRounds({ first: done, invalid: done }), /회차/);
  assert.throws(() => parseSettlementRounds({ first: { ...done, claimAmount: 1e15 }, second: done }), /합계/);
  let maximum = { first: emptySettlement() };
  for (let count = 1; count < 3; count++) maximum = addSettlementRound(maximum);
  assert.equal(Object.keys(parseSettlementRounds(maximum)).length, 3);
  assert.throws(() => addSettlementRound(maximum), /최대 3/);
  const withOld = { ...maximum, unassigned: done };
  const assigned = settlementTools.assignLegacySettlement(withOld, 'third');
  assert.equal(withSettlementRounds(project, assigned).settlementPaidAmount, 100);
  assertSettlementTransition(withSettlementRounds(project, withOld), withSettlementRounds(project, assigned));
});

test('추가 정산 차수도 저장·재조회·실패 복구와 감사 이력에 보존된다', async () => {
  const h = harness();
  const { emptySettlement, withSettlementRounds } = settlementTools;
  const old = { ...withSettlementRounds(settlementProject(), { first: emptySettlement(), second: emptySettlement() }), id: 'multi-round-project', createdAt: 1, updatedAt: 1, createdByUid: 'tester', updatedByUid: 'tester' };
  h.put('projects', old); h.sync();
  const updated = withSettlementRounds(old, { ...old.settlementRounds, third: { ...emptySettlement(), status: 'submitted', claimAmount: 300, owner: '담당자', dueDate: '2026-10-01', note: '3차 원본' } });
  const request = { kind: 'project', projectId: old.id, expectedUpdatedAt: 1, project: updated };
  h.fail();
  await assert.rejects(h.api.patch(request), /Simulated/);
  assert.equal(h.list('projects').find((p) => p.id === old.id).settlementRounds.third, undefined);
  const saved = (await h.api.patch(request)).project; h.sync();
  assert.equal(saved.settlementRounds.third.note, '3차 원본');
  assert.equal(saved.settlementClaimAmount, 300);
  assert.match(h.list('projectUpdates')[0].actionContent, /3차 정산/);
  await assert.rejects(h.api.patch(request), /다른 변경/);
  await assert.rejects(h.api.patch({ ...request, expectedUpdatedAt: saved.updatedAt, project: old }), /삭제/);
  assert.equal(h.list('projects').find((p) => p.id === old.id).settlementRounds.third.note, '3차 원본');
});

test('프로젝트 정산 저장은 차수·감사를 원자적으로 보존하고 과거 완료·오래된 초안·구버전 덮어쓰기를 막는다', async () => {
  const h = harness();
  const { emptySettlement, legacySettlement, withSettlementRounds } =
    settlementTools;
  const old = {
    ...settlementProject(),
    id: 'settlement-project',
    createdAt: 1,
    updatedAt: 1,
    createdByUid: 'tester',
    updatedByUid: 'tester',
  };
  h.put('projects', old);
  h.sync();
  const split = withSettlementRounds(old, {
    first: emptySettlement(),
    second: emptySettlement(),
    unassigned: legacySettlement(old),
  });
  const save = (project, version = 1) =>
    h.api.patch({
      kind: 'project',
      projectId: old.id,
      expectedUpdatedAt: version,
      project,
    });
  h.fail();
  await assert.rejects(save(split), /Simulated/);
  assert.equal(
    h.list('projects').find((p) => p.id === old.id).settlementRounds,
    undefined,
  );
  assert.equal(h.list('projectUpdates').length, 0);
  const result = await save(split);
  h.sync();
  assert.equal(result.project.settlementPaidAmount, 300);
  assert.match(h.list('projectUpdates')[0].actionContent, /1차 정산/);
  await assert.rejects(save(split), /다른 변경/);
  await assert.rejects(save(old, result.project.updatedAt), /최신 화면/);
  assert.equal(h.list('subscriptionEvents').length, 0);
  const closed = {
    ...old,
    year: 2025,
    status: 'completed',
    currentStage: 'closed',
  };
  h.put('projects', closed);
  h.sync();
  const unchanged = await save(closed);
  assert.equal(unchanged.project.status, 'completed');
  assert.equal(unchanged.project.settlementRounds, undefined);
  h.sync();
  await assert.rejects(
    save(
      { ...split, status: 'completed', currentStage: 'closed' },
      unchanged.project.updatedAt,
    ),
    /완료 근거/,
  );
});
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
function harness(
  actor = { uid: 'tester', email: 'tester@example.test', emailVerified: true },
) {
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
      react: { useEffect() {}, useState() {} },
      './client': {
        firebaseWorkspaceId: 'test',
        getFirebaseServices: () => ({ db: {} }),
        requireSignedInUser: () => actor,
      },
    },
    '\nexports.seedWorkspace = value => { latestWorkspace = value; }; exports.post = body => mutateFarmLedger("POST", body); exports.patch = body => mutateFarmLedger("PATCH", body);',
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
    organization: load(
      'lib/firebase/organization-store.ts',
      {
        react: { useEffect() {}, useState() {} },
        'firebase/firestore': firestore,
        './client': {
          firebaseWorkspaceId: 'test',
          getFirebaseServices: () => ({ db: {} }),
          requireSignedInUser: () => actor,
        },
      },
      '',
      { Date: FixedDate },
    ),
    getMember: (id) => clone(state.get('appMembers/' + id)),
    putMember: (value) => state.set('appMembers/' + value.id, clone(value)),
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
test('완료 사업의 농가 A/S는 등록·처리·체크·방문·완료·재개 가능하며 사업 완료와 구독은 유지한다', async () => {
  const h = harness();
  h.put('projects', { ...h.list('projects')[0], status: 'completed', currentStage: 'closed' });
  h.sync();
  const body = h.body();
  const result = await h.api.post({
    ...body, paymentRequest: undefined,
    workItem: { ...body.workItem, workType: 'service', status: 'open', title: '농가 점검' },
    history: h.history(0), checklist: ['센서 점검'],
  });
  const id = result.workItem.id;
  const history = async (newStatus) => {
    h.sync();
    return h.api.post({ kind: 'history', history: { ...h.history(0), workItemId: id, newStatus } });
  };
  await history('in_progress');
  h.sync();
  await h.api.patch({ kind: 'checklist', workItemId: id, checklistItemId: h.list('checklistItems')[0].id, isCompleted: true, completedBy: '담당자' });
  h.sync();
  const visit = {
    workItemId: id, scheduledAt: paidAt, assignedTo: '담당자', status: 'scheduled',
    actualStartedAt: 0, actualEndedAt: 0, preparationNote: '', result: '', nextVisitAt: 0, recordedBy: '담당자',
  };
  const scheduled = await h.api.post({ kind: 'visit', visit });
  await assert.rejects(history('completed'), /현장 방문/);
  h.sync();
  await h.api.post({ kind: 'visit', visit: { ...visit, id: scheduled.visit.id, status: 'completed', actualStartedAt: paidAt, actualEndedAt: paidAt + 60000, result: '센서 교체 완료' } });
  await history('completed');
  assert.equal(h.list('workItems')[0].status, 'completed');
  await history('in_progress');
  assert.equal(h.list('workItems')[0].status, 'in_progress');
  assert.equal(h.list('projects')[0].status, 'completed');
  assert.equal(h.list('projects')[0].currentStage, 'closed');
  assert.equal(h.list('subscriptionEvents').length, 0);
  assert.equal(h.list('farmRecords')[0].currentSubscriptionExpiresAt, '2026-08-31');
});

test('완료 사업의 일반 업무와 직접 프로젝트 A/S, 삭제 사업의 신규 A/S는 계속 차단한다', async () => {
  for (const workPatch of [
    { workType: 'communication' }, { workType: 'installation' },
    { workType: 'service', farmRecordId: '', projectId: 'p1' },
  ]) {
    const h = harness();
    h.put('projects', { ...h.list('projects')[0], status: 'completed' });
    h.sync();
    const body = h.body();
    await assert.rejects(h.api.post({ ...body, paymentRequest: undefined, workItem: { ...body.workItem, status: 'open', ...workPatch }, history: h.history(0) }), /완료된 사업/);
    assert.equal(h.list('workItems').length, 0);
  }
  for (const staleCache of [false, true]) {
    const h = harness();
    h.put('projects', { ...h.list('projects')[0], status: 'completed' });
    h.sync();
    h.put('projects', { ...h.list('projects')[0], deletedAt: fixedNow });
    if (!staleCache) h.sync();
    const body = h.body();
    await assert.rejects(h.api.post({ ...body, paymentRequest: undefined, workItem: { ...body.workItem, workType: 'service', status: 'open' }, history: h.history(0) }), /삭제된 프로젝트/);
    assert.equal(h.list('workItems').length, 0);
    assert.equal(h.list('historyEntries').length, 0);
  }
});

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

function organizationHarness(actor = 'head') {
  const h = harness({
    uid: actor,
    email: `${actor}@example.test`,
    emailVerified: true,
  });
  const person = (id, extra = {}) => ({
    id,
    email: `${id}@example.test`,
    displayName: id,
    active: true,
    admin: false,
    workspaceId: 'test',
    departmentId: 'sales',
    requestedDepartment: '',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...extra,
  });
  for (const id of ['head', 'staff', 'peer', 'admin'])
    h.putMember(person(id, { admin: id === 'admin' }));
  h.putMember(person('other', { departmentId: 'research' }));
  h.put('departments', {
    id: 'sales',
    name: '영업',
    headUid: 'head',
    createdAt: fixedNow,
    updatedAt: fixedNow,
  });
  h.put('departments', {
    id: 'research',
    name: '연구',
    headUid: 'other',
    createdAt: fixedNow,
    updatedAt: fixedNow,
  });
  h.sync();
  return h;
}
function internalWork(
  h,
  id = 'internal-operation-0001',
  parent = '',
  target = 'staff',
) {
  const body = projectWork(h, parent, id);
  body.workItem = {
    ...body.workItem,
    scope: 'internal',
    projectId: '',
    assigneeUid: target,
  };
  return body;
}
async function createInternalProject(h, name = '내부 프로젝트') {
  h.sync();
  return (await h.api.post({ kind: 'project', project: settlementProject({
    name, projectType: 'internal', institution: '',
  }) })).project;
}

function linkedInternalWork(h, projectId, operationId, parent = '') {
  const body = internalWork(h, operationId, parent);
  body.workItem.projectId = projectId;
  return body;
}

test('내부 프로젝트는 서류·정산·농가 없이 등록하고 업무를 모두 완료한 뒤 마감한다', async () => {
  const h = organizationHarness();
  const project = await createInternalProject(h);
  assert.equal(project.projectType, 'internal');
  assert.equal(project.contractAmount, 0);
  assert.equal(project.settlementStatus, 'not_started');
  assert.equal(project.settlementRounds, undefined);
  assert.equal(h.list('projectDocuments').length, 0);
  h.sync();
  const root = (await h.api.post(linkedInternalWork(h, project.id, 'linked-root-create'))).workItem;
  h.sync();
  const child = (await h.api.post(linkedInternalWork(h, project.id, 'linked-child-create', root.id))).workItem;
  h.sync();
  const grandchild = (await h.api.post(linkedInternalWork(h, project.id, 'linked-grandchild-create', child.id))).workItem;
  assert.equal(grandchild.projectId, project.id);
  assert.equal(grandchild.departmentId, child.departmentId);
  assert.equal(h.list('subscriptionEvents').length, 0);
  const save = (patch = {}) => {
    h.sync();
    const current = h.list('projects').find((item) => item.id === project.id);
    return h.api.patch({ kind: 'project', projectId: project.id, expectedUpdatedAt: current.updatedAt, project: { ...current, ...patch } });
  };
  await assert.rejects(save({ status: 'completed' }), /내부 업무/);
  await assert.rejects(changeTask(h, root.id, 'completed'), /세부 업무/);
  for (const item of [grandchild, child, root]) await changeTask(h, item.id, 'completed');
  const completed = (await save({ status: 'completed' })).project;
  assert.equal(completed.status, 'completed');
  assert.equal(completed.currentStage, 'closed');
  assert.equal(completed.settlementStatus, 'not_started');
  await assert.rejects(changeTask(h, root.id, 'open'), /완료/);
  await assert.rejects(h.api.post(linkedInternalWork(h, project.id, 'linked-after-close')), /완료/);
  await assert.rejects(save({ projectType: 'general', institution: '사업 기관', status: 'active', currentStage: 'operation' }), /별도 프로젝트/);
});

async function unusedBusinessProject(h) {
  const empty = internalProjectTools.normalizeInternalProject(settlementProject({ projectType: 'internal' }));
  return (await h.api.post({ kind: 'project', project: {
    // Nonzero counts now create linked farms, so a genuinely unused project has zero sites.
    ...empty, projectType: 'general', targetFarmCount: 0, currentStage: 'verification',
    settlementRounds: { first: settlementTools.emptySettlement(), second: settlementTools.emptySettlement() },
  } })).project;
}

test('빈 일반 프로젝트는 동일 ID로 내부 전환하고 감사 이력·기본정보를 보존한다', async () => {
  const h = organizationHarness();
  const before = await unusedBusinessProject(h);
  assert.equal(h.list('farmRecords').filter((record) => record.projectId === before.id).length, 0);
  const documents = h.list('projectDocuments');
  const initialUpdates = h.list('projectUpdates');
  h.sync();
  const request = { kind: 'project', projectId: before.id, expectedUpdatedAt: before.updatedAt, project: { ...before, projectType: 'internal' } };
  h.fail();
  await assert.rejects(h.api.patch(request), /Simulated/);
  assert.equal(h.list('projects').find((p) => p.id === before.id).projectType, 'general');
  assert.deepEqual(h.list('projectUpdates'), initialUpdates);
  const after = (await h.api.patch(request)).project;
  for (const key of ['id', 'name', 'manager', 'description', 'startDate', 'endDate', 'createdAt']) assert.equal(after[key], before[key]);
  assert.equal(after.projectType, 'internal');
  assert.equal(after.targetFarmCount, 0);
  assert.equal(after.settlementRounds, undefined);
  assert.deepEqual(h.list('projectDocuments'), documents);
  assert.equal(h.list('projectUpdates').length, initialUpdates.length + 1);
  h.sync();
  const task = (await h.api.post(linkedInternalWork(h, after.id, 'converted-new-task'))).workItem;
  assert.equal(task.projectId, before.id);
  assert.equal(task.scope, 'internal');
  await assert.rejects(h.api.patch(request), /다른 변경/);
});

test('전환은 오래된 화면에 없는 서버 연결 기록도 확인하고 원본을 보존한다', async () => {
  for (const [collection, record] of [
    ['farmRecords', { id: 'late-farm' }],
    ['workItems', { id: 'late-task', scope: '', deletedAt: fixedNow }],
    ['projectDocuments', { id: 'late-doc', status: 'approved' }],
    ['projectUpdates', { id: 'late-note', kind: 'communication' }],
  ]) {
    const h = organizationHarness();
    const before = await unusedBusinessProject(h);
    h.sync();
    // Do not sync this server record into the old UI snapshot.
    h.put(collection, { ...record, projectId: before.id });
    await assert.rejects(h.api.patch({ kind: 'project', projectId: before.id, expectedUpdatedAt: before.updatedAt, project: { ...before, projectType: 'internal' } }), /농가|업무|서류/);
    assert.equal(h.list('projects').find((p) => p.id === before.id).projectType, 'general');
    assert.ok(h.list(collection).find((row) => row.id === record.id));
  }
});

test('전환은 정산이 있는 원본과 수정 초안을 초기화하지 않고 최신 버전 충돌을 거부한다', async () => {
  const h = organizationHarness();
  const before = await unusedBusinessProject(h);
  h.sync();
  await assert.rejects(h.api.patch({ kind: 'project', projectId: before.id, expectedUpdatedAt: before.updatedAt, project: { ...before, projectType: 'internal', contractAmount: 100 } }), /정산/);
  h.put('projects', { ...before, contractAmount: 100, updatedAt: before.updatedAt + 1 });
  await assert.rejects(h.api.patch({ kind: 'project', projectId: before.id, expectedUpdatedAt: before.updatedAt, project: { ...before, projectType: 'internal' } }), /다른 변경/);
  assert.equal(h.list('projects').find((p) => p.id === before.id).contractAmount, 100);
});

test('내부 업무의 프로젝트·부서 경계와 기존 미연결 업무를 보존한다', async () => {
  const h = organizationHarness();
  const first = await createInternalProject(h, '첫 내부 프로젝트');
  const second = await createInternalProject(h, '다른 내부 프로젝트');
  h.sync();
  const root = (await h.api.post(linkedInternalWork(h, first.id, 'linked-boundary-root'))).workItem;
  h.sync();
  await assert.rejects(h.api.post(linkedInternalWork(h, second.id, 'linked-cross-project', root.id)), /같은|상위/);
  await assert.rejects(h.api.post(internalWork(h, 'linked-omit-project', root.id)), /같은|상위/);
  const otherDepartment = linkedInternalWork(h, first.id, 'linked-cross-department', root.id);
  otherDepartment.workItem.assigneeUid = 'other';
  await assert.rejects(h.api.post(otherDepartment), /같은|상위/);
  await assert.rejects(h.api.post(linkedInternalWork(h, 'p1', 'linked-business-denied')), /내부 프로젝트/);
  const businessWork = projectWork(h);
  businessWork.workItem.projectId = first.id;
  await assert.rejects(h.api.post(businessWork), /일반·연구/);
  await assert.rejects(h.api.post(capture({ projectId: first.id })), /내부 프로젝트/);
  const standalone = (await h.api.post(internalWork(h, 'standalone-still-works'))).workItem;
  assert.equal(standalone.projectId, '');
  assert.equal(standalone.scope, 'internal');
});

test('연결 내부 업무는 삭제·복원해도 프로젝트와 계정 배정을 보존한다', async () => {
  const h = organizationHarness();
  const project = await createInternalProject(h);
  h.sync();
  const task = (await h.api.post(linkedInternalWork(h, project.id, 'linked-lifecycle-root'))).workItem;
  const removed = (await deleteOrRestoreTask(h, task, true)).workItem;
  const restored = (await deleteOrRestoreTask(h, removed, false)).workItem;
  assert.equal(restored.projectId, project.id);
  assert.equal(restored.assigneeUid, task.assigneeUid);
  assert.equal(restored.departmentId, task.departmentId);
  const removedAgain = (await deleteOrRestoreTask(h, restored, true)).workItem;
  h.put('projects', { ...project, deletedAt: fixedNow });
  h.sync();
  await assert.rejects(deleteOrRestoreTask(h, removedAgain, false), /프로젝트를 먼저 복구/);
});

test('내부 업무는 실제 계정 배정 근거를 저장하고 사업·농가·구독 데이터는 변경하지 않는다', async () => {
  const h = organizationHarness();
  const before = JSON.stringify(
    ['projects', 'farms', 'farmRecords', 'subscriptionEvents'].map(h.list),
  );
  const { workItem } = await h.api.post(internalWork(h));
  assert.equal(workItem.scope, 'internal');
  assert.equal(workItem.assigneeUid, 'staff');
  assert.equal(workItem.assignedByUid, 'head');
  assert.equal(workItem.owner, 'staff');
  assert.equal(workItem.headAssigned, true);
  assert.equal(workItem.departmentId, 'sales');
  assert.equal(
    JSON.stringify(
      ['projects', 'farms', 'farmRecords', 'subscriptionEvents'].map(h.list),
    ),
    before,
  );
  const helpers = load('lib/project-work.ts');
  assert.equal(helpers.isProjectTask(workItem), false);
  assert.equal(helpers.isHeadPriority(workItem), true);
  await changeTask(h, workItem.id, 'completed', { owner: workItem.owner });
  assert.equal(helpers.isHeadPriority(h.list('workItems')[0]), false);
  assert.equal(h.list('workItems')[0].headAssigned, true);
});
test('부서장 본인·동료·다른 부서 배정은 최우선 지시로 오인하지 않는다', async () => {
  for (const [actor, target] of [
    ['head', 'head'],
    ['peer', 'staff'],
    ['other', 'staff'],
  ]) {
    const h = organizationHarness(actor);
    const { workItem } = await h.api.post(
      internalWork(h, 'internal-self-operation', '', target),
    );
    assert.equal(workItem.headAssigned, false);
  }
});
test('내부 업무도 3단계 완료 순서를 지키며 다른 부서 세부 연결은 거부한다', async () => {
  const h = organizationHarness();
  const parent = (await h.api.post(internalWork(h))).workItem;
  h.sync();
  const child = (
    await h.api.post(internalWork(h, 'internal-child-operation', parent.id))
  ).workItem;
  h.sync();
  const grandchild = (
    await h.api.post(internalWork(h, 'internal-grandchild-operation', child.id))
  ).workItem;
  h.sync();
  await assert.rejects(
    h.api.post(internalWork(h, 'internal-other-operation', parent.id, 'other')),
    /같은|부서|프로젝트/,
  );
  await assert.rejects(changeTask(h, parent.id, 'completed'), /세부|하위/);
  await changeTask(h, grandchild.id, 'completed');
  await changeTask(h, child.id, 'completed');
  await changeTask(h, parent.id, 'completed');
  assert.equal(
    h.list('workItems').every((item) => item.status === 'completed'),
    true,
  );
});
test('내부 업무 동시 재전송은 동일 저장 문서를 반환하고 기록도 1건이다', async () => {
  const h = organizationHarness();
  const body = internalWork(h);
  const [a, b] = await Promise.all([h.api.post(body), h.api.post(body)]);
  assert.equal(a.workItem.id, b.workItem.id);
  assert.equal(a.workItem.createdAt, b.workItem.createdAt);
  assert.equal(a.workItem.assignedByUid, b.workItem.assignedByUid);
  assert.equal(h.list('workItems').length, 1);
  assert.equal(h.list('historyEntries').length, 1);
});
test('담당자 이름 수정으로 계정 배정을 변경하지 못하며 미승인 계정은 등록하지 못한다', async () => {
  const h = organizationHarness();
  const { workItem } = await h.api.post(internalWork(h));
  await assert.rejects(
    changeTask(h, workItem.id, 'in_progress', { owner: '조작된 담당자' }),
    /계정|담당/,
  );
  h.putMember({ ...h.getMember('staff'), active: false });
  await assert.rejects(
    h.api.post(internalWork(h, 'internal-denied-operation')),
    /승인|부서/,
  );
  assert.equal(h.list('workItems').length, 1);
});
test('공개 자체 가입 경로가 없으며 본인의 암호 변경 안내만 확인할 수 있다', async () => {
  const h = harness({
    uid: 'new-person',
    email: 'new@example.test',
    emailVerified: true,
  });
  assert.equal(h.organization.requestMembership, undefined);
  h.putMember({
    id: 'new-person',
    active: true,
    passwordChangeRequired: true,
    updatedAt: 1,
  });
  await h.organization.acknowledgePasswordChange();
  const saved = h.getMember('new-person');
  assert.equal(saved.active, true);
  assert.equal(saved.passwordChangeRequired, false);
  await h.organization.acknowledgePasswordChange();
});
test('관리자 승인·부서장 지정·부서장 중지 시 부서 연결 해제를 한 번에 저장한다', async () => {
  const h = organizationHarness('admin');
  const pending = { ...h.getMember('staff'), active: false, departmentId: '' };
  h.putMember(pending);
  await h.organization.saveMemberAccess(pending, true, 'sales');
  assert.equal(h.getMember('staff').active, true);
  const dept = h.list('departments').find((item) => item.id === 'sales');
  await h.organization.saveDepartment('영업', 'staff', dept);
  const approved = h.getMember('staff');
  await h.organization.saveMemberAccess(approved, false, 'sales');
  assert.equal(
    h.list('departments').find((item) => item.id === 'sales').headUid,
    '',
  );
  await assert.rejects(
    h.organization.saveMemberAccess(h.getMember('admin'), false, 'sales'),
    /본인/,
  );
});
test('일반 직원은 직원 승인이나 부서장 지정을 수행할 수 없다', async () => {
  const h = organizationHarness('staff');
  await assert.rejects(h.organization.saveDepartment('새 부서', ''), /권한/);
  await assert.rejects(
    h.organization.saveMemberAccess(h.getMember('peer'), false, 'sales'),
    /권한/,
  );
});
