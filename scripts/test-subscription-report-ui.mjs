import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const types = load('../lib/farm-types.ts');
const reportLib = load('../lib/subscription-renewal-report.ts');
let states = [],
  cursor = 0,
  buttons = [];
function load(path) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const module = { exports: {} };
  const resolve = (name) => {
    if (name === 'react')
      return {
        ...React,
        useState: (initial) => {
          const index = cursor++;
          if (!(index in states))
            states[index] = typeof initial === 'function' ? initial() : initial;
          return [
            states[index],
            (next) => {
              states[index] =
                typeof next === 'function' ? next(states[index]) : next;
            },
          ];
        },
      };
    if (name === '@/lib/farm-types') return types;
    if (name === '@/lib/subscription-renewal-report') return reportLib;
    if (name === '@/components/ui/card')
      return {
        Card: ({ children }) => React.createElement('div', null, children),
        CardContent: ({ children }) =>
          React.createElement('div', null, children),
      };
    if (name === '@/components/ui/button')
      return {
        Button: ({ variant, size, ...props }) => {
          buttons.push(props);
          return React.createElement('button', props);
        },
      };
    return require(name);
  };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: resolve,
  });
  return module.exports;
}
const { SubscriptionRenewalPanel } = load(
  '../app/subscription-renewal-panel.tsx',
);
const projects = [{ id: 'p', name: '테스트 사업', projectType: 'general' }];
const records = [
  {
    id: 'r',
    farmId: 'f',
    projectId: 'p',
    currentSubscriptionExpiresAt: '2026-01-31',
  },
];
const report = reportLib.buildRenewalReport(records, [], projects, {
  year: 2026,
  today: '2026-09-07',
});
const props = {
  report,
  projects,
  records,
  farms: [{ id: 'f', name: '월별 테스트 농가' }],
  onOpenRecord() {},
  onRegister() {},
};
function render() {
  cursor = 0;
  buttons = [];
  return renderToStaticMarkup(
    React.createElement(SubscriptionRenewalPanel, props),
  );
}
test('월별 표는 8열이고 26년 총계가 첫 행, 삭제한 두 열은 없다', () => {
  states = [];
  const html = render();
  const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
  const head = table.slice(table.indexOf('<thead'), table.indexOf('</thead>'));
  assert.equal((head.match(/scope="col"/g) ?? []).length, 8);
  assert.ok(!head.includes('기록 확인'));
  assert.ok(!head.includes('오늘 만료'));
  const body = table.slice(table.indexOf('<tbody>'));
  assert.ok(body.indexOf('26년 총계') < body.indexOf('2026년 1월'));
  assert.ok(!table.includes('<tfoot'));
  assert.ok(!table.includes('월별 테스트 농가'));
});
test('농가 보기 클릭은 해당 월 바로 아래 펼치고 농가 접기는 원상 복귀', () => {
  states = [];
  render();
  buttons
    .find((button) => button.children === '농가 보기' && !button.disabled)
    .onClick();
  let html = render();
  const january = html.indexOf('2026년 1월</th>');
  const farm = html.indexOf('월별 테스트 농가');
  const february = html.indexOf('2026년 2월</th>');
  assert.ok(january < farm && farm < february);
  assert.ok(html.includes('colSpan="8"'));
  assert.ok(html.includes('aria-expanded="true"'));
  buttons.find((button) => button.children === '농가 접기').onClick();
  html = render();
  assert.ok(!html.includes('월별 테스트 농가'));
  assert.ok(!html.includes('aria-expanded="true"'));
});
