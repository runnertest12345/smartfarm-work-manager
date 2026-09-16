import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function Button({ children, variant: _variant, ...props }) {
  return React.createElement('button', props, children);
}
const source = readFileSync(
  new URL('../app/project-installation-setup.tsx', import.meta.url),
  'utf8',
);
const componentModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    module: componentModule,
    exports: componentModule.exports,
    require: (name) =>
      name === '@/components/ui/button' ? { Button } : require(name),
  },
);
const { ProjectInstallationSetupNotice } = componentModule.exports;
const project = {
  id: 'synthetic-project',
  projectType: 'general',
  status: 'active',
  installationFarmSetup: { requestedCount: 25, completedCount: 10 },
};
const props = (patch = {}) => ({
  project,
  busy: false,
  onResume() {},
  ...patch,
});
const render = (patch) =>
  renderToStaticMarkup(React.createElement(ProjectInstallationSetupNotice, props(patch)));
const nodes = (element) =>
  !element || typeof element !== 'object'
    ? []
    : [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
const button = (patch) =>
  nodes(ProjectInstallationSetupNotice(props(patch))).find((node) => node.type === Button);

test('중단된 생성 진행률과 보존 안내를 표시하고 재개 버튼을 제공한다', () => {
  const html = render();
  assert.match(html, /농가 자동 생성 10\/25개소/);
  assert.match(html, /이미 생성된 농가와 수정한 정보는 그대로 보존/);
  assert.match(html, /남은 농가만 이어서 생성/);
  assert.match(html, /남은 농가 생성/);
  assert.match(html, /border-amber-200 bg-amber-50/);
  assert.doesNotMatch(html, /disabled=""/);
});

test('재개 버튼은 콜백을 한 번 호출하고 폼 제출을 유발하지 않는다', () => {
  let calls = 0;
  const control = button({ onResume: () => { calls += 1; } });
  assert.equal(control.props.type, 'button');
  control.props.onClick();
  assert.equal(calls, 1);
});

test('상태는 polite로 알리고 버튼 설명은 안내에 연결한다', () => {
  const html = render();
  assert.match(html, /aria-label="농가 자동 생성 현황"/);
  assert.match(html, /<output aria-live="polite"/);
  assert.match(html, /aria-busy="false"/);
  const description = button().props['aria-describedby'];
  assert.ok(description);
  assert.ok(html.includes(`id="${description}"`));
});

test('진행 중에는 작업 상태와 비활성 버튼으로 중복 실행을 막는다', () => {
  const html = render({ busy: true });
  const control = button({ busy: true });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /농가 생성 중…/);
  assert.equal(control.props.disabled, true);
  assert.equal(control.props.onClick, undefined);
});

for (const { name, patch, reason } of [
  { name: '완료', patch: { status: 'completed' }, reason: '완료된 프로젝트에서는 농가를 생성할 수 없습니다' },
  { name: '삭제', patch: { deletedAt: 100 }, reason: '삭제된 프로젝트에서는 농가를 생성할 수 없습니다' },
]) {
  test(`${name} 프로젝트는 진행률을 남기되 생성 비활성 사유를 안내한다`, () => {
    const state = { project: { ...project, ...patch } };
    const html = render(state);
    assert.match(html, /농가 자동 생성 10\/25개소/);
    assert.ok(html.includes(reason));
    assert.equal(button(state).props.disabled, true);
    assert.equal(button(state).props.onClick, undefined);
  });
}

test('보류 프로젝트는 이어서 생성할 수 있다', () => {
  assert.equal(button({ project: { ...project, status: 'on_hold' } }).props.disabled, false);
});

test('실패 메시지는 alert로 표시하며 재시도할 수 있다', () => {
  const html = render({ error: '연결이 끊어졌습니다. 다시 시도해 주세요.' });
  assert.match(html, /role="alert"/);
  assert.match(html, /연결이 끊어졌습니다/);
  assert.equal(button({ error: '연결 오류' }).props.disabled, false);
  assert.doesNotMatch(render(), /role="alert"/);
});

for (const { name, patch } of [
  { name: '설정 없는 기존', patch: { installationFarmSetup: undefined } },
  { name: '내부', patch: { projectType: 'internal' } },
  { name: '생성 완료', patch: { installationFarmSetup: { requestedCount: 25, completedCount: 25 } } },
  { name: '0개소', patch: { installationFarmSetup: { requestedCount: 0, completedCount: 0 } } },
  { name: '요청 수 이상 생성 완료', patch: { installationFarmSetup: { requestedCount: 5, completedCount: 6 } } },
]) {
  test(`${name} 프로젝트에는 알림을 표시하지 않는다`, () => {
    assert.equal(render({ project: { ...project, ...patch }, error: '이전 오류' }), '');
  });
}

test('아직 한 개도 생성되지 않은 경우에도 재개할 수 있다', () => {
  const state = { project: { ...project, installationFarmSetup: { requestedCount: 3, completedCount: 0 } } };
  assert.match(render(state), /농가 자동 생성 0\/3개소/);
  assert.equal(button(state).props.disabled, false);
});
