import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
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
const projectWork = load('lib/project-work.ts', {
  './work-lifecycle': lifecycle,
});
const { buildWorkBoardGroups, workBoardDropIntent } = load(
  'lib/work-board.ts',
  {
    './work-hierarchy': hierarchy,
    './project-work': projectWork,
  },
);
let slots = [],
  cursor = 0;
const useState = (initial) => {
  const id = cursor++;
  if (!(id in slots))
    slots[id] = typeof initial === 'function' ? initial() : initial;
  return [
    slots[id],
    (next) => {
      slots[id] = typeof next === 'function' ? next(slots[id]) : next;
    },
  ];
};
const tag = (name) =>
  function Primitive({
    children,
    open,
    onOpenChange,
    onValueChange,
    variant,
    size,
    ...props
  }) {
    return React.createElement(name, props, children);
  };
const aliases = {
  react: { ...React, useState },
  '@/lib/farm-types': types,
  '@/lib/project-work': projectWork,
  '@/lib/work-board': { buildWorkBoardGroups },
  '@/components/ui/button': { Button: tag('button') },
  '@/components/ui/progress': { Progress: tag('div') },
  '@/components/ui/collapsible': {
    Collapsible: tag('section'),
    CollapsibleTrigger: tag('button'),
    CollapsibleContent: tag('div'),
  },
  '@/components/ui/select': Object.fromEntries(
    [
      'Select',
      'SelectTrigger',
      'SelectValue',
      'SelectContent',
      'SelectItem',
    ].map((name) => [name, tag('div')]),
  ),
};
const { WorkBoard } = load('app/work-board.tsx', aliases);
const task = (id, status = 'open', extra = {}) => ({
  id,
  title: id,
  status,
  projectId: 'p',
  farmId: '',
  farmRecordId: '',
  workType: 'communication',
  owner: '영업팀',
  dueDate: '2026-09-15',
  description: '',
  nextAction: '',
  blockedReason: '',
  blockedBy: '',
  reviewDate: '',
  expectedUnblockDate: '',
  updatedAt: 10,
  ...extra,
});
const mixed = () => [
  task('견적서 제출', 'open', {
    childWorkItemIds: ['초안', '단가', '사양', '발송'],
    openChildCount: 3,
  }),
  task('초안', 'completed', { parentWorkItemId: '견적서 제출' }),
  task('단가', 'in_progress', { parentWorkItemId: '견적서 제출' }),
  task('사양', 'waiting', {
    parentWorkItemId: '견적서 제출',
    blockedReason: '농가 회신 대기',
    blockedBy: '농가 담당자',
    expectedUnblockDate: '2026-09-10',
  }),
  task('발송', 'open', { parentWorkItemId: '견적서 제출' }),
];
const nested = () => [
  task('root', 'in_progress', { childWorkItemIds: ['child'] }),
  task('child', 'in_progress', {
    parentWorkItemId: 'root',
    childWorkItemIds: ['grandchild'],
  }),
  task('grandchild', 'completed', { parentWorkItemId: 'child' }),
];
const ids = (rows) => rows.map((row) => row.item.id).join(',');
const first = (items) => buildWorkBoardGroups(items)[0];
function nodes(element) {
  return element && typeof element === 'object'
    ? [
        element,
        ...React.Children.toArray(element.props?.children).flatMap(nodes),
      ]
    : [];
}
function find(tree, predicate) {
  const element = nodes(tree).find(predicate);
  assert.ok(element, 'control exists');
  return element;
}
function render(props) {
  cursor = 0;
  return WorkBoard(props);
}
function renderExpanded(props) {
  const tree = render(props);
  for (const node of nodes(tree).filter((node) => node.props?.onOpenChange))
    node.props.onOpenChange(true);
  return render(props);
}
function setup(extra = {}) {
  slots = [];
  cursor = 0;
  const allItems = mixed();
  return {
    allItems,
    items: allItems,
    busy: false,
    dragged: false,
    over: null,
    savingId: '',
    projectLabel: () => '태백 노지 실증단지',
    onOpen() {},
    onEdit() {},
    onOver() {},
    onDrop() {},
    onDragStart() {},
    onDragEnd() {},
    canEdit: () => true,
    handle: () => null,
    historySummary: (item) => React.createElement('p', null, `기록:${item.id}`),
    actions: (item) =>
      React.createElement(
        'button',
        { 'aria-label': item.title + ' 세부 업무 추가' },
        '세부 업무',
      ),
    ...extra,
  };
}

test('상위·자식 5개는 카드 하나로 묶이고 상태는 실행 업무 4개만 집계한다', () => {
  const groups = buildWorkBoardGroups(mixed());
  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.total, 4);
  assert.equal(group.rate, 25);
  for (const key of types.FARM_WORK_STATUSES)
    assert.equal(group.counts[key], 1);
  assert.equal(group.lane, 'in_progress');
  assert.equal(group.active[0].id, '단가');
  assert.equal(group.waiting[0].id, '사양');
});
test('처리 중이 없어지고 남은 실행 업무가 모두 대기이면 대기 열에 배치한다', () => {
  const items = mixed().map((item) =>
    ['단가', '발송'].includes(item.id) ? { ...item, status: 'waiting' } : item,
  );
  assert.equal(first(items).lane, 'waiting');
  assert.equal(first(items).counts.waiting, 3);
});
test('세부 업무가 모두 끝나면 최종 확인 전까지 처리 중 열에 남는다', () => {
  const items = mixed().map((item, i) => ({
    ...item,
    status: i ? 'completed' : 'open',
    openChildCount: 0,
  }));
  const group = first(items);
  assert.equal(group.lane, 'in_progress');
  assert.equal(group.rate, 100);
  assert.equal(group.readyToConfirm, true);
  assert.equal(group.needsConfirmation, true);
  assert.equal(
    items[0].status,
    'open',
    'projection does not write parent status',
  );
  items[0] = { ...items[0], status: 'completed' };
  assert.equal(first(items).lane, 'completed');
  assert.equal(first(items).needsConfirmation, false);
});
test('손자만 완료하면 실행 완료율은 100%지만 중간 부모부터 최종 확인해야 한다', () => {
  const items = nested();
  const group = first(items);
  assert.equal(group.total, 1);
  assert.equal(group.rate, 100);
  assert.equal(group.readyToConfirm, false);
  assert.equal(group.confirmations[0].id, 'child');
  items[1] = { ...items[1], status: 'completed' };
  assert.equal(first(items).readyToConfirm, true);
});
test('부모만 검색에 일치해도 카드 안 모든 자손과 완료율을 유지한다', () => {
  const items = mixed();
  const group = buildWorkBoardGroups(items, [items[0]])[0];
  assert.equal(group.rows.length, 5);
  assert.equal(group.total, 4);
  assert.equal(group.rate, 25);
  assert.equal(group.rows.filter((row) => row.matched).length, 1);
});
test('손자만 검색에 일치해도 최상위 카드와 형제 상태를 함께 보여준다', () => {
  const items = [
    ...nested(),
    task('sibling', 'waiting', { parentWorkItemId: 'root' }),
  ];
  const group = buildWorkBoardGroups(items, [items[2]])[0];
  assert.equal(group.item.id, 'root');
  assert.equal(ids(group.rows), 'root,child,grandchild,sibling');
  assert.equal(group.counts.waiting, 1);
  assert.equal(group.total, 2);
});
test('일치 업무가 없는 묶음은 제외하고 가장 긴급한 일치 업무 순서로 카드 정렬한다', () => {
  const items = [...mixed(), task('other'), task('not-matched')];
  assert.equal(
    buildWorkBoardGroups(items, [items[5], items[3]])
      .map((group) => group.item.id)
      .join(','),
    'other,견적서 제출',
  );
  assert.equal(buildWorkBoardGroups(items, []).length, 0);
});
test('자식 없는 농가 업무는 각 원래 상태의 독립 카드로 유지한다', () => {
  const items = types.FARM_WORK_STATUSES.map((status, index) =>
    task(String(index), status, {
      projectId: undefined,
      farmId: 'f',
      farmRecordId: 'record',
    }),
  );
  const groups = buildWorkBoardGroups(items);
  assert.equal(groups.length, 4);
  groups.forEach((group, index) => {
    assert.equal(group.hasChildren, false);
    assert.equal(group.lane, items[index].status);
  });
});
test('누락 자식·다른 사업·잘못된 역방향 연결은 완료로 표시하지 않는다', () => {
  for (const items of [
    [task('root', 'open', { childWorkItemIds: ['missing'] })],
    [
      task('root', 'open', { childWorkItemIds: ['child'] }),
      task('child', 'completed', {
        parentWorkItemId: 'root',
        projectId: 'other',
      }),
    ],
    [
      task('root', 'open', { childWorkItemIds: ['child'] }),
      task('child', 'completed'),
    ],
  ]) {
    const group = first(items);
    assert.equal(group.missing, true);
    assert.equal(group.rate, null);
    assert.equal(group.readyToConfirm, false);
  }
});
test('완료 부모 아래 미완료 자식·오래된 미완료 카운터는 확인 필요로 남긴다', () => {
  for (const items of [
    mixed().map((item, i) =>
      i ? item : { ...item, status: 'completed', openChildCount: 0 },
    ),
    mixed().map((item, i) => (i ? { ...item, status: 'completed' } : item)),
  ]) {
    const group = first(items);
    assert.equal(group.missing, true);
    assert.notEqual(group.lane, 'completed');
    assert.equal(group.readyToConfirm, false);
  }
});
test('고아·순환 업무도 숨기거나 무한 순회하지 않고 연결 확인 상태로 보여준다', () => {
  const cycle = [
    task('a', 'open', { parentWorkItemId: 'b' }),
    task('b', 'completed', { parentWorkItemId: 'a' }),
  ];
  const groups = buildWorkBoardGroups(cycle);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[0].missing, true);
  const orphan = first([
    task('orphan', 'completed', { parentWorkItemId: 'absent' }),
  ]);
  assert.equal(orphan.missing, true);
  assert.notEqual(orphan.lane, 'completed');
});
test('보드 집계는 원본 업무 상태·KPI·입금 제외 범위를 변경하지 않는다', () => {
  const items = mixed();
  const before = JSON.stringify(items);
  const kpi = JSON.stringify(hierarchy.summarizeWorkHierarchy(items));
  items.forEach(Object.freeze);
  Object.freeze(items);
  buildWorkBoardGroups(items, [items[3]]);
  assert.equal(JSON.stringify(items), before);
  assert.equal(JSON.stringify(hierarchy.summarizeWorkHierarchy(items)), kpi);
  const dashboard = readFileSync(
    new URL('../app/farm-ledger-dashboard.tsx', import.meta.url),
    'utf8',
  );
  assert.match(dashboard, /allItems=\{operationalWorkItems\}/);
  assert.match(
    dashboard,
    /workMode !== 'list'/,
    'hidden list-only status filter does not leak into board',
  );
});
test('보드에는 카드 1개만, 카드 내부에는 세부 업무 각각 한 번씩 표시한다', () => {
  const tree = renderExpanded(setup());
  assert.equal(
    nodes(tree).filter((node) => node.props?.['data-board-root']).length,
    1,
  );
  assert.equal(
    nodes(tree).filter((node) => node.props?.['data-board-task']).length,
    4,
  );
  const html = renderToStaticMarkup(tree);
  assert.match(html, /카드 1개/);
  assert.match(html, /농가 회신 대기/);
  assert.match(html, /2026-09-10/);
  assert.match(html, /현재 처리 중 1건/);
  for (const button of nodes(tree).filter((node) => node.type === 'button'))
    assert.equal(
      nodes(button).filter((node) => node.type === 'button').length,
      1,
    );
});
test('접기/펼치기는 상세 이동 없이 같은 카드 아래 세부 업무만 연다', () => {
  let opened = 0;
  const props = setup({ onOpen: () => opened++ });
  let tree = render(props);
  let panel = find(tree, (node) => node.props?.onOpenChange);
  assert.equal(panel.props.open, false);
  panel.props.onOpenChange(true);
  tree = render(props);
  panel = find(tree, (node) => node.props?.onOpenChange);
  assert.equal(panel.props.open, true);
  panel.props.onOpenChange(false);
  tree = render(props);
  assert.equal(
    find(tree, (node) => node.props?.onOpenChange).props.open,
    false,
  );
  assert.equal(opened, 0);
});
test('세부 업무명은 선택한 업무 상세만 열고 상태 선택은 그 업무 편집을 연다', () => {
  const opened = [],
    edited = [];
  const props = setup({
    onOpen: (item) => opened.push(item.id),
    onEdit: (item, status) => edited.push([item.id, status]),
  });
  const tree = renderExpanded(props);
  find(
    tree,
    (node) => node.props?.['aria-label'] === '단가 업무 상세 열기',
  ).props.onClick();
  assert.equal(opened.join(','), '단가');
  const row = find(tree, (node) => node.props?.['data-board-task'] === '사양');
  find(row, (node) => node.props?.onValueChange).props.onValueChange(
    'in_progress',
  );
  assert.equal(edited[0][0], '사양');
  assert.equal(edited[0][1], 'in_progress');
  assert.equal(
    props.allItems[3].status,
    'waiting',
    'no optimistic status write before Apply',
  );
  find(row, (node) => node.props?.onValueChange).props.onValueChange('invalid');
  assert.equal(edited.length, 1);
});
test('각 세부 업무의 추가 작업 버튼을 유지하여 손자 업무를 등록할 수 있다', () => {
  const props = setup();
  const tree = renderExpanded(props);
  for (const task of props.allItems.slice(1))
    assert.ok(
      find(
        tree,
        (node) => node.props?.['aria-label'] === task.title + ' 세부 업무 추가',
      ),
    );
});
test('전부 완료해도 확인 버튼을 눌러야 완료 편집이 열리고 데이터는 아직 그대로다', () => {
  const items = mixed().map((item, i) => ({
    ...item,
    status: i ? 'completed' : 'open',
    openChildCount: 0,
  }));
  const edited = [];
  const tree = renderExpanded(
    setup({
      allItems: items,
      items,
      onEdit: (item, status) => edited.push([item.id, status]),
    }),
  );
  find(
    tree,
    (node) => node.props?.children === '상위 업무 완료 확인',
  ).props.onClick();
  assert.equal(edited[0][1], 'completed');
  assert.equal(items[0].status, 'open');
});
test('중간 부모 확인이 남으면 최상위 완료 버튼을 숨기고 안내한다', () => {
  const items = nested();
  const tree = renderExpanded(setup({ allItems: items, items }));
  assert.equal(
    nodes(tree).some((node) => node.props?.children === '상위 업무 완료 확인'),
    false,
  );
  assert.match(renderToStaticMarkup(tree), /중간 상위 업무 1건/);
});
test('검색된 자식은 일치 건수로 알리고 상세는 사용자가 펼치고 접을 수 있다', () => {
  const props = setup();
  const searchingProps = {
    ...props,
    searching: true,
    items: [props.allItems[3]],
  };
  let tree = render(searchingProps);
  assert.equal(
    find(tree, (node) => node.props?.onOpenChange).props.open,
    false,
  );
  assert.doesNotMatch(renderToStaticMarkup(tree), /조건에 맞는 세부 업무 1건/);
  assert.equal(
    nodes(tree).filter((node) => node.props?.['data-board-task']).length,
    0,
  );
  tree = renderExpanded(searchingProps);
  assert.match(renderToStaticMarkup(tree), /조건에 맞는 세부 업무 1건/);
  assert.equal(
    nodes(tree).filter((node) => node.props?.['data-board-task']).length,
    4,
  );
  find(tree, (node) => node.props?.onOpenChange).props.onOpenChange(false);
  tree = render(searchingProps);
  assert.equal(
    find(tree, (node) => node.props?.onOpenChange).props.open,
    false,
  );
  tree = render(props);
  assert.equal(
    find(tree, (node) => node.props?.onOpenChange).props.open,
    false,
  );
});
test('카드의 열이 바뀌어도 세부 업무 펼침 상태를 유지한다', () => {
  const props = setup();
  let tree = render(props);
  find(tree, (node) => node.props?.onOpenChange).props.onOpenChange(true);
  const items = props.allItems.map((item, i) => ({
    ...item,
    status: i ? 'completed' : 'completed',
    openChildCount: 0,
  }));
  tree = render({ ...props, allItems: items, items });
  assert.equal(find(tree, (node) => node.props?.onOpenChange).props.open, true);
  const completeColumn = find(
    tree,
    (node) =>
      node.props?.['aria-label'] ===
      types.FARM_WORK_STATUS_LABELS.completed + ' 열',
  );
  assert.equal(
    nodes(completeColumn).filter((node) => node.props?.['data-board-root'])
      .length,
    1,
  );
});
test('저장·편집 중 상세 이동과 상태 선택을 비활성화한다', () => {
  const tree = renderExpanded(setup({ busy: true }));
  assert.equal(
    find(tree, (node) => node.props?.['aria-label'] === '단가 업무 상세 열기')
      .props.disabled,
    true,
  );
  const row = find(tree, (node) => node.props?.['data-board-task'] === '단가');
  assert.equal(
    find(row, (node) => node.props?.onValueChange).props.disabled,
    true,
  );
});
test('손잡이 드롭 대상은 열의 상태만 전달하고 완료·대기 처리는 기존 저장 경로로 보낸다', () => {
  const dropped = [];
  const tree = render(setup({ onDrop: (status) => dropped.push(status) }));
  for (const status of types.FARM_WORK_STATUSES)
    find(
      tree,
      (node) =>
        node.props?.['aria-label'] ===
        types.FARM_WORK_STATUS_LABELS[status] + ' 열',
    ).props.onDrop({ preventDefault() {} });
  assert.equal(dropped.join(','), types.FARM_WORK_STATUSES.join(','));
});
test('깊은 계층은 단계·상위 제목을 남기고 들여쓰기가 무한히 늘지 않는다', () => {
  const items = Array.from({ length: 7 }, (_, i) =>
    task('depth-' + i, 'open', {
      parentWorkItemId: i ? 'depth-' + (i - 1) : undefined,
    }),
  );
  const tree = renderExpanded(setup({ allItems: items, items }));
  assert.equal(
    find(tree, (node) => node.props?.['data-board-task'] === 'depth-6').props
      .style.marginLeft,
    '24px',
  );
  assert.match(renderToStaticMarkup(tree), /6단계/);
});

test('완료된 사업의 상위 업무 다시 열기는 비활성화된다', () => {
  const items = mixed().map((item) => ({
    ...item,
    status: 'completed',
    openChildCount: 0,
  }));
  const tree = renderExpanded(
    setup({ allItems: items, items, canEdit: () => false }),
  );
  assert.equal(
    find(tree, (node) => node.props?.children === '상위 업무 다시 열기').props
      .disabled,
    true,
  );
});

test('접힌 카드는 프로젝트명·업무명·상세 보기를 표시하고 처리 내용과 작업 버튼은 숨긴다', () => {
  const props = setup();
  let tree = render(props);
  let html = renderToStaticMarkup(tree);
  assert.match(html, /견적서 제출/);
  assert.match(html, /태백 노지 실증단지/);
  assert.doesNotMatch(
    html,
    /총괄 영업팀|2026-09-15|완료 1\/4|대기 사유|세부 업무 추가/,
  );
  assert.match(html, /상세 보기/);
  assert.doesNotMatch(html, /농가 회신 대기|기록:|data-board-task|2026-09-10/);
  tree = renderExpanded(props);
  html = renderToStaticMarkup(tree);
  assert.match(html, /태백 노지 실증단지/);
  assert.match(html, /총괄 영업팀 · 마감 2026-09-15/);
  assert.match(html, /완료 1\/4 · 처리 중 1 · 대기 1/);
  assert.match(html, /견적서 제출 세부 업무 추가/);
  assert.match(html, /농가 회신 대기|기록:견적서 제출/);
  find(tree, (node) => node.props?.onOpenChange).props.onOpenChange(false);
  assert.doesNotMatch(
    renderToStaticMarkup(render(props)),
    /농가 회신 대기|기록:|data-board-task/,
  );
});

test('독립 업무도 대기 사유·다음 행동·이력을 아래로 펼치며 다른 카드는 유지한다', () => {
  const items = [
    task('독립 업무', 'waiting', {
      blockedReason: '내역 회신 대기',
      nextAction: '담당자 재연락',
    }),
    task('다른 업무'),
  ];
  let opened = 0,
    edited = 0;
  const props = setup({
    items,
    allItems: items,
    onOpen: () => opened++,
    onEdit: () => edited++,
  });
  let tree = render(props);
  assert.doesNotMatch(
    renderToStaticMarkup(tree),
    /내역 회신 대기|담당자 재연락|기록:/,
  );
  const card = find(
    tree,
    (node) => node.props?.['data-board-root'] === '독립 업무',
  );
  find(card, (node) => node.props?.onOpenChange).props.onOpenChange(true);
  tree = render(props);
  assert.match(renderToStaticMarkup(tree), /내역 회신 대기/);
  assert.match(renderToStaticMarkup(tree), /담당자 재연락/);
  assert.match(renderToStaticMarkup(tree), /기록:독립 업무/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /기록:다른 업무/);
  assert.equal(opened, 0);
  assert.equal(edited, 0);
});

test('접힌 카드도 제목·여백을 잡아 이동하며 세부 버튼에서는 카드 드래그를 시작하지 않는다', () => {
  const starts = [];
  const props = setup({ onDragStart: (item) => starts.push(item.id) });
  let tree = render(props);
  const card = find(tree, (node) => node.props?.['data-board-root']);
  assert.equal(card.props.draggable, true);
  let prevented = 0;
  const event = (interactive, title) => ({
    target: {
      closest: (selector) =>
        selector === '[data-work-title]' ? title : interactive,
    },
    preventDefault: () => prevented++,
  });
  card.props.onDragStart(event(true, true));
  card.props.onDragStart(event(false, false));
  card.props.onDragStart(event(true, false));
  assert.equal(starts.length, 2);
  assert.equal(prevented, 1);
  tree = render({ ...props, busy: true });
  assert.equal(
    find(tree, (node) => node.props?.['data-board-root']).props.draggable,
    false,
  );
});

test('상위 카드 이동은 저장 상태 대신 표시 열을 비교하고 선택·최종 확인·재개를 구분한다', () => {
  const group = buildWorkBoardGroups(mixed())[0];
  assert.equal(group.lane, 'in_progress');
  group.item.status = 'open';
  assert.equal(workBoardDropIntent(group, 'open'), 'choose');
  assert.equal(workBoardDropIntent(group, 'in_progress'), 'none');
  assert.equal(
    workBoardDropIntent({ ...group, missing: true }, 'completed'),
    'blocked',
  );
  assert.equal(
    workBoardDropIntent({ ...group, readyToConfirm: true }, 'completed'),
    'confirm',
  );
  assert.equal(
    workBoardDropIntent(
      {
        ...group,
        item: { ...group.item, status: 'completed' },
        lane: 'completed',
      },
      'open',
    ),
    'reopen',
  );
});
