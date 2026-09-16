import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path) {
  const module = { exports: {} };
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name) });
  return module.exports;
}
const { AnnualMetricList } = load('app/annual-metric-list.tsx');
const record = (id, farmId = id, patch = {}) => ({ id, farmId, projectId: 'project', installationDate: '', commissioningDate: '', educationDate: '', ...patch });
function render(metric, records) {
  return renderToStaticMarkup(React.createElement(AnnualMetricList, {
    metric, records,
    farmById: new Map(records.map((item) => [item.farmId, { name: '농가 ' + item.farmId, farmCode: '' }])),
    projectById: new Map([['project', { name: '프로젝트 하나' }], ['second', { name: '프로젝트 둘' }]]),
    onOpen: () => {}, onClose: () => {},
  }));
}

test('farm and subscription metrics group by farm but preserve project labels', () => {
  for (const metric of ['farms', 'subscriptions']) {
    const html = render(metric, [record('a', 'same'), record('b', 'same', { projectId: 'second' })]);
    assert.equal((html.match(/농가 상세 보기/g) || []).length, 1);
    assert.match(html, /프로젝트 하나 · 프로젝트 둘/);
    assert.match(html, /1곳/);
    assert.doesNotMatch(html, /<select/);
  }
});

test('stage metrics preserve participation rows and display completion evidence', () => {
  const html = render('installation', [record('a', 'same', { installationDate: '2026-09-14' }), record('b', 'same'), record('c', 'other', { stageCompletionConfirmed: { installationDate: true } })]);
  assert.equal((html.match(/농가 상세 보기/g) || []).length, 3);
  assert.match(html, /2026-09-14/);
  assert.match(html, /완료 확인 · 일자 미기록/);
  assert.match(html, /bg-red-50 text-red-700/);
  assert.match(html, /<select/);
  assert.match(html, /<option value="all" selected="">전체<\/option>/);
});

test('pagination exposes total and only first 20 rows with reachable next page', () => {
  const html = render('farms', Array.from({ length: 21 }, (_, index) => record(String(index))));
  assert.equal((html.match(/농가 상세 보기/g) || []).length, 20);
  assert.match(html, /21곳 중 1–20 표시/);
  assert.match(html, /aria-label="다음 페이지"/);
  const nextButton = html.match(/<button[^>]*aria-label="다음 페이지"[^>]*>/)?.[0];
  assert.ok(nextButton);
  assert.doesNotMatch(nextButton, /\sdisabled(?:=|\s|>)/);
});

test('empty list is explicit and metric switch resets local filter and page', () => {
  assert.match(render('education', []), /조건에 맞는 참여 기록이 없습니다/);
  const source = readFileSync(new URL('../app/annual-metric-list.tsx', import.meta.url), 'utf8');
  assert.match(source, /key=\{props.metric\}/);
  assert.match(source, /onOpen\(row.record\)/);
  assert.match(source, /onClick=\{onClose\}/);
  assert.match(source, /setPage\(currentPage \+ 1\)/);
  assert.match(source, /setPage\(1\)/);
});
