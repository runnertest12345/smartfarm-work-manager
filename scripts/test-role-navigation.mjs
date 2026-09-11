import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL('../app/farm-ledger-dashboard.tsx', import.meta.url),
  'utf8',
);
const ast = ts.createSourceFile(
  'dashboard.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let navInitializer;
let sidebar;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'navItems')
    navInitializer = node.initializer.getText(ast);
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(ast) === 'nav' &&
    node.openingElement.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(ast) === 'aria-label' &&
        attribute.initializer?.text === '주요 메뉴',
    )
  )
    sidebar = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(
  navInitializer && sidebar,
  'Test the actual role menu and sidebar JSX',
);

function evaluate(sourceText, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require,
    ...context,
  });
  return module.exports;
}
const roles = evaluate(
  readFileSync(new URL('../lib/organization.ts', import.meta.url), 'utf8'),
);
const workspaceId = 'navigation-test-only';
const employee = {
  id: 'fixture-employee',
  displayName: '일반 직원',
  email: 'employee@example.test',
  active: true,
  admin: false,
  workspaceId,
  departmentId: 'fixture-department',
  passwordChangeRequired: false,
  jobTitle: '직원',
};
const labels = [
  '통합 현황',
  '프로젝트 관리',
  '업무 현황',
  '농가 관리대장',
  '구독·입금',
  'A/S 업무',
  '사업 집계',
  '데이터 점검',
];

for (const [name, member, hasManagement] of [
  ['관리자', { ...employee, id: 'fixture-admin', admin: true }, true],
  ['일반 직원 · 비밀번호 변경 완료', employee, false],
  ['부서장 · 관리자 권한 없음', { ...employee, id: 'fixture-head' }, false],
  [
    '공용 계정',
    { ...employee, email: roles.SHARED_ACCESS_EMAIL, admin: true },
    false,
  ],
  ['다른 작업공간', { ...employee, workspaceId: 'other', admin: true }, false],
  ['회원 정보 없음', null, false],
]) {
  test(`${name}: 허용된 메뉴만 순서대로 렌더하고 중단되지 않는다`, () => {
    const context = {
      organization: { admin: roles.isOrganizationAdmin(member, workspaceId) },
      member,
      canRegisterMembers: roles.canRegisterMembers || (() => false),
      openWorkItems: 123,
      workspace: { farms: Array(295).fill({}) },
      activeProjects: Array(37).fill({}),
      expiredSubscriptions: 16,
      openServices: 12,
      qualityIssues: Array(22).fill({}),
      view: 'overview',
      changeView() {},
    };
    for (const icon of [
      'Users',
      'Leaf',
      'ClipboardList',
      'Warehouse',
      'BriefcaseBusiness',
      'BarChart3',
      'CreditCard',
      'Wrench',
      'ShieldCheck',
    ])
      context[icon] = () => null;
    const { Sidebar } = evaluate(
      `export function Sidebar() { const navItems = ${navInitializer}; return (${sidebar}); }`,
      context,
    );
    const html = renderToStaticMarkup(React.createElement(Sidebar));
    const actual = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(
      actual,
      hasManagement ? [...labels, '직원·부서 관리'] : labels,
    );
    assert.equal(new Set(actual).size, actual.length);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.equal(html.includes('직원·부서 관리'), hasManagement);
    assert.doesNotMatch(html, /전체 건수|>\d+</);
  });
}
