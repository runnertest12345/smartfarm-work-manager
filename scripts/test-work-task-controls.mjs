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
const { ProjectWorkTree } = load('app/project-work-tree.tsx', {
  react: { ...React, useState: hook },
  '@/lib/work-hierarchy': hierarchy,
});
const { WorkQuickEditor, WorkTaskSurface, ChildTaskForm } = load(
  'app/work-task-controls.tsx',
  {
    react: {
      ...React,
      useState: hook,
      useRef: (initial) => hook(() => ({ current: initial }))[0],
    },
    '@/lib/farm-types': types,
    '@/lib/project-work': work,
    '@/lib/work-hierarchy': hierarchy,
    '@/components/ui/button': { Button: tag('button') },
    '@/components/ui/input': { Input: tag('input') },
    '@/components/ui/textarea': { Textarea: tag('textarea') },
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
test('일반 열 드롭은 상태 변경을 한 번 저장하고 대기 열은 편집기를 연다', async () => {
  reset();
  let saved = [];
  const props = surface({
    onSave: async (...args) => {
      saved.push(args);
    },
  });
  let tree = render(WorkTaskSurface, props);
  const drag = () =>
    find(tree, (x) => x.props?.draggable !== undefined).props.onDragStart({
      ...event,
      dataTransfer: { setData() {} },
    });
  drag();
  tree = render(WorkTaskSurface, props);
  find(tree, (x) => x.props?.['aria-label'] === '처리 중 열').props.onDrop(
    event,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0].newStatus, 'in_progress');
  tree = render(WorkTaskSurface, props);
  drag();
  tree = render(WorkTaskSurface, props);
  find(
    tree,
    (x) =>
      x.props?.['aria-label'] === types.FARM_WORK_STATUS_LABELS.waiting + ' 열',
  ).props.onDrop(event);
  tree = render(WorkTaskSurface, props);
  assert.equal(saved.length, 1);
  assert.ok(find(tree, (x) => x.type === WorkQuickEditor));
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
  renderItem: (item) =>
    React.createElement(
      'button',
      { type: 'button', 'aria-label': `${item.title} 상세` },
      item.title,
    ),
  ...extra,
});

test('프로젝트 현황에서 자식·손자는 부모 카드 내부에 한 번씩 중첩된다', () => {
  reset();
  const tree = render(ProjectWorkTree, groupProps());
  const root = find(tree, (x) => x.props?.['data-work-id'] === 'root');
  const child = find(root, (x) => x.props?.['data-work-id'] === 'child');
  const grandchild = find(
    child,
    (x) => x.props?.['data-work-id'] === 'grandchild',
  );
  assert.equal(grandchild.props['data-work-depth'], 2);
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
  assert.match(html, /에 속한 세부 업무/);
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
  assert.equal(
    find(tree, (x) => x.props?.id === 'project-task-children-root').props
      .hidden,
    true,
  );
  tree = render(
    ProjectWorkTree,
    groupProps({ matchedItems: [nestedItems[2]], searching: true }),
  );
  assert.equal(
    find(tree, (x) => x.props?.id === 'project-task-children-root').props
      .hidden,
    false,
  );
  assert.equal(
    nodes(tree).filter((x) => x.props?.['data-work-id'] === 'sibling').length,
    0,
  );
  assert.equal(nodes(tree).filter((x) => x.props?.['data-work-id']).length, 3);
  assert.match(renderToStaticMarkup(tree), /검색된 세부 업무의 상위 업무/);
  // Clearing the search restores the user's collapsed state.
  tree = render(ProjectWorkTree, groupProps());
  assert.equal(
    find(tree, (x) => x.props?.id === 'project-task-children-root').props
      .hidden,
    true,
  );
});

test('모든 업무가 검색에 일치해도 접혀 있던 조상은 검색 중 펼친다', () => {
  reset();
  let tree = render(ProjectWorkTree, groupProps());
  find(
    tree,
    (x) => x.props?.['aria-label'] === '견적서 제출 세부 업무 접기',
  ).props.onClick();
  tree = render(ProjectWorkTree, groupProps({ searching: true }));
  assert.equal(
    find(tree, (x) => x.props?.id === 'project-task-children-root').props
      .hidden,
    false,
  );
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
  const deepList = find(
    tree,
    (x) => x.props?.id === 'project-task-children-level-4',
  );
  assert.match(deepList.props.className, /p-0 pt-3/);
  assert.doesNotMatch(deepList.props.className, /sm:p-4/);
  assert.equal(
    find(deepList, (x) => x.type === 'ul').props.className,
    'space-y-3',
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

test('업무 상세 클릭은 선택한 자식만 연다', () => {
  reset();
  const opened = [];
  const tree = render(
    ProjectWorkTree,
    groupProps({
      renderItem: (item) =>
        React.createElement(
          'button',
          { 'data-open-id': item.id, onClick: () => opened.push(item.id) },
          item.title,
        ),
    }),
  );
  find(tree, (x) => x.props?.['data-open-id'] === 'grandchild').props.onClick();
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
