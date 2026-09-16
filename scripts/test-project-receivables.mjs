import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, aliases = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    module: loadedModule,
    exports: loadedModule.exports,
    require: (name) => aliases[name] || require(name),
  });
  return loadedModule.exports;
}
const farmTypes = load('lib/farm-types.ts');
const { emptySettlement, projectReceivableSummary } = load('lib/project-settlements.ts', {
  './farm-types': farmTypes,
});
const round = (patch = {}) => ({ ...emptySettlement(), ...patch });
const project = (patch = {}) => ({
  name: '수금 검증 프로젝트', projectType: 'general', status: 'active',
  contractAmount: 1000,
  settlementStatus: 'not_started', settlementDueDate: '',
  settlementClaimAmount: 0, settlementApprovedAmount: 0, settlementPaidAmount: 0,
  settledAt: '', settlementOwner: '', settlementEvidenceUrl: '', settlementNote: '',
  ...patch,
});
const summary = (input) => ({ ...projectReceivableSummary(input) });

test('계약 천만 원 중 726만 원 수령은 계약 차액과 승인 미입금을 구분한다', () => {
  assert.deepEqual(summary(project({
    contractAmount: 10_000_000, settlementClaimAmount: 7_260_000,
    settlementApprovedAmount: 7_260_000, settlementPaidAmount: 7_260_000,
  })), {
    contractAmount: 10_000_000, claimedAmount: 7_260_000, approvedAmount: 7_260_000,
    receivedAmount: 7_260_000, remainingContractAmount: 2_740_000,
    unreceivedApprovedAmount: 0, excessReceivedAmount: 0,
  });
});

test('아직 입금받지 않은 계약은 전체 계약 차액과 승인된 미입금액을 별도로 표시한다', () => {
  const result = summary(project({ settlementClaimAmount: 800, settlementApprovedAmount: 600 }));
  assert.equal(result.remainingContractAmount, 1000);
  assert.equal(result.unreceivedApprovedAmount, 600);
  assert.equal(result.receivedAmount, 0);
});

test('계약금액과 정확히 같은 입금은 계약 차액과 초과분이 모두 0이다', () => {
  const result = summary(project({ settlementApprovedAmount: 1000, settlementPaidAmount: 1000 }));
  assert.equal(result.remainingContractAmount, 0);
  assert.equal(result.excessReceivedAmount, 0);
  assert.equal(result.unreceivedApprovedAmount, 0);
});

test('계약 초과 입금은 음수 잔액으로 숨기지 않고 별도 초과 금액을 반환한다', () => {
  const result = summary(project({ settlementApprovedAmount: 1200, settlementPaidAmount: 1200 }));
  assert.equal(result.remainingContractAmount, 0);
  assert.equal(result.excessReceivedAmount, 200);
  assert.equal(result.receivedAmount, 1200);
});

test('계약금액 0은 남은 금액을 추정하지 않는다', () => {
  const result = summary(project({ contractAmount: 0 }));
  assert.equal(result.remainingContractAmount, null);
  assert.equal(result.excessReceivedAmount, 0);
});

test('계약금액 미확정이어도 실제 수령액과 승인 미입금액은 보존한다', () => {
  const result = summary(project({ contractAmount: 0, settlementApprovedAmount: 300, settlementPaidAmount: 200 }));
  assert.equal(result.remainingContractAmount, null);
  assert.equal(result.excessReceivedAmount, 0);
  assert.equal(result.receivedAmount, 200);
  assert.equal(result.unreceivedApprovedAmount, 100);
});

test('회차가 없는 기존 정산은 scalar 금액을 한 번씩 그대로 사용한다', () => {
  const result = summary(project({ settlementClaimAmount: 800, settlementApprovedAmount: 500, settlementPaidAmount: 250 }));
  assert.deepEqual(result, {
    contractAmount: 1000, claimedAmount: 800, approvedAmount: 500, receivedAmount: 250,
    remainingContractAmount: 750, unreceivedApprovedAmount: 250, excessReceivedAmount: 0,
  });
});

test('1·2·3차와 기존 미지정을 한 번씩 합산하며 오래된 scalar는 무시한다', () => {
  const result = summary(project({
    settlementClaimAmount: 9999, settlementApprovedAmount: 9999, settlementPaidAmount: 9999,
    settlementRounds: {
      first: round({ claimAmount: 100, approvedAmount: 100, paidAmount: 50 }),
      second: round({ claimAmount: 200, approvedAmount: 100, paidAmount: 80 }),
      third: round({ claimAmount: 300, approvedAmount: 200, paidAmount: 200 }),
      unassigned: round({ claimAmount: 50, approvedAmount: 40, paidAmount: 30 }),
    },
  }));
  assert.deepEqual(result, {
    contractAmount: 1000, claimedAmount: 650, approvedAmount: 440, receivedAmount: 360,
    remainingContractAmount: 640, unreceivedApprovedAmount: 80, excessReceivedAmount: 0,
  });
});

test('미지정 내역을 회차로 이동해도 조회 합계는 달라지지 않는다', () => {
  const legacy = round({ claimAmount: 300, approvedAmount: 200, paidAmount: 100 });
  const before = project({ settlementRounds: { first: round(), unassigned: legacy } });
  const after = project({ settlementRounds: { first: legacy } });
  assert.deepEqual(summary(before), summary(after));
});

test('청구했지만 승인 전인 금액을 승인 미입금액으로 세지 않는다', () => {
  const result = summary(project({ settlementRounds: { first: round({ status: 'submitted', claimAmount: 700 }) } }));
  assert.equal(result.claimedAmount, 700);
  assert.equal(result.approvedAmount, 0);
  assert.equal(result.unreceivedApprovedAmount, 0);
  assert.equal(result.remainingContractAmount, 1000);
});

test('부분 입금은 실제 승인액에서 받은 금액만 차감한다', () => {
  const result = summary(project({ settlementRounds: { first: round({ status: 'approved', claimAmount: 700, approvedAmount: 600, paidAmount: 250 }) } }));
  assert.equal(result.unreceivedApprovedAmount, 350);
  assert.equal(result.remainingContractAmount, 750);
});

test('한 회차의 초과 입금은 다른 회차의 미입금액을 상쇄하지 않는다', () => {
  // Display legacy/inconsistent data without rewriting it or weakening save validation.
  const result = summary(project({ settlementRounds: {
    first: round({ approvedAmount: 100, paidAmount: 180 }),
    second: round({ approvedAmount: 200, paidAmount: 100 }),
  } }));
  assert.equal(result.approvedAmount, 300);
  assert.equal(result.receivedAmount, 280);
  assert.equal(result.unreceivedApprovedAmount, 100);
});

test('paid·closed 상태와 입금·마감 날짜만으로 입금받았다고 가정하지 않는다', () => {
  for (const status of ['paid', 'closed']) {
    const input = project({
      settlementStatus: status, settledAt: '2026-09-15',
      settlementRounds: { first: round({ status, approvedAmount: 800, settledAt: '2026-09-15' }) },
    });
    const result = summary(input);
    assert.equal(result.receivedAmount, 0);
    assert.equal(result.remainingContractAmount, 1000);
    assert.equal(result.unreceivedApprovedAmount, 800);
    assert.equal(input.settlementRounds.first.status, status);
  }
});

test('미완료 상태라도 기록된 실제 입금액을 집계한다', () => {
  const result = summary(project({ settlementRounds: { first: round({ status: 'not_started', approvedAmount: 500, paidAmount: 500 }) } }));
  assert.equal(result.receivedAmount, 500);
  assert.equal(result.unreceivedApprovedAmount, 0);
});

test('깊게 고정된 원본과 기존 상태·날짜·회차·scalar를 변경하지 않는다', () => {
  const input = project({
    settlementPaidAmount: 9999, settlementStatus: 'closed', settledAt: '2020-01-01',
    settlementRounds: { first: round({ status: 'approved', approvedAmount: 300, paidAmount: 100, dueDate: '2026-10-01' }) },
  });
  const before = JSON.stringify(input);
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  freeze(input);
  const first = summary(input);
  assert.equal(first.receivedAmount, 100);
  assert.equal(JSON.stringify(input), before);
  first.receivedAmount = -1;
  assert.equal(summary(input).receivedAmount, 100);
  assert.equal(JSON.stringify(input), before);
});
