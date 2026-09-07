import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(
  new URL('../lib/subscription-renewal-report.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { buildRenewalReport, groupRenewalCycles, validRenewalDate } =
  await import(
    'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
  );
const today = '2026-09-07';
test('연간 화면은 월별 만료 농가 표를 갱신율 카드보다 먼저 표시한다', () => {
  const panel = readFileSync(
    new URL('../app/subscription-renewal-panel.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    panel.indexOf("'1월~12월 월별 만료 농가'") <
      panel.indexOf("title: '첫 갱신율"),
  );
  assert.ok(panel.includes("useState<RenewalGrouping>('month')"));
  assert.ok(panel.includes('disabled={group.cycles.length === 0}'));
});
const projects = [
  { id: 'p1', name: '일반', projectType: 'general' },
  { id: 'p2', name: '연구', projectType: 'research' },
];
const record = (id, patch = {}) => ({
  id,
  farmId: id,
  projectId: 'p1',
  renewalCount: 0,
  subscriptionStatus: 'active',
  currentSubscriptionExpiresAt: '2026-08-31',
  initialSubscriptionExpiresAt: '2026-08-31',
  ...patch,
});
const event = (id, patch = {}) => ({
  id: 'e-' + id,
  farmRecordId: id,
  projectId: 'p1',
  eventType: 'renewed',
  basisExpiryDate: '2026-08-31',
  processedAt: '2026-09-01',
  newExpiryDate: '2027-08-31',
  ...patch,
});
const work = (id) => ({
  id: 'work-' + id,
  farmRecordId: id,
  workType: 'payment',
});
const payment = (id, date, patch = {}) => ({
  id: 'pay-' + id + date,
  workItemId: 'work-' + id,
  amount: 66000,
  occurredAt: Date.parse(date + 'T10:00:00+09:00'),
  ...patch,
});
const report = (records, events = [], options = {}) =>
  buildRenewalReport(records, events, projects, {
    year: 2026,
    today,
    ...options,
  });
const invariant = (r) => {
  assert.equal(
    r.overall.target,
    r.first.target + r.repeat.target + r.unknown.target,
  );
  for (const m of [r.overall, r.first, r.repeat, r.unknown]) {
    assert.equal(m.target, m.renewed + m.notRenewed + m.conflict);
    assert.equal(m.annualTarget, m.target + m.dueToday + m.upcoming);
    assert.ok(m.rate === null || (m.rate >= 0 && m.rate <= 100));
  }
};
test('33개소 중 갱신22·미갱신11은 66.67%', () => {
  const r = report(
    Array.from({ length: 33 }, (_, i) => record(String(i))),
    Array.from({ length: 22 }, (_, i) =>
      event(String(i), { basisPaymentCount: 0 }),
    ),
  );
  assert.equal(r.overall.rate, 66.67);
  assert.equal(r.overall.notRenewed, 11);
  invariant(r);
});
test('어제만 만료 경과, 오늘과 내일은 별도이며 다음날 자동 미갱신', () => {
  const records = [
    record('a', { currentSubscriptionExpiresAt: '2026-09-06' }),
    record('b', { currentSubscriptionExpiresAt: today }),
    record('c', { currentSubscriptionExpiresAt: '2026-09-08' }),
  ];
  const r = report(records);
  assert.equal(r.overall.target, 1);
  assert.equal(r.overall.notRenewed, 1);
  assert.equal(r.overall.dueToday, 1);
  assert.equal(r.overall.upcoming, 1);
  invariant(r);
  assert.equal(
    report(records, [], { today: '2026-09-08' }).overall.notRenewed,
    2,
  );
});
test('연간1~12월 고정, 빈 달도12행, 월별합계와 KPI 일치', () => {
  const r = report([
    record('a', { currentSubscriptionExpiresAt: '2026-01-31' }),
    record('b', { currentSubscriptionExpiresAt: '2026-12-31' }),
  ]);
  assert.equal(r.startDate, '2026-01-01');
  assert.equal(r.endDate, '2026-12-31');
  assert.equal(r.overall.annualTarget, 2);
  const months = groupRenewalCycles(r.cycles, 'month', projects, r.year);
  assert.equal(months.length, 12);
  assert.equal(months[11].upcoming, 1);
  assert.equal(
    months.reduce((n, m) => n + m.target, 0),
    r.overall.target,
  );
  assert.equal(groupRenewalCycles([], 'month', projects, 2026).length, 12);
});
test('수기 횟수가 아니라 실제 이전 입금 수로 첫·반복 대상을 정한다', () => {
  const r = report([record('a', { renewalCount: 9 }), record('b')], [], {
    workItems: [work('b')],
    historyEntries: [payment('b', '2025-09-01')],
  });
  assert.equal(r.first.target, 1);
  assert.equal(r.repeat.target, 1);
  assert.equal(r.cycles.find((c) => c.farmRecordId === 'b').paymentCount, 1);
});
test('첫 입금은 첫 갱신, 두 번째는 반복, 132000원 한 번도 1회', () => {
  const r = report(
    [record('a'), record('b')],
    [
      event('a', { paymentHistoryEntryId: 'first' }),
      event('b', { paymentHistoryEntryId: 'second' }),
    ],
    {
      workItems: [work('a'), work('b')],
      historyEntries: [
        payment('a', '2026-09-01', { id: 'first', amount: 132000 }),
        payment('b', '2025-09-01'),
        payment('b', '2026-09-01', { id: 'second' }),
      ],
    },
  );
  assert.equal(r.first.renewed, 1);
  assert.equal(r.repeat.renewed, 1);
  assert.equal(r.cycles.find((c) => c.farmRecordId === 'a').paymentOrdinal, 1);
  assert.equal(r.cycles.find((c) => c.farmRecordId === 'b').paymentOrdinal, 2);
});
test('입금일과 처리일이 달라도 명시적 연결은 첫 갱신으로 판정', () => {
  const r = report(
    [record('a')],
    [event('a', { paymentHistoryEntryId: 'paid' })],
    {
      workItems: [work('a')],
      historyEntries: [payment('a', '2026-08-29', { id: 'paid' })],
    },
  );
  assert.equal(r.first.renewed, 1);
  assert.equal(r.unknown.target, 0);
});
test('과거 연결이 불명확해도 실제 입금 건수는 표시', () => {
  const r = report([record('a')], [event('a', { basisRenewalCount: 0 })], {
    workItems: [work('a')],
    historyEntries: [payment('a', '2026-08-29')],
  });
  assert.equal(r.unknown.target, 1);
  assert.equal(r.cycles[0].paymentCount, 1);
  assert.equal(r.cycles[0].paymentOrdinal, null);
  assert.equal(r.overall.renewed, 1);
});
test('저장된 입금 전 횟수는 이후 입금이 늘어도 고정', () => {
  const r = report(
    [record('a', { renewalCount: 20 })],
    [event('a', { basisPaymentCount: 0 })],
    {
      workItems: [work('a')],
      historyEntries: [payment('a', '2026-09-01'), payment('a', '2026-09-02')],
    },
  );
  assert.equal(r.first.renewed, 1);
  assert.equal(r.cycles[0].paymentOrdinal, 1);
});
test('미래 처리 기록은 현재 미갱신, 처리일 도달 후 갱신', () => {
  const records = [record('a', { currentSubscriptionExpiresAt: '2027-08-31' })];
  const events = [
    event('a', { basisPaymentCount: 0, processedAt: '2026-09-08' }),
  ];
  const r = report(records, events);
  assert.equal(r.overall.notRenewed, 1);
  assert.equal(r.cycles[0].futureResultDate, '2026-09-08');
  assert.equal(
    report(records, events, { today: '2026-09-08' }).first.renewed,
    1,
  );
});
test('미래 만료의 선갱신은 연간 예정, 현재 갱신율에서는 제외', () => {
  const r = report(
    [record('a', { currentSubscriptionExpiresAt: '2027-12-31' })],
    [
      event('a', {
        basisExpiryDate: '2026-12-31',
        newExpiryDate: '2027-12-31',
        basisPaymentCount: 0,
      }),
    ],
  );
  assert.equal(r.overall.upcoming, 1);
  assert.equal(r.overall.renewed, 0);
  assert.equal(r.overall.rate, null);
});
test('이탈도 미갱신, 재가입은 갱신과 별도', () => {
  const r = report(
    [record('a', { currentSubscriptionExpiresAt: '2027-08-31' })],
    [
      event('a', { eventType: 'churned', newExpiryDate: '' }),
      event('a', { id: 'rejoin', eventType: 'rejoined' }),
    ],
  );
  assert.equal(r.overall.notRenewed, 1);
  assert.equal(r.rejoined, 1);
  assert.equal(r.overall.renewed, 0);
  invariant(r);
});
test('입금이 명시적으로 대체한 이탈은 갱신으로 인정', () => {
  const r = report(
    [record('a', { currentSubscriptionExpiresAt: '2027-08-31' })],
    [
      event('a', {
        id: 'churn',
        eventType: 'churned',
        newExpiryDate: '',
        processedAt: '2026-08-31',
      }),
      event('a', {
        basisPaymentCount: 0,
        paymentHistoryEntryId: 'paid',
        supersedesEventIds: ['churn'],
      }),
    ],
  );
  assert.equal(r.overall.renewed, 1);
  assert.equal(r.overall.conflict, 0);
});
test('동일 전달은1건, 명시적 대체 없는 상충 결과는 확인 필요', () => {
  const e = event('a', { basisPaymentCount: 0 });
  assert.equal(report([record('a')], [e, { ...e }]).overall.renewed, 1);
  const r = report(
    [record('a')],
    [e, { ...e, id: 'other', eventType: 'churned', newExpiryDate: '' }],
  );
  assert.equal(r.overall.conflict, 1);
  assert.equal(r.overall.rate, 0);
  invariant(r);
});
test('미래 이벤트 순서는 현재 사업 귀속과 입금 집단을 바꾸지 않는다', () => {
  const current = event('a', { basisPaymentCount: 0 });
  const future = event('a', {
    id: 'future',
    projectId: 'p2',
    basisPaymentCount: 1,
    processedAt: '2026-09-08',
  });
  for (const events of [
    [current, future],
    [future, current],
  ])
    assert.equal(
      report([record('a')], events, { projectType: 'general' }).first.renewed,
      1,
    );
});
test('사업타입별 과거 귀속을 보존하고 그룹 합계가 일치', () => {
  const records = [
    record('a', {
      projectId: 'p2',
      currentSubscriptionExpiresAt: '2026-12-31',
    }),
  ];
  const events = [event('a', { projectId: 'p1', basisPaymentCount: 0 })];
  assert.equal(
    report(records, events, { projectType: 'general' }).overall.target,
    1,
  );
  assert.equal(
    report(records, events, { projectType: 'research' }).overall.upcoming,
    1,
  );
  const r = report(records, events);
  for (const grouping of ['year', 'month', 'type', 'project'])
    assert.equal(
      groupRenewalCycles(r.cycles, grouping, projects, 2026).reduce(
        (n, m) => n + m.annualTarget,
        0,
      ),
      r.overall.annualTarget,
    );
});
test('저장된 입금 회차는 화면 입금 이력 지연에도 유지하고 미래 스냅샷은 제외한다', () => {
  const current = record('a', {
    subscriptionPaymentCount: 2,
    lastPaymentDate: '2026-09-01',
  });
  const r = report([current]);
  assert.equal(r.repeat.target, 1);
  assert.equal(r.cycles[0].paymentCount, 2);
  const future = report([{ ...current, lastPaymentDate: '2026-09-08' }]);
  assert.equal(future.first.target, 1);
  assert.equal(future.cycles[0].paymentCount, 0);
});

test('정정 전 날짜를 유령 회차로 만들지 않는다', () => {
  assert.equal(
    report([record('a', { initialSubscriptionExpiresAt: '2026-01-01' })])
      .overall.target,
    1,
  );
});
test('잘못된 날짜와 고아 이력은 제외하며 빈 대상은 -', () => {
  assert.equal(validRenewalDate('2026-02-30'), false);
  const r = report(
    [record('a', { currentSubscriptionExpiresAt: '2026-02-30' })],
    [event('missing')],
  );
  assert.equal(r.excluded, 2);
  assert.equal(r.overall.rate, null);
});
test('미래 연도와 과거12월, 연도와 독립적인 현재 미갱신', () => {
  assert.equal(
    report([record('a', { currentSubscriptionExpiresAt: '2027-12-31' })], [], {
      year: 2027,
    }).overall.rate,
    null,
  );
  const records = [record('a', { currentSubscriptionExpiresAt: '2025-12-31' })];
  assert.equal(report(records, [], { year: 2025 }).overall.notRenewed, 1);
  assert.equal(report(records, [], { year: 2027 }).currentNonRenewed, 1);
});
