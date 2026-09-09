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
const dashboard = source('app/farm-ledger-dashboard.tsx');
const ast = ts.createSourceFile(
  'dashboard.tsx',
  dashboard,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function findNode(predicate) {
  let match;
  function visit(node) {
    if (predicate(node)) match = node;
    else ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(match);
  return match;
}
function selected(name, globals) {
  const node = findNode(
    (n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === name,
  );
  return vm.runInNewContext(node.initializer.getText(ast), globals);
}

test('공통 고정 헤더에는 생성 버튼이 없고 각 관리 화면에는 남는다', () => {
  const header = dashboard.slice(
    dashboard.indexOf('<header '),
    dashboard.indexOf('</header>'),
  );
  assert.doesNotMatch(
    header,
    /openFarmDialog|openProjectDialog|농가 등록|사업 추가/,
  );
  assert.match(header, /loadWorkspace\(true\)/);
  assert.match(dashboard, /onClick=\{openFarmDialog\}[\s\S]{0,500}농가 등록/);
  assert.match(
    dashboard,
    /onClick=\{openProjectDialog\}[\s\S]{0,500}프로젝트 추가/,
  );
});

test('농가 참여 정보가 A/S·처리 이력·입금내역 탭보다 위에 나온다', () => {
  const farm = dashboard.slice(
    dashboard.indexOf('{selectedFarm && ('),
    dashboard.indexOf('{projectDeletionTarget && ('),
  );
  const participation = farm.indexOf(
    'aria-label="농가 참여 사업·설치·구독 정보"',
  );
  const tabs = farm.indexOf('aria-label="농가 상세 항목"');
  assert.ok(participation >= 0 && participation < tabs);
  assert.match(farm, /value="work">\s*A\/S/);
  assert.match(farm, /value="payments">\s*입금내역/);
  assert.doesNotMatch(
    farm,
    /TabsTrigger value="info"|TabsContent value="info"/,
  );
  assert.match(farm, /farmDetailTab === 'info'\s*\? 'work'/);
});

test('A/S 목록은 서비스만 선택하며 일반 업무·입금 이력은 삭제하지 않는다', () => {
  const selectedWorkItems = [
    'service',
    'communication',
    'payment',
    'installation',
  ].map((workType, i) => ({ id: `w${i}`, workType }));
  assert.equal(
    selected('selectedServiceItems', { selectedWorkItems })
      .map((w) => w.id)
      .join(','),
    'w0',
  );
  const historiesByWorkItem = new Map(
    selectedWorkItems.map((work, i) => [
      work.id,
      [{ id: `h${i}`, occurredAt: i, createdAt: i }],
    ]),
  );
  const all = selected('selectedFarmHistory', {
    selectedFarm: { id: 'farm1' },
    selectedWorkItems,
    historiesByWorkItem,
  });
  assert.equal(all.map(({ workItem }) => workItem.id).join(','), 'w3,w2,w1,w0');
  assert.equal(selectedWorkItems.length, 4);
});

test('입금내역은 선택 농가·사업의 실제 양수 입금만 최신 순서대로 보존한다', () => {
  const rows = [
    ['payment', 66000],
    ['service', 66000],
    ['payment', 0],
    ['payment', -66000],
    ['payment', 132000],
  ].map(([workType, amount], i) => ({
    workItem: { id: `w${i}`, workType },
    entry: { id: `h${i}`, amount },
  }));
  const result = selected('selectedFarmPayments', {
    selectedFarmHistory: rows,
  });
  assert.equal(result.map(({ entry }) => entry.id).join(','), 'h0,h4');
  assert.match(
    dashboard,
    /selectedRecords\.some\(\(record\) => record.id === item.farmRecordId\)/,
  );
  assert.match(
    dashboard,
    /key=\{`\$\{selectedFarm.id\}-\$\{farmContextProjectId\}`\}/,
  );
});

test('농가의 A/S 및 입금 등록은 안전한 사업 선택과 기존 저장 검증을 재사용한다', () => {
  const node = findNode(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'openWorkItemDialog',
  );
  let form, dialog;
  const context = {
    selectedFarm: { id: 'f' },
    selectedRecords: [{ id: 'r1' }, { id: 'r2' }],
    setDraftImages() {},
    setWorkItemForm(value) {
      form = value;
    },
    setClarifyingInboxId() {},
    setFormError() {},
    setDialog(value) {
      dialog = value;
    },
    emptyWorkItemForm: (farmRecordId) => ({ farmRecordId, amount: 0 }),
    WORK_CHECKLIST_TEMPLATES: { service: ['점검'] },
    localDateString: () => '2026-09-09',
  };
  const code = ts.transpileModule(node.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code + "\nopenWorkItemDialog('', 'service');", context);
  assert.equal(form.workType, 'service');
  assert.equal(form.farmRecordId, '');
  assert.equal(form.checklistText, '점검');
  assert.equal(dialog, 'work_item');
  vm.runInNewContext(code + "\nopenWorkItemDialog('r2', 'payment');", context);
  assert.equal(form.farmRecordId, 'r2');
  assert.equal(form.workType, 'payment');
  assert.equal(form.title, '구독료 입금');
  assert.match(
    dashboard,
    /onAdd=\{\(\) => openWorkItemDialog\('', 'payment'\)\}/,
  );
  const submit = findNode(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'submitWorkItem',
  ).getText(ast);
  assert.match(submit, /paymentRequest: preparePaymentRequest/);
});

let page = 0;
const tag = (name) =>
  function Primitive({ children, variant, size, ...props }) {
    return React.createElement(name, props, children);
  };
const Button = tag('button');
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source('app/farm-payment-history.tsx'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  {
    module,
    exports: module.exports,
    require: (name) =>
      ({
        react: {
          ...React,
          useState: () => [
            page,
            (next) => {
              page = next;
            },
          ],
        },
        '@/components/ui/button': { Button },
        '@/components/ui/table': Object.fromEntries(
          Object.entries({
            Table: 'table',
            TableHeader: 'thead',
            TableBody: 'tbody',
            TableRow: 'tr',
            TableHead: 'th',
            TableCell: 'td',
          }).map(([key, value]) => [key, tag(value)]),
        ),
      })[name] || require(name),
  },
);
const { FarmPaymentHistory } = module.exports;
const payments = Array.from({ length: 21 }, (_, i) => ({
  workItem: { id: `w${i}` },
  entry: {
    id: `h${i}`,
    amount: 66000,
    occurredAt: new Date('2026-09-09T03:00:00Z').getTime(),
    actionContent: `입금내용-${i}`,
    receivedContent: '',
  },
}));
function render(props = {}) {
  return FarmPaymentHistory({
    payments,
    projectLabel: (item) => `사업-${item.id}`,
    onAdd() {},
    onOpen() {},
    disabled: false,
    ...props,
  });
}
function buttons(tree) {
  const result = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === Button) result.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  return result;
}
test('입금 표는 20건씩 표시하고 합계는 전체 입금으로 유지한다', () => {
  page = 0;
  let tree = render();
  const first = renderToStaticMarkup(tree);
  assert.equal(
    buttons(tree).filter((b) => b.props.children === '입금 상세').length,
    20,
  );
  assert.match(first, /1,386,000원/);
  assert.doesNotMatch(first, /입금내용-20/);
  buttons(tree)
    .find((b) => b.props.children === '다음')
    .props.onClick();
  tree = render();
  assert.equal(
    buttons(tree).filter((b) => b.props.children === '입금 상세').length,
    1,
  );
  assert.match(renderToStaticMarkup(tree), /입금내용-20/);
  assert.match(renderToStaticMarkup(tree), /1,386,000원/);
  assert.equal(
    buttons(tree).find((b) => b.props.children === '다음').props.disabled,
    true,
  );
  buttons(tree)
    .find((b) => b.props.children === '이전')
    .props.onClick();
  assert.equal(page, 0);
});
test('입금 등록·상세는 연결된 동작을 호출하며 읽기 전용 버튼을 지킨다', () => {
  page = 0;
  let added = 0,
    opened;
  const tree = render({
    onAdd: () => added++,
    onOpen: (item) => {
      opened = item.id;
    },
  });
  buttons(tree)
    .find((b) => b.props.children === '입금 등록')
    .props.onClick();
  buttons(tree)
    .find((b) => b.props.children === '입금 상세')
    .props.onClick();
  assert.equal(added, 1);
  assert.equal(opened, 'w0');
  assert.equal(
    buttons(render({ disabled: true })).find(
      (b) => b.props.children === '입금 등록',
    ).props.disabled,
    true,
  );
});
test('빈 입금내역과 실시간 목록 감소에도 유효한 페이지를 보여준다', () => {
  page = 9;
  assert.match(
    renderToStaticMarkup(render({ payments: payments.slice(0, 1) })),
    /입금내용-0/,
  );
  const empty = renderToStaticMarkup(render({ payments: [] }));
  assert.match(empty, /등록된 입금내역이 없습니다/);
  assert.match(empty, /총 0원/);
  assert.doesNotMatch(empty, />이전<|>다음</);
});
