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
  let row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 0);
  row = find(tree, (x) => x.props?.item?.id === 'a' && x.props?.onToggle);
  row.props.onToggle();
  tree = render(WorkTaskSurface, props);
  assert.equal(nodes(tree).filter((x) => x.props?.item?.id === 'b').length, 1);
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
