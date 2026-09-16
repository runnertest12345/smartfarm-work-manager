import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const dashboard = readFileSync(new URL('../app/farm-ledger-dashboard.tsx', import.meta.url), 'utf8');
const file = ts.createSourceFile('dashboard.tsx', dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['submitProject', 'openProjectDialog', 'resumeInstallationFarms'];
const handlers = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) {
    assert.ok(node.body);
    const prefix = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
    handlers.set(node.name.text, `${prefix}function ${node.name.text}(${node.parameters.map((parameter) => parameter.getText(file)).join(', ')}) ${node.body.getText(file)}`);
  }
  ts.forEachChild(node, visit);
}
visit(file);
assert.equal(handlers.size, names.length, 'Expected dashboard handlers exist');
const snippet = ts.transpileModule(
  `${[...handlers.values()].join('\n')}\nglobalThis.handlers = { ${names.join(', ')} };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;

const baseProject = {
  id: 'synthetic-project', name: '새 프로젝트', projectType: 'general',
  targetFarmCount: 2, installationFarmSetup: { requestedCount: 2, completedCount: 2 },
};
const event = () => ({ preventDefault() {} });
function setup(overrides = {}) {
  const state = { calls: [], notices: [], errors: {}, error: '', dialog: 'project', submitting: false, opened: '', tab: '', busyId: '', validationCalls: 0, syncs: 0, uuids: 0 };
  const apply = (value, current) => typeof value === 'function' ? value(current) : value;
  const context = {
    Error,
    projectSaveBusy: { current: false },
    projectRegistrationRequest: { current: '' },
    projectExpectedVersion: { current: 0 },
    installationResumeBusy: { current: false },
    editingProjectId: '',
    projectForm: { ...baseProject },
    projectTypeFilter: 'all', view: 'projects', accountName: '담당자',
    crypto: { randomUUID: () => `synthetic-request-${++state.uuids}` },
    canGoBackDetail: () => true,
    normalizeInternalProject: (input) => ({ ...input, targetFarmCount: 0 }),
    emptyProjectForm: () => ({ ...baseProject, targetFarmCount: 0 }),
    isInternalProject: (input) => input.projectType === 'internal',
    validateInstallationFarmCount: (count) => {
      state.validationCalls += 1;
      if (!Number.isSafeInteger(count) || count < 0 || count > 500) throw new Error('설치 개소 정수 범위 오류');
    },
    withSettlementRounds: (input, rounds) => ({ ...input, settlementRounds: rounds }),
    setSubmitting: (value) => { state.submitting = value; },
    setFormError: (value) => { state.error = value; },
    setDialog: (value) => { state.dialog = value; },
    setEditingProjectId: (value) => { context.editingProjectId = value; },
    setProjectForm: (value) => { context.projectForm = apply(value, context.projectForm); },
    setProjectDetailTab: (value) => { state.tab = value; },
    setInstallationErrors: (value) => { state.errors = apply(value, state.errors); },
    setInstallationBusyId: (value) => { state.busyId = value; },
    openProjectDetail: (id) => { state.opened = id; },
    toast: { add: (notice) => state.notices.push(notice) },
    waitForFarmLedgerSync: async () => { state.syncs += 1; },
    readResponse: async (response) => response.data,
    farmLedgerFetch: async (url, options) => {
      state.calls.push({ url, ...options, payload: JSON.parse(options.body) });
      return context.response();
    },
    response: async () => ({ ok: true, data: { project: baseProject } }),
    ...overrides,
  };
  vm.runInNewContext(snippet, context);
  return { context, state, ...context.handlers };
}

test('등록 창을 새로 열 때만 요청 ID를 갱신하고 이동 거부 시 현재 입력을 보존한다', () => {
  const fixture = setup();
  fixture.openProjectDialog();
  assert.equal(fixture.context.projectRegistrationRequest.current, 'synthetic-request-1');
  fixture.context.canGoBackDetail = () => false;
  fixture.context.projectForm.targetFarmCount = 9;
  fixture.openProjectDialog();
  assert.equal(fixture.context.projectRegistrationRequest.current, 'synthetic-request-1');
  assert.equal(fixture.context.projectForm.targetFarmCount, 9);
  fixture.context.canGoBackDetail = () => true;
  fixture.openProjectDialog();
  assert.equal(fixture.context.projectRegistrationRequest.current, 'synthetic-request-2');
  assert.equal(fixture.state.dialog, 'project');
});

test('등록 저장 중 중복 제출은 네트워크 호출을 추가하지 않는다', async () => {
  let resolve;
  const fixture = setup({ response: () => new Promise((done) => { resolve = done; }) });
  const pending = fixture.submitProject(event());
  assert.equal(fixture.context.projectSaveBusy.current, true);
  await fixture.submitProject(event());
  assert.equal(fixture.state.calls.length, 1);
  resolve({ ok: true, data: { project: baseProject } });
  await pending;
  assert.equal(fixture.context.projectSaveBusy.current, false);
  assert.equal(fixture.state.submitting, false);
});

test('등록 실패 후 같은 폼 재시도는 동일 요청 ID를 유지한다', async () => {
  const fixture = setup({ response: async () => { throw new Error('로컬 모의 연결 오류'); } });
  await fixture.submitProject(event());
  const requestId = fixture.state.calls[0].payload.requestId;
  assert.equal(fixture.state.error, '로컬 모의 연결 오류');
  assert.equal(fixture.state.dialog, 'project');
  assert.equal(fixture.context.projectSaveBusy.current, false);
  fixture.context.response = async () => ({ ok: true, data: { project: baseProject } });
  await fixture.submitProject(event());
  assert.equal(fixture.state.calls[1].payload.requestId, requestId);
  assert.equal(fixture.state.uuids, 1);
  assert.equal(fixture.state.error, '');
});

test('신규 일반 프로젝트만 자동 생성 개소 수를 검증하며 수정 요청에는 생성 ID가 없다', async () => {
  const invalid = setup({ projectForm: { ...baseProject, targetFarmCount: 1.5 } });
  await invalid.submitProject(event());
  assert.equal(invalid.state.validationCalls, 1);
  assert.equal(invalid.state.calls.length, 0);
  assert.match(invalid.state.error, /설치 개소/);
  assert.equal(invalid.state.submitting, false);
  const editing = setup({ editingProjectId: 'existing', projectForm: { ...baseProject, targetFarmCount: 1000 } });
  await editing.submitProject(event());
  assert.equal(editing.state.validationCalls, 0);
  assert.equal(editing.state.calls[0].method, 'PATCH');
  assert.equal(editing.state.calls[0].payload.projectId, 'existing');
  assert.equal('requestId' in editing.state.calls[0].payload, false);
  const internal = setup({ projectForm: { ...baseProject, projectType: 'internal', targetFarmCount: 9999 } });
  await internal.submitProject(event());
  assert.equal(internal.state.validationCalls, 0);
});

test('일부 농가 생성이 실패해도 저장된 프로젝트를 열고 농가 탭과 이어생성 경고를 표시한다', async () => {
  const partial = { ...baseProject, installationFarmSetup: { requestedCount: 25, completedCount: 10 } };
  const fixture = setup({ response: async () => ({ ok: true, data: { project: partial, installationSetupError: '나머지 15개 생성 필요' } }) });
  await fixture.submitProject(event());
  assert.equal(fixture.state.dialog, null);
  assert.equal(fixture.state.opened, partial.id);
  assert.equal(fixture.state.tab, 'farms');
  assert.equal(fixture.state.errors[partial.id], '나머지 15개 생성 필요');
  assert.equal(fixture.state.syncs, 1);
  assert.match(fixture.state.notices[0].title, /프로젝트는 저장됐으며 농가 생성이 남아/);
  assert.match(fixture.state.notices[0].description, /남은 농가 생성을 이어서/);
  assert.equal(fixture.state.notices[0].type, 'error');
});

test('이어생성은 전용 kind와 프로젝트 ID만 전송하고 중복 방지·오류·재시도를 처리한다', async () => {
  let resolve;
  const fixture = setup({ response: () => new Promise((done) => { resolve = done; }) });
  const pending = fixture.resumeInstallationFarms(baseProject);
  assert.equal(fixture.state.busyId, baseProject.id);
  await fixture.resumeInstallationFarms(baseProject);
  assert.equal(fixture.state.calls.length, 1);
  assert.deepEqual(fixture.state.calls[0].payload, { kind: 'project_installation_farms', projectId: baseProject.id });
  assert.equal(fixture.state.calls[0].method, 'POST');
  resolve({ ok: true, data: { project: baseProject, installationSetupError: '이어생성 모의 오류' } });
  await pending;
  assert.equal(fixture.state.errors[baseProject.id], '이어생성 모의 오류');
  assert.equal(fixture.state.busyId, '');
  assert.equal(fixture.context.installationResumeBusy.current, false);
  assert.equal(fixture.state.notices.length, 0);
  fixture.context.response = async () => ({ ok: true, data: { project: baseProject } });
  await fixture.resumeInstallationFarms(baseProject);
  assert.equal(fixture.state.errors[baseProject.id], '');
  assert.equal(fixture.state.notices[0].type, 'success');
});

test('설치 개소 필드는 새 등록만 500개 제한을 적용하고 자동 생성·추후 수정 범위를 설명한다', () => {
  const start = dashboard.indexOf('<FieldLabel htmlFor="project-target-farms">');
  assert.ok(start >= 0);
  const field = dashboard.slice(start, dashboard.indexOf('</Field>', start));
  assert.match(field, /설치 개소/);
  assert.match(field, /min=\{0\}/);
  assert.match(field, /step=\{1\}/);
  assert.match(field, /max=\{editingProjectId \? undefined : MAX_PROJECT_INSTALLATION_FARMS\}/);
  assert.match(field, /aria-describedby="project-installation-help"/);
  assert.match(field, /id="project-installation-help"/);
  assert.match(field, /기존 농가가 자동으로 추가되거나 삭제되지는 않습니다/);
  assert.match(field, /농가명·주소·전화번호·농장번호는 나중에 수정/);
  const helper = readFileSync(new URL('../lib/project-installation-farms.ts', import.meta.url), 'utf8');
  assert.match(helper, /MAX_PROJECT_INSTALLATION_FARMS = 500/);
});
