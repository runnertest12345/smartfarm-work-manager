import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let states = [], effects = [], pending = [], cursor = 0, sequence = 0;
const listeners = new Map();
const hooks = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
  useId() { return hooks.useState(() => `work-title-${++sequence}`)[0]; },
  useEffect(effect, deps) {
    const index = cursor++, before = effects[index];
    if (!before || !deps || deps.some((dep, i) => !Object.is(dep, before.deps?.[i]))) {
      pending.push(() => {
        before?.cleanup?.();
        effects[index] = { deps, cleanup: effect() };
      });
    }
  },
};
hooks.useLayoutEffect = (effect, deps) => hooks.useEffect(effect, deps);
const primitive = (tag) => function Primitive({ children, size: _size, variant: _variant, ...props }) {
  return React.createElement(tag, props, children);
};
const Button = primitive('button'), Input = primitive('input');
function load(path, aliases = {}) {
  const result = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, {
    module: result, exports: result.exports, Error,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    window: {
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
    },
    require: (name) => name === 'react' ? hooks : aliases[name] || require(name),
  });
  return result.exports;
}
const titleHelpers = load('lib/work-title.ts', { './organization': {} });
const { WorkTitleEditor } = load('app/work-title-editor.tsx', {
  '@/components/ui/button': { Button }, '@/components/ui/input': { Input },
  '@/lib/work-title': titleHelpers,
});
const task = { id: 'title-test', title: '원래 업무', updatedAt: 100, status: 'open', workType: 'communication' };
const nodes = (element) => !element || typeof element !== 'object' ? [] : [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
const find = (tree, check) => {
  const result = nodes(tree).find(check);
  assert.ok(result, 'Expected editor element exists');
  return result;
};
const byType = (tree, type) => find(tree, (node) => node.type === type);
const edit = (tree) => find(tree, (node) => node.props['aria-label']?.startsWith('업무명 수정:')).props.onClick();
const change = (tree, title) => byType(tree, Input).props.onChange({ target: { value: title } });
const submit = (tree) => byType(tree, 'form').props.onSubmit({ preventDefault() {} });
const cancel = (tree) => find(tree, (node) => node.type === Button && node.props.children === '취소').props.onClick();
const saveButton = (tree) => find(tree, (node) => node.type === Button && node.props.type === 'submit');
const html = (tree) => renderToStaticMarkup(tree);
function unmount() {
  for (const entry of effects) entry?.cleanup?.();
}
function harness(extra = {}) {
  unmount(); states = []; effects = []; pending = []; cursor = 0; listeners.clear();
  const saves = [], guards = [], focus = [];
  let props = {
    task, canEdit: true,
    onSave: async (base, title, operationId) => { saves.push({ base, title, operationId }); return { ...base, title, updatedAt: 101 }; },
    onEditingChange: (value) => guards.push(value), ...extra,
  };
  const render = (patch = {}) => {
    props = { ...props, ...patch }; cursor = 0; pending = [];
    const tree = WorkTitleEditor(props);
    for (const node of nodes(tree)) {
      if (node.props.ref) node.props.ref.current = {
        focus: () => focus.push(node.type), select: () => focus.push('select'),
      };
    }
    for (const effect of pending) effect();
    return tree;
  };
  return { render, saves, guards, focus };
}

test('title is a one-click accessible heading control with a bounded inline form', () => {
  const h = harness(); let tree = h.render();
  assert.equal(byType(tree, 'h1').props.tabIndex, -1);
  assert.match(html(tree), /업무명 수정: 원래 업무/);
  edit(tree); tree = h.render();
  assert.equal(byType(tree, Input).props.value, task.title);
  assert.equal(byType(tree, Input).props.maxLength, 200);
  assert.ok(h.focus.includes('select'));
  assert.doesNotMatch(html(tree), /role="dialog"/);
  assert.equal(h.guards.at(-1), false);
});
test('h3 mode and read-only titles remain proper headings without edit controls', () => {
  const h = harness({ headingLevel: 3, canEdit: false });
  const tree = h.render();
  assert.equal(byType(tree, 'h3').props.children, task.title);
  assert.doesNotMatch(html(tree), /업무명 수정:/);
});
test('input synchronously raises navigation guard, unload blocks, and cancellation restores focus', () => {
  const h = harness(); edit(h.render()); let tree = h.render();
  change(tree, '새 이름');
  assert.equal(h.guards.at(-1), true, 'guard must change before render');
  tree = h.render();
  const event = { preventDefault() { this.prevented = true; } };
  listeners.get('beforeunload')(event);
  assert.equal(event.prevented, true);
  cancel(tree);
  assert.equal(h.guards.at(-1), false);
  tree = h.render();
  assert.equal(listeners.has('beforeunload'), false);
  assert.match(html(tree), /원래 업무/);
  assert.equal(h.focus.at(-1), 'button');
  assert.equal(h.saves.length, 0);
});
test('save trims and holds the original snapshot while successful response appears before realtime refresh', async () => {
  const h = harness(); edit(h.render()); let tree = h.render();
  change(tree, '  바꾼 업무  ');
  await submit(tree); tree = h.render();
  assert.equal(h.saves.length, 1);
  assert.equal(h.saves[0].title, '바꾼 업무');
  assert.equal(h.saves[0].base.updatedAt, 100);
  assert.equal(h.saves[0].base.title, '원래 업무');
  assert.match(h.saves[0].operationId, /^[\da-f-]{36}$/);
  assert.match(html(tree), /바꾼 업무/);
  assert.match(html(tree), /업무명 저장됨/);
  assert.equal(h.guards.at(-1), false);
  assert.match(html(h.render({ task: { ...task, title: '다른 최신 이름', updatedAt: 102 } })), /다른 최신 이름/);
});
test('unchanged trimmed title is a no-op and finishes inline editing', async () => {
  const h = harness(); edit(h.render()); const tree = h.render();
  change(tree, ' 원래 업무 ');
  assert.equal(h.guards.at(-1), false);
  await submit(tree);
  assert.equal(h.saves.length, 0);
  assert.equal(nodes(h.render()).some((node) => node.type === 'form'), false);
});
test('empty and over-limit drafts are preserved without saving', async () => {
  for (const value of ['   ', '가'.repeat(201)]) {
    const h = harness(); edit(h.render()); let tree = h.render();
    change(tree, value); await submit(tree); tree = h.render();
    assert.equal(h.saves.length, 0);
    assert.equal(byType(tree, Input).props.value, value);
    assert.match(html(tree), /1~200자/);
    assert.equal(h.guards.at(-1), true);
  }
});
test('busy ref prevents duplicate submits and cancel even before React renders', async () => {
  let resolve, calls = 0;
  const h = harness({ onSave: () => { calls++; return new Promise((done) => { resolve = done; }); } });
  edit(h.render()); let tree = h.render(); change(tree, '변경');
  const request = submit(tree); submit(tree); cancel(tree); change(tree, '덮어쓰기');
  assert.equal(calls, 1); assert.equal(h.guards.at(-1), true);
  tree = h.render();
  assert.equal(byType(tree, Input).props.value, '변경');
  assert.equal(saveButton(tree).props.disabled, true);
  assert.equal(find(tree, (node) => node.type === Button && node.props.children === '취소').props.disabled, true);
  resolve({ ...task, title: '변경', updatedAt: 101 }); await request;
  assert.match(html(h.render()), /업무명 저장됨/);
});
test('failed save retains draft and mutation ID for retry, but a changed payload receives a new ID', async () => {
  const attempts = [];
  const h = harness({ onSave: async (base, title, operationId) => {
    attempts.push({ base, title, operationId }); throw new Error('연결 실패');
  } });
  edit(h.render()); let tree = h.render(); change(tree, '초안');
  await submit(tree); tree = h.render();
  assert.equal(byType(tree, Input).props.value, '초안');
  assert.match(html(tree), /연결 실패/);
  assert.equal(h.guards.at(-1), true);
  await submit(tree); tree = h.render();
  assert.equal(attempts[0].operationId, attempts[1].operationId);
  change(tree, '다른 초안'); await submit(tree);
  assert.notEqual(attempts[1].operationId, attempts[2].operationId);
});
test('realtime conflict blocks stale handler submissions, preserves draft and cancel reveals latest', async () => {
  const h = harness(); edit(h.render()); const staleTree = h.render(); change(staleTree, '내 초안');
  const newer = { ...task, title: '다른 사람 수정', updatedAt: 101 };
  let tree = h.render({ task: newer });
  assert.equal(byType(tree, Input).props.value, '내 초안');
  assert.match(html(tree), /다른 변경이 먼저 저장/);
  assert.equal(saveButton(tree).props.disabled, true);
  await submit(staleTree); assert.equal(h.saves.length, 0);
  cancel(tree); tree = h.render(); assert.match(html(tree), /다른 사람 수정/);
});
test('status-only updatedAt conflict also blocks rename to prevent overwriting another mutation', async () => {
  const h = harness(); edit(h.render()); let tree = h.render(); change(tree, '내 초안');
  tree = h.render({ task: { ...task, status: 'waiting', updatedAt: 101 } });
  await submit(tree);
  assert.equal(h.saves.length, 0);
  assert.equal(saveButton(tree).props.disabled, true);
});
test('permission withdrawal or deletion locks the draft while leaving cancel available', async () => {
  for (const patch of [{ canEdit: false }, { task: { ...task, deletedAt: 101, updatedAt: 101 } }]) {
    const h = harness(); edit(h.render()); const stale = h.render(); change(stale, '내 초안');
    const tree = h.render(patch);
    assert.equal(byType(tree, Input).props.disabled, true);
    await submit(stale); change(stale, '차단해야 함');
    assert.equal(h.saves.length, 0);
    assert.equal(byType(h.render(), Input).props.value, '내 초안');
    cancel(tree); assert.equal(h.guards.at(-1), false);
    assert.doesNotMatch(html(h.render()), /업무명 수정:/);
  }
});
test('IME Enter does not submit and Escape cancels locally without closing the parent popup', async () => {
  const h = harness(); edit(h.render()); let tree = h.render(); change(tree, '입력');
  byType(tree, Input).props.onCompositionStart();
  const event = { key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  byType(tree, Input).props.onKeyDown(event);
  await submit(tree);
  assert.equal(event.prevented, true); assert.equal(event.stopped, true); assert.equal(h.saves.length, 0);
  byType(tree, Input).props.onCompositionEnd();
  const escape = { ...event, key: 'Escape', nativeEvent: { isComposing: false }, stopped: false, prevented: false };
  byType(tree, Input).props.onKeyDown(escape);
  assert.equal(escape.prevented, true); assert.equal(escape.stopped, true);
  tree = h.render(); assert.equal(nodes(tree).some((node) => node.type === 'form'), false);
});
test('normal Enter keeps native form submission; legacy 229 composing Enter is blocked', () => {
  const h = harness(); edit(h.render()); const tree = h.render();
  const event = { key: 'Enter', nativeEvent: { isComposing: false }, preventDefault() { this.prevented = true; }, stopPropagation() {} };
  byType(tree, Input).props.onKeyDown(event); assert.equal(event.prevented, undefined);
  byType(tree, Input).props.onKeyDown({ ...event, keyCode: 229, preventDefault() { event.prevented = true; } });
  assert.equal(event.prevented, true);
});
test('newest guard callback and unload listener clean up on unmount', () => {
  const h = harness(); edit(h.render()); let tree = h.render(); change(tree, '초안'); tree = h.render();
  const latest = []; h.render({ onEditingChange: (value) => latest.push(value) });
  unmount(); assert.equal(latest.at(-1), false); assert.equal(listeners.has('beforeunload'), false);
});
test('late save settlement after unmount does not restore editing guards or draft state', async () => {
  let resolve;
  const h = harness({ onSave: () => new Promise((done) => { resolve = done; }) });
  edit(h.render()); const tree = h.render(); change(tree, '초안');
  const request = submit(tree); h.render(); unmount();
  const count = h.guards.length; assert.equal(h.guards.at(-1), false);
  resolve({ ...task, title: '초안', updatedAt: 101 }); await request;
  assert.equal(h.guards.length, count);
});
