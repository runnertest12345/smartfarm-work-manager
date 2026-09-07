import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(
  new URL('../lib/subscription-payment-report.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { buildPaymentYearReport, paymentYearReportLines } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
);
const asOf = new Date('2026-09-07T12:00:00').getTime();
const projects = [
  { id: 'general', projectType: 'general' },
  { id: 'research', projectType: 'research' },
];
const records = [
  { id: 'r1', projectId: 'general' },
  { id: 'r2', projectId: 'research' },
];
const works = [
  { id: 'w1', farmRecordId: 'r1', workType: 'payment' },
  { id: 'w2', farmRecordId: 'r2', workType: 'payment' },
];
const payment = (id, date, patch = {}) => ({
  id,
  workItemId: 'w1',
  amount: 66000,
  occurredAt: new Date(`${date}T12:00:00`).getTime(),
  ...patch,
});
const report = (
  entries,
  options = {},
  inputRecords = records,
  inputWorks = works,
) =>
  buildPaymentYearReport(inputRecords, projects, inputWorks, entries, {
    asOf,
    ...options,
  });

test('연도가 달라져도 입금 차수는 전체 이력 순서로 이어진다', () => {
  const r = report([payment('b', '2026-03-01'), payment('a', '2025-03-01')]);
  assert.equal(r.years.find((row) => row.year === 2025).ordinals[0].count, 1);
  assert.equal(r.years.find((row) => row.year === 2026).ordinals[1].count, 1);
  assert.equal(r.total.count, 2);
});
test('같은 해 여러 입금과 132000원 한 번을 정확히 구분한다', () => {
  const r = report([
    payment('a', '2026-01-01', { amount: 132000 }),
    payment('b', '2026-05-01'),
  ]);
  assert.equal(r.total.count, 2);
  assert.equal(r.total.amount, 198000);
  assert.deepEqual(
    r.total.ordinals.map((cell) => cell.count),
    [1, 1, 0],
  );
});
test('사업 타입 분리와 중복·0원·환불·미래·고아·다른 업무 제외', () => {
  const a = payment('a', '2025-01-01');
  const entries = [
    a,
    a,
    payment('b', '2026-02-01', { workItemId: 'w2' }),
    payment('zero', '2026-02-01', { amount: 0 }),
    payment('negative', '2026-02-01', { amount: -66000 }),
    payment('future', '2027-01-01'),
    payment('orphan', '2026-01-01', { workItemId: 'missing' }),
    payment('memo', '2026-01-01', { workItemId: 'memo' }),
  ];
  const w = [...works, { id: 'memo', farmRecordId: 'r1', workType: 'note' }];
  assert.equal(report(entries, {}, records, w).total.count, 2);
  assert.equal(
    report(entries, { projectType: 'research' }, records, w).total.count,
    1,
  );
  assert.equal(
    report(entries, { projectType: 'general' }, records, w).total.ordinals[0]
      .count,
    1,
  );
});
test('저장된 입금 차수는 과거 이력이 누락돼도 재번호를 붙이지 않는다', () => {
  const r = report(
    [
      payment('legacy', '2026-01-01'),
      payment('saved', '2026-02-01', { subscriptionPaymentOrdinal: 4 }),
    ],
    {},
    [{ ...records[0], subscriptionPaymentCount: 4 }],
  );
  assert.equal(r.incompleteRecords, 1);
  assert.equal(r.total.unknown, 1);
  assert.equal(r.total.ordinals[3].count, 1);
});
test('동일 차수 중복과 같은 시각의 차수 없는 입금은 임의로 확정하지 않는다', () => {
  const r = report([
    payment('a', '2026-01-01', { subscriptionPaymentOrdinal: 1 }),
    payment('b', '2026-02-01', { subscriptionPaymentOrdinal: 1 }),
    payment('c', '2026-03-01'),
    payment('d', '2026-03-01'),
  ]);
  assert.equal(r.total.count, 4);
  assert.equal(r.total.unknown, 4);
});
test('시간순과 반대인 저장 차수는 재번호 없이 충돌 대상으로 분리한다', () => {
  const r = report([
    payment('a', '2025-01-01', { subscriptionPaymentOrdinal: 2 }),
    payment('b', '2026-01-01', { subscriptionPaymentOrdinal: 1 }),
  ]);
  assert.equal(r.total.count, 2);
  assert.equal(r.total.unknown, 2);
  assert.deepEqual(
    r.total.ordinals.map((cell) => cell.count),
    [0, 0, 0],
  );
});
test('동일 시각에 저장된 정상 1차·2차는 UUID 순서와 무관하게 유지한다', () => {
  const r = report([
    payment('a', '2026-01-01', { subscriptionPaymentOrdinal: 2 }),
    payment('z', '2026-01-01', { subscriptionPaymentOrdinal: 1 }),
    payment('later', '2026-02-01'),
  ]);
  assert.equal(r.total.unknown, 0);
  assert.deepEqual(
    r.total.ordinals.map((cell) => cell.count),
    [1, 1, 1],
  );
});
test('새해 경계는 현지 입금일이고 미래 시각은 제외한다', () => {
  const r = report([
    payment('a', '2025-12-31', {
      occurredAt: new Date('2025-12-31T23:59:59').getTime(),
    }),
    payment('b', '2026-01-01', {
      occurredAt: new Date('2026-01-01T00:00:00').getTime(),
    }),
    payment('later', '2026-09-07', { occurredAt: asOf + 1 }),
  ]);
  assert.deepEqual(
    r.years.map((row) => [row.year, row.count]),
    [
      [2026, 1],
      [2025, 1],
    ],
  );
});
test('11차 이상은 한 열로 제한하고 총계와 각 행 차수 합은 일치한다', () => {
  const r = report([
    payment('a', '2026-01-01', { subscriptionPaymentOrdinal: 99999 }),
  ]);
  assert.equal(r.columns.length, 11);
  assert.equal(r.total.ordinals[10].count, 1);
  for (const row of [r.total, ...r.years])
    assert.equal(
      row.unknown + row.ordinals.reduce((n, cell) => n + cell.count, 0),
      row.count,
    );
});
test('전체 연도 복사는 만료 연도 실적과 혼합하지 않으며 빈 기록도 0건', () => {
  const r = report([]);
  assert.equal(r.total.count, 0);
  assert.equal(r.years.length, 1);
  const copy = paymentYearReportLines(r, '전체 사업 타입').join('\n');
  assert.ok(copy.includes('입금연도별'));
  assert.ok(copy.includes('전체 기간 총계'));
  assert.ok(!copy.includes('NaN'));
});
test('조회 한도에서는 저장 차수만 인정하고 일부 조회 경고를 남긴다', () => {
  const entries = Array.from({ length: 5000 }, (_, i) =>
    payment(`e${i}`, '2026-01-01', { amount: i ? 0 : 66000 }),
  );
  const r = report(entries);
  assert.equal(r.possiblyLimited, true);
  assert.equal(r.total.unknown, 1);
});
