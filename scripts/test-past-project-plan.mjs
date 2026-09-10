import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPastProjectPlan } from './lib/past-project-plan.mjs';
const str = (value) => ({ stringValue: value });
const int = (value) => ({ integerValue: String(value) });
const root = 'projects/test/databases/(default)/documents/workspaces/test';
const doc = (name, fields) => ({
  name: `${root}/${name}`,
  updateTime: '2026-09-09T01:00:00Z',
  fields,
});
function fixtures() {
  return {
    projects: [2025, 2026, 2027].map((year) =>
      doc(`projects/p${year}`, {
        year: int(year),
        name: str('시험'),
        status: str('active'),
        currentStage: str('operation'),
        settlementStatus: str('not_started'),
        paidAmount: int(0),
        settledAt: str(''),
        deletedAt: int(0),
      }),
    ),
    farmRecords: [2025, 2026].map((year) =>
      doc(`farmRecords/r${year}`, {
        projectId: str(`p${year}`),
        installationDate: str('2025-05-01'),
        commissioningDate: str(''),
        educationDate: str(''),
        warrantyExpiresAt: str('2027-05-01'),
        currentSubscriptionExpiresAt: str('2027-12-31'),
        custom: { arrayValue: { values: [str('preserved')] } },
      }),
    ),
    projectDocuments: [2025, 2026].map((year) =>
      doc(`projectDocuments/d${year}`, {
        projectId: str(`p${year}`),
        status: str('not_started'),
        approvedAt: str(''),
        submittedAt: str(''),
        revision: int(3),
        referenceUrl: str('https://example.test/proof'),
      }),
    ),
  };
}
test('2026년 이전만 정확히 선택하고 날짜·금액·구독·기존 서류는 보존한다', () => {
  const data = fixtures();
  const original = structuredClone(data);
  const plan = buildPastProjectPlan(data, 1000, 'test-run');
  assert.deepEqual(data, original);
  assert.equal(plan.summary.projects, 1);
  assert.equal(plan.summary.farmRecords, 1);
  assert.equal(plan.summary.documents, 1);
  assert.equal(plan.writes.length, 4);
  assert.ok(
    plan.writes.every(
      (write) =>
        !write.update.name.includes('2026') &&
        !write.update.name.includes('2027'),
    ),
  );
  for (const write of plan.writes.filter((item) => item.updateMask)) {
    assert.equal(write.currentDocument.updateTime, '2026-09-09T01:00:00Z');
    assert.deepEqual(
      write.updateMask.fieldPaths,
      Object.keys(write.update.fields),
    );
    for (const key of [
      'paidAmount',
      'settledAt',
      'installationDate',
      'commissioningDate',
      'educationDate',
      'currentSubscriptionExpiresAt',
      'approvedAt',
      'submittedAt',
      'referenceUrl',
      'revision',
      'custom',
      'deletedAt',
    ])
      assert.equal(write.update.fields[key], undefined);
  }
  const flags = plan.writes.find((write) =>
    write.update.name.includes('farmRecords'),
  ).update.fields.stageCompletionConfirmed.mapValue.fields;
  assert.equal(flags.installationDate, undefined);
  assert.equal(flags.commissioningDate.booleanValue, true);
  assert.equal(flags.educationDate.booleanValue, true);
  const audit = plan.writes.at(-1);
  assert.equal(audit.currentDocument.exists, false);
  assert.match(audit.update.fields.actionContent.stringValue, /금액·구독·입금/);
});
test('완료 프로젝트의 하위 자료만 정정해도 연도 변경 경합을 방어한다', () => {
  const data = fixtures();
  Object.assign(data.projects[0].fields, {
    status: str('completed'),
    currentStage: str('closed'),
    settlementStatus: str('closed'),
  });
  const plan = buildPastProjectPlan(data, 1000, 'test-run');
  const guard = plan.writes.find(
    (write) => write.update.name === data.projects[0].name,
  );
  assert.equal(guard.currentDocument.updateTime, data.projects[0].updateTime);
  assert.deepEqual(guard.updateMask.fieldPaths, ['updatedAt', 'updatedByUid']);
});

test('이미 완료한 자료에 재실행하면 추가 기록·변경이 없다', () => {
  const data = fixtures();
  const plan = buildPastProjectPlan(data, 1000, 'test-run');
  for (const name of Object.keys(data))
    for (const item of data[name]) {
      const patch = plan.writes.find((write) => write.update.name === item.name)
        ?.update.fields;
      if (patch) Object.assign(item.fields, patch);
    }
  assert.equal(
    buildPastProjectPlan(data, 2000, 'another-run').writes.length,
    0,
  );
});
