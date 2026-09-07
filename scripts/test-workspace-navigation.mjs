import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  new URL('../lib/workspace-navigation.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { workMatchesScope, farmRecordsInContext, hasProjectParticipation } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
const today = '2026-09-07';
const scope = (status = 'all') => ({
  projectIds: ['general2026'],
  label: '2026년 · 일반사업',
  status,
});
const item = (status = 'open', dueDate = '2026-09-06') => ({ status, dueDate });
const records = [
  { id: 'a', projectId: 'general2026' },
  { id: 'b', projectId: 'research2026' },
];

test('KPI에서 연 목록은 선택한 연도·사업 타입의 프로젝트만 포함한다', () => {
  assert.equal(workMatchesScope(item(), 'general2026', scope(), today), true);
  assert.equal(workMatchesScope(item(), 'research2026', scope(), today), false);
  assert.equal(workMatchesScope(item(), 'general2025', scope(), today), false);
  assert.equal(workMatchesScope(item(), undefined, scope(), today), false);
});
test('전체 업무에는 완료를 포함하고 처리 필요에는 포함하지 않는다', () => {
  assert.equal(
    workMatchesScope(item('completed'), 'general2026', scope(), today),
    true,
  );
  assert.equal(
    workMatchesScope(item('completed'), 'general2026', scope('open'), today),
    false,
  );
  for (const status of ['open', 'waiting', 'in_progress'])
    assert.equal(
      workMatchesScope(item(status), 'general2026', scope('open'), today),
      true,
    );
});
test('마감 지연은 오늘 이전 미완료이며 오늘·미입력·완료는 제외한다', () => {
  assert.equal(
    workMatchesScope(item(), 'general2026', scope('overdue'), today),
    true,
  );
  for (const candidate of [
    item('open', today),
    item('open', ''),
    item('completed'),
  ])
    assert.equal(
      workMatchesScope(candidate, 'general2026', scope('overdue'), today),
      false,
    );
});
test('날짜가 넘어가면 같은 업무의 지연 여부도 바뀐다', () => {
  assert.equal(
    workMatchesScope(
      item('open', today),
      'general2026',
      scope('overdue'),
      today,
    ),
    false,
  );
  assert.equal(
    workMatchesScope(
      item('open', today),
      'general2026',
      scope('overdue'),
      '2026-09-08',
    ),
    true,
  );
});
test('빈 프로젝트 범위는 전체 목록으로 확대되지 않는다', () => {
  assert.equal(
    workMatchesScope(
      item(),
      'general2026',
      { ...scope(), projectIds: [] },
      today,
    ),
    false,
  );
  assert.equal(workMatchesScope(item(), undefined, null, today), true);
});
test('프로젝트에서 농가 진입 시 참여 기록 범위를 유지하고 전체로 해제할 수 있다', () => {
  assert.deepEqual(
    farmRecordsInContext(records, 'general2026').map((record) => record.id),
    ['a'],
  );
  assert.equal(farmRecordsInContext(records, '').length, 2);
  assert.equal(farmRecordsInContext(records, 'missing').length, 0);
  assert.equal(records.length, 2);
});
test('다른 사업을 보는 중에도 기존 참여 사업의 중복을 막는다', () => {
  assert.equal(farmRecordsInContext(records, 'general2026').length, 1);
  assert.equal(hasProjectParticipation(records, 'research2026'), true);
  assert.equal(hasProjectParticipation(records, 'new'), false);
  assert.equal(hasProjectParticipation(records, 'general2026', 'a'), false);
  assert.equal(hasProjectParticipation(records, 'research2026', 'a'), true);
});
