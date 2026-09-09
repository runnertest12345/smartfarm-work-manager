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
const work = load('lib/project-work.ts');
const tag = (name) =>
  function TestPrimitive({
    children,
    variant,
    size,
    keepMounted,
    containerClassName,
    onValueChange,
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
const { WorkQuickEditor, WorkTaskSurface, ChildTaskForm } = load(
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
    '@/components/ui/button': { Button: tag('button') },
    '@/components/ui/input': { Input: tag('input') },
    '@/components/ui/textarea': { Textarea: tag('textarea') },
    '@/components/ui/dialog': dialogs,
    '@/components/ui/alert-dialog': alerts,
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
const event = { preventDefault() {} };
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
  find(tree, (x) => x.props?.handle).props.onDrop('in_progress');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].newStatus, 'in_progress');
  tree = render(WorkTaskSurface, props);
  drag();
  tree = render(WorkTaskSurface, props);
  find(tree, (x) => x.props?.handle).props.onDrop('waiting');
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
  assert.match(html, /margin-left:24px/);
  let row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 0);
  row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 1);
});

test('상위 묶음은 드래그하지 않고 자식 실행 업무만 독립적으로 변경한다', async () => {
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
  assert.equal(board.props.handle(parent), null);
  board.props
    .handle(child)
    .props.onDragStart({ ...event, dataTransfer: { setData() {} } });
  tree = render(WorkTaskSurface, props);
  board = find(tree, (node) => node.props?.handle);
  board.props.onDrop('in_progress');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].workItemId, 'b');
  assert.equal(parent.status, 'open');
  assert.equal(child.status, 'open');
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
  find(tree, (node) => node.props?.handle).props.onOpen(item);
  assert.equal(opened.length, 0);
  editor.props.onCancel();
  tree = render(WorkTaskSurface, props);
  find(tree, (node) => node.props?.handle).props.onOpen(child);
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
  find(tree, (node) => node.props?.handle).props.onDrop('in_progress');
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
  assert.equal(
    rows[0].props.style.borderTopWidth,
    2,
    'collapsed families keep their divider',
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
