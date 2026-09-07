import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  new URL('../lib/dashboard-kpis.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const {
  filterProjectsByScope,
  filterSubscriptionsByScope,
  summarizeProjectKpis,
  paymentEvidenceByRecord,
  summarizeSubscriptionCycles,
  unresolvedExpiryCohorts,
  summarizeCurrentExpiry,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

const today = '2026-09-07';
const now = Date.parse(`${today}T12:00:00+09:00`);
const record = (id, patch = {}) => ({
  id,
  farmId: id,
  projectId: 'p1',
  renewalCount: 0,
  subscriptionStatus: 'active',
  currentSubscriptionExpiresAt: '2026-12-31',
  initialSubscriptionExpiresAt: '2026-12-31',
  ...patch,
});
const work = (id, farmRecordId, patch = {}) => ({
  id,
  farmRecordId,
  workType: 'payment',
  status: 'completed',
  dueDate: '',
  ...patch,
});
const entry = (id, workItemId, patch = {}) => ({
  id,
  workItemId,
  amount: 100,
  occurredAt: now - 1000,
  ...patch,
});
const event = (farmRecordId, basisExpiryDate, patch = {}) => ({
  id: `${farmRecordId}-${basisExpiryDate}`,
  farmRecordId,
  basisExpiryDate,
  eventType: 'renewed',
  processedAt: today,
  ...patch,
});
const snapshot = (records, workItems = [], patch = {}) => ({
  records,
  workItems,
  activeSubscriptions: [],
  requiredDocuments: [],
  approvedDocuments: [],
  openProjectBlockers: [],
  documentRisks: [],
  ...patch,
});

test('연도 선택 후 사업 수, 업무 및 가중 설치율의 분모가 일치한다', () => {
  const projects = [
    {
      id: 'old',
      year: 2025,
      status: 'completed',
      projectType: 'general',
      settlementStatus: 'closed',
    },
    {
      id: 'p1',
      year: 2026,
      status: 'active',
      projectType: 'general',
      settlementStatus: 'paid',
    },
    {
      id: 'p2',
      year: 2026,
      status: 'on_hold',
      projectType: 'research',
      settlementStatus: 'approved',
    },
  ];
  const records = Array.from({ length: 9 }, (_, i) =>
    record(`r${i}`, { projectId: 'p2' }),
  );
  const sharedTask = work('shared', 'r0');
  const snapshots = new Map([
    [
      'old',
      snapshot(
        [record('old', { installationDate: today })],
        [work('old-work', 'old')],
      ),
    ],
    [
      'p1',
      snapshot([record('r0', { installationDate: today })], [sharedTask], {
        requiredDocuments: [1],
        approvedDocuments: [1],
      }),
    ],
    [
      'p2',
      snapshot(
        records,
        [
          sharedTask,
          work('waiting', 'r1', { status: 'waiting', dueDate: '2026-09-06' }),
        ],
        { requiredDocuments: [1, 2, 3], openProjectBlockers: [1] },
      ),
    ],
  ]);
  const result = summarizeProjectKpis(
    projects.filter((project) => project.year === 2026),
    snapshots,
    today,
  );
  assert.equal(result.projects, 2);
  assert.equal(result.active, 1);
  assert.equal(result.onHold, 1);
  assert.equal(result.completed, 0);
  assert.equal(result.participations, 10);
  assert.equal(result.farms, 9);
  assert.equal(result.installationRate, 10); // 1/10, not the 50% average of project percentages.
  assert.equal(result.tasks, 2);
  assert.equal(result.taskCompletionRate, 50);
  assert.equal(result.overdueTasks, 1);
  assert.equal(result.documentRate, 25);
  assert.equal(result.settled, 1); // approval alone is not payment completion.
});

test('연도와 사업 타입을 교차 선택하며 다른 타입의 업무·농가·서류·정산은 제외한다', () => {
  const projects = [
    {
      id: 'general-old',
      year: 2025,
      projectType: 'general',
      status: 'completed',
      settlementStatus: 'closed',
    },
    {
      id: 'general-new',
      year: 2026,
      projectType: 'general',
      status: 'active',
      settlementStatus: 'paid',
    },
    {
      id: 'research-new',
      year: 2026,
      projectType: 'research',
      status: 'on_hold',
      settlementStatus: 'approved',
    },
  ];
  const snapshots = new Map(
    projects.map((project) => [
      project.id,
      snapshot(
        [
          record(project.id, {
            projectId: project.id,
            installationDate: project.projectType === 'general' ? today : '',
          }),
        ],
        [
          work(project.id, project.id, {
            status: project.status === 'active' ? 'completed' : 'waiting',
          }),
        ],
        {
          requiredDocuments: [1],
          approvedDocuments: project.projectType === 'general' ? [1] : [],
        },
      ),
    ]),
  );
  assert.equal(filterProjectsByScope(projects, 'all', 'all').length, 3);
  assert.deepEqual(
    filterProjectsByScope(projects, 'all', 'general').map((p) => p.id),
    ['general-old', 'general-new'],
  );
  const selected = filterProjectsByScope(projects, '2026', 'general');
  const kpis = summarizeProjectKpis(selected, snapshots, today);
  assert.equal(kpis.projects, 1);
  assert.equal(kpis.general, 1);
  assert.equal(kpis.research, 0);
  assert.equal(kpis.tasks, 1);
  assert.equal(kpis.farms, 1);
  assert.equal(kpis.taskCompletionRate, 100);
  assert.equal(kpis.installationRate, 100);
  assert.equal(kpis.documentRate, 100);
  assert.equal(kpis.settled, 1);
  const empty = summarizeProjectKpis(
    filterProjectsByScope(projects, '2025', 'research'),
    snapshots,
    today,
  );
  assert.equal(empty.projects, 0);
  assert.equal(empty.taskCompletionRate, null);
  assert.equal(empty.subscriptionRate, null);
});

test('구독 타입과 개별 사업을 함께 제한해 같은 농가의 다른 타입 입금을 제외한다', () => {
  const projects = [
    { id: 'g1', year: 2026, projectType: 'general' },
    { id: 'g2', year: 2025, projectType: 'general' },
    { id: 'r1', year: 2026, projectType: 'research' },
  ];
  const records = [
    record('g1-record', { farmId: 'shared', projectId: 'g1' }),
    record('g2-record', { farmId: 'shared', projectId: 'g2', renewalCount: 1 }),
    record('r1-record', { farmId: 'shared', projectId: 'r1', renewalCount: 2 }),
    record('orphan', { projectId: 'missing' }),
  ];
  const works = records.slice(0, 3).map((r) => work(r.id, r.id));
  const evidence = paymentEvidenceByRecord(
    works,
    works.map((w, i) => entry(w.id, w.id, { amount: (i + 1) * 100 })),
    now,
  );
  const general = filterSubscriptionsByScope(
    records,
    projects,
    'general',
    'all',
  );
  assert.deepEqual(
    general.map((r) => r.id),
    ['g1-record', 'g2-record'],
  );
  assert.deepEqual(summarizeSubscriptionCycles(general, evidence), {
    noPayment: 0,
    first: 2,
    second: 0,
    thirdPlus: 0,
    total: 2,
  });
  assert.equal(
    general.reduce((total, r) => total + (evidence.get(r.id)?.total ?? 0), 0),
    300,
  );
  assert.equal(
    filterSubscriptionsByScope(records, projects, 'general', 'g1').length,
    1,
  );
  assert.equal(
    filterSubscriptionsByScope(records, projects, 'research', 'g1').length,
    0,
  );
  assert.deepEqual(
    filterSubscriptionsByScope(records, projects, 'research', 'all').map(
      (r) => r.id,
    ),
    ['r1-record'],
  );
  assert.equal(
    filterSubscriptionsByScope(records, projects, 'all', 'all').length,
    4,
  );
});

test('빈 연도의 완료율은 0% 실적으로 오인시키지 않는다', () => {
  const result = summarizeProjectKpis([], new Map(), today);
  assert.equal(result.projects, 0);
  assert.equal(result.taskCompletionRate, null);
  assert.equal(result.installationRate, null);
  assert.equal(result.documentRate, null);
  assert.equal(result.settlementRate, null);
});

test('입금 근거는 양수 입금 업무 이력만 사용하고 두 입금은 두 번째 갱신으로 묶는다', () => {
  const works = [
    work('pay', 'r1'),
    work('pay2', 'r2'),
    work('note', 'r3', { workType: 'note' }),
  ];
  const payment = entry('a', 'pay');
  const evidence = paymentEvidenceByRecord(
    works,
    [
      payment,
      payment,
      entry('b', 'pay', { amount: 250 }),
      entry('zero', 'pay', { amount: 0 }),
      entry('refund', 'pay', { amount: -100 }),
      entry('memo', 'note'),
      entry('orphan', 'missing'),
      entry('future', 'pay2', { occurredAt: now + 1 }),
      entry('invalid', 'pay', { amount: Number.NaN }),
    ],
    now,
  );
  assert.equal(evidence.size, 1);
  assert.equal(evidence.get('r1').count, 2);
  assert.equal(evidence.get('r1').total, 350);
  assert.equal(
    summarizeSubscriptionCycles(
      [record('r1'), record('r2', { lastPaymentDate: today })],
      evidence,
    ).second,
    1,
  );
});

test('최근 입금일·금액·연결 업무는 같은 최신 입금 기록을 참조한다', () => {
  const works = [work('older', 'r1'), work('latest', 'r1')];
  const older = entry('a', 'older', { amount: 132000, occurredAt: now - 3000 });
  const latest = entry('z', 'latest', {
    amount: 66000,
    occurredAt: now - 1000,
  });
  for (const entries of [
    [latest, older],
    [older, latest],
  ]) {
    const payment = paymentEvidenceByRecord(works, entries, now).get('r1');
    assert.equal(payment.count, 2);
    assert.equal(payment.total, 198000);
    assert.equal(payment.latestPaymentAmount, 66000);
    assert.equal(payment.latestPaidAt, latest.occurredAt);
    assert.equal(payment.latestHistoryEntryId, latest.id);
    assert.equal(payment.latestWorkItemId, latest.workItemId);
  }
});

test('실제 입금 0·1·2·3건 이상으로만 분류하고 수기 횟수와 구독 상태는 무시한다', () => {
  const records = [
    record('initial'),
    record('first', { renewalCount: 1 }),
    record('second', { renewalCount: 99 }),
    record('third', { renewalCount: 0 }),
    record('no-proof', { lastPaymentDate: today }),
    record('not-a-subscription', {
      subscriptionStatus: 'unregistered',
      initialSubscriptionExpiresAt: '',
      currentSubscriptionExpiresAt: '',
    }),
    record('invalid-cycle', { renewalCount: -1 }),
    record('server-snapshot', { renewalCount: 0, subscriptionPaymentCount: 2 }),
    record('invalid-snapshot', {
      renewalCount: 8,
      subscriptionPaymentCount: -1,
    }),
  ];
  const payments = paymentEvidenceByRecord(
    [
      work('i', 'initial'),
      work('u', 'not-a-subscription'),
      work('s', 'second'),
      work('t', 'third'),
      work('bad', 'invalid-cycle'),
    ],
    [
      entry('i', 'i', { amount: 132000 }),
      entry('u', 'u'),
      entry('s1', 's'),
      entry('s2', 's'),
      entry('t1', 't'),
      entry('t2', 't'),
      entry('t3', 't'),
      entry('bad', 'bad'),
    ],
    now,
  );
  assert.deepEqual(summarizeSubscriptionCycles(records, payments), {
    noPayment: 3,
    first: 3,
    second: 2,
    thirdPlus: 1,
    total: 9,
  });
});

test('기간 미처리 대상에서 어제·오늘·내일 만료와 이미 처리한 회차를 구분한다', () => {
  const records = [
    record('yesterday', { currentSubscriptionExpiresAt: '2026-09-06' }),
    record('today', { currentSubscriptionExpiresAt: today }),
    record('tomorrow', { currentSubscriptionExpiresAt: '2026-09-08' }),
    record('resolved', { currentSubscriptionExpiresAt: '2026-08-31' }),
    record('next-year', { currentSubscriptionExpiresAt: '2027-01-01' }),
  ];
  const outcomes = [
    event('resolved', '2026-08-31'),
    event('resolved', '2026-08-31', { eventType: 'churned' }),
  ];
  assert.deepEqual(
    unresolvedExpiryCohorts(records, outcomes, 2026, 12, today),
    {
      target: 4,
      pending: 3,
      expiredPending: 1,
      scheduledPending: 2,
      dueTodayPending: 1,
    },
  );
  assert.equal(
    unresolvedExpiryCohorts(records, outcomes, 2026, 8, today).pending,
    0,
  );
});

test('오늘 기준 현황은 전월 보고기간과 무관하게 이번 달 만료도 집계한다', () => {
  const records = [
    record('past', { currentSubscriptionExpiresAt: '2026-09-06' }),
    record('today', { currentSubscriptionExpiresAt: today }),
    record('future', { currentSubscriptionExpiresAt: '2028-01-01' }),
    record('churn', {
      subscriptionStatus: 'expired',
      currentSubscriptionExpiresAt: '2026-08-01',
    }),
    record('missing', { currentSubscriptionExpiresAt: '' }),
    record('inactive-future', {
      subscriptionStatus: 'expired',
      currentSubscriptionExpiresAt: '2027-01-01',
    }),
  ];
  const events = [event('churn', '2026-08-01', { eventType: 'churned' })];
  assert.equal(
    unresolvedExpiryCohorts(records, events, 2026, 8, today).expiredPending,
    0,
  );
  assert.deepEqual(summarizeCurrentExpiry(records, events, today), {
    expiredPending: 1,
    upcoming: 2,
    dueToday: 1,
    missingExpiry: 1,
  });
});

test('다른 사업의 처리나 재가입은 현재 만료 회차 결과로 오인하지 않는다', () => {
  const records = [
    record('p1-record', {
      farmId: 'same-farm',
      currentSubscriptionExpiresAt: '2026-09-01',
    }),
    record('p2-record', {
      farmId: 'same-farm',
      projectId: 'p2',
      currentSubscriptionExpiresAt: '2026-09-01',
    }),
  ];
  const events = [
    event('p1-record', '2026-09-01'),
    event('p2-record', '2026-09-01', { eventType: 'rejoined' }),
  ];
  assert.equal(
    summarizeCurrentExpiry(records, events, today).expiredPending,
    1,
  );
});
