import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
let states = [], effects = [], pending = [], cursor = 0;
const hooks = {
  ...React,
  useState(initial) {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  },
  useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
  useEffect(effect, deps) {
    const i = cursor++, before = effects[i];
    if (!before || !deps || deps.some((value, index) => !Object.is(value, before.deps?.[index]))) {
      pending.push(() => { before?.cleanup?.(); effects[i] = { deps, cleanup: effect() }; });
    }
  },
};
const listeners = new Map();
const Button = ({ children, variant: _variant, ...props }) => React.createElement('button', props, children);
const ProjectSettlementDetails = () => React.createElement('div', null, '정산 조회 내역');
const ProjectSettlementEditor = () => React.createElement('div', null, '정산 편집 필드');
const load = (file, aliases = {}) => {
  const evaluatedModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source(file), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: evaluatedModule, exports: evaluatedModule.exports, Error, structuredClone,
    window: {
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    },
    require: (name) => name === 'react' ? hooks : aliases[name] || require(name),
  });
  return evaluatedModule.exports;
};
const farmTypes = load('lib/farm-types.ts');
const settlementHelpers = load('lib/project-settlements.ts', { './farm-types': farmTypes });
const helpers = load('lib/project-settlement-edit.ts', { './project-settlements': settlementHelpers });
const { projectSettlementDraft, projectSettlementInput } = helpers;
const { ProjectSettlementWorkspace } = load('app/project-settlement-workspace.tsx', {
  '@/lib/project-settlement-edit': helpers,
  '@/components/ui/button': { Button },
  './project-settlement-panels': { ProjectSettlementDetails, ProjectSettlementEditor },
});
const unmount = () => { for (const effect of effects) effect?.cleanup?.(); };
const reset = () => { unmount(); states = []; effects = []; pending = []; cursor = 0; listeners.clear(); };
const nodes = (element) => !element || typeof element !== 'object' ? [] : [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
const find = (tree, predicate) => { const match = nodes(tree).find(predicate); assert.ok(match, 'Control exists'); return match; };
const render = (props) => {
  cursor = 0; pending = [];
  const tree = ProjectSettlementWorkspace(props);
  for (const effect of pending) effect();
  return tree;
};
const button = (tree, label) => find(tree, (node) => node.type === Button && node.props.children === label);
const edit = (tree) => button(tree, '정산 수정').props.onClick();
const cancel = (tree) => button(tree, '변경 취소').props.onClick();
const editor = (tree) => find(tree, (node) => node.type === ProjectSettlementEditor);
const change = (tree, patch) => editor(tree).props.onChange({ ...editor(tree).props.value, ...patch });
const submit = (tree) => find(tree, (node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
const plain = (value) => JSON.parse(JSON.stringify(value));
const settlement = (patch = {}) => ({ ...settlementHelpers.emptySettlement(), status: 'submitted', claimAmount: 200, approvedAmount: 100, paidAmount: 50, owner: '정산 담당', note: '증빙 메모', ...patch });
const original = {
  id: 'synthetic-project', name: '프로젝트', projectType: 'general', year: 2026,
  institution: '기관', status: 'active', description: '원래 설명', targetFarmCount: 5,
  manager: '담당', startDate: '2026-01-01', endDate: '2026-12-31', currentStage: 'settlement',
  contractAmount: 10000, settlementStatus: 'submitted', settlementDueDate: '',
  settlementClaimAmount: 800, settlementApprovedAmount: 400, settlementPaidAmount: 200,
  settledAt: '', settlementOwner: '담당', settlementEvidenceUrl: '', settlementNote: '보존 메모',
  settlementRounds: { first: settlement(), second: settlement(), third: settlement(), unassigned: settlement({ note: '이관 원본' }) },
  createdAt: 1, updatedAt: 100,
  installationFarmSetup: { requestedCount: 5, completedCount: 5 },
  registrationRequestId: 'do-not-send',
};
const props = (patch = {}) => ({
  project: structuredClone(original), onEditingChange() {},
  onSave: async (base, values) => ({ ...base, ...values, updatedAt: base.updatedAt + 100 }),
  ...patch,
});

test('정산 초안은 모든 프로젝트 입력을 보존하고 문서 메타데이터를 제외한다', () => {
  const draft = projectSettlementDraft(original);
  assert.equal(Object.keys(draft).length, 22);
  for (const key of Object.keys(draft)) assert.deepEqual(plain(draft[key]), plain(original[key]), key);
  for (const key of ['id', 'createdAt', 'updatedAt', 'installationFarmSetup', 'registrationRequestId']) assert.equal(key in draft, false);
  draft.settlementRounds.third.note = '초안';
  assert.equal(original.settlementRounds.third.note, '증빙 메모');
});

test('정산 저장은 기본정보 변경을 무시하고 계약 및 1·2·3차·미지정 합계를 한 번만 반영한다', () => {
  const before = structuredClone(original), draft = projectSettlementDraft(original);
  Object.assign(draft, { name: '잘못된 기본정보', projectType: 'internal', year: 2099, targetFarmCount: 999, status: 'completed', currentStage: 'closed', description: '잘못된 설명', manager: '변경', startDate: '', endDate: '', institution: '변경', contractAmount: 12000 });
  draft.settlementRounds.third.approvedAmount = 150;
  draft.settlementRounds.third.paidAmount = 125;
  draft.settlementPaidAmount = 999999;
  const input = projectSettlementInput(original, draft);
  for (const key of ['name', 'projectType', 'year', 'targetFarmCount', 'status', 'currentStage', 'description', 'manager', 'startDate', 'endDate', 'institution']) assert.equal(input[key], original[key]);
  assert.equal(input.contractAmount, 12000);
  assert.equal(input.settlementPaidAmount, 275);
  assert.deepEqual(plain(input.settlementRounds.unassigned), before.settlementRounds.unassigned);
  assert.deepEqual(original, before);
});

test('단일 이관 정산은 명시적 회차 전환 전까지 보존한다', () => {
  const base = { ...original }; delete base.settlementRounds;
  const draft = projectSettlementDraft(base);
  const input = projectSettlementInput(base, { ...draft, contractAmount: 12345 });
  assert.equal('settlementRounds' in input, false);
  assert.equal(input.settlementNote, base.settlementNote);
  assert.equal(input.settlementPaidAmount, base.settlementPaidAmount);
  const converted = settlementHelpers.withSettlementRounds(draft, { first: settlementHelpers.emptySettlement(), unassigned: settlementHelpers.legacySettlement(draft) });
  const preserved = projectSettlementInput(base, converted);
  assert.equal(preserved.settlementPaidAmount, base.settlementPaidAmount);
  assert.equal(preserved.settlementRounds.unassigned.note, base.settlementNote);
});

test('기존 미지정은 빈 차수로 옮겨 저장한 뒤에만 수정할 수 있다', () => {
  const base = { ...original, settlementRounds: { first: settlementHelpers.emptySettlement(), unassigned: settlement() } };
  const draft = projectSettlementDraft(base);
  draft.settlementRounds = settlementHelpers.assignLegacySettlement(draft.settlementRounds, 'first');
  assert.equal(projectSettlementInput(base, draft).settlementPaidAmount, 50);
  draft.settlementRounds.first.note = '같은 저장에서 원본 변조';
  assert.throws(() => projectSettlementInput(base, draft), /기존 내역은/);
});

test('기존 회차 및 이관 내역 삭제와 잘못된 금액을 거절한다', () => {
  const draft = projectSettlementDraft(original);
  delete draft.settlementRounds.third;
  assert.throws(() => projectSettlementInput(original, draft), /입력된 정산 차수는 삭제/);
  delete draft.settlementRounds;
  assert.throws(() => projectSettlementInput(original, draft), /최신 화면/);
  for (const value of [-1, 1.5, NaN, Infinity, 1e15 + 1]) assert.throws(() => projectSettlementInput(original, { ...projectSettlementDraft(original), contractAmount: value }), /계약금액/);
});

test('삭제·완료·내부 프로젝트는 정산 전용 저장에서 거절한다', () => {
  for (const patch of [{ deletedAt: 200 }, { status: 'completed' }, { projectType: 'internal' }]) {
    assert.throws(() => projectSettlementInput({ ...original, ...patch }, projectSettlementDraft(original)), /삭제|완료|내부/);
  }
});

test('평소 조회 하나만 표시하고 정산 편집 시 조회를 대체하며 기본정보 입력은 만들지 않는다', () => {
  reset(); const current = props(); let tree = render(current);
  assert.match(renderToStaticMarkup(tree), /정산·수금 관리/);
  assert.match(renderToStaticMarkup(tree), /고객·기관에 청구하고 우리 회사가 입금받는/);
  assert.equal(nodes(tree).filter((node) => node.type === ProjectSettlementDetails).length, 1);
  assert.equal(nodes(tree).some((node) => node.type === ProjectSettlementEditor), false);
  edit(tree); tree = render(current);
  assert.equal(nodes(tree).some((node) => node.type === ProjectSettlementDetails), false);
  assert.equal(nodes(tree).filter((node) => node.type === ProjectSettlementEditor).length, 1);
  assert.equal(button(tree, '정산 저장').props.disabled, true);
  assert.equal(nodes(tree).some((node) => node.props?.name === 'name' || node.props?.name === 'projectType'), false);
});

test('저장 입력은 원래 버전을 유지하고 서버 반환값으로 조회를 갱신한다', async () => {
  reset(); const calls = [];
  const current = props({ onSave: async (base, values) => { calls.push([base, values]); return { ...base, ...values, updatedAt: 200 }; } });
  let tree = render(current); edit(tree); tree = render(current);
  change(tree, { contractAmount: 20000 }); tree = render(current); await submit(tree); tree = render(current);
  assert.equal(calls[0][0].updatedAt, 100);
  assert.equal(calls[0][1].contractAmount, 20000);
  assert.equal(find(tree, (node) => node.type === ProjectSettlementDetails).props.project.contractAmount, 20000);
  assert.match(renderToStaticMarkup(tree), /정산 저장됨/);
  edit(tree); tree = render(current); change(tree, { contractAmount: 21000 }); tree = render(current); await submit(tree);
  assert.equal(calls[1][0].updatedAt, 200);
});

test('진행 중 서버 갱신은 초안을 덮지 않고 저장을 막으며 취소하면 최신 값으로 돌아간다', async () => {
  reset(); let calls = 0; const current = props({ onSave: async () => { calls++; return original; } });
  let tree = render(current); edit(tree); tree = render(current); change(tree, { contractAmount: 20000 });
  const newer = { ...current, project: { ...original, updatedAt: 200, contractAmount: 30000 } };
  tree = render(newer);
  assert.equal(editor(tree).props.value.contractAmount, 20000);
  assert.match(renderToStaticMarkup(tree), /다른 변경이 먼저 저장되었습니다/);
  assert.equal(button(tree, '정산 저장').props.disabled, true);
  await submit(tree); assert.equal(calls, 0);
  cancel(tree); tree = render(newer);
  assert.equal(find(tree, (node) => node.type === ProjectSettlementDetails).props.project.contractAmount, 30000);
});

test('저장 실패는 입력·서버 오류·이탈방지를 유지하고 취소하면 해제한다', async () => {
  reset(); const guards = [];
  const current = props({ onEditingChange: (value) => guards.push(value), onSave: async () => { throw new Error('기존 정산은 보존해야 합니다.'); } });
  let tree = render(current); edit(tree); tree = render(current); change(tree, { contractAmount: 20000 }); tree = render(current);
  await submit(tree); tree = render(current);
  assert.equal(editor(tree).props.value.contractAmount, 20000);
  assert.match(renderToStaticMarkup(tree), /기존 정산은 보존/);
  assert.equal(guards.at(-1), true);
  cancel(tree); tree = render(current);
  assert.equal(guards.at(-1), false);
  assert.equal(listeners.has('beforeunload'), false);
});

test('저장 중 중복 제출·취소·입력 변경을 차단한다', async () => {
  reset(); let finish; const calls = [];
  const current = props({ onSave: async (base, values) => { calls.push(values); return new Promise((resolve) => { finish = () => resolve({ ...base, ...values, updatedAt: 200 }); }); } });
  let tree = render(current); edit(tree); tree = render(current); change(tree, { contractAmount: 20000 }); tree = render(current);
  const first = submit(tree); await submit(tree); assert.equal(calls.length, 1);
  tree = render(current); assert.equal(editor(tree).props.locked, true); assert.equal(button(tree, '변경 취소').props.disabled, true);
  change(tree, { contractAmount: 99999 }); cancel(tree); tree = render(current);
  assert.equal(editor(tree).props.value.contractAmount, 20000);
  finish(); await first;
});

test('변경 없는 저장이나 원복은 요청하지 않는다', async () => {
  reset(); let calls = 0; const current = props({ onSave: async () => { calls++; return original; } });
  let tree = render(current); edit(tree); tree = render(current); await submit(tree);
  change(tree, { contractAmount: 20000 }); tree = render(current); change(tree, { contractAmount: original.contractAmount }); tree = render(current); await submit(tree);
  assert.equal(calls, 0); assert.equal(button(tree, '정산 저장').props.disabled, true);
});

test('완료·삭제·내부 프로젝트는 처음부터 편집 진입을 잠근다', () => {
  for (const patch of [{ deletedAt: 200 }, { status: 'completed' }, { projectType: 'internal' }]) {
    reset(); const current = props({ project: { ...original, ...patch } }); let tree = render(current);
    assert.equal(button(tree, '정산 수정').props.disabled, true); edit(tree); tree = render(current);
    assert.equal(nodes(tree).some((node) => node.type === ProjectSettlementEditor), false);
  }
});

test('편집 중 완료·삭제·내부 전환이 와도 초안은 보존하되 추가 저장은 막는다', async () => {
  for (const patch of [{ deletedAt: 200 }, { status: 'completed' }, { projectType: 'internal' }]) {
    reset(); let calls = 0; const current = props({ onSave: async () => { calls++; return original; } });
    let tree = render(current); edit(tree); tree = render(current); change(tree, { contractAmount: 20000 });
    tree = render({ ...current, project: { ...original, ...patch, updatedAt: 200 } });
    assert.equal(editor(tree).props.locked, true); assert.equal(editor(tree).props.value.contractAmount, 20000);
    await submit(tree); assert.equal(calls, 0);
  }
});

test('부모 이탈방지는 변경 즉시 작동하며 beforeunload 및 언마운트 정리가 제공된다', () => {
  reset(); const guards = []; const current = props({ onEditingChange: (value) => guards.push(value) });
  let tree = render(current); edit(tree); tree = render(current); assert.equal(guards.at(-1), false);
  change(tree, { contractAmount: 20000 }); assert.equal(guards.at(-1), true); tree = render(current);
  assert.equal(listeners.has('beforeunload'), true);
  let prevented = false; listeners.get('beforeunload')({ preventDefault: () => { prevented = true; } }); assert.equal(prevented, true);
  unmount(); assert.equal(guards.at(-1), false); assert.equal(listeners.has('beforeunload'), false);
});

test('정산 전용 편집도 기존 회차 이관·추가·삭제와 보호 컴포넌트를 그대로 사용한다', () => {
  const panels = source('app/project-settlement-panels.tsx');
  for (const phrase of ['기존 내역 보존하고 회차별 관리 시작', 'assignLegacySettlement', 'addSettlementRound', 'removeLastSettlementRound', 'MAX_SETTLEMENT_ROUNDS']) assert.ok(panels.includes(phrase));
  assert.match(source('app/project-settlement-workspace.tsx'), /projectSettlementInput\(base, draft\)/);
});
