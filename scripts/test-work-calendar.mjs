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
  const loadedModule = { exports: {} };
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: (name) => aliases[name] || require(name) });
  return loadedModule.exports;
}
const types = load('lib/farm-types.ts');
const organization = load('lib/organization.ts');
const lifecycle = load('lib/work-lifecycle.ts', { './organization': organization });
const projectWork = load('lib/project-work.ts', { './work-lifecycle': lifecycle });
const hierarchy = load('lib/work-hierarchy.ts');
const calendarGroups = load('lib/work-calendar-groups.ts');
const calendar = load('lib/work-calendar.ts', {
  './project-work': projectWork, './work-hierarchy': hierarchy,
});
const {
  isCalendarDate, calendarDateAt, calendarTimeAt, shiftCalendarDate, shiftCalendarMonth,
  calendarVisibleDates, calendarDayLabel, buildWorkCalendar, filterWorkCalendar,
} = calendar;
const task = (id, extra = {}) => ({
  id, title: id, status: 'open', projectId: 'p1', scope: undefined,
  farmId: '', farmRecordId: '', workType: 'communication', owner: '담호',
  dueDate: '2026-09-15', blockedReason: '', respondedAt: 0, createdAt: 100,
  ...extra,
});
const visit = (id, workItemId, extra = {}) => ({
  id, workItemId, scheduledAt: Date.parse('2026-09-15T10:30:00+09:00'),
  assignedTo: '평화', status: 'scheduled', actualStartedAt: 0, actualEndedAt: 0,
  nextVisitAt: 0, ...extra,
});
const input = (workItems = [], visits = [], extra = {}) => ({
  workItems, visits, projects: [{ id: 'p1', name: '2026 설치 사업', status: 'active' }],
  farmRecords: [], farms: [], historyEntries: [], ...extra,
});
const ids = (entries) => entries.map((entry) => entry.id).join(',');
const filtered = (data, filter = {}) => filterWorkCalendar(buildWorkCalendar(data), filter, '2026-09-15');

test('strict dates do not normalize invalid days, missing values or timestamps', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  for (const value of ['', '2026-2-3', '2026-02-29', '2026-04-31', '2026-13-01', '2026-09-15T00:00:00Z'])
    assert.equal(isCalendarDate(value), false, value);
});
test('Korean midnight and 24-hour visit time do not depend on host timezone', () => {
  assert.equal(calendarDateAt(Date.parse('2026-09-14T14:59:00Z')), '2026-09-14');
  assert.equal(calendarDateAt(Date.parse('2026-09-14T15:00:00Z')), '2026-09-15');
  assert.equal(calendarTimeAt(Date.parse('2026-09-14T15:00:00Z')), '00:00');
  assert.equal(calendarTimeAt(Date.parse('2026-09-14T23:05:00Z')), '08:05');
  assert.equal(calendarDateAt(Infinity), '');
  assert.equal(calendarDateAt(NaN), '');
  assert.equal(calendarTimeAt(9e18), '');
});
test('Monday week spans month and year boundaries; Sunday remains in prior week', () => {
  assert.equal(calendarVisibleDates('2027-01-03', 'week').join(','), '2026-12-28,2026-12-29,2026-12-30,2026-12-31,2027-01-01,2027-01-02,2027-01-03');
  assert.equal(calendarVisibleDates('2027-01-04', 'week')[0], '2027-01-04');
  assert.equal(calendarVisibleDates('2026-09-15', 'day').join(','), '2026-09-15');
  assert.equal(calendarVisibleDates('not-a-date', 'week').length, 0);
});
test('month view is a fixed six-week Monday-first grid anchored on the first day', () => {
  const september = calendarVisibleDates('2026-09-15', 'month');
  assert.equal(september.length, 42);
  assert.equal(september[0], '2026-08-31');
  assert.equal(september[41], '2026-10-11');
  assert.equal(september.join(','), calendarVisibleDates('2026-09-30', 'month').join(','));
  assert.equal(new Set(september).size, 42);
  for (let index = 1; index < september.length; index++)
    assert.equal(september[index], shiftCalendarDate(september[index - 1], 1));
});
test('six-week month grids include previous and next year and leap-day boundaries', () => {
  const january = calendarVisibleDates('2027-01-15', 'month');
  assert.equal(january[0], '2026-12-28');
  assert.equal(january[41], '2027-02-07');
  const february = calendarVisibleDates('2024-02-29', 'month');
  assert.equal(february.length, 42);
  assert.equal(february[0], '2024-01-29');
  assert.equal(february[41], '2024-03-10');
  assert.equal(february.includes('2024-02-29'), true);
  assert.equal(calendarVisibleDates('2026-06-15', 'month')[0], '2026-06-01');
  assert.equal(calendarVisibleDates('2026-11-15', 'month')[0], '2026-10-26');
});
test('month shifting clamps the selected day at shorter month ends and leap years', () => {
  assert.equal(shiftCalendarMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftCalendarMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftCalendarMonth('2026-03-31', -1), '2026-02-28');
  assert.equal(shiftCalendarMonth('2026-03-31', 1), '2026-04-30');
  assert.equal(shiftCalendarMonth('2026-09-15', 1), '2026-10-15');
  assert.equal(shiftCalendarMonth('2024-02-29', 12), '2025-02-28');
  assert.equal(shiftCalendarMonth('2026-01-31', 0), '2026-01-31');
});
test('month shifting crosses year boundaries without the Date constructor 1900 offset', () => {
  assert.equal(shiftCalendarMonth('2026-12-31', 1), '2027-01-31');
  assert.equal(shiftCalendarMonth('2026-01-31', -1), '2025-12-31');
  assert.equal(shiftCalendarMonth('2026-01-31', 14), '2027-03-31');
  assert.equal(shiftCalendarMonth('2026-01-31', -14), '2024-11-30');
  assert.equal(shiftCalendarMonth('0099-12-31', 1), '0100-01-31');
});
test('invalid dates, fractional offsets and out-of-range shifts safely return no date', () => {
  for (const date of ['', 'invalid', '2026-02-29', '2026-1-1']) {
    assert.equal(shiftCalendarMonth(date, 1), '');
    assert.equal(calendarVisibleDates(date, 'month').length, 0);
  }
  for (const offset of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER])
    assert.equal(shiftCalendarMonth('2026-09-15', offset), '');
  assert.equal(shiftCalendarMonth('9999-12-31', 1), '');
  assert.equal(shiftCalendarMonth('0000-01-01', -1), '');
  assert.equal(shiftCalendarDate('2026-09-15', Number.MAX_SAFE_INTEGER), '');
  assert.equal(shiftCalendarDate('9999-12-31', 1), '');
  assert.equal(calendarVisibleDates('9999-12-31', 'month').length, 0);
});
test('date shifts respect leap days without DST or host timezone drift', () => {
  assert.equal(shiftCalendarDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftCalendarDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftCalendarDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftCalendarDate('2026-09-15', -7), '2026-09-08');
  assert.equal(shiftCalendarDate('bad', 1), '');
  assert.equal(shiftCalendarDate('2026-09-15', 0.5), '');
  assert.match(calendarDayLabel('2026-09-15'), /화/);
});
test('Korean day labels have stable punctuation and weekdays across ICU builds', () => {
  assert.equal(calendarDayLabel('2026-09-23'), '9월 23일 (수)');
  assert.equal(calendarDayLabel('2027-01-03'), '1월 3일 (일)');
  assert.equal(calendarDayLabel('2024-02-29'), '2월 29일 (목)');
  assert.equal(calendarDayLabel('2026-02-29'), '');
  assert.equal(calendarDayLabel(''), '');
});
test('deadline and visit are separate labeled entries referencing the same original work', () => {
  const work = task('업무');
  const originalVisit = visit('v1', work.id);
  const data = buildWorkCalendar(input([work], [originalVisit]));
  assert.equal(ids(data.entries), 'deadline:업무,visit:v1');
  assert.equal(data.entries[0].time, '');
  assert.equal(data.entries[0].scheduledAt, 0);
  assert.equal(data.entries[1].time, '10:30');
  assert.equal(data.entries[1].work, work);
  assert.equal(data.entries[1].visit, originalVisit);
  assert.equal('end' in data.entries[1], false);
  assert.equal('duration' in data.entries[1], false);
});
test('only a real scheduled visit timestamp is used, not next visit or actual start', () => {
  const data = buildWorkCalendar(input([task('t')], [visit('v', 't', {
    nextVisitAt: Date.parse('2026-10-10T13:00:00+09:00'),
    actualStartedAt: Date.parse('2026-09-15T11:00:00+09:00'),
  })]));
  assert.equal(data.entries.length, 2);
  assert.equal(data.entries[1].time, '10:30');
});
test('payments, subscriptions and deleted works never appear even with visits', () => {
  const works = [task('paid', { workType: 'payment' }), task('sub', { workType: 'subscription' }), task('deleted', { deletedAt: 100 }), task('valid')];
  const data = buildWorkCalendar(input(works, works.map((work) => visit(work.id, work.id))));
  assert.equal(ids(data.entries), 'deadline:valid,visit:valid');
});
test('automatic ledger audit records excluded using existing operational helper and history', () => {
  const work = task('audit', { title: '농가 관리대장 등록', workType: 'note', status: 'completed' });
  const data = buildWorkCalendar(input([work], [], { historyEntries: [{ workItemId: 'audit', channel: 'system', occurredAt: 100, receivedContent: '' }] }));
  assert.equal(data.entries.length, 0);
  assert.equal(data.unscheduled.length, 0);
});
test('import-only box replacement history excluded without excluding genuine service work', () => {
  const id = `work_service_${'a'.repeat(32)}`;
  const work = task(id, { title: 'A/S 기록 이관', workType: 'service', status: 'completed', farmRecordId: 'r', migrationRunId: 'm', sourceFingerprint: 'b'.repeat(64) });
  const data = buildWorkCalendar(input([work, task('real-as', { workType: 'service' })], [], { historyEntries: [{ id: id.replace('work_', 'history_'), workItemId: id, channel: 'system', occurredAt: 100, actionContent: '파모스 박스 교체 완료' }] }));
  assert.equal(ids(data.entries), 'deadline:real-as');
});
test('canceled, orphaned, zero and invalid visits are always excluded', () => {
  const visits = [visit('cancel', 't', { status: 'canceled' }), visit('orphan', 'missing'), visit('zero', 't', { scheduledAt: 0 }), visit('nan', 't', { scheduledAt: NaN }), visit('range', 't', { scheduledAt: 9e18 })];
  assert.equal(ids(buildWorkCalendar(input([task('t')], visits)).entries), 'deadline:t');
});
test('completed work and visits default hidden, completed toggle restores both', () => {
  const data = input([task('active'), task('done', { status: 'completed' })], [visit('done-visit', 'active', { status: 'completed' }), visit('active-visit', 'active')]);
  assert.equal(ids(filtered(data).entries), 'deadline:active,visit:active-visit');
  assert.equal(filtered(data, { showCompleted: true }).entries.length, 4);
});
test('visit owner filtering uses visit assignee, deadline uses work owner', () => {
  const data = input([task('t')], [visit('v', 't')]);
  assert.equal(ids(filtered(data, { owner: '담호' }).entries), 'deadline:t');
  assert.equal(ids(filtered(data, { owner: '평화' }).entries), 'visit:v');
  assert.equal(buildWorkCalendar(data).ownerOptions.join(','), '담호,평화');
});
test('empty visit owner falls back to work owner; unassigned filter supports blank owners', () => {
  const data = input([task('assigned'), task('none', { owner: ' ' })], [visit('v1', 'assigned', { assignedTo: ' ' }), visit('v2', 'none', { assignedTo: '' })]);
  assert.equal(ids(filtered(data, { owner: '__unassigned__' }).entries), 'deadline:none,visit:v2');
  assert.equal(ids(filtered(data, { owner: '담호' }).entries), 'deadline:assigned,visit:v1');
});
test('internal work and project, farm source and record project precedence resolve correctly', () => {
  const works = [task('internal', { scope: 'internal', projectId: 'internal-p' }), task('farm-task', { projectId: 'stale', farmRecordId: 'r' })];
  const data = input(works, [], { projects: [{ id: 'internal-p', name: '사내 홍보', projectType: 'internal' }, { id: 'farm-p', name: '설치 사업' }], farmRecords: [{ id: 'r', farmId: 'f', projectId: 'farm-p' }], farms: [{ id: 'f', name: '김농장' }] });
  const entries = buildWorkCalendar(data).entries;
  assert.match(entries.find((entry) => entry.work.id === 'internal').sourceLabel, /내부 업무 · 사내 홍보/);
  const farm = entries.find((entry) => entry.work.id === 'farm-task');
  assert.equal(farm.projectId, 'farm-p');
  assert.match(farm.sourceLabel, /농가 업무 · 설치 사업 · 김농장/);
  assert.equal(ids(filtered(data, { projectId: 'farm-p' }).entries), 'deadline:farm-task');
});
test('completed and on-hold projects do not hide unfinished after-sales tasks', () => {
  for (const status of ['completed', 'on_hold']) {
    const data = input([task('as', { workType: 'service', farmRecordId: 'r' })], [], { projects: [{ id: 'p1', name: '완료한 사업', status }], farmRecords: [{ id: 'r', projectId: 'p1', farmId: 'f' }] });
    assert.equal(filtered(data).entries.length, 1);
  }
});
test('parent breadcrumb retains filtered-out ancestors and guards circular links', () => {
  const works = [task('root', { owner: '다른 직원', status: 'completed' }), task('middle', { parentWorkItemId: 'root' }), task('leaf', { parentWorkItemId: 'middle' })];
  assert.equal(filtered(input(works), { owner: '담호' }).entries.find((entry) => entry.work.id === 'leaf').parentPath, 'root › middle');
  const cyclic = buildWorkCalendar(input([task('a', { parentWorkItemId: 'b' }), task('b', { parentWorkItemId: 'a' })]));
  assert.equal(cyclic.entries.length, 2);
  assert.equal(cyclic.entries.find((entry) => entry.work.id === 'a').parentPath, 'b');
});
test('missing parent, farm and project retain task with explicit context warning', () => {
  const data = buildWorkCalendar(input([task('orphan', { parentWorkItemId: 'missing', projectId: 'missing', farmRecordId: 'missing' })]));
  assert.match(data.entries[0].parentPath, /연결 확인 필요/);
  assert.match(data.entries[0].sourceLabel, /농가 연결 확인 필요/);
  assert.match(data.entries[0].projectLabel, /연결 확인 필요/);
});
test('unscheduled includes invalid dates and canceled/completed visit-only unfinished tasks', () => {
  const works = [task('empty', { dueDate: '' }), task('bad', { dueDate: '2026-02-31' }), task('canceled', { dueDate: '' }), task('visited', { dueDate: '' }), task('scheduled', { dueDate: '' }), task('done', { dueDate: '', status: 'completed' })];
  const visits = [visit('v1', 'canceled', { status: 'canceled' }), visit('v2', 'visited', { status: 'completed' }), visit('v3', 'scheduled')];
  const result = filtered(input(works, visits));
  assert.equal(result.unscheduled.map((context) => context.work.id).join(','), 'empty,bad,canceled,visited');
});
test('overdue means unfinished deadlines before Korean today, not today or visits', () => {
  const data = input([task('late', { dueDate: '2026-09-14' }), task('today'), task('future', { dueDate: '2026-09-16' }), task('done', { dueDate: '2026-01-01', status: 'completed' })], [visit('past', 'today', { scheduledAt: Date.parse('2026-09-01T09:00:00+09:00') })]);
  const result = filtered(data, { showCompleted: true });
  assert.equal(ids(result.overdue), 'deadline:late');
});
test('global collapsed lists still honor project and owner filters', () => {
  const data = input([task('one', { dueDate: '' }), task('two', { dueDate: '', projectId: 'p2' }), task('late', { dueDate: '2020-01-01', projectId: 'p2' }), task('none', { dueDate: '', projectId: '' })]);
  assert.equal(filtered(data, { projectId: 'p1' }).unscheduled.map((context) => context.work.id).join(','), 'one');
  assert.equal(filtered(data, { projectId: 'p1' }).overdue.length, 0);
  assert.equal(filtered(data, { projectId: '__unlinked__' }).unscheduled.map((context) => context.work.id).join(','), 'none');
});
test('entries are chronological and show waiting deadlines first without moving timed visits', () => {
  const works = [task('a'), task('blocked', { status: 'waiting' })];
  const data = buildWorkCalendar(input(works, [visit('late', 'blocked', { scheduledAt: Date.parse('2026-09-15T18:00:00+09:00') }), visit('early', 'a')]));
  assert.equal(ids(data.entries), 'deadline:blocked,deadline:a,visit:early,visit:late');
});
test('building and filtering never mutate authorized work or visit data', () => {
  const data = input([task('t')], [visit('v', 't')]);
  const before = JSON.stringify(data);
  filtered(data, { owner: '평화' });
  assert.equal(JSON.stringify(data), before);
});

let slots = [], cursor = 0;
const useState = (initial) => {
  const index = cursor++;
  if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
  return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
};
const useRef = (value) => useState(() => ({ current: value }))[0];
const ButtonMock = ({ variant: _variant, size: _size, ...props }) => React.createElement('button', props);
const DialogMock = ({ open, children }) => open ? React.createElement('section', { role: 'dialog' }, children) : null;
const DialogContentMock = ({ showCloseButton: _close, finalFocus: _focus, ...props }) => React.createElement('div', props);
const { WorkCalendarPreview } = load('app/work-calendar-preview.tsx', {
  '@/lib/farm-types': types,
  '@/lib/work-calendar': calendar,
  '@/components/ui/button': { Button: ButtonMock },
  '@/components/ui/dialog': {
    Dialog: DialogMock,
    DialogContent: DialogContentMock,
    DialogTitle: (props) => React.createElement('h2', props),
    DialogDescription: (props) => React.createElement('p', props),
  },
});
const { WorkCalendar } = load('app/work-calendar.tsx', {
  react: { ...React, useState, useRef, useId: () => 'calendar-test', useMemo: (fn) => fn(), useEffect: () => {} },
  '@/lib/farm-types': types,
  '@/lib/work-calendar': calendar,
  '@/lib/work-calendar-groups': calendarGroups,
  './work-calendar-preview': { WorkCalendarPreview },
  '@/components/ui/button': { Button: ButtonMock },
});
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
function text(element) {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  return React.Children.toArray(element?.props?.children).map(text).join('');
}
function find(tree, predicate) {
  const node = nodes(tree).find(predicate);
  assert.ok(node, 'expected control exists');
  return node;
}
const render = (props) => { cursor = 0; return WorkCalendar(props); };
const ui = (extra = {}) => { slots = []; return { ...input([task('t')], [visit('v', 't')]), onOpenWork() {}, ...extra }; };
const setDate = (tree, value) => find(tree, (node) => node.type === 'input' && node.props.type === 'date').props.onChange({ target: { value } });
const rawNodes = (node) => node && typeof node === 'object' ? [node, ...React.Children.toArray(node.props?.children).flatMap(rawNodes)] : [];
const previewOf = (tree) => {
  const preview = rawNodes(tree).find((node) => node.type === WorkCalendarPreview);
  assert.ok(preview, 'calendar preview exists');
  return preview;
};
const clickGroup = (node, trigger = { isConnected: true, focus() {} }) => {
  node.props.onClick({ currentTarget: trigger });
  return trigger;
};
const completePreviewClose = (tree) => {
  const preview = previewOf(tree);
  const dialog = WorkCalendarPreview(preview.props);
  assert.equal(dialog.type, DialogMock);
  dialog.props.onOpenChangeComplete(false);
};
const previewRows = (tree) => nodes(find(tree, (node) => node.props.role === 'dialog')).filter((node) => node.props['data-calendar-row']);

test('component defaults to week and collapsed global groups with labeled controls', () => {
  const props = ui();
  const tree = render(props);
  assert.equal(find(tree, (node) => text(node) === '주간' && node.type === 'button').props['aria-pressed'], true);
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-overdue').props.hidden, true);
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-unscheduled').props.hidden, true);
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-completed').props.checked, false);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /한국 시간/);
  assert.match(html, /종료 예정 시각은 등록된 정보가 없어/);
  assert.doesNotMatch(html, /draggable=/);
});
test('week navigation, date heading and day navigation preserve selected period', () => {
  const props = ui();
  setDate(render(props), '2026-09-15');
  find(render(props), (node) => node.props['aria-label'] === '다음 주').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-09-22');
  find(render(props), (node) => node.props['aria-label'] === '9월 23일 (수) 일간 보기').props.onClick();
  assert.equal(find(render(props), (node) => text(node) === '일간' && node.type === 'button').props['aria-pressed'], true);
  find(render(props), (node) => node.props['aria-label'] === '이전 날').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-09-22');
});
test('week group opens read-only preview before transitioning to existing work after close', () => {
  const opened = [];
  const work = task('t');
  const props = ui({ workItems: [work], onOpenWork: (item) => opened.push(item) });
  setDate(render(props), '2026-09-15');
  find(render(props), (node) => node.props.id === 'calendar-test-owner').props.onChange({ target: { value: '담호' } });
  const events = [];
  const trigger = clickGroup(find(render(props), (node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:t'), { isConnected: true, focus() { events.push('focus'); } });
  assert.equal(opened.length, 0);
  assert.equal(previewOf(render(props)).props.open, true);
  assert.equal(previewOf(render(props)).props.returnFocus(), trigger);
  find(render(props), (node) => node.props['aria-label'] === 't 업무 조회·수정').props.onClick();
  assert.equal(opened.length, 0, 'must wait until the lookup modal closes');
  assert.equal(previewOf(render(props)).props.open, false);
  completePreviewClose(render(props));
  assert.equal(opened[0], work);
  assert.deepEqual(events, ['focus']);
  completePreviewClose(render(props));
  assert.equal(opened.length, 1, 'repeat animation completion must not open another dialog');
  assert.equal(find(render(props), (node) => node.props.id === 'calendar-test-owner').props.value, '담호');
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-09-15');
});
test('completed and collapsed disclosure controls update independently', () => {
  const props = ui({ workItems: [task('done', { status: 'completed' })], visits: [] });
  setDate(render(props), '2026-09-15');
  assert.equal(nodes(render(props)).some((node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:done'), false);
  find(render(props), (node) => node.props.id === 'calendar-test-completed').props.onChange({ target: { checked: true } });
  assert.equal(nodes(render(props)).some((node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:done'), true);
  find(render(props), (node) => node.props['aria-controls'] === 'calendar-test-unscheduled').props.onClick();
  assert.equal(find(render(props), (node) => node.props.id === 'calendar-test-unscheduled').props.hidden, false);
  assert.equal(find(render(props), (node) => node.props.id === 'calendar-test-overdue').props.hidden, true);
});
test('day view presents chronological real visit times and distinct all-day deadlines', () => {
  const props = ui();
  setDate(render(props), '2026-09-15');
  find(render(props), (node) => text(node) === '일간' && node.type === 'button').props.onClick();
  const html = renderToStaticMarkup(render(props));
  assert.match(html, /종일 마감 업무/);
  assert.match(html, /시간순 방문 일정/);
  assert.match(html, /10:30/);
  assert.match(html, /방문 담당.*평화/);
});

const selectView = (tree, label) => find(tree, (node) => node.type === 'button' && text(node) === label).props.onClick();
const monthCell = (tree, date) => find(tree, (node) => node.props['data-calendar-date'] === date);
const groupButtons = (tree) => nodes(tree).filter((node) => node.type === 'button' && node.props['data-calendar-group']);

test('month UI renders 42 dates, previews three of ten independent groups and opens all ten in lookup', () => {
  const works = Array.from({ length: 10 }, (_, index) => task(`업무 ${index + 1}`));
  const props = ui({ workItems: works, visits: [] });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '월간');
  const tree = render(props);
  assert.equal(nodes(tree).filter((node) => node.props['data-calendar-date']).length, 42);
  const cell = monthCell(tree, '2026-09-15');
  assert.equal(groupButtons(cell).length, 3);
  const more = find(cell, (node) => node.props['aria-label'] === '9월 15일 (화) 업무 10건 모두 보기');
  assert.equal(text(more), '+7묶음 더보기');
  clickGroup(more);
  const next = render(props);
  assert.equal(find(next, (node) => node.props.type === 'date').props.value, '2026-09-15');
  assert.equal(find(next, (node) => node.type === 'button' && text(node) === '월간').props['aria-pressed'], true);
  assert.equal(previewOf(next).props.groups.length, 10);
  assert.equal(previewRows(next).length, 10);
});

test('month navigation clamps month ends and leaves valid date intact after invalid navigation', () => {
  const props = ui();
  setDate(render(props), '2026-01-31');
  selectView(render(props), '월간');
  find(render(props), (node) => node.props['aria-label'] === '다음 달').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-02-28');
  find(render(props), (node) => node.props['aria-label'] === '이전 달').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-01-28');
  setDate(render(props), '2024-01-31');
  find(render(props), (node) => node.props['aria-label'] === '다음 달').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2024-02-29');
  setDate(render(props), '9999-12-31');
  find(render(props), (node) => node.props['aria-label'] === '다음 달').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '9999-12-31');
});

test('month statistics exclude adjacent-month entries while their calendar cells remain visible', () => {
  const works = [task('previous', { dueDate: '2026-08-31' }), task('current'), task('next', { dueDate: '2026-10-01' })];
  const visits = [visit('previous', 'previous', { scheduledAt: Date.parse('2026-08-31T10:00:00+09:00') }), visit('current', 'current'), visit('next', 'next', { scheduledAt: Date.parse('2026-10-01T10:00:00+09:00') })];
  const props = ui({ workItems: works, visits });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '월간');
  const tree = render(props);
  const summary = find(tree, (node) => node.type === 'p' && text(node).startsWith('선택한 달 · '));
  assert.match(text(summary), /마감 1건 · 방문 1건/);
  assert.equal(groupButtons(monthCell(tree, '2026-08-31')).length, 1);
  assert.equal(groupButtons(monthCell(tree, '2026-10-01')).length, 1);
  find(monthCell(tree, '2026-10-01'), (node) => node.props['aria-label'] === '10월 1일 (목) 일간 보기').props.onClick();
  assert.equal(find(render(props), (node) => node.props.type === 'date').props.value, '2026-10-01');
});

test('month preview respects owner/project/completed filters and popup selection preserves them', () => {
  const opened = [];
  const selected = task('mine');
  const props = ui({
    workItems: [selected, task('done', { status: 'completed' }), task('other-owner', { owner: '평화' }), task('other-project', { projectId: 'p2' })],
    visits: [], onOpenWork: (work) => opened.push(work),
  });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '월간');
  find(render(props), (node) => node.props.id === 'calendar-test-project').props.onChange({ target: { value: 'p1' } });
  find(render(props), (node) => node.props.id === 'calendar-test-owner').props.onChange({ target: { value: '담호' } });
  assert.equal(groupButtons(monthCell(render(props), '2026-09-15')).length, 1);
  find(render(props), (node) => node.props.id === 'calendar-test-completed').props.onChange({ target: { checked: true } });
  assert.equal(groupButtons(monthCell(render(props), '2026-09-15')).length, 2);
  clickGroup(find(monthCell(render(props), '2026-09-15'), (node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:mine'));
  find(render(props), (node) => node.props['aria-label'] === 'mine 업무 조회·수정').props.onClick();
  assert.equal(opened.length, 0);
  completePreviewClose(render(props));
  assert.equal(opened[0], selected);
  const tree = render(props);
  assert.equal(find(tree, (node) => node.type === 'button' && text(node) === '월간').props['aria-pressed'], true);
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-owner').props.value, '담호');
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-project').props.value, 'p1');
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-completed').props.checked, true);
  assert.equal(find(tree, (node) => node.props.type === 'date').props.value, '2026-09-15');
});

test('month overflow opens filtered lookup without losing the selected owner and project', () => {
  const works = [...Array.from({ length: 10 }, (_, index) => task(`mine-${index}`)), task('other-owner', { owner: '평화' }), task('other-project', { projectId: 'p2' })];
  const props = ui({ workItems: works, visits: [] });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '월간');
  find(render(props), (node) => node.props.id === 'calendar-test-project').props.onChange({ target: { value: 'p1' } });
  find(render(props), (node) => node.props.id === 'calendar-test-owner').props.onChange({ target: { value: '담호' } });
  clickGroup(find(monthCell(render(props), '2026-09-15'), (node) => node.props['aria-label'] === '9월 15일 (화) 업무 10건 모두 보기'));
  const tree = render(props);
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-owner').props.value, '담호');
  assert.equal(find(tree, (node) => node.props.id === 'calendar-test-project').props.value, 'p1');
  const rows = previewRows(tree);
  assert.equal(rows.length, 10);
  assert.equal(rows.every((node) => node.props['data-calendar-row'].startsWith('mine-')), true);
  assert.equal(find(tree, (node) => node.type === 'button' && text(node) === '월간').props['aria-pressed'], true);
});

test('month waiting badge includes hidden visits and deduplicates deadline/visit for the same work', () => {
  const works = [task('blocked-both', { status: 'waiting' }), task('a'), task('b'), task('blocked-visit', { status: 'waiting', dueDate: '' })];
  const props = ui({ workItems: works, visits: [visit('blocked-both', 'blocked-both'), visit('blocked-visit', 'blocked-visit')] });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '월간');
  const cell = monthCell(render(props), '2026-09-15');
  assert.equal(groupButtons(cell).length, 3);
  assert.equal(groupButtons(cell).some((node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:blocked-visit'), false);
  assert.equal(text(find(cell, (node) => node.props.title === '대기·막힘 업무 2건')), '막힘 2');
});

test('ten children on the same date appear as one parent group and ten matched popup rows in month and week', () => {
  for (const viewLabel of ['월간', '주간']) {
    const parent = task('parent', { dueDate: '' });
    const children = Array.from({ length: 10 }, (_, index) => task(`child-${index}`, { parentWorkItemId: parent.id }));
    const props = ui({ workItems: [parent, ...children], visits: [] });
    setDate(render(props), '2026-09-15');
    selectView(render(props), viewLabel);
    const tree = render(props);
    const cell = viewLabel === '월간' ? monthCell(tree, '2026-09-15') : find(tree, (node) => node.type === 'section' && node.props['aria-label'] === '9월 15일 (화)');
    assert.equal(groupButtons(cell).length, 1);
    assert.match(groupButtons(cell)[0].props['aria-label'], /parent · 업무 10건/);
    clickGroup(groupButtons(cell)[0]);
    const rows = previewRows(render(props));
    assert.equal(rows.filter((row) => !row.props['data-context-only']).length, 10);
    assert.equal(rows.filter((row) => row.props['data-context-only']).length, 1, 'non-scheduled root is context, not another counted work');
    assert.match(renderToStaticMarkup(find(render(props), (node) => node.props.role === 'dialog')), /업무 10건 · 마감 10건 · 방문 0건/);
  }
});

test('week limits ten independent groups to three and overflow opens all without switching to day', () => {
  const props = ui({ workItems: Array.from({ length: 10 }, (_, index) => task(`independent-${index}`)), visits: [] });
  setDate(render(props), '2026-09-15');
  const tree = render(props);
  const cell = find(tree, (node) => node.type === 'section' && node.props['aria-label'] === '9월 15일 (화)');
  assert.equal(groupButtons(cell).length, 3);
  const more = find(cell, (node) => node.type === 'button' && text(node) === '+7묶음 더보기');
  clickGroup(more);
  assert.equal(previewRows(render(props)).length, 10);
  assert.equal(find(render(props), (node) => node.type === 'button' && text(node) === '주간').props['aria-pressed'], true);
});

test('day cards still open existing work directly without a lookup modal', () => {
  const opened = [], work = task('day-work');
  const props = ui({ workItems: [work], visits: [visit('day-visit', work.id)], onOpenWork: (value) => opened.push(value) });
  setDate(render(props), '2026-09-15');
  selectView(render(props), '일간');
  const tree = render(props);
  assert.equal(rawNodes(tree).some((node) => node.type === WorkCalendarPreview), false);
  find(tree, (node) => node.type === 'button' && node.props['data-calendar-entry'] === 'deadline:day-work').props.onClick();
  assert.equal(opened[0], work);
  find(tree, (node) => node.type === 'button' && node.props['data-calendar-entry'] === 'visit:day-visit').props.onClick();
  assert.equal(opened[1], work);
});

test('closing lookup normally or canceling pending selection never opens a work popup', () => {
  for (const pending of [false, true]) {
    const opened = [], props = ui({ visits: [], onOpenWork: (work) => opened.push(work) });
    setDate(render(props), '2026-09-15');
    clickGroup(groupButtons(render(props))[0]);
    const preview = previewOf(render(props));
    if (pending) preview.props.onOpenWork(props.workItems[0]);
    preview.props.onOpenChange(false);
    completePreviewClose(render(props));
    completePreviewClose(render(props));
    assert.equal(opened.length, 0);
    assert.equal(previewOf(render(props)).props.open, false);
  }
});

test('popup always derives rows from latest date and group data without resurrecting removed work', () => {
  const parent = task('root', { dueDate: '' });
  const child = task('child', { parentWorkItemId: parent.id });
  const props = ui({ workItems: [parent, child], visits: [] });
  setDate(render(props), '2026-09-15');
  clickGroup(groupButtons(render(props))[0]);
  assert.equal(previewRows(render(props)).length, 2);
  props.workItems = [parent, { ...child, title: '최신 업무명', status: 'waiting', blockedReason: '확인 대기' }];
  assert.match(renderToStaticMarkup(find(render(props), (node) => node.props.role === 'dialog')), /최신 업무명/);
  assert.match(renderToStaticMarkup(find(render(props), (node) => node.props.role === 'dialog')), /확인 대기/);
  props.workItems = [parent, { ...child, deletedAt: 100 }];
  assert.equal(previewRows(render(props)).length, 0);
  assert.match(renderToStaticMarkup(find(render(props), (node) => node.props.role === 'dialog')), /업무가 변경되어 표시할 일정이 없습니다/);
  props.workItems = [parent, { ...child, dueDate: '2026-09-16' }];
  assert.equal(previewRows(render(props)).length, 0, 'moving the deadline must not retain a stale row on the prior date');
});

test('work lookup completion uses latest work object and ignores a task deleted while closing', () => {
  for (const deleted of [false, true]) {
    const opened = [], props = ui({ visits: [], onOpenWork: (work) => opened.push(work) });
    setDate(render(props), '2026-09-15');
    clickGroup(groupButtons(render(props))[0]);
    previewOf(render(props)).props.onOpenWork(props.workItems[0]);
    const latest = { ...props.workItems[0], title: '최신 제목', ...(deleted ? { deletedAt: 100 } : {}) };
    props.workItems = [latest];
    completePreviewClose(render(props));
    assert.equal(opened.length, deleted ? 0 : 1);
    if (!deleted) assert.equal(opened[0], latest);
  }
});

test('popup rows retain hierarchy and distinguish context from matched schedules without editing controls', () => {
  const parent = task('root', { dueDate: '2026-09-16' });
  const child = task('child', { parentWorkItemId: parent.id, dueDate: '2026-09-16' });
  const leaf = task('leaf', { parentWorkItemId: child.id, status: 'waiting', blockedReason: '납품 대기' });
  const props = ui({ workItems: [parent, child, leaf], visits: [visit('leaf-visit', leaf.id)] });
  setDate(render(props), '2026-09-15');
  clickGroup(find(render(props), (node) => node.props['data-calendar-group'] === 'calendar-group:2026-09-15:root'));
  const modal = find(render(props), (node) => node.props.role === 'dialog');
  const html = renderToStaticMarkup(modal);
  assert.match(html, /업무 1건 · 마감 1건 · 방문 1건 · 대기·막힘 1건/);
  assert.match(html, /상위 참고/);
  assert.match(html, /세부 업무 · 2단계/);
  assert.match(html, /납품 대기/);
  assert.equal(previewRows(render(props)).filter((row) => !row.props['data-context-only']).length, 1);
  assert.equal(nodes(modal).filter((node) => node.props['data-calendar-entry']).length, 2, 'deadline and visit belong to one work row');
  assert.equal(nodes(modal).some((node) => ['form', 'input', 'textarea', 'select'].includes(node.type)), false);
  assert.equal(find(modal, (node) => node.props['data-calendar-row'] === 'root').props['data-context-only'], true);
  assert.equal(find(modal, (node) => node.props['data-calendar-row'] === 'leaf').props['data-context-only'], false);
});

test('preview close callback runs only for close completion and returns focus only to a connected trigger', () => {
  const opened = [], props = ui({ visits: [], onOpenWork: (work) => opened.push(work) });
  setDate(render(props), '2026-09-15');
  const trigger = clickGroup(groupButtons(render(props))[0]);
  let preview = previewOf(render(props));
  preview.props.onOpenWork(props.workItems[0]);
  const dialog = WorkCalendarPreview(previewOf(render(props)).props);
  dialog.props.onOpenChangeComplete(true);
  assert.equal(opened.length, 0);
  assert.equal(preview.props.returnFocus(), trigger);
  trigger.isConnected = false;
  preview = previewOf(render(props));
  assert.equal(preview.props.returnFocus(), false);
  completePreviewClose(render(props));
  assert.equal(opened.length, 1);
});

test('week status summary shows processing, completed and blocked tasks once per work', () => {
  const works = [task('active', { status: 'in_progress' }), task('done', { status: 'completed' }), task('blocked', { status: 'waiting' }), task('new')];
  const props = ui({ workItems: works, visits: [visit('one', 'active'), visit('two', 'active'), visit('finished-visit', 'blocked', { status: 'completed' })] });
  setDate(render(props), '2026-09-15');
  const summary = () => find(render(props), (node) => node.type === 'dl' && node.props['aria-label'] === '9월 15일 (화) 업무 상태');
  const count = (status) => text(find(summary(), (node) => node.props['data-calendar-status'] === status));
  assert.equal(count('in_progress'), '처리 중1건');
  assert.equal(count('completed'), '완료0건');
  assert.equal(count('waiting'), '막힘1건');
  find(render(props), (node) => node.props.id === 'calendar-test-completed').props.onChange({ target: { checked: true } });
  assert.equal(count('in_progress'), '처리 중1건');
  assert.equal(count('completed'), '완료1건');
  assert.equal(count('waiting'), '막힘1건', 'completed visit does not complete its blocked work');
  assert.equal(nodes(summary()).some((node) => node.type === 'button'), false);
  const day = find(render(props), (node) => node.type === 'section' && node.props['aria-label'] === '9월 15일 (화)');
  assert.equal(nodes(day).some((node) => node.type === 'p' && /마감|방문/.test(text(node))), false, 'status summary replaces the former deadline/visit line');
  assert.equal(nodes(day).filter((node) => node.type === 'dl').length, 1);
});

test('week status counts respect date, owner and project filters and retain all matches beyond three groups', () => {
  const works = [
    ...Array.from({ length: 5 }, (_, index) => task(`active-${index}`, { status: 'in_progress' })),
    task('blocked', { status: 'waiting' }), task('done', { status: 'completed' }),
    task('other-project', { projectId: 'p2', status: 'waiting' }),
    task('other-owner', { owner: '평화', status: 'completed' }),
    task('tomorrow', { dueDate: '2026-09-16', status: 'waiting' }),
  ];
  const props = ui({ workItems: works, visits: [] });
  setDate(render(props), '2026-09-15');
  find(render(props), (node) => node.props.id === 'calendar-test-project').props.onChange({ target: { value: 'p1' } });
  find(render(props), (node) => node.props.id === 'calendar-test-owner').props.onChange({ target: { value: '담호' } });
  find(render(props), (node) => node.props.id === 'calendar-test-completed').props.onChange({ target: { checked: true } });
  const summary = find(render(props), (node) => node.type === 'dl' && node.props['aria-label'] === '9월 15일 (화) 업무 상태');
  assert.equal(text(find(summary, (node) => node.props['data-calendar-status'] === 'in_progress')), '처리 중5건');
  assert.equal(text(find(summary, (node) => node.props['data-calendar-status'] === 'completed')), '완료1건');
  assert.equal(text(find(summary, (node) => node.props['data-calendar-status'] === 'waiting')), '막힘1건');
  const day = find(render(props), (node) => node.type === 'section' && node.props['aria-label'] === '9월 15일 (화)');
  assert.equal(groupButtons(day).length, 3);
  assert.ok(find(day, (node) => node.type === 'button' && text(node) === '+4묶음 더보기'));
});

test('empty week days display zero status counts without changing month or day layout', () => {
  const props = ui({ workItems: [], visits: [] });
  setDate(render(props), '2026-09-15');
  const summaries = nodes(render(props)).filter((node) => node.type === 'dl' && node.props['aria-label']?.endsWith('업무 상태'));
  assert.equal(summaries.length, 7);
  assert.equal(summaries.every((node) => text(node) === '처리 중0건완료0건막힘0건'), true);
  selectView(render(props), '월간');
  assert.equal(nodes(render(props)).some((node) => node.props['data-calendar-status']), false);
  selectView(render(props), '일간');
  assert.equal(nodes(render(props)).some((node) => node.props['data-calendar-status']), false);
});

test('calendar integration reuses authorized workspace data and existing detail popup', () => {
  const source = readFileSync(new URL('../app/farm-ledger-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /\['calendar', '달력', CalendarClock, null\]/);
  const binding = source.match(/<WorkCalendar[\s\S]*?\/>/)?.[0];
  assert.ok(binding);
  for (const prop of ['workItems', 'visits', 'projects', 'farms', 'historyEntries']) {
    assert.ok(binding.includes(`${prop}={workspace.${prop}}`));
  }
  assert.ok(binding.includes('farmRecords={workspace.records}'));
  assert.ok(binding.includes('onOpenWork={(item) => openFarm(item.farmId, item.id)}'));
  assert.doesNotMatch(source, /<FarmMapPanel/);
});
