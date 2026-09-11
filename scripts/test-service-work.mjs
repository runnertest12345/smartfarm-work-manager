import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = (path) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, mocked = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(js, {
    module,
    exports: module.exports,
    require: (name) => mocked[name] ?? require(name),
    Intl,
    Date,
    Set,
    Map,
  });
  return module.exports;
}
const dates = load('lib/service-work.ts');
const date = (value) => Date.parse(value);
const current = date('2026-09-11T00:00:00+09:00');
const previous = date('2025-09-11T00:00:00+09:00');

test('접수일은 최초 저장 이력의 발생일이며 후속 과거 이력이 바꾸지 않는다', () => {
  const entries = [
    { createdAt: current + 1, occurredAt: date('2024-01-01') },
    { createdAt: current, occurredAt: previous },
  ];
  assert.equal(
    dates.serviceReceivedAt({ createdAt: current }, entries),
    previous,
  );
  assert.equal(entries[0].createdAt, current + 1, '원본 이력 정렬 변경 없음');
});
test('최초 저장시각이 같으면 유효한 이른 발생일을 사용한다', () => {
  assert.equal(
    dates.serviceReceivedAt({ createdAt: current }, [
      { createdAt: current, occurredAt: current },
      { createdAt: current, occurredAt: previous },
      { createdAt: current, occurredAt: NaN },
    ]),
    previous,
  );
});
test('이력 없음·잘못된 최초 발생일은 업무 생성일, 잘못된 생성일은 미지정', () => {
  assert.equal(dates.serviceReceivedAt({ createdAt: previous }, []), previous);
  assert.equal(
    dates.serviceReceivedAt({ createdAt: current }, [
      { createdAt: current, occurredAt: 0 },
      { createdAt: current + 1, occurredAt: previous },
    ]),
    current,
  );
  for (const invalid of [0, -1, NaN, Infinity, 1e20]) {
    assert.equal(dates.serviceReceivedAt({ createdAt: invalid }, []), 0);
    assert.equal(dates.serviceYear(invalid), 'unknown');
    assert.equal(dates.serviceDateLabel(invalid), '접수일 미지정');
  }
});
test('연도와 표시 날짜 모두 한국 시간의 연말 경계를 적용한다', () => {
  assert.equal(dates.serviceYear(date('2025-12-31T15:00:00Z')), '2026');
  assert.match(
    dates.serviceDateLabel(date('2025-12-31T15:00:00Z')),
    /2026.*01.*01/,
  );
  assert.equal(dates.serviceYear(date('2025-12-31T14:59:59Z')), '2025');
});
test('선택지는 현재 연도 포함·내림차순·미지정 분리', () => {
  assert.equal(
    dates.serviceYearOptions([previous, previous, 0], '2026').join(','),
    '2026,2025,unknown',
  );
});

function primitive(tag) {
  return ({ children, ...props }) => {
    const clean = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          !['onValueChange', 'onOpenChange', 'variant', 'size'].includes(key),
      ),
    );
    return React.createElement(tag, clean, children);
  };
}
function harness() {
  const state = [];
  let cursor = 0;
  const ui = {};
  for (const [file, tags] of Object.entries({
    badge: { Badge: 'span' },
    button: { Button: 'button' },
    input: { Input: 'input' },
    dialog: {
      Dialog: 'div',
      DialogContent: 'div',
      DialogHeader: 'div',
      DialogTitle: 'h2',
      DialogDescription: 'p',
      DialogFooter: 'div',
    },
    select: {
      Select: 'div',
      SelectContent: 'div',
      SelectItem: 'span',
      SelectTrigger: 'button',
      SelectValue: 'span',
    },
    table: {
      Table: 'table',
      TableBody: 'tbody',
      TableCell: 'td',
      TableHead: 'th',
      TableHeader: 'thead',
      TableRow: 'tr',
    },
  }))
    ui['@/components/ui/' + file] = Object.fromEntries(
      Object.entries(tags).map(([name, tag]) => [name, primitive(tag)]),
    );
  const { ServiceWorkPanel } = load('app/service-work-panel.tsx', {
    ...ui,
    '@/lib/service-work': dates,
    'lucide-react': {
      Plus: primitive('i'),
      ChevronDown: primitive('i'),
      ChevronRight: primitive('i'),
    },
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in state))
          state[index] = typeof initial === 'function' ? initial() : initial;
        return [
          state[index],
          (next) => {
            state[index] =
              typeof next === 'function' ? next(state[index]) : next;
          },
        ];
      },
    },
  });
  const opened = [],
    registered = [];
  const makeRow = (id, receivedAt) => ({
    id,
    receivedAt,
    title: '업무' + id,
    farmName: '농가' + id,
    projectName: '프로젝트' + id,
    owner: '담당자',
    statusLabel: '완료',
    statusClass: '',
    receivedContent: '받은 내용' + id,
    actionContent: '처리 내용' + id,
  });
  const props = {
    rows: [
      makeRow('현재', current),
      makeRow('과거', previous),
      makeRow('미지정', 0),
    ],
    currentYear: '2026',
    registrationOptions: [
      {
        farmId: 'f1',
        farmLabel: '농가1 · 1',
        recordId: 'r1',
        projectLabel: '프로젝트1',
      },
      {
        farmId: 'f1',
        farmLabel: '농가1 · 1',
        recordId: 'r2',
        projectLabel: '프로젝트2',
      },
      {
        farmId: 'f2',
        farmLabel: '농가2 · 2',
        recordId: 'r3',
        projectLabel: '프로젝트3',
      },
    ],
    onOpen: (id) => opened.push(id),
    onRegister: (id) => registered.push(id),
    onRegistrationOpenChange: (open) => {
      props.registrationOpen = open;
    },
  };
  const render = () => {
    cursor = 0;
    return ServiceWorkPanel(props);
  };
  const renderDialog = (element) => {
    cursor = 3;
    return element.type(element.props);
  };
  return { props, state, render, renderDialog, opened, registered };
}
function nodes(tree) {
  const found = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!React.isValidElement(node)) return;
    found.push(node);
    visit(node.props.children);
  }
  visit(tree);
  return found;
}
const find = (tree, predicate) => {
  const node = nodes(tree).find(predicate);
  assert.ok(node, '대상 컨트롤 존재');
  return node;
};
const text = (node) => renderToStaticMarkup(node);
const yearSelect = (tree) =>
  find(tree, (n) => n.props.value && n.props.onValueChange);

test('기본 현재 연도만 표시하고 상세는 접힌 작은 표로 표시한다', () => {
  const h = harness();
  const html = text(h.render());
  assert.match(html, /<table/);
  assert.match(html, /농가현재/);
  assert.match(html, /프로젝트현재/);
  assert.doesNotMatch(html, /업무과거|업무미지정|받은 내용현재/);
  assert.match(html, /aria-expanded="false"/);
});
test('연도 선택·전체·미지정 필터와 빈 현재 연도 안내', () => {
  const h = harness();
  yearSelect(h.render()).props.onValueChange('2025');
  assert.match(text(h.render()), /업무과거/);
  assert.doesNotMatch(text(h.render()), /업무현재/);
  yearSelect(h.render()).props.onValueChange('unknown');
  assert.match(text(h.render()), /업무미지정/);
  yearSelect(h.render()).props.onValueChange('all');
  assert.match(text(h.render()), /업무현재[\s\S]*업무과거[\s\S]*업무미지정/);
  yearSelect(h.render()).props.onValueChange('2026');
  h.props.rows = h.props.rows.filter((row) => row.id !== '현재');
  assert.match(text(h.render()), /2026년에 접수된 A\/S 업무가 없습니다/);
});
test('상세 펼치기·접기와 제목 열기가 정확한 업무로 연결된다', () => {
  const h = harness();
  find(h.render(), (n) => n.props['aria-expanded'] === false).props.onClick();
  assert.match(text(h.render()), /받은 내용현재/);
  find(h.render(), (n) => n.props.title === '업무현재').props.onClick();
  assert.deepEqual(h.opened, ['현재']);
  find(h.render(), (n) => n.props['aria-expanded'] === true).props.onClick();
  assert.doesNotMatch(text(h.render()), /받은 내용현재/);
});
test('A/S 등록은 농가와 사업을 명시 선택하며 농가 변경 시 사업 선택을 지운다', () => {
  const h = harness();
  find(
    h.render(),
    (n) => n.props.onClick && text(n).includes('A/S 등록'),
  ).props.onClick();
  const dialog = find(
    h.render(),
    (n) => n.type.name === 'ServiceRegistrationDialog',
  );
  assert.equal(
    h.props.registrationOpen,
    true,
    '선택창을 열면 이동 방지 활성화',
  );
  const render = () => h.renderDialog(dialog);
  const selectors = () => nodes(render()).filter((n) => n.props.onValueChange);
  const submit = () =>
    find(render(), (n) => n.props.children === 'A/S 내용 작성');
  assert.equal(submit().props.disabled, true);
  selectors()[0].props.onValueChange('f1');
  assert.equal(submit().props.disabled, true);
  selectors()[1].props.onValueChange('r2');
  assert.equal(submit().props.disabled, false);
  selectors()[0].props.onValueChange('f2');
  assert.equal(submit().props.disabled, true);
  selectors()[1].props.onValueChange('r3');
  submit().props.onClick();
  assert.deepEqual(h.registered, ['r3']);
  assert.equal(h.state[2], false);
  assert.equal(
    h.props.registrationOpen,
    false,
    '입력창으로 전환하기 전에 선택창 이동 방지 해제',
  );
});
test('대시보드는 기존 A/S 조회·등록·상세 연결과 원본 로고를 사용한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(
    dashboard,
    /isActiveWork\(workItem\) && workItem.workType === 'service'/,
  );
  assert.match(dashboard, /openQuickWorkItem\(record, 'service', ''\)/);
  assert.match(dashboard, /if \(item\) openFarm\(item.farmId, item.id\)/);
  assert.match(dashboard, /project.status === 'completed'/);
  const guard = dashboard.slice(
    dashboard.indexOf('function canGoBackDetail()'),
    dashboard.indexOf('function restoreDetailNavigation('),
  );
  assert.match(guard, /serviceRegistrationOpenRef.current/);
  const brand = dashboard.slice(
    dashboard.indexOf('<aside '),
    dashboard.indexOf('<nav '),
  );
  assert.match(brand, /farmos-ci.png/);
  assert.match(brand, /bg-white/);
  assert.match(brand, /팜로그/);
  assert.match(brand, /파모스 업무관리 프로그램/);
  assert.doesNotMatch(brand, /<Leaf/);
  const header = dashboard.slice(
    dashboard.indexOf('<header '),
    dashboard.indexOf('</header>'),
  );
  assert.match(header, /farmos-ci.png/);
});
