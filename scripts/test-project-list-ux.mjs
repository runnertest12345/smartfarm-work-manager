import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = readFileSync(
  new URL('../app/project-management-list.tsx', import.meta.url),
  'utf8',
);
let state = [],
  cursor = 0;
const hooks = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in state))
      state[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state[index],
      (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      },
    ];
  },
};
const tag = (name) =>
  function Primitive({ children, variant, size, ...props }) {
    return React.createElement(name, props, children);
  };
const Button = tag('button');
const table = Object.fromEntries(
  [
    'Table',
    'TableBody',
    'TableCell',
    'TableHead',
    'TableHeader',
    'TableRow',
  ].map((name, i) => [
    name,
    tag(['table', 'tbody', 'td', 'th', 'thead', 'tr'][i]),
  ]),
);
const aliases = {
  '@/components/ui/button': { Button },
  '@/components/ui/badge': { Badge: tag('span') },
  '@/components/ui/table': table,
};
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(code, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    module,
    exports: module.exports,
    require: (name) =>
      name === 'react' ? hooks : aliases[name] || require(name),
  },
);
const { ProjectManagementList } = module.exports;
const render = (props) => {
  cursor = 0;
  return ProjectManagementList(props);
};
const reset = () => {
  state = [];
  cursor = 0;
};
const nodes = (element) =>
  !element || typeof element !== 'object'
    ? []
    : [
        element,
        ...React.Children.toArray(element.props?.children).flatMap(nodes),
      ];
const find = (tree, predicate) => {
  const node = nodes(tree).find(predicate);
  assert.ok(node, 'Expected UI control exists');
  return node;
};
const markup = renderToStaticMarkup;
const row = (id, status = 'active', patch = {}) => ({
  id,
  name: `프로젝트 ${id}`,
  context: '2026년 · 일반 사업',
  manager: '',
  status,
  statusLabel: { active: '진행 중', on_hold: '보류', completed: '완료' }[
    status
  ],
  statusClass: '',
  stageLabel: '설치',
  farmCount: 3,
  riskCount: 0,
  riskLabel: '',
  ...patch,
});
const rows = [
  row('A', 'active', { riskCount: 7, riskLabel: '서류 확인' }),
  row('B', 'on_hold'),
  row('C', 'completed', { riskCount: 1, riskLabel: '정산 확인' }),
];
const summaryButtons = (tree) =>
  nodes(
    find(
      tree,
      (node) => node.props?.['aria-label'] === '프로젝트 관리 핵심 요약',
    ),
  ).filter((node) => node.type === 'button');
const body = (tree) =>
  markup(find(tree, (node) => node.type === table.TableBody));

test('전체·진행·보류·완료를 동등한 네 요약으로 보여주고 보류를 직접 조회한다', () => {
  reset();
  const props = { rows, onOpen() {} };
  let tree = render(props);
  const buttons = summaryButtons(tree);
  assert.equal(buttons.length, 4);
  assert.deepEqual(
    buttons.map((button) => button.props.children[0].props.children),
    ['전체 프로젝트', '진행 중', '보류', '완료'],
  );
  assert.deepEqual(
    buttons.map((button) => button.props.children[1].props.children[0]),
    [3, 1, 1, 1],
  );
  buttons[2].props.onClick();
  tree = render(props);
  assert.match(body(tree), /프로젝트 B/);
  assert.doesNotMatch(body(tree), /프로젝트 A|프로젝트 C/);
  assert.equal(summaryButtons(tree)[2].props['aria-pressed'], true);
  assert.deepEqual(
    summaryButtons(tree).map(
      (button) => button.props.children[1].props.children[0],
    ),
    [3, 1, 1, 1],
  );
});

test('확인 필요는 큰 요약이 아닌 작은 필터이며 위험 건수가 아닌 프로젝트 수를 센다', () => {
  reset();
  const props = { rows, onOpen() {} };
  let tree = render(props);
  const attention = find(
    tree,
    (node) =>
      node.type === 'button' &&
      React.Children.toArray(node.props.children).join('') === '확인 필요 2개',
  );
  assert.match(attention.props.className, /rounded-full/);
  attention.props.onClick();
  tree = render(props);
  assert.match(body(tree), /프로젝트 A/);
  assert.match(body(tree), /프로젝트 C/);
  assert.doesNotMatch(body(tree), /프로젝트 B/);
  find(
    tree,
    (node) =>
      node.type === 'button' &&
      React.Children.toArray(node.props.children).join('') === '확인 필요 2개',
  ).props.onClick();
  assert.match(body(render(props)), /프로젝트 B/);
});

test('상위 화면 상태 선택을 공유하며 부모가 새 focus를 전달할 때만 통제 상태를 바꾼다', () => {
  reset();
  const selected = [];
  const props = {
    rows,
    onOpen() {},
    focus: 'on_hold',
    onFocusChange: (next) => selected.push(next),
  };
  let tree = render(props);
  assert.match(body(tree), /프로젝트 B/);
  summaryButtons(tree)[3].props.onClick();
  assert.deepEqual(selected, ['completed']);
  assert.match(body(render(props)), /프로젝트 B/);
  tree = render({ ...props, focus: 'completed' });
  assert.match(body(tree), /프로젝트 C/);
  assert.doesNotMatch(body(tree), /프로젝트 B/);
});

test('중복 요약을 숨겨도 네 상태 탭과 전체로 돌아가기 동작을 유지한다', () => {
  reset();
  const selected = [];
  const props = {
    rows: [rows[0]],
    onOpen() {},
    showSummary: false,
    focus: 'on_hold',
    onFocusChange: (next) => selected.push(next),
  };
  const tree = render(props);
  assert.equal(
    nodes(tree).some(
      (node) => node.props?.['aria-label'] === '프로젝트 관리 핵심 요약',
    ),
    false,
  );
  const tabs = find(
    tree,
    (node) => node.props?.['aria-label'] === '프로젝트 상태 필터',
  );
  assert.equal(nodes(tabs).filter((node) => node.type === 'button').length, 4);
  assert.match(markup(tree), /조건에 맞는 프로젝트가 없습니다/);
  find(tree, (node) => node.type === Button).props.onClick();
  assert.deepEqual(selected, ['all']);
});

test('상위 핵심 지표가 상태 선택을 담당하면 중복 상태 필터만 숨기고 확인 필요 필터는 유지한다', () => {
  reset();
  const selected = [];
  const props = {
    rows, onOpen() {}, showSummary: false, showStatusFilters: false,
    focus: 'on_hold', onFocusChange: (next) => selected.push(next),
  };
  let tree = render(props);
  assert.equal(nodes(tree).filter((node) => node.props?.['aria-label'] === '프로젝트 상태 필터').length, 0);
  assert.equal(nodes(tree).filter((node) => node.props?.['aria-label'] === '프로젝트 관리 핵심 요약').length, 0);
  assert.match(body(tree), /프로젝트 B/);
  assert.doesNotMatch(body(tree), /프로젝트 A|프로젝트 C/);
  const attention = (view) => nodes(view).filter((node) => node.type === 'button' && React.Children.toArray(node.props.children).join('').startsWith('확인 필요'));
  assert.equal(attention(tree).length, 1);
  attention(tree)[0].props.onClick();
  assert.deepEqual(selected, ['attention']);
  tree = render({ ...props, focus: 'attention' });
  assert.match(body(tree), /프로젝트 A/);
  assert.match(body(tree), /프로젝트 C/);
  assert.doesNotMatch(body(tree), /프로젝트 B/);
  attention(tree)[0].props.onClick();
  assert.deepEqual(selected, ['attention', 'all']);
});

test('보조 상태 필터를 숨겨도 독립 프로젝트 관리의 네 상태 요약은 유지한다', () => {
  reset();
  const props = { rows, onOpen() {}, showStatusFilters: false };
  let tree = render(props);
  assert.equal(summaryButtons(tree).length, 4);
  summaryButtons(tree)[2].props.onClick();
  tree = render(props);
  assert.match(body(tree), /프로젝트 B/);
  assert.doesNotMatch(body(tree), /프로젝트 A|프로젝트 C/);
  assert.equal(summaryButtons(tree)[2].props['aria-pressed'], true);
});

test('이름 한 곳에서만 상세를 열고 현재 선택한 행을 표시한다', () => {
  reset();
  const opened = [];
  const tree = render({
    rows: [rows[0]],
    selectedId: 'A',
    onOpen: (id) => opened.push(id),
  });
  const entry = find(
    tree,
    (node) => node.props?.['aria-label'] === '프로젝트 A 프로젝트 상세',
  );
  assert.equal(entry.props.type, 'button');
  assert.equal(entry.props['aria-current'], 'true');
  entry.props.onClick();
  assert.deepEqual(opened, ['A']);
  const rowTree = find(tree, (node) => node.type === table.TableBody);
  assert.equal(
    nodes(rowTree).filter(
      (node) => node.type === 'button' || node.type === Button,
    ).length,
    1,
  );
  assert.equal(
    find(rowTree, (node) => node.type === table.TableRow).props['data-state'],
    'selected',
  );
});

test('권한이 있는 행의 상태·담당자·기한은 키보드 접근 가능한 한 번 클릭 편집 진입점이다', () => {
  reset();
  const changed = [];
  const tree = render({
    rows: [row('A', 'active', { canEdit: true })],
    onOpen() {},
    onQuickEdit: (...args) => changed.push(args),
  });
  for (const label of ['상태', '담당자', '종료 예정일']) {
    const control = find(
      tree,
      (node) => node.props?.['aria-label'] === `프로젝트 A ${label} 수정`,
    );
    assert.equal(control.type, 'button');
    assert.equal(control.props.type, 'button');
    assert.match(control.props.className, /focus-visible:ring-2/);
    control.props.onClick();
  }
  assert.deepEqual(changed, [
    ['A', 'status'],
    ['A', 'manager'],
    ['A', 'endDate'],
  ]);
  assert.equal(
    nodes(find(tree, (node) => node.type === table.TableBody)).filter(
      (node) => node.type === 'button',
    ).length,
    4,
  );
  assert.doesNotMatch(markup(tree), /복제|삭제|수정 저장/);
});

test('쓰기 권한이 없거나 편집 콜백이 없으면 편집 가능하다고 표시하지 않는다', () => {
  for (const props of [
    { rows: [row('A', 'active', { canEdit: false })], onQuickEdit() {} },
    { rows: [row('A', 'active', { canEdit: true })] },
    { rows: [row('A')], onQuickEdit() {} },
  ]) {
    reset();
    const tree = render({ ...props, onOpen() {} });
    assert.equal(
      nodes(tree).filter((node) => node.props?.['aria-label']?.endsWith('수정'))
        .length,
      0,
    );
    assert.doesNotMatch(markup(tree), /누르면 수정/);
  }
});

test('내부 프로젝트는 농가·구독·설치 지표를 0%가 아닌 해당 없음으로 표시한다', () => {
  reset();
  const tree = render({
    rows: [
      row('I', 'active', {
        internal: true,
        farmCount: 0,
        subscriptionCount: 0,
        installationRate: 0,
        commissioningRate: 0,
        educationRate: 0,
      }),
    ],
    onOpen() {},
  });
  assert.equal((body(tree).match(/해당 없음/g) || []).length, 2);
  assert.doesNotMatch(body(tree), /0%|농가 0|구독 0/);
});

test('미집계는 공란 표시를 유지하고 미완료율만 빨간 숫자로 표시한다', () => {
  reset();
  const tree = render({
    rows: [
      row('A', 'active', {
        installationRate: 0,
        commissioningRate: 100,
        educationRate: null,
      }),
    ],
    onOpen() {},
  });
  const html = body(tree);
  assert.match(html, /text-red-700">0%/);
  assert.match(html, /text-emerald-800">100%/);
  assert.match(html, /text-slate-400">—/);
  assert.match(html, /구독 집계 전/);
});

test('조회 범위가 바뀌면 보류 필터는 유지하되 모든 상태 숫자를 새 rows로 다시 센다', () => {
  reset();
  const props = { rows, onOpen() {} };
  summaryButtons(render(props))[2].props.onClick();
  const narrowed = render({ ...props, rows: [rows[0]] });
  assert.match(markup(narrowed), /조건에 맞는 프로젝트가 없습니다/);
  assert.deepEqual(
    summaryButtons(narrowed).map(
      (button) => button.props.children[1].props.children[0],
    ),
    [1, 1, 0, 0],
  );
  assert.equal(summaryButtons(narrowed)[2].props['aria-pressed'], true);
});
