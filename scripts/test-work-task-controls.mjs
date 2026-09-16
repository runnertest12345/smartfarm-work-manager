import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let state = [],
  cursor = 0;
let effects = [];
const focusElements = new Map();
const documentMock = {
  activeElement: null,
  getElementById: (id) => focusElements.get(id) || null,
};
function load(path, aliases = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    crypto: webcrypto,
    Date,
    Error,
    document: documentMock,
    Node: class {},
    require: (name) => aliases[name] || require(name),
  });
  return module.exports;
}
const types = load('lib/farm-types.ts');
const hierarchy = load('lib/work-hierarchy.ts');
const organization = load('lib/organization.ts');
const lifecycle = load('lib/work-lifecycle.ts', {
  './organization': organization,
});
const work = load('lib/project-work.ts', { './work-lifecycle': lifecycle });
const workBoard = load('lib/work-board.ts', {
  './work-hierarchy': hierarchy,
  './project-work': work,
});
const tag = (name) =>
  function TestPrimitive({
    children,
    variant,
    size,
    keepMounted,
    defaultOpen,
    containerClassName,
    onValueChange,
    finalFocus,
    showCloseButton,
    ...props
  }) {
    return React.createElement(name, props, children);
  };
const hook = (initial) => {
  const index = cursor++;
  if (!(index in state))
    state[index] = typeof initial === 'function' ? initial() : initial;
  return [
    state[index],
    (next) => {
      state[index] = typeof next === 'function' ? next(state[index]) : next;
    },
  ];
};
const dialogs = Object.fromEntries(
  [
    'Dialog',
    'DialogClose',
    'DialogContent',
    'DialogHeader',
    'DialogTitle',
    'DialogDescription',
  ].map((name) => [name, tag('div')]),
);
const alerts = Object.fromEntries(
  [
    'AlertDialog',
    'AlertDialogContent',
    'AlertDialogHeader',
    'AlertDialogTitle',
    'AlertDialogDescription',
    'AlertDialogFooter',
    'AlertDialogCancel',
    'AlertDialogAction',
  ].map((name) => [name, tag('div')]),
);
const menus = Object.fromEntries(
  ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem']
    .map((name) => [name, tag('div')]),
);
const { ProjectWorkTree } = load('app/project-work-tree.tsx', {
  react: { ...React, useState: hook },
  '@/lib/work-hierarchy': hierarchy,
  '@/lib/farm-types': types,
  '@/components/ui/table': Object.fromEntries(
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
  ),
});
const { WorkQuickEditor, WorkTaskSurface, WorkTaskMoreMenu, ChildTaskForm } = load(
  'app/work-task-controls.tsx',
  {
    react: {
      ...React,
      useState: hook,
      useRef: (initial) => hook(() => ({ current: initial }))[0],
      useEffect: (effect, deps) => effects.push({ effect, deps }),
    },
    '@/lib/farm-types': types,
    '@/lib/project-work': work,
    '@/lib/work-hierarchy': hierarchy,
    '@/lib/work-board': workBoard,
    '@/components/ui/button': { Button: tag('button') },
    '@/components/ui/input': { Input: tag('input') },
    '@/components/ui/textarea': { Textarea: tag('textarea') },
    '@/components/ui/dialog': dialogs,
    '@/components/ui/alert-dialog': alerts,
    '@/components/ui/dropdown-menu': menus,
    '@/components/ui/select': Object.fromEntries(
      [
        'Select',
        'SelectTrigger',
        'SelectValue',
        'SelectContent',
        'SelectItem',
      ].map((name) => [name, tag('div')]),
    ),
    '@/components/ui/collapsible': {
      Collapsible: tag('section'),
      CollapsibleTrigger: tag('button'),
      CollapsibleContent: ({ children, keepMounted }) =>
        React.createElement(
          'div',
          { hidden: true, 'data-kept': keepMounted },
          children,
        ),
    },
    '@/components/ui/table': Object.fromEntries(
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
    ),
    './received-images': { ReceivedContentInput: tag('textarea') },
    './work-board': { WorkBoard: () => React.createElement('section') },
  },
);
const item = {
  id: 'a',
  title: '견적서 제출',
  farmId: '',
  farmRecordId: '',
  projectId: 'p',
  workType: 'communication',
  status: 'open',
  owner: '담당자',
  dueDate: '',
  nextAction: '',
  blockedReason: '',
  blockedBy: '',
  updatedAt: 10,
};
function render(component, props) {
  cursor = 0;
  return component(props);
}
function reset() {
  state = [];
  cursor = 0;
  effects = [];
  documentMock.activeElement = null;
  focusElements.clear();
}
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [
    element,
    ...React.Children.toArray(element.props?.children).flatMap(nodes),
  ];
}
function find(tree, predicate) {
  const found = nodes(tree).find(predicate);
  assert.ok(found, 'UI control exists');
  return found;
}
const event = { preventDefault() {}, stopPropagation() {} };
test('일반 기록은 상태·처리 내용 중심이며 금액·기록자·발생 시각 입력을 제거한다', () => {
  reset();
  const tree = render(WorkQuickEditor, {
    task: item,
    recorder: '실제 작성자',
    onSave: async () => {},
    onCancel() {},
  });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /처리 내용/);
  assert.match(html, /담당자·기한·다음 행동 \(선택\)/);
  assert.match(html, /받은 내용·캡처 추가 \(선택\)/);
  assert.match(html, /작성 시각 자동 기록/);
  assert.doesNotMatch(html, /type="number"|datetime-local/);
  assert.equal(nodes(tree).filter((node) => node.props?.keepMounted).length, 2);
});
test('빠른 수정은 오래된 버전을 검출하고 작성한 텍스트를 유지한다', () => {
  reset();
  const props = {
    task: item,
    recorder: '작성자',
    onSave: async () => {},
    onCancel() {},
  };
  let tree = render(WorkQuickEditor, props);
  find(tree, (x) => x.props?.id === 'quick-a-action').props.onChange({
    target: { value: '검토 회신 완료' },
  });
  tree = render(WorkQuickEditor, {
    ...props,
    task: { ...item, status: 'in_progress', updatedAt: 11 },
  });
  assert.match(renderToStaticMarkup(tree), /다른 변경이 먼저 저장/);
  assert.equal(
    find(tree, (x) => x.props?.id === 'quick-a-action').props.value,
    '검토 회신 완료',
  );
  assert.equal(
    find(tree, (x) => x.props?.type === 'submit').props.disabled,
    true,
  );
});
test('저장 중 중복 전송을 막고 요청 ID·작성자·버전과 처리 내용을 보낸다', async () => {
  reset();
  let count = 0,
    payload,
    resolve;
  const props = {
    task: item,
    recorder: '작성자',
    onCancel() {},
    onSave: async (input) => {
      count++;
      payload = input;
      await new Promise((r) => {
        resolve = r;
      });
    },
  };
  let tree = render(WorkQuickEditor, props);
  find(tree, (x) => x.props?.id === 'quick-a-action').props.onChange({
    target: { value: '검토 완료' },
  });
  tree = render(WorkQuickEditor, props);
  const pending = tree.props.onSubmit(event);
  await tree.props.onSubmit(event);
  assert.equal(count, 1);
  assert.equal(payload.actionContent, '검토 완료');
  assert.equal(payload.expectedUpdatedAt, 10);
  assert.equal(payload.recorder, '작성자');
  assert.ok(payload.operationId);
  resolve();
  await pending;
});
test('상태만 변경한 초안도 상세 계획 전환으로 사라지지 않도록 차단한다', () => {
  reset();
  const props = {
    task: item,
    recorder: '작성자',
    onSave: async () => {},
    onCancel() {},
    onAdvanced() {},
  };
  let tree = render(WorkQuickEditor, props);
  find(tree, (x) => x.props?.id === 'quick-a-status').props.onChange(
    'in_progress',
  );
  tree = render(WorkQuickEditor, props);
  assert.equal(
    find(tree, (x) => x.props?.onClick === props.onAdvanced).props.disabled,
    true,
  );
});
test('대기 진입은 사유와 확인 대상, 대기 해제는 처리 내용이 필요하다', () => {
  reset();
  let tree = render(WorkQuickEditor, {
    task: item,
    initialStatus: 'waiting',
    recorder: '담당',
    onSave: async () => {},
    onCancel() {},
  });
  assert.match(renderToStaticMarkup(tree), /막힌 이유/);
  assert.match(renderToStaticMarkup(tree), /확인이 필요한 사람/);
  reset();
  tree = render(WorkQuickEditor, {
    task: { ...item, status: 'waiting' },
    initialStatus: 'completed',
    recorder: '담당',
    onSave: async () => {},
    onCancel() {},
  });
  assert.equal(
    find(tree, (x) => x.props?.id === 'quick-a-action').props.required,
    true,
  );
});
const surface = (extra = {}) => ({
  items: [item],
  allItems: [item],
  mode: 'board',
  recorder: '담당',
  projectLabel: () => '태백',
  onOpen() {},
  onAddChild() {},
  onSave: async () => {},
  ...extra,
});
test('일반 열 드롭은 상태 변경을 한 번 저장하고 대기 열은 팝업 편집기를 연다', async () => {
  reset();
  let saved = [];
  const props = surface({
    onSave: async (...args) => {
      saved.push(args);
    },
  });
  let tree = render(WorkTaskSurface, props);
  const drag = () =>
    find(tree, (x) => x.props?.handle)
      .props.handle(item)
      .props.onDragStart({
        ...event,
        dataTransfer: { setData() {} },
      });
  drag();
  tree = render(WorkTaskSurface, props);
  find(tree, (x) => x.props?.handle).props.onDrop('in_progress', Date.now());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].newStatus, 'in_progress');
  tree = render(WorkTaskSurface, props);
  drag();
  tree = render(WorkTaskSurface, props);
  find(tree, (x) => x.props?.handle).props.onDrop('waiting', Date.now());
  tree = render(WorkTaskSurface, props);
  assert.equal(saved.length, 1);
  assert.ok(find(tree, (x) => x.type === WorkQuickEditor));
  assert.equal(find(tree, (x) => x.type === WorkQuickEditor).props.popup, true);
  assert.ok(
    React.Children.toArray(tree.props.children).some(
      (x) => x.type === WorkQuickEditor,
    ),
    'editor stays outside status columns',
  );
});
test('목록은 중첩 업무를 펼치고 접을 수 있으며 세부 실행 완료를 집계한다', () => {
  reset();
  const child = {
    ...item,
    id: 'b',
    title: '자료 검토',
    parentWorkItemId: 'a',
    status: 'completed',
  };
  const props = surface({
    mode: 'list',
    items: [item, child],
    allItems: [{ ...item, childWorkItemIds: ['b'] }, child],
  });
  let tree = render(WorkTaskSurface, props);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /data-work-id="b" data-work-depth="1"/);
  assert.match(html, /상위: 견적서 제출/);
  assert.match(html, /margin-left:32px/);
  let row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 0);
  row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 1);
});

test('목록은 부모 아래 자식·손자를 연속 행과 같은 형제 들여쓰기로 연결한다', () => {
  reset();
  const allItems = [
    { ...item, childWorkItemIds: ['child', 'sibling'] },
    { ...item, id: 'child', title: '직접 하위', parentWorkItemId: item.id, childWorkItemIds: ['leaf'] },
    { ...item, id: 'leaf', title: '손자 업무', parentWorkItemId: 'child' },
    { ...item, id: 'sibling', title: '형제 업무', parentWorkItemId: item.id },
    { ...item, id: 'other', title: '다른 상위 업무' },
  ];
  const props = surface({ mode: 'list', items: allItems, allItems });
  let tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.children === '모두 펼치기').props.onClick();
  tree = render(WorkTaskSurface, props);
  const rows = nodes(tree).filter((node) => node.props?.onToggle);
  assert.deepEqual(rows.map((node) => node.props.item.id), ['a', 'child', 'leaf', 'sibling', 'other']);
  assert.deepEqual(rows.map((node) => Array.from(node.props.branchGuides)), [[], [true], [true, false], [false], []]);
  const rendered = rows.map((node) => node.type(node.props));
  assert.deepEqual(rendered.map((row) => find(row, (node) => node.props?.style?.marginLeft !== undefined).props.style.marginLeft), ['0px', '32px', '64px', '32px', '0px']);
  const guides = (row) => nodes(row).filter((node) => node.props?.['data-tree-guide']);
  assert.equal(guides(rendered[0]).length, 0);
  assert.deepEqual(guides(rendered[2]).map((node) => node.props['data-tree-guide']), ['ancestor', 'branch']);
  assert.ok(guides(rendered[2]).every((node) => String(node.props['aria-hidden']) === 'true'));
  const guideLines = (row) => guides(row).flatMap((guide) => nodes(guide)).filter((node) => node.props?.style?.left !== undefined && node.props?.className?.includes('border-l'));
  assert.ok(find(rendered[0], (node) => node.props?.['data-tree-stem']), 'an expanded parent connects its arrow to the children below');
  assert.equal(nodes(rendered[3]).find((node) => node.props?.['data-tree-stem']), undefined, 'a leaf has no outgoing stem');
  assert.deepEqual(guideLines(rendered[2]).map((node) => ({ ...node.props.style })), [{ left: '22px', bottom: 0 }, { left: '54px', height: '24px' }]);
  assert.equal(guideLines(rendered[1])[0].props.style.bottom, 0, 'the parent rail continues toward the next sibling');
  assert.equal(guideLines(rendered[3])[0].props.style.height, '24px', 'the final sibling rail ends at its title');
  for (const row of rendered.slice(1, 4)) {
    assert.match(renderToStaticMarkup(row), /하위 업무/);
    assert.match(find(row, (node) => node.props?.['aria-label']?.startsWith('목록 번호 ')).props.className, /sr-only/);
  }
  const html = renderToStaticMarkup(tree);
  assert.match(html, /border-collapse/);
  assert.doesNotMatch(html, /border-spacing-y/);
  assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 5);
  assert.match(html, /<th>담당자<\/th><th>기한<\/th>/);
});

test('검색된 손자의 연결선은 제외된 형제를 향해 이어지지 않는다', () => {
  reset();
  const allItems = [
    { ...item, childWorkItemIds: ['child', 'sibling'] },
    { ...item, id: 'child', parentWorkItemId: item.id, childWorkItemIds: ['leaf'] },
    { ...item, id: 'leaf', parentWorkItemId: 'child' },
    { ...item, id: 'sibling', parentWorkItemId: item.id },
  ];
  const tree = render(WorkTaskSurface, surface({ mode: 'list', items: [allItems[2]], allItems, searching: true }));
  const rows = nodes(tree).filter((node) => node.props?.onToggle);
  assert.deepEqual(rows.map((node) => node.props.item.id), ['a', 'child', 'leaf']);
  assert.deepEqual(rows.map((node) => Array.from(node.props.branchGuides)), [[], [false], [false, false]]);
  const leaf = rows[2].type(rows[2].props);
  const verticals = nodes(leaf).filter((node) => node.props?.style?.left !== undefined && node.props?.className?.includes('border-l'));
  assert.equal(verticals.length, 1, 'an excluded sibling does not leave an ancestor continuation line');
  assert.equal(verticals[0].props.style.left, '54px');
  assert.match(renderToStaticMarkup(leaf), /상위: 견적서 제출/);
});

test('목록 번호는 접기·검색과 무관하게 계층을 유지하고 전체 접기를 지원한다', () => {
  reset();
  const allItems = [
    { ...item, childWorkItemIds: ['child', 'sibling'] },
    { ...item, id: 'child', parentWorkItemId: item.id, childWorkItemIds: ['leaf'] },
    { ...item, id: 'leaf', parentWorkItemId: 'child' },
    { ...item, id: 'sibling', parentWorkItemId: item.id },
    { ...item, id: 'other' },
  ];
  const props = surface({ mode: 'list', items: allItems, allItems });
  const numbers = (tree) => nodes(tree).filter((node) => node.props?.onToggle && node.props?.number).map((node) => node.props.number);
  let tree = render(WorkTaskSurface, props);
  assert.deepEqual(numbers(tree), ['1', '1.1', '1.2', '2']);
  find(tree, (node) => node.props?.children === '모두 접기').props.onClick();
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(numbers(tree), ['1', '2']);
  tree = render(WorkTaskSurface, { ...props, items: [allItems[2]], searching: true });
  assert.deepEqual(numbers(tree), ['1', '1.1', '1.1.1']);
  // Even a matching parent must reveal its matching children without changing collapse state.
  tree = render(WorkTaskSurface, { ...props, searching: true });
  assert.deepEqual(numbers(tree), ['1', '1.1', '1.1.1', '1.2', '2']);
  const searchedParent = find(tree, (node) => node.props?.number === '1');
  const toggleButton = find(searchedParent.type(searchedParent.props), (node) => node.props?.['aria-expanded'] !== undefined);
  assert.equal(toggleButton.props.disabled, true);
  assert.match(toggleButton.props['aria-label'], /검색 중 펼침/);
  searchedParent.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(numbers(tree), ['1', '2']);
  find(tree, (node) => node.props?.children === '모두 펼치기').props.onClick();
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(numbers(tree), ['1', '1.1', '1.1.1', '1.2', '2']);
});

test('선택한 중간 업무 상세는 자손만 표시하고 전체 조상의 완료 잠금을 유지한다', () => {
  reset();
  const root = { ...item, status: 'completed', childWorkItemIds: ['selected'] };
  const selected = { ...item, id: 'selected', title: '선택한 상위 업무', parentWorkItemId: root.id, childWorkItemIds: ['leaf'] };
  const leaf = { ...item, id: 'leaf', title: '직접 세부 업무', parentWorkItemId: selected.id };
  const props = surface({ mode: 'list', items: [leaf], allItems: [root, selected, leaf], contextRootId: selected.id });
  let tree = render(WorkTaskSurface, props);
  const rows = nodes(tree).filter((node) => node.props?.item && node.props?.onToggle);
  assert.deepEqual(rows.map((node) => node.props.item.id), ['leaf']);
  assert.equal(rows[0].props.depth, 0);
  assert.equal(rows[0].props.level, 2);
  const renderedRow = rows[0].type(rows[0].props);
  const actualRow = find(renderedRow, (node) => node.props?.['data-work-id'] === 'leaf');
  assert.equal(actualRow.props['data-parent-work-id'], selected.id);
  assert.match(actualRow.props.className, /bg-white/);
  assert.doesNotMatch(actualRow.props.className, /bg-emerald/);
  assert.match(renderToStaticMarkup(renderedRow), /하위 업무 · 2단계/);
  assert.equal(find(renderedRow, (node) => node.props?.style?.marginLeft !== undefined).props.style.marginLeft, '0px');
  const html = renderToStaticMarkup(tree);
  assert.match(html, /상위: 선택한 상위 업무/);
  assert.doesNotMatch(html, /상위 업무 연결 확인 필요/);
  find(rows[0].props.actions, (node) => node.props?.['aria-label'] === '직접 세부 업무 빠른 수정').props.onClick();
  tree = render(WorkTaskSurface, props);
  assert.equal(find(tree, (node) => node.type === WorkQuickEditor).props.statusLocked, true);
});

test('깊은 목록은 단계와 번호를 보존하고 최근 기록은 접혀도 진행 요약은 보인다', () => {
  reset();
  const allItems = Array.from({ length: 9 }, (_, index) => ({ ...item, id: `depth-${index}`, parentWorkItemId: index ? `depth-${index - 1}` : '', nextAction: '다음 처리 계획' }));
  const props = surface({ mode: 'list', items: allItems, allItems, latestSummary: () => ({ action: '최근 처리 내용', received: '받은 내용' }) });
  let tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.children === '모두 펼치기').props.onClick();
  tree = render(WorkTaskSurface, props);
  const row = find(tree, (node) => node.props?.item?.id === 'depth-8' && node.props?.onToggle);
  assert.equal(row.props.number, '1.1.1.1.1.1.1.1.1');
  const renderedRow = row.type(row.props);
  assert.equal(find(renderedRow, (node) => node.props?.style?.marginLeft).props.style.marginLeft, '128px');
  assert.equal(nodes(renderedRow).filter((node) => node.props?.['data-tree-guide']).length, 4);
  const details = find(renderedRow, (node) => node.type === 'details');
  assert.equal(details.props.open, undefined);
  assert.equal(find(details, (node) => node.type === 'summary').props.children, '최근 기록·다음 행동');
  assert.match(renderToStaticMarkup(renderedRow), /하위 업무 · 8단계/);
  assert.match(renderToStaticMarkup(details), /최근 처리 내용/);
  assert.match(renderToStaticMarkup(details), /다음: 다음 처리 계획/);
  const parent = find(tree, (node) => node.props?.item?.id === 'depth-7' && node.props?.onToggle);
  const parentDetails = find(parent.type(parent.props), (node) => node.type === 'details');
  assert.equal(parentDetails.props.open, undefined);
  assert.doesNotMatch(renderToStaticMarkup(parentDetails), /최하위 실행 완료/);
  assert.match(renderToStaticMarkup(parent.type(parent.props)), /최하위 실행 완료 0\/1 · 0%/);
});

test('접힌 부모의 제목 아래 최하위 진행 요약을 항상 보이며 자신의 상태는 유지한다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['child'] };
  const child = { ...item, id: 'child', title: '접힌 중간 업무', status: 'waiting', parentWorkItemId: root.id, childWorkItemIds: ['done', 'active', 'blocked', 'open'] };
  const leaves = ['completed', 'in_progress', 'waiting', 'open'].map((status, index) => ({
    ...item, id: ['done', 'active', 'blocked', 'open'][index], title: `세부 ${index}`, status, parentWorkItemId: child.id,
  }));
  const allItems = [root, child, ...leaves];
  const before = JSON.stringify(allItems);
  const props = surface({ mode: 'list', items: allItems, allItems });
  let tree = render(WorkTaskSurface, props);
  const rootRow = () => find(tree, (node) => node.props?.item?.id === root.id && node.props?.onToggle);
  const summary = () => find(rootRow().type(rootRow().props), (node) => node.props?.['data-child-progress'] === root.id);
  const html = renderToStaticMarkup(summary());
  assert.match(html, /최하위 실행 완료 1\/4 · 25%/);
  assert.match(html, /처리 중 1/);
  assert.match(html, /대기·막힘 1/);
  assert.match(html, /중간 업무 대기·막힘 1건/);
  assert.match(html, /width:25%/);
  assert.equal(nodes(summary()).some((node) => node.type === 'button' || node.type === 'details'), false);
  assert.equal(find(rootRow().props.status, (node) => node.type === 'button').props.children, '접수');
  rootRow().props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(rootRow().props.expanded, false);
  assert.equal(nodes(tree).some((node) => node.props?.onToggle && node.props.item.id === child.id), false);
  assert.equal(renderToStaticMarkup(summary()), html);
  assert.equal(JSON.stringify(allItems), before, 'view changes do not mutate any work or status');
});

test('상태·검색으로 보이지 않는 자손도 전체 하위 진행 요약에 포함하고 동일 ID는 한 번만 센다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['done', 'active', 'waiting'] };
  const done = { ...item, id: 'done', status: 'completed', parentWorkItemId: root.id };
  const active = { ...item, id: 'active', status: 'in_progress', parentWorkItemId: root.id };
  const waiting = { ...item, id: 'waiting', status: 'waiting', parentWorkItemId: root.id };
  const allItems = [root, done, active, waiting, { ...active }];
  const props = surface({ mode: 'list', items: [waiting], allItems, searching: true });
  const tree = render(WorkTaskSurface, props);
  const rows = nodes(tree).filter((node) => node.props?.onToggle);
  assert.deepEqual(rows.map((node) => node.props.item.id), [root.id, waiting.id]);
  const row = rows[0].type(rows[0].props);
  const summary = find(row, (node) => node.props?.['data-child-progress'] === root.id);
  const html = renderToStaticMarkup(summary);
  assert.match(html, /최하위 실행 완료 1\/3 · 33%/);
  assert.match(html, /처리 중 1/);
  assert.match(html, /대기·막힘 1/);
  assert.doesNotMatch(html, /중간 업무 대기/);
});

test('최하위가 모두 완료여도 중간 업무 막힘은 별도 표시하고 부모 상태를 대체하지 않는다', () => {
  reset();
  const root = { ...item, status: 'in_progress', childWorkItemIds: ['middle'] };
  const middle = { ...item, id: 'middle', status: 'waiting', parentWorkItemId: root.id, childWorkItemIds: ['leaf'] };
  const leaf = { ...item, id: 'leaf', status: 'completed', parentWorkItemId: middle.id };
  const allItems = [root, middle, leaf];
  const tree = render(WorkTaskSurface, surface({ mode: 'list', items: allItems, allItems }));
  const row = find(tree, (node) => node.props?.onToggle && node.props.item.id === root.id);
  const summary = find(row.type(row.props), (node) => node.props?.['data-child-progress'] === root.id);
  assert.match(renderToStaticMarkup(summary), /최하위 실행 완료 1\/1 · 100%/);
  assert.match(renderToStaticMarkup(summary), /대기·막힘 0/);
  assert.match(renderToStaticMarkup(summary), /중간 업무 대기·막힘 1건/);
  assert.equal(find(row.props.status, (node) => node.type === 'button').props.children, '처리 중');
});

test('일부 하위 문서 미조회는 완료율·막대를 숨기며 자식 ID만 있는 부모도 안내한다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['done', 'missing'] };
  const done = { ...item, id: 'done', status: 'completed', parentWorkItemId: root.id };
  const emptyParent = { ...item, id: 'empty-parent', childWorkItemIds: ['also-missing'] };
  const allItems = [root, done, emptyParent];
  const tree = render(WorkTaskSurface, surface({ mode: 'list', items: allItems, allItems }));
  for (const id of [root.id, emptyParent.id]) {
    const row = find(tree, (node) => node.props?.onToggle && node.props.item.id === id);
    const summary = find(row.type(row.props), (node) => node.props?.['data-child-progress'] === id);
    const html = renderToStaticMarkup(summary);
    assert.match(html, /일부 하위 업무 미조회 · 완료율 확인 필요/);
    assert.doesNotMatch(html, /\d+%|style="width/);
  }
  const leafRow = find(tree, (node) => node.props?.onToggle && node.props.item.id === done.id);
  assert.equal(leafRow.props.progress, null, 'leaf rows do not repeat a child summary');
});

test('펼침 상태를 보존한 실시간 갱신은 완료율과 상태 건수를 새 업무 값으로 갱신한다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['child'] };
  const child = { ...item, id: 'child', status: 'in_progress', parentWorkItemId: root.id };
  let props = surface({ mode: 'list', items: [root, child], allItems: [root, child] });
  let tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.onToggle && node.props.item.id === root.id).props.onToggle();
  const updated = { ...child, status: 'completed', updatedAt: 99 };
  props = { ...props, items: [root, updated], allItems: [root, updated] };
  tree = render(WorkTaskSurface, props);
  const row = find(tree, (node) => node.props?.onToggle && node.props.item.id === root.id);
  assert.equal(row.props.expanded, false);
  const summary = find(row.type(row.props), (node) => node.props?.['data-child-progress'] === root.id);
  assert.match(renderToStaticMarkup(summary), /최하위 실행 완료 1\/1 · 100%/);
  assert.match(renderToStaticMarkup(summary), /처리 중 0/);
});

test('기본 목록은 상위·바로 아래만 보이고 새 깊은 묶음도 사용자 펼침을 유지하며 접힌다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['child'] };
  const child = { ...item, id: 'child', parentWorkItemId: root.id, childWorkItemIds: ['leaf'] };
  const leaf = { ...item, id: 'leaf', parentWorkItemId: child.id };
  let props = surface({ mode: 'list', items: [root, child, leaf], allItems: [root, child, leaf] });
  const ids = (tree) => nodes(tree).filter((node) => node.props?.onToggle).map((node) => node.props.item.id);
  let tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [root.id, child.id]);
  find(tree, (node) => node.props?.onToggle && node.props.item.id === child.id).props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [root.id, child.id, leaf.id]);
  const incoming = { ...item, id: 'new-deep', parentWorkItemId: leaf.id };
  const allItems = [root, child, { ...leaf, childWorkItemIds: [incoming.id] }, incoming];
  props = { ...props, items: allItems, allItems };
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [root.id, child.id, leaf.id]);
  assert.equal(find(tree, (node) => node.props?.onToggle && node.props.item.id === child.id).props.expanded, true);
  assert.equal(find(tree, (node) => node.props?.onToggle && node.props.item.id === leaf.id).props.expanded, false);
  tree = render(WorkTaskSurface, { ...props, items: [incoming], searching: true });
  assert.deepEqual(ids(tree), [root.id, child.id, leaf.id, incoming.id]);
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [root.id, child.id, leaf.id]);
});

test('선택 업무 상세는 직접 자식만 기본 노출하고 전체 펼침 후 도착한 깊은 묶음은 접힌다', () => {
  reset();
  const root = { ...item, childWorkItemIds: ['child'] };
  const child = { ...item, id: 'child', parentWorkItemId: root.id, childWorkItemIds: ['leaf'] };
  const leaf = { ...item, id: 'leaf', parentWorkItemId: child.id };
  const props = surface({ mode: 'list', items: [child, leaf], allItems: [root, child, leaf], contextRootId: root.id });
  const ids = (tree) => nodes(tree).filter((node) => node.props?.onToggle).map((node) => node.props.item.id);
  let tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [child.id]);
  find(tree, (node) => node.props?.children === '모두 펼치기').props.onClick();
  tree = render(WorkTaskSurface, props);
  assert.deepEqual(ids(tree), [child.id, leaf.id]);
  const incoming = { ...item, id: 'new-deep', parentWorkItemId: leaf.id };
  tree = render(WorkTaskSurface, { ...props, items: [child, leaf, incoming], allItems: [root, child, leaf, incoming] });
  assert.deepEqual(ids(tree), [child.id, leaf.id]);
});

test('상태·담당자·기한 클릭은 해당 필드의 편집만 열고 적용 전에는 저장하지 않는다', () => {
  for (const field of ['status', 'owner', 'dueDate']) {
    reset();
    let saves = 0;
    const props = surface({ mode: 'list', onSave: async () => saves++ });
    let tree = render(WorkTaskSurface, props);
    const row = find(tree, (node) => node.props?.onToggle);
    if (field === 'status') row.props.status.props.onClick();
    else row.props.onEditField(field);
    tree = render(WorkTaskSurface, props);
    const editor = find(tree, (node) => node.type === WorkQuickEditor);
    assert.equal(editor.props.initialField, field);
    assert.equal(editor.props.task.id, item.id);
    assert.equal(saves, 0);
    const busyRow = find(tree, (node) => node.props?.onToggle);
    assert.equal(busyRow.props.editingDisabled, true);
    assert.equal(busyRow.props.status.props.disabled, true);
  }
});

test('추가·삭제는 더보기 안에 있으며 기존 삭제 확인 트리거를 그대로 합성한다', () => {
  reset();
  let confirmations = 0;
  const deletion = React.createElement('button', { onClick: () => confirmations++, disabled: false }, '삭제');
  const props = surface({ mode: 'list', deleteAction: () => deletion });
  const tree = render(WorkTaskSurface, props);
  const row = find(tree, (node) => node.props?.onToggle);
  const directButtons = React.Children.toArray(row.props.actions.props.children);
  assert.equal(directButtons.length, 2, 'only quick edit and more are exposed on a row');
  const menu = find(row.props.actions, (node) => node.type === WorkTaskMoreMenu);
  const rendered = WorkTaskMoreMenu(menu.props);
  assert.equal(find(rendered, (node) => node.type === menus.DropdownMenuTrigger).props['aria-label'], `${item.title} 더보기`);
  const deletionItem = find(rendered, (node) => node.type === menus.DropdownMenuItem && node.props.variant === 'destructive');
  assert.equal(deletionItem.props.render, deletion);
  assert.equal(deletionItem.props.nativeButton, true, 'no nested button inside menu item');
  assert.equal(confirmations, 0);
  deletionItem.props.render.props.onClick();
  assert.equal(confirmations, 1, 'existing confirmation trigger is retained');
});

test('더보기는 완료·상위 완료의 세부 업무 추가 잠금과 편집 중 비활성화를 유지한다', () => {
  for (const lockedParent of [false, true]) {
    reset();
    const parent = { ...item, id: 'parent', status: 'completed', childWorkItemIds: [item.id] };
    const task = { ...item, status: lockedParent ? 'open' : 'completed', parentWorkItemId: lockedParent ? parent.id : '' };
    const props = surface({ mode: 'list', items: [task], allItems: lockedParent ? [parent, task] : [task] });
    const tree = render(WorkTaskSurface, props);
    const row = find(tree, (node) => node.props?.onToggle && node.props.item.id === task.id);
    const menu = find(row.props.actions, (node) => node.type === WorkTaskMoreMenu);
    assert.equal(menu.props.addChildDisabled, true);
    const rendered = WorkTaskMoreMenu(menu.props);
    assert.equal(find(rendered, (node) => node.props?.['aria-label'] === `${item.title} 세부 업무 추가`).props.disabled, true);
    const busy = WorkTaskMoreMenu({ ...menu.props, disabled: true });
    assert.equal(find(busy, (node) => node.type === menus.DropdownMenuTrigger).props.disabled, true);
  }
});

test('상위 손잡이가 표시되며 자식 실행 업무의 드래그는 해당 업무만 변경한다', async () => {
  reset();
  const parent = { ...item, childWorkItemIds: ['b'] };
  const child = { ...item, id: 'b', title: '세부 실행', parentWorkItemId: 'a' };
  const saved = [];
  const props = surface({
    items: [parent, child],
    allItems: [parent, child],
    onSave: async (input) => saved.push(input),
  });
  let tree = render(WorkTaskSurface, props);
  let board = find(tree, (node) => node.props?.handle);
  assert.equal(board.props.handle(parent).props.draggable, true);
  board.props
    .handle(child)
    .props.onDragStart({ ...event, dataTransfer: { setData() {} } });
  tree = render(WorkTaskSurface, props);
  board = find(tree, (node) => node.props?.handle);
  board.props.onDrop('in_progress', Date.now());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].workItemId, 'b');
  assert.equal(parent.status, 'open');
  assert.equal(child.status, 'open');
});

const boardOf = (tree) => find(tree, (node) => node.props?.handle);
const dragEvent = () => ({ ...event, dataTransfer: { setData() {} } });
function dragTo(props, task, target) {
  let tree = render(WorkTaskSurface, props);
  boardOf(tree).props.onDragStart(task, dragEvent(), Date.now());
  tree = render(WorkTaskSurface, props);
  boardOf(tree).props.onDrop(target, Date.now());
  return render(WorkTaskSurface, props);
}
const family = () => [
  { ...item, status: 'open', childWorkItemIds: ['b', 'c'], openChildCount: 2 },
  {
    ...item,
    id: 'b',
    title: '단가 검토',
    parentWorkItemId: 'a',
    status: 'in_progress',
  },
  {
    ...item,
    id: 'c',
    title: '승인 대기',
    parentWorkItemId: 'a',
    status: 'waiting',
  },
];

test('상위 카드를 직접 옮기면 부모만 저장하고 하위 대기 때문에 열이 유지됨을 알린다', async () => {
  reset();
  const tasks = family();
  const saved = [];
  const props = surface({
    items: tasks,
    allItems: tasks,
    onSave: async (input) => saved.push(input),
  });
  let tree = dragTo(props, tasks[0], 'in_progress');
  assert.doesNotMatch(renderToStaticMarkup(tree), /이동할 세부 업무 선택/);
  assert.equal(boardOf(tree).props.busy, true);
  await new Promise(setImmediate);
  tree = render(WorkTaskSurface, props);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].workItemId, 'a');
  assert.equal(saved[0].newStatus, 'in_progress');
  assert.match(renderToStaticMarkup(tree), /하위 업무에 대기·막힘/);
  assert.equal(tasks[0].status, 'open');
  assert.equal(tasks[1].status, 'in_progress');
  assert.equal(tasks[2].status, 'waiting');
  assert.equal(tasks[0].openChildCount, 2);
});

test('상위 대기 열 드롭은 부모의 대기 사유 편집만 열고 하위 업무는 그대로 둔다', () => {
  reset();
  const tasks = family();
  const saved = [];
  const props = surface({
    items: tasks,
    allItems: tasks,
    onSave: async (input) => saved.push(input),
  });
  let tree = dragTo(props, tasks[0], 'waiting');
  const editor = find(tree, (node) => node.type === WorkQuickEditor);
  assert.equal(editor.props.task.id, 'a');
  assert.equal(editor.props.initialStatus, 'waiting');
  assert.equal(saved.length, 0);
  assert.equal(tasks[0].status, 'open');
  assert.equal(tasks[2].status, 'waiting');
});

test('하위 상태와 관계없이 처리 중인 상위를 접수로 옮기고 부모만 한 번 저장한다', async () => {
  reset();
  const tasks = family().map((task, index) => ({
    ...task, status: index === 0 ? 'in_progress' : 'open',
  }));
  const saved = [];
  const props = surface({ items: tasks, allItems: tasks, onSave: async (input) => saved.push(input) });
  dragTo(props, tasks[0], 'open');
  await new Promise(setImmediate);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].workItemId, 'a');
  assert.equal(saved[0].newStatus, 'open');
  assert.equal(saved[0].expectedUpdatedAt, tasks[0].updatedAt);
  assert.equal(tasks[0].openChildCount, 2);
  assert.equal(tasks[1].status, 'open');
  assert.equal(tasks[2].status, 'open');
});

test('완료된 상위를 다시 열 때 드롭한 접수 상태를 그대로 사용한다', () => {
  reset();
  const tasks = family().map((task) => ({ ...task, status: 'completed', openChildCount: 0 }));
  const saved = [];
  const props = surface({ items: tasks, allItems: tasks, onSave: async (input) => saved.push(input) });
  const tree = dragTo(props, tasks[0], 'open');
  const editor = find(tree, (node) => node.type === WorkQuickEditor);
  assert.equal(editor.props.task.id, 'a');
  assert.equal(editor.props.initialStatus, 'open');
  assert.equal(saved.length, 0);
});

test('자동 대기 카드의 실제 부모 상태로 드롭하면 저장 없이 우선 표시 이유를 알린다', () => {
  reset();
  const tasks = family();
  const saved = [];
  const props = surface({ items: tasks, allItems: tasks, onSave: async (input) => saved.push(input) });
  const tree = dragTo(props, tasks[0], 'open');
  assert.equal(saved.length, 0);
  assert.match(renderToStaticMarkup(tree), /상위 업무의 상태는 그대로/);
  assert.match(renderToStaticMarkup(tree), /대기·막힘 열에 표시/);
});

test('완료 열 드롭은 준비된 부모도 최종 확인을 열며 미완료 세부 업무를 자동 완료하지 않는다', () => {
  reset();
  const tasks = family().map((task, index) => ({
    ...task,
    status: index ? 'completed' : 'in_progress',
    openChildCount: 0,
  }));
  const saved = [];
  const props = surface({
    items: tasks,
    allItems: tasks,
    onSave: async (input) => saved.push(input),
  });
  const tree = dragTo(props, tasks[0], 'completed');
  const editor = find(tree, (node) => node.type === WorkQuickEditor);
  assert.equal(editor.props.task.id, 'a');
  assert.equal(editor.props.initialStatus, 'completed');
  assert.equal(saved.length, 0);
  reset();
  const unfinished = family();
  const next = dragTo(
    { ...props, items: unfinished, allItems: unfinished },
    unfinished[0],
    'completed',
  );
  assert.match(renderToStaticMarkup(next), /하위 업무를 모두 완료한 뒤/);
  assert.equal(
    nodes(next).some((node) => node.type === WorkQuickEditor),
    false,
  );
  assert.equal(saved.length, 0);
});

test('동일 열 드롭·드래그 직후 클릭·중복 드롭은 추가 저장이나 상세 이동을 일으키지 않는다', async () => {
  reset();
  const saved = [];
  let opened = 0;
  let finish;
  const props = surface({
    onOpen: () => opened++,
    onSave: (input) => {
      saved.push(input);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  let tree = dragTo(props, item, 'open');
  assert.equal(saved.length, 0);
  tree = dragTo(props, item, 'in_progress');
  boardOf(tree).props.onDrop('completed', Date.now());
  boardOf(tree).props.onOpen(item, Date.now());
  assert.equal(saved.length, 1);
  assert.equal(opened, 0);
  finish();
  await new Promise(setImmediate);
});

test('드래그 중 변경·삭제된 업무와 누락 연결은 이동하지 않는다', () => {
  for (const replacement of [[], [{ ...item, updatedAt: 20 }]]) {
    reset();
    let saved = 0;
    const props = surface({ onSave: async () => saved++ });
    let tree = render(WorkTaskSurface, props);
    boardOf(tree).props.onDragStart(item, dragEvent(), Date.now());
    const updated = { ...props, items: replacement, allItems: replacement };
    tree = render(WorkTaskSurface, updated);
    boardOf(tree).props.onDrop('completed', Date.now());
    assert.match(
      renderToStaticMarkup(render(WorkTaskSurface, updated)),
      /변경되었거나 삭제/,
    );
    assert.equal(saved, 0);
  }
  reset();
  const missing = { ...item, childWorkItemIds: ['missing'] };
  const props = surface({ items: [missing], allItems: [missing] });
  assert.match(
    renderToStaticMarkup(dragTo(props, missing, 'completed')),
    /연결을 확인/,
  );
});

test('상위 대기 편집 중 업무가 삭제되면 오래된 업무의 편집기를 표시하지 않는다', () => {
  reset();
  const tasks = family();
  const props = surface({ items: tasks, allItems: tasks });
  dragTo(props, tasks[0], 'waiting');
  const tree = render(WorkTaskSurface, { ...props, items: [], allItems: [] });
  assert.equal(
    nodes(tree).some((node) => node.type === WorkQuickEditor),
    false,
  );
});

test('세부 업무 상태 선택은 해당 빠른 수정만 열고 적용 전에는 저장하지 않는다', () => {
  reset();
  const child = { ...item, id: 'b', title: '세부 실행', parentWorkItemId: 'a' };
  let saved = 0;
  const opened = [];
  const props = surface({
    items: [item, child],
    allItems: [item, child],
    onSave: async () => saved++,
    onOpen: (item) => opened.push(item.id),
  });
  let tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.handle).props.onEdit(child, 'waiting');
  tree = render(WorkTaskSurface, props);
  const editor = find(tree, (node) => node.type === WorkQuickEditor);
  assert.equal(editor.props.task.id, 'b');
  assert.equal(editor.props.initialStatus, 'waiting');
  assert.equal(saved, 0);
  find(tree, (node) => node.props?.handle).props.onOpen(item, Date.now());
  assert.equal(opened.length, 0);
  editor.props.onCancel();
  tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.handle).props.onOpen(child, Date.now());
  assert.equal(opened.join(','), 'b');
});

test('완료 상위 아래의 자식은 상태 재개를 막되 후속 처리 기록은 허용한다', async () => {
  reset();
  const parent = { ...item, status: 'completed', childWorkItemIds: ['b'] };
  const child = {
    ...item,
    id: 'b',
    title: '세부 실행',
    status: 'completed',
    parentWorkItemId: 'a',
  };
  const props = surface({ items: [parent, child], allItems: [parent, child] });
  let tree = render(WorkTaskSurface, props);
  const board = find(tree, (node) => node.props?.handle);
  assert.equal(board.props.canEdit(child), false);
  assert.equal(board.props.handle(child).props.draggable, false);
  const action = find(
    board.props.actions(child),
    (node) => node.props?.['aria-label'] === '세부 실행 빠른 수정',
  );
  assert.equal(action.props.disabled, false);
  action.props.onClick();
  tree = render(WorkTaskSurface, props);
  const editor = find(tree, (node) => node.type === WorkQuickEditor);
  assert.equal(editor.props.statusLocked, true);
  reset();
  let sent;
  const editorProps = {
    ...editor.props,
    onSave: async (input) => {
      sent = input;
    },
    onCancel() {},
  };
  tree = render(WorkQuickEditor, editorProps);
  assert.equal(
    find(tree, (node) => node.props?.id === 'quick-b-status').props.disabled,
    true,
  );
  find(tree, (node) => node.props?.id === 'quick-b-action').props.onChange({
    target: { value: '완료 후 확인 연락 기록' },
  });
  tree = render(WorkQuickEditor, editorProps);
  await find(tree, (node) => node.type === 'form').props.onSubmit(event);
  assert.equal(sent.newStatus, 'completed');
  assert.equal(sent.actionContent, '완료 후 확인 연락 기록');
});

test('드래그 중 실시간 변경으로 저장이 거절되면 성공으로 표시하거나 상태를 덮어쓰지 않는다', async () => {
  reset();
  const props = surface({
    onSave: async () => {
      throw new Error('다른 변경이 먼저 저장되었습니다.');
    },
  });
  let tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.handle)
    .props.handle(item)
    .props.onDragStart({ ...event, dataTransfer: { setData() {} } });
  tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.handle).props.onDrop(
    'in_progress',
    Date.now(),
  );
  await new Promise((resolve) => setImmediate(resolve));
  tree = render(WorkTaskSurface, props);
  assert.match(renderToStaticMarkup(tree), /다른 변경이 먼저 저장되었습니다/);
  assert.equal(item.status, 'open');
});

test('완료된 프로젝트는 상태 재개를 막고 기록 추가는 허용한다', () => {
  reset();
  const completed = { ...item, status: 'completed' };
  const props = surface({
    items: [completed],
    allItems: [completed],
    isClosed: () => true,
  });
  let tree = render(WorkTaskSurface, props);
  const board = find(tree, (node) => node.props?.handle);
  assert.equal(board.props.canEdit(completed), false);
  board.props.onEdit(completed, 'in_progress');
  tree = render(WorkTaskSurface, props);
  assert.equal(
    nodes(tree).some((node) => node.type === WorkQuickEditor),
    false,
  );
  find(tree, (node) => node.props?.handle).props.onEdit(completed);
  tree = render(WorkTaskSurface, props);
  assert.equal(
    find(tree, (node) => node.type === WorkQuickEditor).props.statusLocked,
    true,
  );
});

const nestedItems = [
  {
    ...item,
    id: 'root',
    title: '견적서 제출',
    childWorkItemIds: ['child', 'sibling'],
  },
  {
    ...item,
    id: 'child',
    title: '내부 검토',
    parentWorkItemId: 'root',
    childWorkItemIds: ['grandchild'],
  },
  {
    ...item,
    id: 'grandchild',
    title: '수정 내역 확인',
    parentWorkItemId: 'child',
    status: 'completed',
  },
  { ...item, id: 'sibling', title: '고객 회신', parentWorkItemId: 'root' },
];
const groupProps = (extra = {}) => ({
  items: nestedItems,
  matchedItems: nestedItems,
  searching: false,
  expanded: false,
  onToggleExpanded() {},
  onOpen() {},
  renderStatus: (item) => types.FARM_WORK_STATUS_LABELS[item.status],
  renderDueDate: (item) => item.dueDate || '기한 미지정',
  latestAction: () => '',
  farmName: () => '프로젝트 공통',
  ...extra,
});

test('계층형 표는 부모→자식→손자 순서로 한 번씩 표시하고 모든 행의 5개 열을 정렬한다', () => {
  reset();
  const tree = render(ProjectWorkTree, groupProps());
  const rootGroup = find(tree, (x) => x.props?.['data-work-group'] === 'root');
  const child = find(rootGroup, (x) => x.props?.['data-work-id'] === 'child');
  const grandchild = find(
    rootGroup,
    (x) => x.props?.['data-work-id'] === 'grandchild',
  );
  assert.equal(grandchild.props['data-work-depth'], 2);
  assert.equal(child.props['data-parent-work-id'], 'root');
  assert.equal(grandchild.props['data-parent-work-id'], 'child');
  const rows = nodes(rootGroup).filter((x) => x.props?.['data-work-id']);
  assert.match(
    rows[0].props.className,
    /border-l-4/,
    'parent has a distinct leading edge',
  );
  for (const row of rows)
    assert.match(
      row.props.className,
      /border-y/,
      'each task has its own boundary',
    );
  assert.equal(
    rows.map((x) => x.props['data-work-id']).join(','),
    'root,child,grandchild,sibling',
  );
  for (const row of rows) {
    assert.equal(React.Children.toArray(row.props.children).length, 5);
    assert.equal(
      nodes(row).filter((x) => x.props?.['data-work-id']).length,
      1,
      'task rows are siblings, never nested cards',
    );
  }
  for (const item of nestedItems)
    assert.equal(
      nodes(tree).filter((x) => x.props?.['data-work-id'] === item.id).length,
      1,
    );
  for (const button of nodes(tree).filter((x) => x.type === 'button'))
    assert.equal(
      nodes(button).filter((x) => x.type === 'button').length,
      1,
      'buttons are not nested',
    );
  const html = renderToStaticMarkup(tree);
  assert.match(html, /<table/);
  assert.equal((html.match(/scope="col"/g) || []).length, 5);
  assert.doesNotMatch(html, /<li|<ul/);
  assert.match(html, /세부 업무 · 2단계/);
  assert.match(html, /border-l-2/);
});

test('접힌 조상 아래 손자 검색은 조상을 펼치고 무관한 형제를 숨긴다', () => {
  reset();
  let tree = render(ProjectWorkTree, groupProps());
  find(
    tree,
    (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 접기',
  ).props.onClick();
  tree = render(ProjectWorkTree, groupProps());
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 1);
  assert.equal(
    find(
      tree,
      (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 펼치기',
    ).props['aria-expanded'],
    false,
  );
  tree = render(
    ProjectWorkTree,
    groupProps({ matchedItems: [nestedItems[2]], searching: true }),
  );
  assert.equal(
    find(
      tree,
      (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 검색 중 펼침',
    ).props['aria-expanded'],
    true,
  );
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-id'] === 'sibling').length,
    0,
  );
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 3);
  assert.match(renderToStaticMarkup(tree), /검색된 세부 업무의 상위 업무/);
  // Clearing the search restores the user's collapsed state.
  tree = render(ProjectWorkTree, groupProps());
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 1);
});

test('모든 업무가 검색에 일치해도 접혀 있던 조상은 검색 중 펼친다', () => {
  reset();
  let tree = render(ProjectWorkTree, groupProps());
  find(
    tree,
    (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 접기',
  ).props.onClick();
  tree = render(ProjectWorkTree, groupProps({ searching: true }));
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 4);
  assert.match(renderToStaticMarkup(tree), /검색 중 펼침/);
});

test('깊은 세부 업무는 단계 표기를 유지하면서 누적 들여쓰기를 제한한다', () => {
  reset();
  const items = Array.from({ length: 7 }, (_, i) => ({
    ...item,
    id: `level-${i}`,
    parentWorkItemId: i ? `level-${i - 1}` : undefined,
  }));
  const tree = render(
    ProjectWorkTree,
    groupProps({ items, matchedItems: items }),
  );
  const deepRow = find(tree, (x) => x.props?.['data-work-id'] === 'level-6');
  assert.equal(
    find(deepRow, (x) => x.props?.style?.marginLeft).props.style.marginLeft,
    '60px',
  );
  assert.match(renderToStaticMarkup(tree), /세부 업무 · 6단계/);
});

test('더 보기는 8개 부모 묶음으로 제한하며 세부 업무를 중간에 자르지 않는다', () => {
  reset();
  const items = [
    ...nestedItems,
    ...Array.from({ length: 9 }, (_, i) => ({ ...item, id: `other-${i}` })),
  ];
  let expanded = false;
  const props = groupProps({
    items,
    matchedItems: items,
    onToggleExpanded: () => {
      expanded = !expanded;
    },
  });
  let tree = render(ProjectWorkTree, props);
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-depth'] === 0).length,
    8,
  );
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 11);
  assert.match(renderToStaticMarkup(tree), /나머지 하위 업무 2개 묶음 더 보기/);
  find(
    tree,
    (x) => x.props?.onClick === props.onToggleExpanded,
  ).props.onClick();
  tree = render(ProjectWorkTree, { ...props, expanded });
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-depth'] === 0).length,
    10,
  );
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-id']).length,
    items.length,
  );
  find(
    tree,
    (x) => x.props?.onClick === props.onToggleExpanded,
  ).props.onClick();
  tree = render(ProjectWorkTree, { ...props, expanded });
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-depth'] === 0).length,
    8,
  );
});

test('세부 업무 접기와 상세 클릭은 분리되어 선택한 자식만 연다', () => {
  reset();
  const opened = [];
  const tree = render(
    ProjectWorkTree,
    groupProps({
      onOpen: (item) => opened.push(item.id),
    }),
  );
  find(
    tree,
    (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 접기',
  ).props.onClick();
  assert.deepEqual(opened, []);
  find(
    tree,
    (x) => x.props?.['aria-label'] === '수정 내역 확인 업무 상세 열기',
  ).props.onClick();
  assert.deepEqual(opened, ['grandchild']);
  assert.equal(
    find(tree, (x) => x.props?.['data-work-id'] === 'root').props.onClick,
    undefined,
  );
});

test('가장 긴급한 자식의 부모 묶음을 먼저 표시하고 기존 완료 집계는 유지한다', () => {
  const other = { ...item, id: 'other' };
  const items = [
    nestedItems[2],
    other,
    nestedItems[0],
    nestedItems[1],
    nestedItems[3],
  ];
  const before = hierarchy.summarizeWorkHierarchy(items);
  const groups = hierarchy.buildWorkDisplayGroups(items, items);
  assert.equal(groups[0].item.id, 'root');
  assert.equal(groups[1].item.id, 'other');
  hierarchy.buildWorkDisplayGroups(items, [nestedItems[2]]);
  const after = hierarchy.summarizeWorkHierarchy(items);
  assert.equal(before.leafCount, 3);
  assert.equal(before.completionRate, 33);
  assert.equal(JSON.stringify(after), JSON.stringify(before));
});

test('조회 누락 세부 업무는 안내하고 잘못된 순환 이력도 중복 없이 처리한다', () => {
  reset();
  const missing = [{ ...item, childWorkItemIds: ['not-loaded'] }];
  const tree = render(
    ProjectWorkTree,
    groupProps({ items: missing, matchedItems: missing }),
  );
  assert.match(
    renderToStaticMarkup(tree),
    /세부 업무 1건을 아직 불러오지 못했습니다/,
  );
  assert.equal(hierarchy.summarizeWorkHierarchy(missing).completionRate, null);
  const cyclic = [
    { ...item, id: 'a', parentWorkItemId: 'b' },
    { ...item, id: 'b', parentWorkItemId: 'a' },
  ];
  const groups = hierarchy.buildWorkDisplayGroups(cyclic);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].children.length, 1);
  assert.equal(groups[0].children[0].children.length, 0);
  assert.equal(hierarchy.buildWorkDisplayGroups(missing, []).length, 0);
});

test('계층 표의 상태·담당자·기한·처리 내용은 각 업무의 값으로 독립 표시된다', () => {
  reset();
  const tasks = nestedItems.map((task, i) => ({
    ...task,
    owner: `담당 ${i}`,
    dueDate: `2026-09-${10 + i}`,
  }));
  const tree = render(
    ProjectWorkTree,
    groupProps({
      items: tasks,
      matchedItems: tasks,
      latestAction: (task) => `처리 ${task.id}`,
    }),
  );
  for (const task of tasks) {
    const row = find(tree, (x) => x.props?.['data-work-id'] === task.id);
    const cells = React.Children.toArray(row.props.children);
    assert.equal(
      cells[1].props.children,
      types.FARM_WORK_STATUS_LABELS[task.status],
    );
    assert.equal(cells[2].props.children, task.owner);
    assert.equal(cells[3].props.children, task.dueDate);
    assert.equal(cells[4].props.children.props.children, `처리 ${task.id}`);
  }
});

test('긴 제목은 줄바꿈하고 최근처리는 이력→다음행동→빈 안내 순서로 유지한다', () => {
  reset();
  const tasks = [
    {
      ...item,
      id: 'history',
      title: '확인해야 하는 긴 업무명 '.repeat(12),
      nextAction: '다음 행동',
    },
    { ...item, id: 'next', nextAction: '담당자에게 확인' },
    { ...item, id: 'empty', owner: '' },
  ];
  const tree = render(
    ProjectWorkTree,
    groupProps({
      items: tasks,
      matchedItems: tasks,
      latestAction: (task) => (task.id === 'history' ? '최근 처리 기록' : ''),
    }),
  );
  const html = renderToStaticMarkup(tree);
  assert.match(html, /최근 처리 기록/);
  assert.match(html, /담당자에게 확인/);
  assert.match(html, /처리 내용 없음/);
  assert.match(html, /기한 미지정/);
  assert.match(html, /미지정/);
  const title = find(
    tree,
    (x) => x.props?.['aria-label'] === `${tasks[0].title} 업무 상세 열기`,
  );
  assert.match(title.props.className, /break-words/);
  assert.doesNotMatch(title.props.className, /truncate/);
  assert.match(
    find(
      tree,
      (x) => x.props?.['aria-label'] === '프로젝트 하위 업무와 세부 업무',
    ).props.className,
    /min-w-\[1000px\]/,
  );
});
test('자식 생성 재시도는 같은 요청 ID와 작성 시각을 유지한다', async () => {
  reset();
  const sent = [];
  const props = {
    parent: item,
    recorder: '담당',
    onBusy() {},
    onCancel() {},
    onSave: async (...args) => {
      sent.push(args);
      throw new Error('응답 실패');
    },
  };
  let tree = render(ChildTaskForm, props);
  await tree.props.onSubmit(event);
  tree = render(ChildTaskForm, props);
  await tree.props.onSubmit(event);
  assert.equal(sent[0][5], sent[1][5]);
  assert.equal(sent[0][6], sent[1][6]);
  assert.equal(nodes(tree).filter((x) => x.props?.keepMounted).length, 2);
});

const popupProps = (extra = {}) => ({
  task: item,
  popup: true,
  recorder: '담당',
  onSave: async () => {},
  onCancel() {},
  ...extra,
});
const modal = (tree) => find(tree, (x) => x.type === dialogs.Dialog);
const discard = (tree) => find(tree, (x) => x.type === alerts.AlertDialog);
const closeEvent = (reason) => ({
  reason,
  cancel() {
    this.cancelled = true;
  },
});

test('빠른 수정은 제목·설명이 있는 팝업이고 작은 화면에서는 내부 스크롤을 사용한다', () => {
  reset();
  const tree = render(WorkQuickEditor, popupProps());
  assert.equal(modal(tree).props.open, true);
  assert.equal(modal(tree).props.disablePointerDismissal, true);
  const content = find(tree, (x) => x.type === dialogs.DialogContent);
  assert.match(content.props.className, /farm-app farm-dialog/);
  assert.match(content.props.className, /max-h-\[90dvh\].*overflow-y-auto/);
  assert.equal(
    find(tree, (x) => x.type === dialogs.DialogTitle).props.children,
    '빠른 수정',
  );
  assert.equal(
    find(tree, (x) => x.type === dialogs.DialogDescription).props.children,
    item.title,
  );
  assert.equal(
    find(tree, (x) => x.type === 'form').props['aria-label'],
    `${item.title} 빠른 수정`,
  );
  const statusFocus = {},
    actionFocus = {};
  focusElements.set('quick-a-status', statusFocus);
  focusElements.set('quick-a-action', actionFocus);
  assert.equal(content.props.initialFocus('keyboard'), statusFocus);
  assert.equal(content.props.initialFocus('touch'), true);
  const locked = render(WorkQuickEditor, popupProps({ statusLocked: true }));
  assert.equal(
    find(locked, (x) => x.type === dialogs.DialogContent).props.initialFocus(
      'mouse',
    ),
    actionFocus,
  );
});

test('바깥 클릭은 닫지 않으며 입력 전 Esc는 팝업을 닫는다', () => {
  reset();
  let closed = 0;
  const tree = render(
    WorkQuickEditor,
    popupProps({ onCancel: () => closed++ }),
  );
  const outside = closeEvent('outside-press');
  modal(tree).props.onOpenChange(false, outside);
  assert.equal(outside.cancelled, true);
  assert.equal(closed, 0);
  modal(tree).props.onOpenChange(false, closeEvent('escape-key'));
  assert.equal(closed, 1);
});

test('담당자·기한 직접 편집은 선택 영역을 펼치고 해당 입력에 초점을 준다', () => {
  for (const field of ['owner', 'dueDate']) {
    reset();
    const tree = render(WorkQuickEditor, popupProps({ initialField: field }));
    const openedSection = find(tree, (node) => node.props?.defaultOpen === true);
    assert.match(renderToStaticMarkup(openedSection), /담당자·기한·다음 행동/);
    const fieldFocus = {};
    focusElements.set(`work-control-${field === 'owner' ? '3' : '4'}-${item.id}`, fieldFocus);
    const content = find(tree, (node) => node.type === dialogs.DialogContent);
    assert.equal(content.props.initialFocus('keyboard'), fieldFocus);
  }
  reset();
  const assigned = render(WorkQuickEditor, popupProps({ task: { ...item, assigneeUid: 'assigned' }, initialField: 'owner' }));
  assert.equal(find(assigned, (node) => node.props?.id === `work-control-3-${item.id}`).props.disabled, true);
  const dueFocus = {};
  focusElements.set(`work-control-4-${item.id}`, dueFocus);
  assert.equal(find(assigned, (node) => node.type === dialogs.DialogContent).props.initialFocus('keyboard'), dueFocus);
});

test('입력 후 취소·닫기·Esc는 취소 확인을 띄우고 계속 작성하면 초안을 유지한다', () => {
  for (const reason of ['escape-key', 'close-press', 'cancel-button']) {
    reset();
    let closed = 0;
    const props = popupProps({ onCancel: () => closed++ });
    let tree = render(WorkQuickEditor, props);
    find(tree, (x) => x.props?.id === 'quick-a-action').props.onChange({
      target: { value: '현장 확인 중' },
    });
    tree = render(WorkQuickEditor, props);
    if (reason === 'cancel-button')
      find(tree, (x) => x.props?.children === '취소').props.onClick();
    else modal(tree).props.onOpenChange(false, closeEvent(reason));
    tree = render(WorkQuickEditor, props);
    assert.equal(discard(tree).props.open, true);
    assert.equal(closed, 0);
    discard(tree).props.onOpenChange(false);
    tree = render(WorkQuickEditor, props);
    assert.equal(discard(tree).props.open, false);
    assert.equal(
      find(tree, (x) => x.props?.id === 'quick-a-action').props.value,
      '현장 확인 중',
    );
    modal(tree).props.onOpenChange(false, closeEvent('close-press'));
    tree = render(WorkQuickEditor, props);
    find(tree, (x) => x.type === alerts.AlertDialogAction).props.onClick();
    assert.equal(closed, 1);
  }
});

test('팝업 저장 중 닫기를 막고 저장 성공 때 취소 확인 없이 정확히 한 번 닫는다', async () => {
  reset();
  let resolveSave,
    closed = 0;
  const sent = [];
  const props = popupProps({
    onCancel: () => closed++,
    onSave: async (...args) => {
      sent.push(args);
      await new Promise((resolve) => {
        resolveSave = resolve;
      });
    },
  });
  let tree = render(WorkQuickEditor, props);
  find(tree, (x) => x.props?.id === 'quick-a-action').props.onChange({
    target: { value: '견적 전달 완료' },
  });
  tree = render(WorkQuickEditor, props);
  const submit = find(tree, (x) => x.type === 'form').props.onSubmit(event);
  tree = render(WorkQuickEditor, props);
  modal(tree).props.onOpenChange(false, closeEvent('escape-key'));
  modal(tree).props.onOpenChange(false, closeEvent('close-press'));
  assert.equal(closed, 0);
  assert.equal(discard(tree).props.open, false);
  assert.equal(
    find(tree, (x) => x.type === dialogs.DialogClose).props.render.props
      .disabled,
    true,
  );
  assert.equal(
    find(tree, (x) => x.props?.children === '취소').props.disabled,
    true,
  );
  resolveSave();
  await submit;
  assert.equal(closed, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].workItemId, item.id);
  assert.equal(sent[0][0].actionContent, '견적 전달 완료');
});

test('팝업 이미지 처리 중 닫기를 막고 실패·외부 변경 때 초안과 오류를 남긴다', async () => {
  reset();
  let closed = 0;
  const props = popupProps({
    onCancel: () => closed++,
    onSave: async () => {
      throw new Error('연결 오류');
    },
  });
  let tree = render(WorkQuickEditor, props);
  find(tree, (x) => x.props?.onBusyChange).props.onBusyChange(true);
  tree = render(WorkQuickEditor, props);
  modal(tree).props.onOpenChange(false, closeEvent('close-press'));
  assert.equal(closed, 0);
  assert.equal(
    find(tree, (x) => x.type === dialogs.DialogClose).props.render.props
      .disabled,
    true,
  );
  find(tree, (x) => x.props?.onBusyChange).props.onBusyChange(false);
  find(tree, (x) => x.props?.id === 'quick-a-action').props.onChange({
    target: { value: '작성 중인 처리 내용' },
  });
  tree = render(WorkQuickEditor, props);
  await find(tree, (x) => x.type === 'form').props.onSubmit(event);
  tree = render(WorkQuickEditor, props);
  assert.equal(closed, 0);
  assert.ok(
    nodes(tree).some(
      (x) => x.props?.role === 'alert' && x.props.children === '연결 오류',
    ),
  );
  assert.equal(
    find(tree, (x) => x.props?.id === 'quick-a-action').props.value,
    '작성 중인 처리 내용',
  );
  tree = render(WorkQuickEditor, {
    ...props,
    task: { ...item, updatedAt: 20, status: 'in_progress' },
  });
  assert.equal(
    find(tree, (x) => x.props?.children === '적용').props.disabled,
    true,
  );
  assert.equal(
    find(tree, (x) => x.props?.id === 'quick-a-action').props.value,
    '작성 중인 처리 내용',
  );
});

test('보드·목록 빠른 수정은 팝업 열림을 부모에 알리고 닫기·언마운트 때 해제하며 원래 위치로 초점을 돌린다', () => {
  for (const mode of ['board', 'list']) {
    reset();
    const changes = [],
      trigger = { isConnected: true },
      fallback = {};
    documentMock.activeElement = trigger;
    const props = surface({
      mode,
      onEditingChange: (open) => changes.push(open),
    });
    let tree = render(WorkTaskSurface, props);
    const actions =
      mode === 'board'
        ? find(tree, (x) => x.props?.actions).props.actions(item)
        : find(tree, (x) => x.props?.item?.id === item.id).props.actions;
    find(
      actions,
      (x) => x.props?.['aria-label'] === `${item.title} 빠른 수정`,
    ).props.onClick();
    tree = render(WorkTaskSurface, props);
    tree.props.ref.current = fallback;
    const editor = find(tree, (x) => x.type === WorkQuickEditor);
    assert.equal(editor.props.popup, true);
    assert.equal(editor.props.returnFocus(), trigger);
    trigger.isConnected = false;
    assert.equal(editor.props.returnFocus(), fallback);
    const cleanup = effects.at(-1).effect();
    assert.deepEqual(changes, [true]);
    editor.props.onCancel();
    cleanup();
    tree = render(WorkTaskSurface, props);
    assert.deepEqual(changes, [true, false]);
    assert.equal(
      nodes(tree).some((x) => x.type === WorkQuickEditor),
      false,
    );
  }
});
