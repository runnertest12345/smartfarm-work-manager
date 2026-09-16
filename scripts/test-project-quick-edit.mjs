import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = (file) =>
  readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('첫 화면 목록은 위험 계산 함수 초기화 뒤 계산하고 연간 업무 이동도 내부 프로젝트를 포함한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.ok(
    dashboard.indexOf('const annualProjectRows =') >
      dashboard.indexOf('const projectRiskCount ='),
  );
  assert.match(
    dashboard,
    /const annualLeafTasks = \[\.\.\.new Map\(annualProjects\.flatMap/,
  );
  const annualWork = dashboard.slice(
    dashboard.indexOf('  function openAnnualWork('),
    dashboard.indexOf('  function selectInternalKpi('),
  );
  assert.match(annualWork, /projectIds: annualProjects\.map/);
  assert.match(
    annualWork,
    /setWorkStatusFilter\(status === 'waiting' \? 'waiting' : 'all'\)/,
  );
  assert.doesNotMatch(annualWork, /yearProjects|overviewProjectType/);
});

test('좁은 화면 상세는 모달이며 다른 조회에는 이전 편집 초점을 재사용하지 않는다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(
    dashboard,
    /modal=\{detailPopup \|\| isMobile\} disablePointerDismissal/,
  );
  assert.match(dashboard, /initialFocus=\{detailPopup \|\| isMobile\}/);
  assert.match(dashboard, /data-\[side=right\]:md:w-\[min\(880px,72vw\)\]/);
  const apply = dashboard.slice(
    dashboard.indexOf('  function applyDetailTarget('),
    dashboard.indexOf('  function openDetail('),
  );
  assert.match(apply, /setProjectQuickFocus\(null\)/);
  assert.match(
    dashboard,
    /annualMetric === 'farms' \|\| annualMetric === 'subscriptions' \? undefined : record.projectId/,
  );
});
let states = [],
  effects = [],
  pending = [],
  cursor = 0;
const hooks = {
  ...React,
  useState(initial) {
    const i = cursor++;
    if (!(i in states))
      states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      states[i],
      (value) => {
        states[i] = typeof value === 'function' ? value(states[i]) : value;
      },
    ];
  },
  useRef(initial) {
    return hooks.useState(() => ({ current: initial }))[0];
  },
  useEffect(effect, deps) {
    const i = cursor++;
    const before = effects[i];
    if (
      !before ||
      !deps ||
      deps.some((dep, index) => !Object.is(dep, before.deps?.[index]))
    ) {
      pending.push(() => {
        before?.cleanup?.();
        effects[i] = { deps, cleanup: effect() };
      });
    }
  },
};
const listeners = new Map();
class Element {
  focused = false;
  focus(options) {
    this.focused = options;
  }
}
const tag = (name) =>
  function Primitive({ children, variant: _variant, size: _size, ...props }) {
    return React.createElement(name, props, children);
  };
const Button = tag('button'),
  Input = tag('input'),
  Textarea = tag('textarea');
const load = (file, aliases = {}) => {
  const evaluatedModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: evaluatedModule,
      exports: evaluatedModule.exports,
      Error,
      structuredClone,
      HTMLElement: Element,
      window: {
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type, listener) => {
          if (listeners.get(type) === listener) listeners.delete(type);
        },
      },
      require: (name) =>
        name === 'react' ? hooks : aliases[name] || require(name),
    },
  );
  return evaluatedModule.exports;
};
const farmTypes = load('lib/farm-types.ts');
const helpers = load('lib/project-quick-edit.ts', {
  './farm-types': farmTypes,
});
const { projectQuickValues, projectQuickInput, updateProjectQuickValues } =
  helpers;
const { ProjectQuickEditor } = load('app/project-quick-editor.tsx', {
  '@/lib/project-quick-edit': helpers,
  '@/lib/farm-types': farmTypes,
  '@/components/ui/button': { Button },
  '@/components/ui/input': { Input },
  '@/components/ui/textarea': { Textarea },
});
const unmount = () => {
  for (const effect of effects) effect?.cleanup?.();
};
const reset = () => {
  unmount();
  states = [];
  effects = [];
  pending = [];
  cursor = 0;
  listeners.clear();
};
const nodes = (element) =>
  !element || typeof element !== 'object'
    ? []
    : [
        element,
        ...React.Children.toArray(element.props?.children).flatMap(nodes),
      ];
const find = (tree, predicate) => {
  const found = nodes(tree).find(predicate);
  assert.ok(found, 'Expected control exists');
  return found;
};
const field = (tree, name) => find(tree, (node) => node.props?.name === name);
const render = (props, dom) => {
  cursor = 0;
  pending = [];
  const tree = ProjectQuickEditor(props);
  if (dom) tree.props.ref.current = dom;
  for (const effect of pending) effect();
  return tree;
};
const change = (tree, name, value) =>
  field(tree, name).props.onChange({ target: { value } });
const submit = (tree) => tree.props.onSubmit({ preventDefault() {} });
const cancel = (tree) =>
  find(
    tree,
    (node) => node.type === Button && node.props.children === '변경 취소',
  ).props.onClick();
const settlement = (patch = {}) => ({
  status: 'submitted',
  dueDate: '2026-10-10',
  claimAmount: 200,
  approvedAmount: 100,
  paidAmount: 50,
  settledAt: '',
  owner: '정산 담당',
  evidenceUrl: 'https://example.test/evidence',
  note: '원본 증빙 메모',
  ...patch,
});
const original = {
  id: 'synthetic-project',
  name: '원래 프로젝트',
  manager: '기존 담당',
  status: 'active',
  endDate: '2026-12-31',
  projectType: 'general',
  year: 2026,
  institution: '테스트 기관',
  description: '원래 설명',
  targetFarmCount: 6,
  startDate: '2026-01-01',
  currentStage: 'installation',
  settlementStatus: 'submitted',
  settlementDueDate: '2026-11-01',
  contractAmount: 10000,
  settlementClaimAmount: 900,
  settlementApprovedAmount: 600,
  settlementPaidAmount: 500,
  settledAt: '2026-09-01',
  settlementOwner: '계약 담당',
  settlementEvidenceUrl: 'https://example.test/contract',
  settlementNote: '프로젝트 정산 원본',
  settlementRounds: {
    first: settlement(),
    second: settlement({
      claimAmount: 500,
      approvedAmount: 300,
      paidAmount: 200,
    }),
    third: settlement({ status: 'closed' }),
    unassigned: settlement({ note: '원래 단일 정산' }),
  },
  createdAt: 1,
  updatedAt: 100,
};
const props = (patch = {}) => ({
  project: structuredClone(original),
  focusRequest: null,
  onEditingChange() {},
  onSave: async (base, values) => ({ ...base, ...values, updatedAt: 200 }),
  ...patch,
});

test('빠른 수정은 모든 기존 비편집 필드와 1·2·3차 및 미지정 정산을 그대로 보존한다', () => {
  const base = structuredClone(original);
  const before = structuredClone(base);
  const values = {
    ...projectQuickValues(base),
    name: '  새 이름  ',
    manager: ' 새 담당 ',
    status: 'on_hold',
    endDate: '2027-01-01',
  };
  const input = projectQuickInput(base, values);
  const inputInterface = source('lib/farm-types.ts').match(
    /export interface FarmProjectInput \{([\s\S]*?)\n\}/,
  )[1];
  const keys = Array.from(
    inputInterface.matchAll(/^\s+(\w+)\??:/gm),
    (match) => match[1],
  );
  assert.deepEqual(Object.keys(input).sort((a, b) => a.localeCompare(b)), keys.sort((a, b) => a.localeCompare(b)));
  for (const key of keys.filter(
    (key) => !['name', 'manager', 'status', 'endDate'].includes(key),
  )) {
    assert.deepEqual(input[key], base[key], key + ' preserved');
  }
  assert.equal(input.name, '새 이름');
  assert.equal(input.manager, '새 담당');
  assert.equal(input.status, 'on_hold');
  assert.equal(input.id, undefined);
  assert.equal(input.updatedAt, undefined);
  input.settlementRounds.first.note = '입력 객체만 변경';
  assert.deepEqual(base, before);
});

test('단일 정산에는 임의 회차를 만들지 않고 빈 이름과 잘못된 상태를 거절한다', () => {
  const base = { ...original };
  delete base.settlementRounds;
  assert.equal(
    'settlementRounds' in projectQuickInput(base, projectQuickValues(base)),
    false,
  );
  assert.throws(
    () => projectQuickInput(base, { ...projectQuickValues(base), name: '   ' }),
    /프로젝트명/,
  );
  assert.throws(
    () =>
      projectQuickInput(base, {
        ...projectQuickValues(base),
        status: 'waiting',
      }),
    /프로젝트 상태/,
  );
});

test('저장은 최초 편집 버전과 초안을 전달하고 루트 요청도 base.updatedAt을 사용한다', async () => {
  reset();
  const calls = [];
  const current = props({
    onSave: async (...args) => {
      calls.push(args);
      return { ...args[0], ...args[1], updatedAt: 300 };
    },
  });
  let tree = render(current);
  change(tree, 'manager', '내 초안');
  const newer = {
    ...current,
    project: { ...current.project, manager: '서버 변경', updatedAt: 200 },
  };
  tree = render(newer);
  assert.equal(field(tree, 'manager').props.value, '내 초안');
  await submit(tree);
  assert.equal(calls[0][0].updatedAt, 100);
  assert.equal(calls[0][1].manager, '내 초안');
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const save = dashboard.slice(
    dashboard.indexOf('async function saveProjectQuick('),
    dashboard.indexOf('function projectListRow('),
  );
  assert.match(save, /expectedUpdatedAt: base\.updatedAt/);
  assert.match(save, /projectQuickInput\(base, values\)/);
});

test('서버 갱신 뒤 저장 실패해도 입력과 오류를 보존하며 취소하면 최신 props로 복귀한다', async () => {
  reset();
  const guarding = [];
  const current = props({
    onEditingChange: (value) => guarding.push(value),
    onSave: async () => {
      throw new Error('다른 변경이 먼저 저장되었습니다');
    },
  });
  let tree = render(current);
  change(tree, 'name', '작성 중인 프로젝트명');
  const newer = {
    ...current,
    project: {
      ...current.project,
      name: '다른 사람이 저장',
      manager: '최신 담당',
      updatedAt: 200,
    },
  };
  tree = render(newer);
  await submit(tree);
  tree = render(newer);
  assert.equal(field(tree, 'name').props.value, '작성 중인 프로젝트명');
  assert.match(renderToStaticMarkup(tree), /다른 변경이 먼저 저장되었습니다/);
  assert.equal(guarding.at(-1), true);
  cancel(tree);
  assert.equal(guarding.at(-1), false);
  tree = render(newer);
  assert.equal(field(tree, 'name').props.value, '다른 사람이 저장');
  assert.equal(field(tree, 'manager').props.value, '최신 담당');
  assert.equal(
    nodes(tree).some((node) => node.props?.role === 'alert'),
    false,
  );
});

test('저장 중 같은 콜백이 연속 실행되어도 중복 요청하지 않는다', async () => {
  reset();
  let finish;
  const calls = [];
  const current = props({
    onSave: async (base, values) => {
      calls.push(values);
      return await new Promise((resolve) => {
        finish = () => resolve({ ...base, ...values, updatedAt: 200 });
      });
    },
  });
  let tree = render(current);
  change(tree, 'status', 'on_hold');
  tree = render(current);
  const first = submit(tree);
  await submit(tree);
  assert.equal(calls.length, 1);
  tree = render(current);
  assert.equal(
    find(tree, (node) => node.type === 'fieldset').props.disabled,
    true,
  );
  assert.equal(
    find(
      tree,
      (node) => node.type === Button && node.props.children === '변경 취소',
    ).props.disabled,
    true,
  );
  finish();
  await first;
  tree = render(current);
  assert.equal(field(tree, 'status').props.value, 'on_hold');
  assert.match(renderToStaticMarkup(tree), /저장됨/);
});

test('변경 없는 제출과 원래 값으로 되돌린 제출은 저장하지 않는다', async () => {
  reset();
  let saved = 0;
  const current = props({
    onSave: async () => {
      saved++;
      return original;
    },
  });
  let tree = render(current);
  await submit(tree);
  change(tree, 'manager', '잠시 변경');
  tree = render(current);
  change(tree, 'manager', original.manager);
  tree = render(current);
  await submit(tree);
  assert.equal(saved, 0);
  assert.equal(
    nodes(tree).some(
      (node) => node.type === Button && node.props.type === 'submit',
    ),
    false,
  );
});

test('편집 콜백은 렌더 전 동기 실행되고 이탈 방지는 변경 취소와 언마운트 때 해제한다', () => {
  reset();
  const guarding = [];
  const current = props({ onEditingChange: (value) => guarding.push(value) });
  let tree = render(current);
  change(tree, 'manager', '작업 중');
  assert.equal(
    guarding.at(-1),
    true,
    'same event immediately guards parent navigation',
  );
  tree = render(current);
  assert.equal(listeners.has('beforeunload'), true);
  let prevented = false;
  listeners.get('beforeunload')({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  cancel(tree);
  assert.equal(guarding.at(-1), false);
  tree = render(current);
  assert.equal(listeners.has('beforeunload'), false);
  change(tree, 'manager', '다시 작성');
  render(current);
  unmount();
  assert.equal(guarding.at(-1), false);
  assert.equal(listeners.has('beforeunload'), false);
});

test('완료 검증 오류는 그대로 보여주고 완료 선택 초안을 유지한다', async () => {
  reset();
  const calls = [];
  const current = props({
    onSave: async (base, values) => {
      calls.push(values);
      throw new Error(
        '하위 업무가 모두 완료되어야 프로젝트를 완료할 수 있습니다.',
      );
    },
  });
  let tree = render(current);
  change(tree, 'status', 'completed');
  tree = render(current);
  await submit(tree);
  tree = render(current);
  assert.equal(calls[0].status, 'completed');
  assert.equal(field(tree, 'status').props.value, 'completed');
  assert.match(
    find(tree, (node) => node.props?.role === 'alert').props.children,
    /하위 업무가 모두 완료/,
  );
  assert.equal(
    find(tree, (node) => node.type === 'fieldset').props.disabled,
    false,
  );
});

test('삭제된 프로젝트는 변경 초안이 있어도 추가 저장하지 않는다', async () => {
  reset();
  let saved = 0;
  const current = props({
    onSave: async () => {
      saved++;
      return original;
    },
  });
  let tree = render(current);
  change(tree, 'manager', '초안');
  tree = render({
    ...current,
    project: { ...current.project, deletedAt: 200 },
  });
  await submit(tree);
  assert.equal(saved, 0);
  assert.equal(
    find(tree, (node) => node.type === 'fieldset').props.disabled,
    true,
  );
});

test('목록의 필드 선택은 동일 편집 폼의 해당 입력에 스크롤 이동 없이 초점을 준다', () => {
  reset();
  const target = new Element();
  const current = props({ focusRequest: { field: 'manager', ticket: 1 } });
  render(current, {
    elements: { namedItem: (name) => (name === 'manager' ? target : null) },
  });
  assert.equal(target.focused.preventScroll, true);
});

test('본인 저장 결과보다 props 수신이 늦어도 후속 편집을 다른 사용자 충돌로 표시하지 않는다', async () => {
  reset();
  const current = props();
  let tree = render(current);
  change(tree, 'manager', '첫 저장');
  tree = render(current);
  await submit(tree);
  tree = render(current);
  assert.equal(field(tree, 'manager').props.value, '첫 저장');
  change(tree, 'name', '두 번째 초안');
  tree = render(current);
  assert.doesNotMatch(
    renderToStaticMarkup(tree),
    /다른 변경이 먼저 저장되었습니다/,
  );
});

test('기본정보는 모든 일반 필드를 표시하고 정산은 별도 편집에 남겨 둔다', () => {
  reset();
  const tree = render(props());
  const names = nodes(tree)
    .map((node) => node.props?.name)
    .filter(Boolean)
    .sort();
  assert.deepEqual(names, Object.keys(projectQuickValues(original)).sort());
  assert.match(
    find(tree, (node) => node.type === 'fieldset').props.className,
    /sm:grid-cols-2 lg:grid-cols-3/,
  );
  for (const type of ['general', 'research', 'internal']) {
    assert.ok(
      nodes(field(tree, 'projectType')).some(
        (node) => node.type === 'option' && node.props.value === type,
      ),
    );
  }
  assert.equal(field(tree, 'targetFarmCount').props.min, 0);
  assert.equal(field(tree, 'targetFarmCount').props.step, 1);
  assert.equal(
    field(tree, 'targetFarmCount').props.max,
    undefined,
    '기존 개소 편집에는 신규 생성 개수 제한을 적용하지 않는다',
  );
  assert.match(
    renderToStaticMarkup(tree),
    /수정해도 농가가 자동으로 추가·삭제되지는 않습니다/,
  );
  assert.equal(
    nodes(tree).some((node) => node.type === Button),
    false,
    '변경 전에는 저장 버튼을 늘리지 않는다',
  );
});

test('확장된 필드의 수정값을 저장하되 정산·증빙·회차와 입력 원본은 보존한다', () => {
  const before = structuredClone(original);
  const values = {
    ...projectQuickValues(original),
    projectType: 'research',
    year: 2027,
    institution: '  연구기관  ',
    targetFarmCount: 900,
    currentStage: 'verification',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    description: '수정한 설명',
  };
  const input = projectQuickInput(original, values);
  for (const key of [
    'projectType',
    'year',
    'targetFarmCount',
    'currentStage',
    'startDate',
    'endDate',
    'description',
  ]) {
    assert.equal(input[key], values[key]);
  }
  assert.equal(input.institution, '연구기관');
  for (const key of Object.keys(original).filter(
    (key) =>
      key.startsWith('settlement') ||
      ['contractAmount', 'settledAt'].includes(key),
  )) {
    assert.deepEqual(input[key], original[key], key);
  }
  assert.deepEqual(original, before);
});

test('내부 유형을 미리 선택해도 숨겨진 개소·단계·정산을 삭제하지 않고 원복할 수 있다', () => {
  reset();
  const current = props();
  let tree = render(current);
  change(tree, 'projectType', 'internal');
  tree = render(current);
  assert.equal(
    nodes(tree).some((node) => node.props?.name === 'targetFarmCount'),
    false,
  );
  assert.equal(
    nodes(tree).some((node) => node.props?.name === 'currentStage'),
    false,
  );
  assert.match(renderToStaticMarkup(tree), />부서</);
  const internalDraft = updateProjectQuickValues(
    projectQuickValues(original),
    'projectType',
    'internal',
  );
  const input = projectQuickInput(original, internalDraft);
  assert.equal(input.projectType, 'internal');
  assert.equal(input.targetFarmCount, original.targetFarmCount);
  assert.equal(input.currentStage, original.currentStage);
  assert.deepEqual(input.settlementRounds, original.settlementRounds);
  change(tree, 'projectType', 'general');
  tree = render(current);
  assert.equal(
    field(tree, 'targetFarmCount').props.value,
    original.targetFarmCount,
  );
  assert.equal(field(tree, 'currentStage').props.value, original.currentStage);
  assert.equal(
    nodes(tree).some(
      (node) => node.type === Button && node.props.type === 'submit',
    ),
    false,
  );
});

test('유형 전환 검증 실패는 초안과 기록을 보존하고 오류를 그대로 안내한다', async () => {
  reset();
  const calls = [];
  const current = props({
    onSave: async (base, values) => {
      calls.push(projectQuickInput(base, values));
      throw new Error(
        '계약·정산 정보가 있어 내부 프로젝트로 바꿀 수 없습니다.',
      );
    },
  });
  let tree = render(current);
  change(tree, 'projectType', 'internal');
  tree = render(current);
  await submit(tree);
  tree = render(current);
  assert.equal(calls[0].projectType, 'internal');
  assert.equal(calls[0].contractAmount, original.contractAmount);
  assert.deepEqual(calls[0].settlementRounds, original.settlementRounds);
  assert.equal(field(tree, 'projectType').props.value, 'internal');
  assert.match(
    find(tree, (node) => node.props?.role === 'alert').props.children,
    /계약·정산 정보/,
  );
});

test('상태와 단계는 전체 수정 폼처럼 완료·재개를 연동하며 보류는 유지한다', () => {
  const initial = projectQuickValues(original);
  const completed = updateProjectQuickValues(initial, 'status', 'completed');
  assert.equal(completed.currentStage, 'closed');
  const resumed = updateProjectQuickValues(completed, 'status', 'on_hold');
  assert.equal(resumed.currentStage, 'settlement');
  assert.equal(resumed.status, 'on_hold');
  assert.equal(
    updateProjectQuickValues(resumed, 'currentStage', 'installation').status,
    'on_hold',
  );
  const closedStage = updateProjectQuickValues(
    initial,
    'currentStage',
    'closed',
  );
  assert.equal(closedStage.status, 'completed');
  assert.equal(
    updateProjectQuickValues(closedStage, 'currentStage', 'verification')
      .status,
    'active',
  );
  reset();
  const current = props();
  let tree = render(current);
  change(tree, 'status', 'completed');
  tree = render(current);
  assert.equal(field(tree, 'currentStage').props.value, 'closed');
  change(tree, 'currentStage', 'operation');
  tree = render(current);
  assert.equal(field(tree, 'status').props.value, 'active');
});

test('완료 프로젝트의 설치 개소와 기간은 상태 재개 저장 전까지 잠긴다', async () => {
  reset();
  const current = props({
    project: { ...original, status: 'completed', currentStage: 'closed' },
  });
  let tree = render(current);
  for (const name of ['targetFarmCount', 'startDate', 'endDate'])
    assert.equal(field(tree, name).props.disabled, true);
  assert.equal(field(tree, 'name').props.disabled, undefined);
  change(tree, 'status', 'active');
  tree = render(current);
  assert.equal(
    field(tree, 'endDate').props.disabled,
    true,
    '저장 전에는 완료 근거를 함께 바꾸지 않는다',
  );
  await submit(tree);
  tree = render(current);
  for (const name of ['targetFarmCount', 'startDate', 'endDate'])
    assert.equal(field(tree, name).props.disabled, false);
});

test('새로 편집 가능한 유형·단계·연도·설치 개소의 잘못된 입력을 거절한다', () => {
  const values = projectQuickValues(original);
  for (const [key, value, message] of [
    ['projectType', 'unknown', /프로젝트 유형/],
    ['currentStage', 'unknown', /현재 사업 단계/],
    ['year', 1999, /기준 연도/],
    ['year', 2101, /기준 연도/],
    ['year', 2026.5, /기준 연도/],
    ['targetFarmCount', -1, /설치 개소/],
    ['targetFarmCount', 0.5, /설치 개소/],
    ['targetFarmCount', Infinity, /설치 개소/],
    ['targetFarmCount', NaN, /설치 개소/],
  ])
    assert.throws(
      () => projectQuickInput(original, { ...values, [key]: value }),
      message,
    );
});
