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
const {
  buildRenewalReport,
  groupRenewalCycles,
  renewalCountBeforeEvent,
  validRenewalDate,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const today = '2026-09-07';
const projects = [
  { id: 'p1', name: '일반 사업', projectType: 'general' },
  { id: 'p2', name: '연구 사업', projectType: 'research' },
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
  id: `e-${id}`,
  farmRecordId: id,
  projectId: 'p1',
  eventType: 'renewed',
  basisExpiryDate: '2026-08-31',
  processedAt: '2026-09-01',
  newExpiryDate: '2027-08-31',
  ...patch,
});
const report = (records, events = [], options = {}) =>
  buildRenewalReport(records, events, projects, {
    year: 2026,
    endMonth: 12,
    today,
    ...options,
  });
const invariant = (result) => {
  assert.equal(
    result.overall.target,
    result.first.target + result.repeat.target + result.unknown.target,
  );
  for (const metric of [
    result.overall,
    result.first,
    result.repeat,
    result.unknown,
  ]) {
    assert.equal(
      metric.target,
      metric.renewed + metric.churned + metric.pending + metric.conflict,
    );
    assert.ok(metric.rate === null || (metric.rate >= 0 && metric.rate <= 100));
  }
};

test('33개소 중 갱신 22개소, 미확인 11개소는 66.67%다', () => {
  const result = report(
    Array.from({ length: 33 }, (_, i) => record(String(i))),
    Array.from({ length: 22 }, (_, i) =>
      event(String(i), { basisRenewalCount: 0 }),
    ),
  );
  assert.deepEqual(result.overall, {
    target: 33,
    renewed: 22,
    churned: 0,
    pending: 11,
    conflict: 0,
    upcoming: 0,
    rate: 66.67,
  });
  invariant(result);
});

test('첫·반복·회차 미확인을 구분하고 미확인 갱신도 전체에는 포함한다', () => {
  const result = report(
    [
      record('a'),
      record('b'),
      record('c', { renewalCount: 1 }),
      record('d', { renewalCount: 2 }),
      record('e'),
    ],
    [
      event('a', { basisRenewalCount: 0 }),
      event('c', { basisRenewalCount: 1 }),
      event('e'),
    ],
  );
  assert.equal(result.first.rate, 50);
  assert.equal(result.repeat.rate, 50);
  assert.equal(result.unknown.renewed, 1);
  assert.equal(result.overall.rate, 60);
  invariant(result);
});

test('오늘 만료는 대상, 내일 만료의 선갱신은 예정으로 분자·분모 제외', () => {
  const result = report(
    [
      record('y', { currentSubscriptionExpiresAt: '2026-09-06' }),
      record('t', { currentSubscriptionExpiresAt: today }),
      record('f', { currentSubscriptionExpiresAt: '2027-09-08' }),
    ],
    [
      event('f', {
        basisExpiryDate: '2026-09-08',
        basisRenewalCount: 0,
        newExpiryDate: '2027-09-08',
      }),
    ],
  );
  assert.equal(result.overall.target, 2);
  assert.equal(result.overall.renewed, 0);
  assert.equal(result.overall.rate, 0);
  assert.equal(result.overall.upcoming, 1);
  invariant(result);
});

test('과거 기간의 결과는 오늘까지 확인하고 다른 기간 만료는 제외한다', () => {
  const result = report(
    [
      record('a', { currentSubscriptionExpiresAt: '2027-08-31' }),
      record('b', { currentSubscriptionExpiresAt: today }),
    ],
    [event('a', { basisRenewalCount: 0 })],
    { endMonth: 8 },
  );
  assert.equal(result.overall.target, 1);
  assert.equal(result.overall.renewed, 1);
  assert.equal(result.cutoffDate, '2026-08-31');
});

test('미래 처리 결과는 미확인이며 첫 처리 기준 만료일은 분모에 보존', () => {
  const result = report(
    [
      record('a', {
        currentSubscriptionExpiresAt: '2027-08-31',
        renewalCount: 1,
      }),
    ],
    [event('a', { basisRenewalCount: 0, processedAt: '2026-09-08' })],
  );
  assert.equal(result.unknown.target, 1);
  assert.equal(result.unknown.pending, 1);
  assert.equal(result.overall.rate, 0);
  assert.equal(result.cycles[0].futureResultDate, '2026-09-08');
});

test('대상이 없으면 -, 대상이 있고 갱신이 없으면 0%', () => {
  assert.equal(report([]).overall.rate, null);
  assert.equal(report([record('a')]).overall.rate, 0);
  const future = report(
    [record('a', { currentSubscriptionExpiresAt: '2027-01-01' })],
    [],
    { year: 2027 },
  );
  assert.equal(future.overall.rate, null);
  assert.equal(future.overall.upcoming, 1);
});

test('전년도 갱신 연결은 반복 근거지만 재가입은 반복 근거가 아니다', () => {
  const records = [record('a'), record('b')];
  const events = [
    event('a', {
      id: 'prior',
      basisExpiryDate: '2025-08-31',
      processedAt: '2025-09-01',
      newExpiryDate: '2026-08-31',
    }),
    event('a'),
    event('b', {
      id: 'rejoin',
      eventType: 'rejoined',
      basisExpiryDate: '2025-08-31',
      processedAt: '2025-09-01',
      newExpiryDate: '2026-08-31',
    }),
    event('b'),
  ];
  const result = report(records, events);
  assert.equal(result.repeat.target, 1);
  assert.equal(result.unknown.target, 1);
});

test('현재 횟수를 변경해도 과거 완료회차 분류를 역산하지 않는다', () => {
  for (const renewalCount of [0, 1, 5]) {
    const result = report([record('a', { renewalCount })], [event('a')]);
    assert.equal(result.unknown.target, 1);
    assert.equal(result.first.target, 0);
  }
  const saved = event('a', { basisRenewalCount: 0 });
  assert.equal(
    report([record('a', { renewalCount: 5 })], [saved]).first.target,
    1,
  );
});

test('중복 전달은 한 회차, 갱신·이탈 또는 새 만료일 모순은 결과 충돌', () => {
  const renewed = event('a', { basisRenewalCount: 0 });
  const deduped = report([record('a')], [renewed, { ...renewed }]);
  assert.equal(deduped.overall.renewed, 1);
  for (const conflicting of [
    { ...renewed, eventType: 'churned', newExpiryDate: '' },
    { ...renewed, id: 'other', newExpiryDate: '2028-08-31' },
    { ...renewed, processedAt: '2026-09-02' },
  ]) {
    const result = report([record('a')], [renewed, conflicting]);
    assert.equal(result.overall.target, 1);
    assert.equal(result.overall.conflict, 1);
    assert.equal(result.overall.renewed, 0);
    invariant(result);
  }
});

test('최초 만료일·정정 전 newExpiry로 유령 회차를 만들지 않는다', () => {
  const result = report(
    [
      record('a', {
        initialSubscriptionExpiresAt: '2026-01-01',
        currentSubscriptionExpiresAt: '2026-09-01',
      }),
    ],
    [
      event('a', {
        basisExpiryDate: '2025-08-31',
        processedAt: '2025-09-01',
        newExpiryDate: '2026-08-31',
      }),
    ],
  );
  assert.equal(result.overall.target, 1);
  assert.equal(result.cycles[0].expiryDate, '2026-09-01');
});

test('재가입은 처리기간 기준 별도 실적이며 갱신을 증가시키지 않는다', () => {
  const result = report(
    [record('a', { currentSubscriptionExpiresAt: '2027-08-31' })],
    [
      event('a', { eventType: 'churned', newExpiryDate: '' }),
      event('a', { id: 'rejoined', eventType: 'rejoined' }),
    ],
  );
  assert.equal(result.rejoined, 1);
  assert.equal(result.overall.churned, 1);
  assert.equal(result.overall.renewed, 0);
});

test('사업타입 필터는 과거 이벤트 사업 귀속을 지키고 그룹 합계가 일치한다', () => {
  const records = [
    record('a', {
      projectId: 'p2',
      currentSubscriptionExpiresAt: '2026-12-31',
    }),
  ];
  const events = [event('a', { projectId: 'p1', basisRenewalCount: 0 })];
  const general = report(records, events, { projectType: 'general' });
  assert.equal(general.overall.target, 1);
  assert.equal(general.overall.upcoming, 0);
  const research = report(records, events, { projectType: 'research' });
  assert.equal(research.overall.target, 0);
  assert.equal(research.overall.upcoming, 1);
  const all = report(records, events);
  for (const grouping of ['year', 'month', 'type', 'project']) {
    const groups = groupRenewalCycles(all.cycles, grouping, projects);
    assert.equal(
      groups.reduce((sum, item) => sum + item.target, 0),
      all.overall.target,
    );
    assert.equal(
      groups.reduce((sum, item) => sum + item.upcoming, 0),
      all.overall.upcoming,
    );
  }
});

test('이전 갱신 처리 순서가 뒤집힌 이력은 반복 증거가 아니다', () => {
  const result = report(
    [record('a')],
    [
      event('a'),
      event('a', {
        id: 'prior',
        basisExpiryDate: '2025-08-31',
        newExpiryDate: '2026-08-31',
        processedAt: '2026-09-06',
      }),
    ],
  );
  assert.equal(result.unknown.target, 1);
});

test('잘못된 날짜·고아 이력 제외 사유를 표시한다', () => {
  assert.equal(validRenewalDate('2026-02-30'), false);
  const result = report(
    [record('a', { currentSubscriptionExpiresAt: '2026-02-30' })],
    [event('missing')],
  );
  assert.equal(result.overall.target, 0);
  assert.equal(result.excluded, 2);
});

test('새 결과의 현재 회차만 자동 스냅샷하고 과거는 명시값 또는 미확인', () => {
  const current = record('a', { renewalCount: 2 });
  assert.equal(renewalCountBeforeEvent(current, '2026-08-31'), 2);
  assert.equal(renewalCountBeforeEvent(current, '2025-08-31'), null);
  assert.equal(renewalCountBeforeEvent(current, '2025-08-31', 0), 0);
  for (const invalid of [-1, 0.5, Infinity, '0', NaN])
    assert.equal(renewalCountBeforeEvent(current, '2025-08-31', invalid), null);
});

test('미래 이벤트는 순서와 관계없이 오늘의 사업 귀속·회차 집단을 바꾸지 않는다', () => {
  const records = [
    record('a', {
      projectId: 'p2',
      currentSubscriptionExpiresAt: '2027-08-31',
    }),
  ];
  const old = event('a', { basisRenewalCount: 0 });
  const future = event('a', {
    id: 'future',
    projectId: 'p2',
    basisRenewalCount: 1,
    processedAt: '2026-09-08',
  });
  for (const events of [
    [old, future],
    [future, old],
  ]) {
    const result = report(records, events, { projectType: 'general' });
    assert.equal(result.first.target, 1);
    assert.equal(result.first.renewed, 1);
    assert.equal(result.overall.rate, 100);
  }
});

test('관찰된 사업 귀속 충돌은 전체의 미확인 사업으로 보존한다', () => {
  const result = report(
    [record('a')],
    [event('a'), event('a', { id: 'other', projectId: 'p2' })],
  );
  assert.equal(result.overall.target, 1);
  assert.equal(result.overall.conflict, 1);
  assert.equal(result.cycles[0].projectId, '');
  invariant(result);
});
