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
  cursor = 0,
  namespace = 0;
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
  react: { ...React, useState, useId: () => useState(() => `board-test-${++namespace}`)[0] },
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
function toggleOf(tree, rootId = '견적서 제출') {
  return find(tree, (node) => node.props?.['data-board-children-toggle'] === rootId);
}
function renderExpanded(props, rootId = '견적서 제출') {
  const tree = render(props);
  assert.equal(toggleOf(tree, rootId).props['aria-expanded'], false);
  toggleOf(tree, rootId).props.onClick();
  const expanded = render(props);
  assert.equal(toggleOf(expanded, rootId).props['aria-expanded'], true);
  return expanded;
}
function visibleText(element) {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return React.Children.toArray(element?.props?.children).map(visibleText).join('');
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

test('하위 대기가 없으면 처리 중인 자식과 무관하게 부모의 저장 상태를 따른다', () => {
  const items = mixed().map((item) => item.status === 'waiting' ? { ...item, status: 'open' } : item);
  for (const status of ['open', 'in_progress', 'waiting']) {
    const current = [{ ...items[0], status }, ...items.slice(1)];
    const original = JSON.stringify(current);
    assert.equal(first(current).lane, status);
    assert.equal(JSON.stringify(current), original);
  }
});

test('중간 부모나 손자의 대기는 검색에서 숨겨져도 최상위 카드에 우선 반영된다', () => {
  for (const waitingIndex of [1, 2]) {
    const items = nested().map((item, index) => ({
      ...item, status: index === waitingIndex ? 'waiting' : 'in_progress',
    }));
    const group = buildWorkBoardGroups(items, [items[0]])[0];
    assert.equal(group.lane, 'waiting');
    assert.equal(group.waiting.length, 1);
    assert.equal(group.waiting[0].id, items[waitingIndex].id);
  }
});

test('하위 대기 해제 후 상위가 마지막으로 직접 선택한 상태로 돌아온다', () => {
  const items = mixed();
  items[0] = { ...items[0], status: 'in_progress' };
  assert.equal(first(items).lane, 'waiting');
  items[3] = { ...items[3], status: 'open' };
  assert.equal(first(items).lane, 'in_progress');
  assert.equal(items[0].blockedReason, '');
  assert.equal(items[0].blockedBy, '');
});

test('요약 카드에 하위 대기와 상위의 실제 상태를 구분해 표시한다', () => {
  const tree = render(setup());
  const hint = find(tree, (node) => node.props?.['data-board-waiting']);
  assert.match(renderToStaticMarkup(hint), /하위 대기·막힘 1건 · 상위 접수/);
});

test('상위·자식 5개는 카드 하나로 묶이고 상태는 실행 업무 4개만 집계한다', () => {
  const groups = buildWorkBoardGroups(mixed());
  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.total, 4);
  assert.equal(group.rate, 25);
  for (const key of types.FARM_WORK_STATUSES)
    assert.equal(group.counts[key], 1);
  assert.equal(group.lane, 'waiting');
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
test('세부 업무가 모두 끝나도 최종 확인 전까지 상위가 선택한 열에 남는다', () => {
  const items = mixed().map((item, i) => ({
    ...item,
    status: i ? 'completed' : 'open',
    openChildCount: 0,
  }));
  const group = first(items);
  assert.equal(group.lane, 'open');
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
test('카드는 담당자·기한·완료율·막힘을 유지하고 하위 목록은 기본 접힘으로 시작한다', () => {
  const tree = render(setup());
  const html = renderToStaticMarkup(tree);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-root']).length, 1);
  assert.match(html, /견적서 제출|태백 노지 실증단지/);
  assert.match(html, /담당자/);
  assert.match(html, /영업팀/);
  assert.match(html, /2026-09-15/);
  assert.match(html, /하위 실행 업무 1\/4 완료/);
  assert.match(html, /25%/);
  assert.match(html, /text-red-600/);
  assert.doesNotMatch(html, /상세 보기|상세 접기|빠른 수정|세부 업무 추가/);
  assert.match(html, /하위 업무 4개/);
  assert.doesNotMatch(html, /대기·막힘 우선/);
  assert.match(html, /하위 대기·막힘 1건 · 상위 접수/);
  assert.match(html, /사양/);
  assert.doesNotMatch(html, /농가 회신 대기|농가 담당자/);
  assert.doesNotMatch(html, /기록:|현재 처리 중/);
  assert.equal(nodes(tree).filter((node) => node.props?.onOpenChange).length, 0);
  assert.equal(nodes(tree).filter((node) => node.type === 'button').length, 2);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 0);
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
  assert.match(toggleOf(tree).props['aria-label'], /하위 업무 펼치기$/);
  const content = find(tree, (node) => node.props?.id === toggleOf(tree).props['aria-controls']);
  assert.equal(content.props.hidden, true);
  assert.equal(find(tree, (node) => node.props?.['aria-label'] === '하위 실행 업무 완료율').props.value, 25);
});

test('카드 제목 클릭은 선택한 상위 업무 팝업만 한 번 열고 상태를 쓰지 않는다', () => {
  const opened = [], edited = [];
  const props = setup({
    onOpen: (item, occurredAt) => opened.push([item.id, occurredAt]),
    onEdit: (item) => edited.push(item.id),
  });
  const before = JSON.stringify(props.allItems);
  const tree = render(props);
  const title = find(tree, (node) => node.props?.['aria-label'] === '견적서 제출 업무 상세 열기');
  assert.equal(title.props['aria-haspopup'], 'dialog');
  title.props.onClick();
  assert.equal(opened.length, 1);
  assert.equal(opened[0][0], '견적서 제출');
  assert.equal(typeof opened[0][1], 'number');
  assert.equal(edited.length, 0);
  assert.equal(JSON.stringify(props.allItems), before);
});

test('상세 작업과 이력 렌더러는 보드에서 호출하지 않고 팝업에 위임한다', () => {
  let actions = 0, history = 0;
  render(setup({
    actions: () => { actions++; return null; },
    historySummary: () => { history++; return null; },
  }));
  assert.equal(actions, 0);
  assert.equal(history, 0);
});

test('자식 없는 업무는 담당자·기한과 자체 대기 여부만 보여주고 가짜 하위 완료율을 만들지 않는다', () => {
  const items = [task('독립 업무', 'waiting', {
    owner: '', dueDate: '', blockedReason: '내역 회신 대기', nextAction: '담당자 재연락',
  })];
  const tree = render(setup({ items, allItems: items }));
  const html = renderToStaticMarkup(tree);
  assert.match(html, /담당자/);
  assert.match(html, /기한/);
  assert.equal((html.match(/미지정/g) || []).length, 2);
  assert.match(html, /이 업무 대기·막힘/);
  assert.doesNotMatch(html, /하위 실행 업무|내역 회신 대기|담당자 재연락|기록:/);
});

test('누락·모순 연결은 가짜 완료율 대신 연결 확인 필요를 표시한다', () => {
  const items = [task('root', 'completed', { childWorkItemIds: ['missing'] })];
  const tree = render(setup({ items, allItems: items }));
  const html = renderToStaticMarkup(tree);
  assert.match(html, /업무 연결 확인 필요 · 완료율 집계 제외/);
  assert.doesNotMatch(html, /100%|하위 실행 업무 0\/0/);
  assert.equal(nodes(tree).filter((node) => node.props?.['aria-label'] === '하위 실행 업무 완료율').length, 0);
});

test('하위 실행이 모두 완료돼도 최종 확인 안내를 남기고 자동 완료나 숨은 저장 버튼을 만들지 않는다', () => {
  const items = mixed().map((item, i) => ({
    ...item, status: i ? 'completed' : 'open', openChildCount: 0,
  }));
  const tree = render(setup({ items, allItems: items }));
  const html = renderToStaticMarkup(tree);
  assert.match(html, /하위 실행 업무 4\/4 완료/);
  assert.match(html, /100%/);
  assert.match(html, /text-emerald-700/);
  assert.match(html, /하위 완료 · 상위 완료 확인 필요/);
  assert.equal(nodes(tree).filter((node) => node.type === 'button').length, 2);
  assert.equal(items[0].status, 'open');
  const column = find(tree, (node) => node.props?.['aria-label'] === '접수 열');
  assert.equal(nodes(column).filter((node) => node.props?.['data-board-root']).length, 1);
});

test('손자 완료율은 최하위 기준이며 중간 상위 업무 확인이 남았음을 카드에 표시한다', () => {
  const items = nested();
  const html = renderToStaticMarkup(render(setup({ items, allItems: items })));
  assert.match(html, /하위 실행 업무 1\/1 완료/);
  assert.match(html, /중간 상위 업무 1건 완료 확인 필요/);
  assert.doesNotMatch(html, /하위 완료 · 상위 완료 확인 필요/);
});

test('완료 카운터와 역방향 연결 확인이 남으면 잘못된 0건 확인 안내를 만들지 않는다', () => {
  const items = [
    task('root', 'open', { openChildCount: 1 }),
    task('child', 'completed', { parentWorkItemId: 'root' }),
  ];
  const html = renderToStaticMarkup(render(setup({ items, allItems: items })));
  assert.match(html, /완료 연결 확인 필요/);
  assert.doesNotMatch(html, /중간 상위 업무 0건/);
});

test('검색한 하위 업무의 건수를 기본 카드에 알리고 실제 완료율은 전체 묶음 기준을 유지한다', () => {
  const props = setup();
  const html = renderToStaticMarkup(render({
    ...props, searching: true, items: [props.allItems[3]],
  }));
  assert.match(html, /검색 일치 하위 업무 1건 · 제목을 눌러 확인/);
  assert.match(html, /하위 실행 업무 1\/4 완료/);
  assert.match(html, /25%/);
  assert.match(html, /하위 대기·막힘 1건 · 상위 접수/);
  assert.doesNotMatch(renderToStaticMarkup(render(props)), /검색 일치 하위 업무/);
});

test('하위 업무의 최우선 지시도 카드에서 즉시 보인다', () => {
  const items = mixed().map((item, i) => i === 2 ? {
    ...item, headAssigned: true, assigneeUid: 'member', assignedByUid: 'head',
  } : item);
  const html = renderToStaticMarkup(render(setup({ items, allItems: items })));
  assert.match(html, /부서장 지시 · 최우선/);
  assert.match(html, /border-l-4 border-amber-600/);
});

test('깊은 하위 업무도 빠짐없이 표시하며 즉시 부모와 실제 단계를 구분한다', () => {
  const items = Array.from({ length: 7 }, (_, i) => task('depth-' + i, 'open', {
    parentWorkItemId: i ? 'depth-' + (i - 1) : undefined,
  }));
  const tree = renderExpanded(setup({ items, allItems: items }), 'depth-0');
  const html = renderToStaticMarkup(tree);
  assert.match(html, /depth-0/);
  assert.match(html, /하위 실행 업무 0\/1 완료/);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 6);
  const deepest = find(tree, (node) => node.props?.['data-board-task'] === 'depth-6');
  const deepestHtml = renderToStaticMarkup(deepest);
  assert.match(deepestHtml, /depth-6/);
  assert.match(deepestHtml, /depth-5/);
  assert.match(deepestHtml, /6단계/);
  assert.equal(deepest.props['data-board-depth'], 6);
  assert.equal(parseFloat(deepest.props.style.marginLeft), 64);
  assert.doesNotMatch(html, /처리 내용 함께 보기/);
  assert.equal(nodes(tree).filter((node) => node.type === 'button').length, 8);
});

test('대기·막힘이 있어도 하위 순서는 유지하며 각 업무의 상태와 사유를 표시한다', () => {
  const items = mixed().map((item) => item.id === '발송'
    ? { ...item, status: 'waiting', blockedReason: '수신 주소 확인', blockedBy: '연락 담당자' }
    : item);
  const original = JSON.stringify(items);
  const tree = renderExpanded(setup({ items, allItems: items }));
  const list = find(tree, (node) => node.props?.['aria-label'] === '하위 업무 목록');
  const rows = nodes(list).filter((node) => node.props?.['data-board-task']);
  assert.equal(rows.map((node) => node.props['data-board-task']).join(','), '초안,단가,사양,발송');
  for (const row of rows) {
    assert.equal(row.type, 'li');
    const child = items.find((item) => item.id === row.props['data-board-task']);
    assert.ok(renderToStaticMarkup(row).includes(types.FARM_WORK_STATUS_LABELS[child.status]));
  }
  const waiting = find(list, (node) => node.props?.['data-board-task'] === '사양');
  assert.match(waiting.props.className, /amber/);
  assert.match(renderToStaticMarkup(waiting), /대기·막힘/);
  assert.match(renderToStaticMarkup(waiting), /농가 회신 대기/);
  assert.match(renderToStaticMarkup(waiting), /농가 담당자/);
  assert.equal(JSON.stringify(items), original, 'presentation sorting never mutates workspace data');
  assert.match(renderToStaticMarkup(tree), /하위 실행 업무 1\/4 완료/);
});

test('대기 하위의 사유·확인 대상 빈값은 명확한 미입력 안내로 표시한다', () => {
  const items = mixed().map((item) => item.id === '사양'
    ? { ...item, blockedReason: '', blockedBy: '' }
    : item);
  const tree = renderExpanded(setup({ items, allItems: items }));
  const waiting = find(tree, (node) => node.props?.['data-board-task'] === '사양');
  const html = renderToStaticMarkup(waiting);
  assert.match(html, /막힘 사유 미입력/);
  assert.match(html, /확인 대상 미지정/);
});

test('부모→자식 계층 순서를 유지하고 같은 단계 형제는 같은 들여쓰기로 정렬한다', () => {
  const items = [
    task('상위', 'open', { childWorkItemIds: ['부모A', '부모B'] }),
    task('부모A', 'in_progress', { parentWorkItemId: '상위', childWorkItemIds: ['손자A'] }),
    task('손자A', 'waiting', { parentWorkItemId: '부모A', blockedReason: '손자 막힘' }),
    task('부모B', 'open', { parentWorkItemId: '상위', childWorkItemIds: ['손자B'] }),
    task('손자B', 'open', { parentWorkItemId: '부모B' }),
  ];
  const tree = renderExpanded(setup({ items, allItems: items }), '상위');
  const rows = nodes(tree).filter((node) => node.props?.['data-board-task']);
  assert.equal(rows.map((row) => row.props['data-board-task']).join(','), '부모A,손자A,부모B,손자B');
  assert.deepEqual(rows.map((row) => row.props['data-board-depth']), [1, 2, 1, 2]);
  assert.deepEqual(rows.map((row) => parseFloat(row.props.style.marginLeft)), [0, 16, 0, 16]);
  assert.match(renderToStaticMarkup(rows[1]), /부모A/);
  assert.match(renderToStaticMarkup(rows[3]), /부모B/);
});

test('하위 헤더 반복 토글은 목록만 펼치고 접으며 팝업·편집·드래그·원본 집계를 변경하지 않는다', () => {
  let opened = 0, edited = 0, dragged = 0;
  const props = setup({
    onOpen: () => opened++, onEdit: () => edited++, onDragStart: () => dragged++,
  });
  const original = JSON.stringify(props.allItems);
  let tree = render(props);
  const controlsId = toggleOf(tree).props['aria-controls'];
  assert.ok(controlsId);
  const controlled = find(tree, (node) => node.props?.id === controlsId);
  assert.equal(controlled.props.hidden, true);
  assert.equal(nodes(controlled).some((node) => node.props?.['aria-label'] === '하위 업무 목록'), false);
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
  assert.equal(toggleOf(tree).type, 'button');
  for (let click = 0; click < 4; click++) {
    toggleOf(tree).props.onClick({ stopPropagation() {} });
    tree = render(props);
    const expanded = click % 2 === 0;
    assert.equal(toggleOf(tree).props['aria-expanded'], expanded);
    assert.equal(toggleOf(tree).props['aria-controls'], controlsId);
    const target = find(tree, (node) => node.props?.id === controlsId);
    assert.equal(target.props.hidden, !expanded);
    assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, expanded ? 4 : 0);
    assert.equal(nodes(tree).filter((node) => node.props?.['aria-label'] === '하위 업무 목록').length, expanded ? 1 : 0);
    assert.equal(nodes(tree).filter((node) => node.props?.['aria-label']?.endsWith('하위 업무 상세 열기')).length, expanded ? 4 : 0);
    assert.match(renderToStaticMarkup(tree), /하위 실행 업무 1\/4 완료/);
    assert.match(renderToStaticMarkup(tree), /하위 대기·막힘 1건 · 상위 접수/);
    assert.equal(find(tree, (node) => node.props?.['aria-label'] === '하위 실행 업무 완료율').props.value, 25);
  }
  assert.equal(opened, 0);
  assert.equal(edited, 0);
  assert.equal(dragged, 0);
  assert.equal(JSON.stringify(props.allItems), original);
});

test('각 상위 카드의 접힘은 독립적이며 서로 다른 목록 ID를 사용한다', () => {
  const items = [
    ...mixed(),
    task('다른 상위', 'open', { childWorkItemIds: ['다른 하위'] }),
    task('다른 하위', 'open', { parentWorkItemId: '다른 상위' }),
  ];
  const props = setup({ items, allItems: items });
  let tree = render(props);
  assert.notEqual(toggleOf(tree).props['aria-controls'], toggleOf(tree, '다른 상위').props['aria-controls']);
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
  assert.equal(toggleOf(tree, '다른 상위').props['aria-expanded'], false);
  toggleOf(tree).props.onClick();
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(toggleOf(tree, '다른 상위').props['aria-expanded'], false);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).map((node) => node.props['data-board-task']).join(','), '초안,단가,사양,발송');
  toggleOf(tree, '다른 상위').props.onClick();
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(toggleOf(tree, '다른 상위').props['aria-expanded'], true);
  toggleOf(tree).props.onClick();
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
  assert.equal(toggleOf(tree, '다른 상위').props['aria-expanded'], true);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).map((node) => node.props['data-board-task']).join(','), '다른 하위');
});

test('동일 업무를 표시하는 두 보드 인스턴스도 useId 목록 네임스페이스가 충돌하지 않는다', () => {
  const props = setup();
  cursor = 0;
  const firstTree = WorkBoard(props);
  const secondTree = WorkBoard(props);
  assert.notEqual(toggleOf(firstTree).props['aria-controls'], toggleOf(secondTree).props['aria-controls']);
  assert.equal(toggleOf(firstTree).props['aria-expanded'], false);
  assert.equal(toggleOf(secondTree).props['aria-expanded'], false);
  toggleOf(firstTree).props.onClick();
  cursor = 0;
  const firstUpdated = WorkBoard(props);
  const secondUpdated = WorkBoard(props);
  assert.equal(toggleOf(firstUpdated).props['aria-expanded'], true);
  assert.equal(toggleOf(secondUpdated).props['aria-expanded'], false);
});

test('실시간으로 추가된 새 카드는 접힌 채 나타나고 기존 카드의 수동 펼침만 유지한다', () => {
  const props = setup();
  let tree = renderExpanded(props);
  const items = [
    ...props.allItems.map((item) => ({ ...item, updatedAt: 20 })),
    task('새 상위', 'in_progress', { childWorkItemIds: ['새 하위'] }),
    task('새 하위', 'waiting', { parentWorkItemId: '새 상위' }),
  ];
  tree = render({ ...props, items, allItems: items });
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(toggleOf(tree, '새 상위').props['aria-expanded'], false);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 4);
  assert.equal(nodes(tree).some((node) => node.props?.['data-board-task'] === '새 하위'), false);
  const newCard = find(tree, (node) => node.props?.['data-board-root'] === '새 상위');
  assert.match(renderToStaticMarkup(newCard), /하위 대기·막힘 1건 · 상위 처리 중/);
  assert.match(renderToStaticMarkup(newCard), /새 하위/);
  toggleOf(tree, '새 상위').props.onClick();
  tree = render({ ...props, items, allItems: items });
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(toggleOf(tree, '새 상위').props['aria-expanded'], true);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 5);
});

test('검색에 처음 나타난 카드도 자동으로 펼치지 않는다', () => {
  const props = setup();
  let tree = render({ ...props, searching: true, items: [] });
  assert.equal(nodes(tree).some((node) => node.props?.['data-board-root']), false);
  tree = render({ ...props, searching: true, items: [props.allItems[3]] });
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
  assert.equal(nodes(tree).some((node) => node.props?.['data-board-task']), false);
  assert.match(renderToStaticMarkup(tree), /검색 일치 하위 업무 1건/);
  assert.match(renderToStaticMarkup(tree), /하위 대기·막힘 1건 · 상위 접수/);
});

test('보드를 새로 마운트하면 이전 세션에서 펼친 카드도 다시 기본 접힘으로 시작한다', () => {
  const props = setup();
  const opened = renderExpanded(props);
  assert.equal(toggleOf(opened).props['aria-expanded'], true);
  const previousId = toggleOf(opened).props['aria-controls'];
  const remounted = render(setup(props));
  assert.equal(toggleOf(remounted).props['aria-expanded'], false);
  assert.notEqual(toggleOf(remounted).props['aria-controls'], previousId);
  assert.equal(nodes(remounted).filter((node) => node.props?.['data-board-task']).length, 0);
  assert.match(renderToStaticMarkup(remounted), /하위 실행 업무 1\/4 완료/);
  assert.match(renderToStaticMarkup(remounted), /하위 대기·막힘 1건 · 상위 접수/);
});

test('실시간 갱신과 다른 열 이동에도 사용자가 선택한 펼침·접힘을 유지한다', () => {
  const props = setup();
  let tree = render(props);
  toggleOf(tree).props.onClick();
  const items = props.allItems.map((item) => ({ ...item, status: 'completed', openChildCount: 0 }));
  tree = render({ ...props, items, allItems: items });
  let column = find(tree, (node) => node.props?.['aria-label'] === '완료 열');
  assert.equal(toggleOf(column).props['aria-expanded'], true);
  assert.equal(nodes(column).filter((node) => node.props?.['data-board-task']).length, 4);
  assert.match(renderToStaticMarkup(column), /하위 실행 업무 4\/4 완료/);
  toggleOf(tree).props.onClick();
  tree = render(props);
  column = find(tree, (node) => node.props?.['aria-label'] === '대기·막힘 열');
  assert.equal(toggleOf(column).props['aria-expanded'], false);
  assert.equal(nodes(column).filter((node) => node.props?.['data-board-task']).length, 0);
  assert.match(renderToStaticMarkup(column), /하위 실행 업무 1\/4 완료/);
});

test('검색 필터로 카드가 사라졌다 다시 나타나도 펼침과 재접기 선택을 보존한다', () => {
  const props = setup();
  let tree = render(props);
  toggleOf(tree).props.onClick();
  tree = render({ ...props, searching: true, items: [] });
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-root']).length, 0);
  tree = render({ ...props, searching: true, items: [props.allItems[3]] });
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 4);
  assert.match(renderToStaticMarkup(tree), /검색 일치 하위 업무 1건/);
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  toggleOf(tree).props.onClick();
  render({ ...props, searching: true, items: [] });
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], false);
});

test('접힌 상태에서도 막힌 하위 이름 두 개와 나머지 건수·전체 이름을 확인할 수 있다', () => {
  const children = ['막힘A', '막힘B', '막힘C', '막힘D'].map((id) => task(id, 'waiting', { parentWorkItemId: '상위' }));
  const items = [task('상위', 'in_progress', { childWorkItemIds: children.map((child) => child.id) }), ...children];
  const props = setup({ items, allItems: items });
  const tree = render(props);
  const summary = find(tree, (node) => node.props?.['data-board-waiting'] === '상위');
  const names = find(summary, (node) => node.props?.['data-board-blocker-names'] !== undefined);
  const text = visibleText(names);
  assert.match(text, /막힘A/);
  assert.match(text, /막힘B/);
  assert.match(text, /외 2개/);
  assert.doesNotMatch(text, /막힘C|막힘D/);
  for (const child of children) assert.ok(names.props.title.includes(child.title));
  assert.match(renderToStaticMarkup(summary), /하위 대기·막힘 4건 · 상위 처리 중/);
  assert.equal(nodes(tree).filter((node) => node.props?.['data-board-task']).length, 0);
});

test('저장 중에도 하위 조회 토글은 가능하지만 제목 이동·편집·상위 드래그를 실행하지 않는다', () => {
  let opened = 0, edited = 0, started = 0, prevented = 0;
  const props = setup({ busy: true, onOpen: () => opened++, onEdit: () => edited++, onDragStart: () => started++ });
  let tree = render(props);
  let toggle = toggleOf(tree);
  assert.notEqual(toggle.props.disabled, true);
  assert.equal(toggle.props['data-work-title'], undefined);
  toggle.props.onClick();
  tree = render(props);
  assert.equal(toggleOf(tree).props['aria-expanded'], true);
  assert.equal(find(tree, (node) => node.props?.['data-work-title']).props.disabled, true);
  const card = find(tree, (node) => node.props?.['data-board-root']);
  assert.equal(card.props.draggable, false);
  toggle = toggleOf(tree);
  card.props.onDragStart({
    target: { closest: (selector) => selector === '[data-work-title]' ? undefined : toggle },
    preventDefault: () => prevented++,
  });
  assert.equal(prevented, 1);
  assert.equal(started, 0);
  assert.equal(opened, 0);
  assert.equal(edited, 0);
});

test('하위 제목은 해당 업무 팝업만 열며 읽기 전용에서도 조회를 허용하고 편집은 호출하지 않는다', () => {
  const opened = [], edited = [];
  const props = setup({
    canEdit: () => false,
    onOpen: (item, occurredAt) => opened.push([item.id, occurredAt]),
    onEdit: (item) => edited.push(item.id),
  });
  const original = JSON.stringify(props.allItems);
  const tree = renderExpanded(props);
  const child = find(tree, (node) => node.props?.['aria-label'] === '사양 하위 업무 상세 열기');
  assert.equal(child.type, 'button');
  assert.equal(child.props['aria-haspopup'], 'dialog');
  assert.equal(child.props.disabled, false);
  assert.equal(child.props['data-work-title'], undefined);
  child.props.onClick();
  assert.equal(opened.length, 1);
  assert.equal(opened[0][0], '사양');
  assert.equal(typeof opened[0][1], 'number');
  assert.equal(edited.length, 0);
  assert.equal(JSON.stringify(props.allItems), original);
});

test('저장 중에는 모든 하위 팝업 버튼을 비활성화하며 자식 버튼 드래그는 상위 이동으로 이어지지 않는다', () => {
  let starts = 0, prevented = 0;
  const props = setup({ onDragStart: () => starts++ });
  const busyTree = renderExpanded({ ...props, busy: true });
  const busyChildren = nodes(busyTree).filter((node) => node.props?.['data-board-task']);
  assert.equal(busyChildren.length, 4);
  for (const row of busyChildren) {
    const title = find(row, (node) => node.type === 'button');
    assert.equal(title.props.disabled, true);
  }
  const tree = render(props);
  const childButton = find(tree, (node) => node.props?.['aria-label'] === '사양 하위 업무 상세 열기');
  assert.equal(childButton.props['data-work-title'], undefined);
  const card = find(tree, (node) => node.props?.['data-board-root']);
  card.props.onDragStart({
    target: {
      closest: (selector) => selector === '[data-work-title]'
        ? childButton.props['data-work-title']
        : childButton,
    },
    preventDefault: () => prevented++,
  });
  assert.equal(starts, 0);
  assert.equal(prevented, 1);
});

test('하위 목록이 길어도 숨기거나 잘라내지 않고 높이 제한 안에서 모두 스크롤 조회한다', () => {
  const children = Array.from({ length: 48 }, (_, index) => task('하위-' + index, index === 47 ? 'waiting' : 'open', {
    parentWorkItemId: '상위',
    blockedReason: index === 47 ? '마지막 업무 막힘' : '',
  }));
  const items = [task('상위', 'in_progress', { childWorkItemIds: children.map((child) => child.id) }), ...children];
  const tree = renderExpanded(setup({ items, allItems: items }), '상위');
  const list = find(tree, (node) => node.props?.['aria-label'] === '하위 업무 목록');
  assert.match(list.props.className, /max-h-64/);
  assert.match(list.props.className, /overflow-y-auto/);
  const rows = nodes(list).filter((node) => node.props?.['data-board-task']);
  assert.equal(rows.length, 48);
  assert.equal(new Set(rows.map((row) => row.props['data-board-task'])).size, 48);
  assert.equal(rows[0].props['data-board-task'], '하위-0');
  assert.equal(rows[47].props['data-board-task'], '하위-47');
  assert.match(renderToStaticMarkup(tree), /하위 업무 48개/);
  assert.match(renderToStaticMarkup(list), /마지막 업무 막힘/);
  assert.match(renderToStaticMarkup(list), /하위-0/);
  assert.match(renderToStaticMarkup(list), /하위-46/);
});

test('누락 연결이 있더라도 존재하는 하위 업무는 보여주고 누락된 업무를 허구 행으로 만들지 않는다', () => {
  const items = [
    task('상위', 'open', { childWorkItemIds: ['누락', '실제 하위'] }),
    task('실제 하위', 'waiting', { parentWorkItemId: '상위', blockedReason: '실제 막힘 사유' }),
  ];
  const tree = renderExpanded(setup({ items, allItems: items }), '상위');
  const rows = nodes(tree).filter((node) => node.props?.['data-board-task']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].props['data-board-task'], '실제 하위');
  assert.match(renderToStaticMarkup(tree), /업무 연결 확인 필요/);
  assert.match(renderToStaticMarkup(rows[0]), /실제 막힘 사유/);
  assert.equal(nodes(tree).filter((node) => node.props?.['aria-label'] === '하위 실행 업무 완료율').length, 0);
});

test('저장 중 제목 상세 이동과 카드 드래그를 비활성화하고 읽기 전용 카드의 조회는 허용한다', () => {
  const props = setup();
  let tree = render({ ...props, busy: true });
  assert.equal(find(tree, (node) => node.props?.['data-work-title']).props.disabled, true);
  assert.equal(find(tree, (node) => node.props?.['data-board-root']).props.draggable, false);
  tree = render({ ...props, canEdit: () => false });
  assert.equal(find(tree, (node) => node.props?.['data-work-title']).props.disabled, false);
  assert.equal(find(tree, (node) => node.props?.['data-board-root']).props.draggable, false);
  tree = render({ ...props, savingId: '사양' });
  assert.match(find(tree, (node) => node.props?.['data-board-root']).props.className, /opacity-60/);
});

test('카드 제목·여백은 이동하며 내부 일반 버튼에서는 드래그를 시작하지 않는다', () => {
  const starts = [];
  const props = setup({ onDragStart: (item) => starts.push(item.id) });
  const card = find(render(props), (node) => node.props?.['data-board-root']);
  let prevented = 0;
  const event = (interactive, title) => ({
    target: { closest: (selector) => selector === '[data-work-title]' ? title : interactive },
    preventDefault: () => prevented++,
  });
  card.props.onDragStart(event(true, true));
  card.props.onDragStart(event(false, false));
  card.props.onDragStart(event(true, false));
  assert.equal(starts.length, 2);
  assert.equal(prevented, 1);
});

test('드롭 대상은 열의 상태만 전달하고 대기·완료 검증은 기존 저장 경로를 사용한다', () => {
  const dropped = [];
  const tree = render(setup({ onDrop: (status) => dropped.push(status) }));
  for (const status of types.FARM_WORK_STATUSES)
    find(tree, (node) => node.props?.['aria-label'] === types.FARM_WORK_STATUS_LABELS[status] + ' 열')
      .props.onDrop({ preventDefault() {} });
  assert.equal(dropped.join(','), types.FARM_WORK_STATUSES.join(','));
});

test('실시간 상태 변경으로 열이 바뀌어도 한 개의 요약 카드와 제목 팝업 동작을 유지한다', () => {
  const props = setup();
  const items = props.allItems.map((item) => ({ ...item, status: 'completed', openChildCount: 0 }));
  const tree = render({ ...props, items, allItems: items });
  const completeColumn = find(tree, (node) => node.props?.['aria-label'] === '완료 열');
  assert.equal(nodes(completeColumn).filter((node) => node.props?.['data-board-root']).length, 1);
  assert.match(renderToStaticMarkup(completeColumn), /하위 실행 업무 4\/4 완료/);
  assert.equal(nodes(tree).filter((node) => node.props?.onOpenChange).length, 0);
});

test('상위 카드 이동은 저장 상태를 비교하고 직접 이동·최종 확인·재개를 구분한다', () => {
  const group = buildWorkBoardGroups(mixed())[0];
  assert.equal(group.lane, 'waiting');
  group.item.status = 'open';
  assert.equal(workBoardDropIntent(group, 'open'), 'none');
  assert.equal(workBoardDropIntent(group, 'in_progress'), 'move');
  assert.equal(workBoardDropIntent(group, 'waiting'), 'move');
  assert.equal(workBoardDropIntent(group, 'completed'), 'incomplete');
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
