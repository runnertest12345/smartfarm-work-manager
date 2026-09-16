import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const evaluatedModule = { exports: {} };
const Button = ({ size: _size, variant: _variant, ...props }) => React.createElement('button', props);
vm.runInNewContext(ts.transpileModule(source('app/project-detail-actions.tsx'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: evaluatedModule, exports: evaluatedModule.exports,
  require: (name) => name === '@/components/ui/button' ? { Button } : require(name),
});
const { ProjectDetailActions } = evaluatedModule.exports;
const defaults = {
  project: { id: 'project', status: 'active' }, canAddTask: true,
  onAddTask() {}, onRecord() {}, onDocument() {}, onDelete() {},
};
function tree(overrides = {}) { return ProjectDetailActions({ ...defaults, ...overrides }); }
function nodes(element) {
  return !element || typeof element !== 'object' ? [] : [element,
    ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
function buttons(overrides = {}) { return nodes(tree(overrides)).filter((node) => node.type === Button); }

test('네 작업을 메뉴 없이 직접 표시하며 전체 정보 수정 진입점을 중복하지 않는다', () => {
  const view = tree();
  const html = renderToStaticMarkup(view);
  assert.equal(buttons().length, 4);
  for (const label of ['업무 추가', '기록 추가', '제출서류 추가', '프로젝트 삭제']) assert.ok(html.includes(label));
  assert.match(html, /aria-label="프로젝트 작업"/);
  assert.match(view.props.className, /flex-wrap/);
  assert.doesNotMatch(html, /전체 정보|정산 수정|더보기|role="menu"|aria-haspopup/);
  assert.ok(buttons().every((button) => button.props.type === 'button'));
});

test('각 버튼은 해당 동작만 한 번 호출한다', () => {
  const events = [];
  const names = ['onAddTask', 'onRecord', 'onDocument', 'onDelete'];
  buttons(Object.fromEntries(names.map((name) => [name, () => events.push(name)]))).forEach((button) => button.props.onClick());
  assert.deepEqual(events, names);
});

test('완료 프로젝트는 업무·서류 추가만 잠그고 기록·삭제를 유지한다', () => {
  const controls = buttons({ project: { id: 'closed', status: 'completed' } });
  assert.deepEqual(controls.map((button) => Boolean(button.props.disabled)), [true, false, true, false]);
});

test('보류 프로젝트의 작업은 활성 상태와 같고 공용 접속의 업무 추가는 비활성이다', () => {
  assert.ok(buttons({ project: { status: 'on_hold' } }).every((button) => !button.props.disabled));
  assert.equal(buttons({ canAddTask: false })[0].props.disabled, true);
});

test('삭제 프로젝트는 신규 작업을 막고 복구만 노출한다', () => {
  const props = { project: { status: 'active', deletedAt: 100 } };
  assert.deepEqual(buttons(props).map((button) => Boolean(button.props.disabled)), [true, true, true, false]);
  const html = renderToStaticMarkup(tree(props));
  assert.match(html, /프로젝트 복구/);
  assert.doesNotMatch(html, /프로젝트 삭제/);
});

test('삭제는 별도 색상으로 구분하며 기존 확인 팝업을 경유한다', () => {
  assert.match(buttons()[3].props.className, /text-red-700/);
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const match = dashboard.match(/<ProjectDetailActions[\s\S]*?\n\s*\/>/);
  assert.ok(match);
  const wired = match[0];
  assert.equal((wired.match(/canGoBackDetail\(\)/g) || []).length, 4);
  assert.match(wired, /setProjectDeletionTarget\(selectedProject\)/);
  assert.doesNotMatch(wired, /confirmProjectDeletion|farmLedgerFetch/);
  assert.doesNotMatch(dashboard, /aria-label="프로젝트 더보기"/);
});

test('내부 프로젝트는 업무 등록과 삭제·복구만 표시하고 사업 정산·서류·기록 버튼을 섞지 않는다', () => {
  for (const [status, canAddTask, deletedAt] of [
    ['active', true, 0], ['active', false, 0], ['on_hold', true, 0],
    ['completed', true, 0], ['active', true, 100],
  ]) {
    const events = [];
    const props = {
      project: { projectType: 'internal', status, deletedAt }, canAddTask,
      onAddTask: () => events.push('add'), onDelete: () => events.push('delete'),
    };
    const controls = buttons(props);
    const html = renderToStaticMarkup(tree(props));
    assert.equal(controls.length, 2);
    assert.match(html, /내부 업무 등록/);
    assert.doesNotMatch(html, /프로젝트 수정|정산|제출서류|기록 추가/);
    assert.equal(Boolean(controls[0].props.disabled), !canAddTask || status === 'completed' || Boolean(deletedAt));
    assert.equal(Boolean(controls[1].props.disabled), false);
    assert.match(html, deletedAt ? /프로젝트 복구/ : /프로젝트 삭제/);
    if (!controls[0].props.disabled) controls[0].props.onClick();
    controls[1].props.onClick();
    assert.deepEqual(events, controls[0].props.disabled ? ['delete'] : ['add', 'delete']);
  }
});
