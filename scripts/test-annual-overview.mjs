import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  cache.set(path, module.exports);
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => {
    assert.ok(name.startsWith('.'));
    return load(posix.normalize(posix.join(posix.dirname(path), name + '.ts')));
  } });
  return module.exports;
}
const { annualOverviewRecords, summarizeAnnualOverview } = load('lib/annual-overview.ts');
const project = (id, patch = {}) => ({ id, year: 2026, status: 'active', projectType: 'general', ...patch });
const record = (id, farmId, projectId, patch = {}) => ({ id, farmId, projectId, installationDate: '', commissioningDate: '', educationDate: '', lastActivityAt: 1, ...patch });
const snapshot = (records = [], activeSubscriptions = []) => ({ records, activeSubscriptions });

const runtimeRequire = createRequire(import.meta.url);
const panelModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/annual-overview-panel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: panelModule, exports: panelModule.exports,
  require: (name) => name === '@/lib/annual-overview' ? { summarizeAnnualOverview } : runtimeRequire(name),
});
const { AnnualOverviewPanel } = panelModule.exports;
const nodes = (element) => !element || typeof element !== 'object' ? [] : [element,
  ...React.Children.toArray(element.props?.children).flatMap(nodes)];
const renderPanel = (props = {}) => AnnualOverviewPanel({ projects: [project('p')], snapshots: new Map(), year: '2026', onProjectStatus() {}, onMetric() {}, ...props });
const statusButtons = (tree) => nodes(tree).filter((node) => node.type === 'button' && node.props['aria-label']?.endsWith('프로젝트 목록 보기'));

test('selected year counts general, research and internal projects with separate hold status', () => {
  const summary = summarizeAnnualOverview([
    project('general'), project('research', { projectType: 'research', status: 'on_hold' }),
    project('internal', { projectType: 'internal', status: 'completed' }),
    project('last-year', { year: 2025 }), project('deleted', { deletedAt: 1 }),
  ], new Map(), '2026');
  for (const [key, value] of Object.entries({ projects: 3, active: 1, onHold: 1, completed: 1, general: 1, research: 1, internal: 1 })) assert.equal(summary[key], value, key);
});

test('all years supported; supplied scope and project ids remain authoritative', () => {
  const one = project('one');
  const summary = summarizeAnnualOverview([one, one, project('two', { year: 2025 })], new Map(), 'all');
  assert.equal(summary.projects, 2);
  assert.equal(summarizeAnnualOverview([one], new Map(), '2025').projects, 0);
});

test('farm and active subscription totals count distinct farms across projects', () => {
  const a = record('a', 'same-farm', 'one', { installationDate: '2026-01-01' });
  const b = record('b', 'same-farm', 'two', { educationDate: '2026-02-01' });
  const c = record('c', 'other-farm', 'two');
  const summary = summarizeAnnualOverview([project('one'), project('two')], new Map([['one', snapshot([a], [a])], ['two', snapshot([b, c], [b])]]), '2026');
  assert.equal(summary.farms, 2);
  assert.equal(summary.subscribedFarms, 1);
  assert.equal(summary.participations, 3);
  assert.equal(summary.stages[0].completed, 1);
  assert.equal(summary.stages[0].rate, 33);
  assert.equal(summary.stages[0].remaining, 2);
  assert.equal(summary.stages[2].completed, 1);
});

test('internal snapshots are never accessed and do not dilute farm progress', () => {
  const summary = summarizeAnnualOverview([project('internal', { projectType: 'internal' })], { get: () => assert.fail('must not read internal farm snapshot') }, '2026');
  assert.equal(summary.projects, 1);
  assert.equal(summary.farms, 0);
  assert.equal(summary.subscribedFarms, 0);
  for (const stage of summary.stages) {
    assert.equal(stage.total, 0);
    assert.equal(stage.rate, null);
  }
});

test('stage completion uses verified confirmation without fabricated dates', () => {
  const a = record('a', 'farm', 'one', { stageCompletionConfirmed: { commissioningDate: true, educationDate: true } });
  const summary = summarizeAnnualOverview([project('one')], new Map([['one', snapshot([a])]]), '2026');
  assert.equal(summary.stages[0].rate, 0);
  assert.equal(summary.stages[1].rate, 100);
  assert.equal(summary.stages[2].rate, 100);
});

test('distinct participation records for one farm retain stage denominator and any valid subscription', () => {
  const old = record('old', 'farm', 'one', { installationDate: '2025-01-01' });
  const current = record('current', 'farm', 'one', { lastActivityAt: 2 });
  const unrelated = record('outside', 'other-farm', 'outside');
  const summary = summarizeAnnualOverview([project('one')], new Map([['one', snapshot([old, current, current, unrelated], [old, unrelated])]]), '2026');
  assert.equal(summary.farms, 1);
  assert.equal(summary.participations, 2);
  assert.equal(summary.stages[0].completed, 1);
  assert.equal(summary.stages[0].rate, 50);
  assert.equal(summary.subscribedFarms, 1);
});

test('drilldown records match summary and exclude foreign projects, internal and other years', () => {
  const one = record('one', 'farm', 'project');
  const two = record('two', 'farm', 'project');
  const foreign = record('foreign', 'foreign-farm', 'other');
  const internal = record('internal', 'internal-farm', 'internal');
  const previousYear = record('previous', 'previous-farm', 'previous');
  const projects = [project('project'), project('internal', { projectType: 'internal' }), project('previous', { year: 2025 })];
  const snapshots = new Map([
    ['project', snapshot([one, two, one, foreign], [two, foreign])],
    ['internal', snapshot([internal], [internal])],
    ['previous', snapshot([previousYear], [previousYear])],
  ]);
  const records = annualOverviewRecords(projects, snapshots, '2026');
  assert.deepEqual(Array.from(records, (item) => item.id), ['one', 'two']);
  const summary = summarizeAnnualOverview(projects, snapshots, '2026');
  assert.equal(summary.participations, records.length);
  assert.equal(summary.farms, 1);
  assert.equal(summary.subscribedFarms, 1);
});

test('empty and missing snapshots produce no false 0% completion claim', () => {
  const summary = summarizeAnnualOverview([project('missing')], new Map(), '2026');
  assert.equal(summary.projects, 1);
  assert.equal(summary.farms, 0);
  assert.equal(summary.stages[0].rate, null);
});

test('panel always exposes status and stage links without a collapsed section', () => {
  const source = readFileSync(new URL('../app/annual-overview-panel.tsx', import.meta.url), 'utf8');
  assert.match(source, /status: 'on_hold', label: '보류'/);
  assert.match(source, /onProjectStatus\(metric.status\)/);
  assert.match(source, /onMetric\(stage.key\)/);
  assert.match(source, /onMetric\('farms'\)/);
  assert.match(source, /onMetric\('subscriptions'\)/);
  assert.match(source, /aria-label=/);
  assert.match(source, /미완료/);
  assert.doesNotMatch(source, /<details|Accordion/);
});

test('연도 핵심 지표가 유일한 상태 선택기일 때 현재 상태 하나를 시각과 aria-pressed로 표시한다', () => {
  const statuses = ['all', 'active', 'on_hold', 'completed'];
  for (const selectedStatus of statuses) {
    const selected = [];
    const tree = renderPanel({ selectedStatus, onProjectStatus: (next) => selected.push(next) });
    const controls = statusButtons(tree);
    assert.equal(controls.length, 4);
    assert.deepEqual(controls.map((button) => button.props['aria-pressed']), statuses.map((status) => status === selectedStatus));
    assert.equal(controls.filter((button) => button.props.className.includes('ring-inset')).length, 1);
    assert.match(controls[statuses.indexOf(selectedStatus)].props.className, /bg-emerald-50/);
    controls.forEach((button) => button.props.onClick());
    assert.deepEqual(selected, statuses);
    // 선택 상태는 부모가 소유한다. 클릭했다고 자체 선택 상태를 바꾸지 않는다.
    assert.deepEqual(statusButtons(renderPanel({ selectedStatus })).map((button) => button.props['aria-pressed']), statuses.map((status) => status === selectedStatus));
  }
});

test('농가·구독·확인 필요 목록을 볼 때 상태 선택을 비우면 잘못된 선택 표시를 남기지 않는다', () => {
  const tree = renderPanel({ selectedStatus: undefined });
  assert.equal(statusButtons(tree).length, 4);
  assert.ok(statusButtons(tree).every((button) => button.props['aria-pressed'] === undefined));
  assert.ok(statusButtons(tree).every((button) => !button.props.className.includes('ring-inset')));
  assert.doesNotMatch(renderToStaticMarkup(tree), /aria-pressed=/);
  const metrics = [];
  const metricTree = renderPanel({ onMetric: (next) => metrics.push(next) });
  const allButtons = nodes(metricTree).filter((node) => node.type === 'button');
  for (const control of allButtons.filter((button) => !statusButtons(metricTree).includes(button))) control.props.onClick();
  assert.deepEqual(metrics, ['farms', 'subscriptions', 'installation', 'commissioning', 'education']);
});
