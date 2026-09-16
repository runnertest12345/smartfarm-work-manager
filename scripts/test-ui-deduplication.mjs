import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const dashboard = source('app/farm-ledger-dashboard.tsx');
const parsed = ts.createSourceFile('dashboard.tsx', dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function walk(node) {
  const found = [node];
  ts.forEachChild(node, (child) => { found.push(...walk(child)); });
  return found;
}
function jsx(node) {
  return ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
}
function components(root, tag) {
  return walk(root).filter((node) => jsx(node)?.tagName.getText(parsed) === tag);
}
function attribute(node, name) {
  const attr = jsx(node)?.attributes.properties.find((entry) => ts.isJsxAttribute(entry) && entry.name.getText(parsed) === name);
  if (!attr) return undefined;
  return ts.isStringLiteral(attr.initializer) ? attr.initializer.text : attr.initializer?.getText(parsed);
}
function oneByAttribute(tag, name, value, root = parsed) {
  const matches = components(root, tag).filter((node) => attribute(node, name) === value);
  assert.equal(matches.length, 1, `${tag} ${name}=${value} must have one canonical location`);
  return matches[0];
}
function section(start, end) {
  const begin = dashboard.indexOf(start);
  const finish = dashboard.indexOf(end, begin + start.length);
  assert.ok(begin >= 0 && finish > begin, `Expected bounded section: ${start}`);
  return dashboard.slice(begin, finish);
}
const count = (text, needle) => text.split(needle).length - 1;
function initializer(name) {
  const variable = walk(parsed).find((node) => ts.isVariableDeclaration(node) && node.name.getText(parsed) === name);
  assert.ok(variable?.initializer, `Expected data source: ${name}`);
  return variable.initializer.getText(parsed);
}

function projectSaveHarness() {
  const names = ['saveProjectQuick', 'saveProjectSettlement'];
  const declarations = names.map((name) => {
    const declaration = walk(parsed).find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, `Expected actual dashboard save function: ${name}`);
    return declaration.getText(parsed);
  });
  const quickEditing = { current: false };
  const settlementEditing = { current: false };
  const calls = [];
  const transformed = [];
  const notifications = [];
  let syncCount = 0;
  // Only the boundary dependencies are fakes. Both guards and save pipelines
  // below are compiled directly from the dashboard's actual functions.
  const transform = (kind) => (base, values) => {
    transformed.push(kind);
    return { ...base, ...values };
  };
  const code = ts.transpileModule(`${declarations.join('\n')}\n({ ${names.join(', ')} });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const functions = vm.runInNewContext(code, {
    projectQuickEditingRef: quickEditing,
    projectSettlementEditingRef: settlementEditing,
    projectQuickInput: transform('quick'),
    projectSettlementInput: transform('settlement'),
    farmLedgerFetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, method: options.method, body });
      return { ok: true, data: { project: { ...body.project, id: body.projectId, updatedAt: body.expectedUpdatedAt + 1 } } };
    },
    readResponse: async (response) => response.data,
    waitForFarmLedgerSync: async () => { syncCount += 1; },
    toast: { add: (notification) => notifications.push(notification) },
  });
  return { ...functions, quickEditing, settlementEditing, calls, transformed, notifications, syncCount: () => syncCount };
}

for (const [functionName, blockingRef, error, transformName, values] of [
  ['saveProjectQuick', 'settlementEditing', /정산 변경을 저장하거나 취소한 뒤 기본정보/, 'quick', { projectType: 'internal', name: '변경된 내부 프로젝트' }],
  ['saveProjectSettlement', 'quickEditing', /기본정보 변경을 저장하거나 취소한 뒤 정산/, 'settlement', { contractAmount: 300000, settlementNote: '미저장 정산 초안' }],
]) {
  test(`${functionName}: 반대 영역의 초안이 있으면 API 전 차단하고 취소 후 한 번만 저장한다`, async () => {
    const harness = projectSaveHarness();
    const base = Object.freeze({ id: 'project', updatedAt: 10, projectType: 'general', name: '원본', contractAmount: 0 });
    const draft = Object.freeze({ ...values });
    const original = JSON.stringify({ base, draft });
    harness[blockingRef].current = true;
    await assert.rejects(harness[functionName](base, draft), error);
    assert.equal(harness.calls.length, 0, '상대 초안이 사라질 수 있는 저장은 API 전에 막는다');
    assert.equal(harness.transformed.length, 0);
    assert.equal(harness.syncCount(), 0);
    assert.equal(harness.notifications.length, 0);
    assert.equal(JSON.stringify({ base, draft }), original);
    assert.equal(harness[blockingRef].current, true, '저장 거절이 다른 폼의 편집 상태를 지우면 안 된다');

    harness[blockingRef].current = false;
    const result = await harness[functionName](base, draft);
    assert.equal(harness.calls.length, 1);
    assert.deepEqual(harness.transformed, [transformName]);
    assert.equal(harness.calls[0].url, '/api/farm-ledger');
    assert.equal(harness.calls[0].method, 'PATCH');
    assert.equal(harness.calls[0].body.kind, 'project');
    assert.equal(harness.calls[0].body.projectId, base.id);
    assert.equal(harness.calls[0].body.expectedUpdatedAt, base.updatedAt);
    assert.deepEqual(harness.calls[0].body.project, { ...base, ...draft });
    assert.equal(result.updatedAt, 11);
    assert.equal(harness.syncCount(), 1);
    assert.equal(harness.notifications.length, 1);
    assert.equal(JSON.stringify({ base, draft }), original);
  });
}

test('기본정보와 정산을 동시에 수정한 경우 어느 저장도 다른 초안이나 원본을 소실시키지 않는다', async () => {
  const harness = projectSaveHarness();
  const base = Object.freeze({ id: 'project', updatedAt: 10, projectType: 'general', name: '원본', contractAmount: 0 });
  const quickDraft = Object.freeze({ projectType: 'internal', name: '내부 전환 초안' });
  const settlementDraft = Object.freeze({ contractAmount: 300000, settlementNote: '취소하면 안 되는 초안' });
  const original = JSON.stringify({ base, quickDraft, settlementDraft });
  harness.quickEditing.current = true;
  harness.settlementEditing.current = true;
  await assert.rejects(harness.saveProjectQuick(base, quickDraft), /정산 변경을 저장하거나 취소/);
  await assert.rejects(harness.saveProjectSettlement(base, settlementDraft), /기본정보 변경을 저장하거나 취소/);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.transformed.length, 0);
  assert.equal(JSON.stringify({ base, quickDraft, settlementDraft }), original);
  assert.equal(harness.quickEditing.current, true);
  assert.equal(harness.settlementEditing.current, true);
});

test('프로젝트의 기본정보·제목·작업은 일반·내부 공통 위치에 각각 한 번만 배치한다', () => {
  const basics = components(parsed, 'ProjectQuickEditor');
  const actions = components(parsed, 'ProjectDetailActions');
  assert.equal(basics.length, 1);
  assert.equal(actions.length, 1);
  assert.equal(attribute(basics[0], 'project'), '{selectedProject}');
  assert.equal(attribute(basics[0], 'onSave'), '{saveProjectQuick}');
  const header = oneByAttribute('header', 'aria-label', '프로젝트 제목과 작업');
  assert.equal(components(header, 'ProjectDetailActions').length, 1);
  const headerText = header.getText(parsed);
  for (const field of ['description', 'institution', 'manager', 'startDate', 'endDate', 'currentStage']) {
    assert.ok(!headerText.includes(`selectedProject.${field}`), `${field} is edited and displayed in basic information only`);
  }
  assert.equal(components(parsed, 'InternalProjectDetail').length, 1);
  assert.ok(!dashboard.includes('openProjectEditDialog'), '기존 프로젝트의 전체 정보 수정 팝업을 다시 열지 않는다');
});

test('정산은 정산 탭의 전용 Workspace만 열고 기본정보를 다시 편집하지 않는다', () => {
  const settlement = oneByAttribute('TabsContent', 'value', 'settlement');
  const workspaces = components(settlement, 'ProjectSettlementWorkspace');
  assert.equal(workspaces.length, 1);
  assert.equal(components(parsed, 'ProjectSettlementWorkspace').length, 1);
  assert.equal(attribute(workspaces[0], 'project'), '{selectedProject}');
  assert.equal(attribute(workspaces[0], 'onSave'), '{saveProjectSettlement}');
  assert.ok(attribute(workspaces[0], 'onEditingChange')?.includes('projectSettlementEditingRef'));
  assert.equal(components(settlement, 'ProjectQuickEditor').length, 0);
  assert.equal(components(settlement, 'Dialog').length, 0);
  const editor = source('app/project-settlement-workspace.tsx');
  assert.ok(editor.includes('projectSettlementInput(base, draft)'));
  assert.ok(editor.includes("base.status === 'completed'"));
  assert.ok(editor.includes("base.projectType === 'internal'"));
  assert.ok(editor.includes('latest.deletedAt'));
});

test('프로젝트 기록·서류 추가는 헤더에서만 실행하고 각 탭은 조회·기존 내역 수정에 집중한다', () => {
  const actions = components(parsed, 'ProjectDetailActions')[0];
  assert.ok(attribute(actions, 'onRecord')?.includes('openProjectUpdateDialog(selectedProject)'));
  assert.ok(attribute(actions, 'onDocument')?.includes('openProjectDocumentDialog(selectedProject)'));
  const documents = oneByAttribute('TabsContent', 'value', 'documents');
  const documentsText = documents.getText(parsed);
  const documentCalls = components(documents, 'Button').map((node) => attribute(node, 'onClick') || '').filter((handler) => handler.includes('openProjectDocumentDialog'));
  assert.equal(documentCalls.length, 1, '기존 서류 수정만 남긴다');
  assert.match(documentCalls[0], /openProjectDocumentDialog\(\s*selectedProject,\s*document,?\s*\)/);
  assert.ok(documentsText.includes('서류 정보 수정'));
  const detail = oneByAttribute('section', 'aria-label', '프로젝트 전체 상세');
  const history = oneByAttribute('TabsContent', 'value', 'history', detail);
  const historyText = history.getText(parsed);
  assert.ok(!historyText.includes('기록 추가'));
  // 막힘은 일반 연락 기록과 다르므로 별도 기록 동작으로 남겨 둔다.
  assert.ok(historyText.includes('막힘 추가'));
  assert.ok(historyText.includes("'blocker'"));
});

test('프로젝트 하위 업무의 빠른 수신은 직접 업무 등록과 이름과 흐름이 구분된다', () => {
  const candidates = components(parsed, 'TabsContent').filter((node) => attribute(node, 'value') === 'work' && node.getText(parsed).includes('selectedProject.name'));
  assert.equal(candidates.length, 1);
  const work = candidates[0].getText(parsed);
  assert.ok(work.includes('빠른 수신'));
  assert.ok(work.includes('openInboxDialog(selectedProject.id)'));
  assert.ok(!work.includes('하위 업무 추가'));
  assert.equal(components(candidates[0], 'WorkTaskSurface').length, 1);
});

test('통합 현황에는 연도별 지표와 프로젝트 목록을 한 번만 두고 구형 프로젝트 트리를 반복하지 않는다', () => {
  const overview = section("{view === 'overview' && (", "{view === 'work' && (");
  assert.equal(count(overview, '<AnnualOverviewPanel'), 1);
  assert.equal(count(overview, '<ProjectManagementList'), 1);
  assert.ok(overview.includes('rows={annualProjectRows}'));
  assert.ok(overview.includes('onOpen={openProjectDetail}'));
  assert.ok(!overview.includes('overviewProjectRows'));
  assert.ok(!overview.includes('<ProjectWorkTree'));
  assert.equal(count(overview, '<InternalWorkKpiPanel'), 1, '명시 요청한 내부 업무 KPI는 보존한다');
  assert.equal(count(overview, '최근 업무·처리 히스토리'), 1);
  assert.ok(dashboard.includes('사업별 설치 진행'), '연도별 사업 성과 비교는 별도 역할로 보존한다');
});

test('통합 현황에서 제거한 업무 트리는 프로젝트 상세와 업무 보드에서 계속 조회·수정할 수 있다', () => {
  const detail = oneByAttribute('section', 'aria-label', '프로젝트 전체 상세');
  assert.ok(components(detail, 'WorkTaskSurface').length > 0);
  const internal = components(parsed, 'InternalProjectDetail')[0];
  assert.equal(components(internal, 'WorkTaskSurface').length, 1);
  assert.equal(components(parsed, 'WorkTaskSurface').filter((node) => attribute(node, 'mode') === 'board').length, 1);
  assert.match(source('app/work-task-controls.tsx'), /mode === 'board' \? \(\s*<WorkBoard/);
  const board = source('app/work-board.tsx');
  assert.ok(board.includes('data-board-children-toggle'), '사용자가 요청한 보드 하위 업무 접기·펼치기는 보존한다');
});

test('통합 현황 최근 이력은 선택된 일반·내부 프로젝트 범위를 그대로 따르며 다른 사업을 끼워 넣지 않는다', () => {
  const snapshots = new Map([
    ['internal', { workItems: [{ id: 'internal-task' }] }],
    ['business', { workItems: [{ id: 'business-task' }] }],
    ['outside', { workItems: [{ id: 'outside-task' }] }],
  ]);
  const historyEntries = [
    { id: 'internal-history', workItemId: 'internal-task', occurredAt: 20, createdAt: 20 },
    { id: 'business-history', workItemId: 'business-task', occurredAt: 30, createdAt: 30 },
    { id: 'outside-history', workItemId: 'outside-task', occurredAt: 40, createdAt: 40 },
  ];
  for (const [ids, expected] of [
    [['internal'], ['internal-history']],
    [['business'], ['business-history']],
    [['internal', 'business'], ['business-history', 'internal-history']],
    [[], []],
  ]) {
    const result = vm.runInNewContext(`const overviewWorkIds = ${initializer('overviewWorkIds')}; (${initializer('recentHistoryEntries')}).map((entry) => entry.id)`, {
      annualProjects: ids.map((id) => ({ id })), projectSnapshots: snapshots,
      workspace: { historyEntries },
    });
    assert.deepEqual(Array.from(result), expected);
  }
  const overview = section("{view === 'overview' && (", "{view === 'work' && (");
  assert.ok(overview.includes('workContextLabel(workItem)'));
  assert.ok(!overview.includes('openScopedWork'));
  assert.match(overview, /최근 업무·처리 히스토리[\s\S]*?onClick=\{\(\) => openAnnualWork\(\)\}/);
  assert.ok(overview.includes('최근 이력은 선택한 연도·프로젝트 유형 기준'));
});

test('농가 사업 점검은 내부 프로젝트에서 숨기고 마감 지연은 연도 핵심 지표에서 한 번만 노출한다', () => {
  const aside = oneByAttribute('aside', 'aria-label', '농가 사업 점검');
  assert.ok(ts.isBinaryExpression(aside.parent), '사업 점검 전체 영역에 조건이 적용되어야 한다');
  assert.equal(aside.parent.operatorToken.kind, ts.SyntaxKind.AmpersandAmpersandToken);
  assert.equal(aside.parent.left.getText(parsed), "projectTypeFilter !== 'internal'");
  const overview = section("{view === 'overview' && (", "{view === 'work' && (");
  assert.equal(count(overview, "openAnnualWork('overdue')"), 1);
  assert.ok(overview.includes('annualOverdueCount'));
  assert.ok(!overview.includes('yearProjectKpis.overdueTasks'));
  assert.ok(aside.getText(parsed).includes('구독 만료·미등록'));
  assert.ok(aside.getText(parsed).includes('데이터 점검'));
  assert.ok(overview.includes('내부 업무 지표는 전체 기간'));
});

test('현재 구독 회차는 관리 탭에만 두고 연간 보고의 과거 실적과 섞지 않는다', () => {
  const report = oneByAttribute('TabsContent', 'value', 'report');
  const management = oneByAttribute('TabsContent', 'value', 'management');
  assert.equal(components(report, 'SubscriptionCyclePanel').length, 0);
  assert.equal(components(management, 'SubscriptionCyclePanel').length, 1);
  assert.equal(components(parsed, 'SubscriptionCyclePanel').length, 1);
  assert.equal(components(report, 'SubscriptionRenewalPanel').length, 1);
  assert.equal(components(report, 'SubscriptionPaymentYearPanel').length, 1);
});

test('농가 A/S 등록은 사업별 맥락과 A/S 탭에 남기고 공통 기본정보 작업에 중복하지 않는다', () => {
  const farmInfo = oneByAttribute('section', 'aria-label', '농가 참여 사업·설치·구독 정보');
  const serviceCalls = components(farmInfo, 'Button').map((node) => attribute(node, 'onClick') || '').filter((handler) => handler.includes('openWorkItemDialog'));
  assert.equal(serviceCalls.length, 1);
  assert.match(serviceCalls[0], /openWorkItemDialog\(\s*record.id,\s*'service',?\s*\)/);
  assert.ok(farmInfo.getText(parsed).includes('이 사업에 A/S 등록'));
  const serviceTabs = components(parsed, 'TabsContent').filter((node) => attribute(node, 'value') === 'work' && node.getText(parsed).includes('농가 A/S'));
  assert.equal(serviceTabs.length, 1);
  const tabCalls = components(serviceTabs[0], 'Button').map((node) => attribute(node, 'onClick') || '').filter((handler) => handler.includes('openWorkItemDialog'));
  assert.equal(tabCalls.length, 1);
  assert.match(tabCalls[0], /openWorkItemDialog\(\s*'',\s*'service'\s*\)/);
  assert.ok(serviceTabs[0].getText(parsed).includes('disabled={!selectedRecords.length}'));
});
