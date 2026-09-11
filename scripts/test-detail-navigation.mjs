import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = (path) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = (path, module = ts.ModuleKind.ESNext) =>
  ts.transpileModule(source(path), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module },
  }).outputText;
const navigationModule = await import(
  `data:text/javascript;base64,${Buffer.from(compile('lib/detail-navigation.ts')).toString('base64')}`
);
const { createDetailNavigation, readDetailNavigation } = navigationModule;
const snapshot = (changes = {}) => ({
  view: 'overview',
  target: null,
  projectTab: 'summary',
  farmTab: 'work',
  trail: [],
  scrollY: 820,
  listScrollY: 0,
  ...changes,
});
const project = { kind: 'project', projectId: 'p1' };
const work = { kind: 'work', farmId: '', workItemId: 'w1', projectId: 'p1' };
const farm = { kind: 'farm', farmId: 'f1', projectId: 'p1' };
const trail = (state) => ({
  target: state.target,
  scrollY: state.scrollY,
  projectTab: state.projectTab,
  farmTab: state.farmTab,
});

class FakeHistory {
  entries = [{ external: true }, { __NA: true, tree: { host: 'preserved' } }];
  index = 1;
  queue = [];
  urls = [];
  scrollRestoration = 'auto';
  get state() {
    return this.entries[this.index];
  }
  pushState(state, unused, url) {
    this.urls.push(url);
    this.entries.splice(this.index + 1);
    this.entries.push(structuredClone(state));
    this.index++;
  }
  replaceState(state, unused, url) {
    this.urls.push(url);
    this.entries[this.index] = structuredClone(state);
  }
  back() {
    this.go(-1);
  }
  go(delta) {
    this.queue.push(delta);
  }
  flush(onPop) {
    assert.ok(this.queue.length, 'queued history traversal expected');
    const next = this.index + this.queue.shift();
    if (next < 0 || next >= this.entries.length) return;
    this.index = next;
    onPop(this.state);
  }
}

function harness(initial = snapshot(), history = new FakeHistory()) {
  let current = initial,
    pending = null,
    allowed = true,
    id = 0;
  const restores = [];
  const controller = createDetailNavigation(
    history,
    () => current,
    (next) => {
      pending = next;
      restores.push(next);
    },
    () => `navigation-${history.entries.length}-${++id}`,
    () => allowed,
  );
  return {
    history,
    controller,
    restores,
    get current() {
      return current;
    },
    edit(changes) {
      current = { ...current, ...changes };
    },
    guard(value) {
      allowed = value;
    },
    commit() {
      if (!pending) return;
      current = pending;
      pending = null;
      controller.committed(current);
    },
    push(next) {
      assert.equal(controller.push(next), true);
      current = next;
      controller.committed(next);
    },
    replace(next, reset = false) {
      assert.equal(controller.replace(next, reset), true);
      current = next;
      controller.committed(next);
    },
    flush(commit = true) {
      history.flush((state) => controller.pop(state));
      if (commit) this.commit();
    },
    nativeBack(commit = true) {
      history.back();
      this.flush(commit);
    },
    forward(commit = true) {
      history.go(1);
      this.flush(commit);
    },
  };
}

test('통합 현황 → 프로젝트 → 브라우저 뒤로가기는 통합 현황과 스크롤을 복원한다', () => {
  const h = harness();
  h.push(snapshot({ target: project, scrollY: 0, listScrollY: 820 }));
  h.nativeBack();
  assert.equal(h.current.view, 'overview');
  assert.equal(h.current.target, null);
  assert.equal(h.current.scrollY, 820);
});

test('프로젝트 관리·업무 현황·농가 목록에서 진입하면 각각 출발 목록으로 돌아간다', () => {
  for (const view of ['projects', 'work', 'farms']) {
    const h = harness(snapshot({ view }));
    h.push(snapshot({ view, target: project, scrollY: 0 }));
    assert.equal(h.controller.back(), true);
    h.flush();
    assert.equal(h.current.view, view);
    assert.equal(h.current.target, null);
  }
});

test('프로젝트 → 농가 → 업무의 뒤로가기와 앞으로가기는 탭·사업 문맥·스크롤을 보존한다', () => {
  const h = harness();
  const p = snapshot({
    target: project,
    projectTab: 'farms',
    scrollY: 460,
    listScrollY: 820,
  });
  const f = snapshot({
    target: farm,
    farmTab: 'work',
    scrollY: 230,
    listScrollY: 820,
    trail: [trail(p)],
  });
  const w = snapshot({
    target: work,
    scrollY: 0,
    listScrollY: 820,
    trail: [trail(p), trail(f)],
  });
  h.push(p);
  h.push(f);
  h.push(w);
  h.nativeBack();
  assert.deepEqual(h.current, f);
  h.nativeBack();
  assert.deepEqual(h.current, p);
  h.forward();
  assert.deepEqual(h.current, f);
  h.forward();
  assert.deepEqual(h.current, w);
});

test('화면 뒤로가기가 같은 history를 소비하여 가짜 상세 기록을 남기지 않는다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  const count = h.history.entries.length;
  assert.equal(h.controller.back(), true);
  h.flush();
  assert.equal(h.history.entries.length, count);
  assert.equal(h.controller.back(), false);
  h.forward();
  assert.deepEqual(h.current.target, project);
});

test('상세에서 변경한 탭과 스크롤은 뒤로간 뒤 앞으로가도 유지한다', () => {
  const h = harness();
  h.push(snapshot({ target: project, scrollY: 0 }));
  h.edit({ projectTab: 'tasks', scrollY: 930 });
  h.nativeBack();
  h.forward();
  assert.equal(h.current.projectTab, 'tasks');
  assert.equal(h.current.scrollY, 930);
});

test('다른 메뉴를 선택한 후 상세를 열면 새 메뉴로 복귀한다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.replace(snapshot({ view: 'work', scrollY: 0 }), true);
  assert.equal(h.controller.back(), false);
  h.push(snapshot({ view: 'work', target: work, scrollY: 0 }));
  h.nativeBack();
  assert.equal(h.current.view, 'work');
  assert.equal(h.current.target, null);
  assert.equal(h.current.trail.length, 0);
});

test('뒤로가기 처리 중 중복 클릭과 새 이동은 보류한다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.controller.back();
  h.controller.back();
  assert.equal(h.history.queue.length, 1);
  assert.equal(h.controller.push(snapshot({ target: work })), false);
  assert.equal(h.controller.replace(snapshot({ view: 'farms' })), false);
  h.flush();
  h.push(snapshot({ target: farm }));
});

test('화면 뒤로가기는 입력창이 열려 있으면 이동하지 않는다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.guard(false);
  assert.equal(h.controller.back(), true);
  assert.equal(h.history.queue.length, 0);
  assert.deepEqual(h.current.target, project);
});

test('입력창에서 브라우저 뒤로가기는 원래 상세 기록으로 되돌리고 초안을 보존한다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.guard(false);
  h.nativeBack();
  assert.equal(h.restores.length, 0);
  assert.equal(h.history.queue.length, 1);
  h.flush();
  assert.deepEqual(
    readDetailNavigation(h.history.state).snapshot.target,
    project,
  );
  assert.deepEqual(h.current.target, project);
  h.guard(true);
  h.nativeBack();
  assert.equal(h.current.target, null);
});

test('앞으로가기와 여러 단계를 건너뛰는 뒤로가기도 입력창 보호를 적용한다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.push(snapshot({ target: work }));
  h.guard(false);
  h.history.go(-2);
  h.flush();
  h.flush();
  assert.deepEqual(h.current.target, work);
  h.guard(true);
  h.nativeBack();
  h.guard(false);
  h.forward();
  h.flush();
  assert.deepEqual(h.current.target, project);
});

test('초기 목록에서는 앱 밖의 이전 기록을 가두거나 추가하지 않는다', () => {
  const h = harness();
  assert.equal(h.controller.back(), false);
  const count = h.history.entries.length;
  h.nativeBack();
  assert.equal(h.history.state.external, true);
  assert.equal(h.history.entries.length, count);
  assert.equal(h.controller.pop({ anotherApp: true }), false);
});

test('Next.js history 필드와 현재 release URL을 보존하고 직렬화 가능한 값만 저장한다', () => {
  const h = harness();
  h.push(snapshot({ target: work }));
  h.nativeBack();
  assert.equal(h.history.state.__NA, true);
  assert.deepEqual(h.history.state.tree, { host: 'preserved' });
  assert.ok(h.history.urls.every((url) => url === undefined));
  assert.doesNotThrow(() => structuredClone(h.history.state));
});

test('새로고침 전에 저장한 최신 탭·스크롤을 복원하고 기존 뒤로가기를 유지한다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.edit({ projectTab: 'documents', scrollY: 715 });
  h.controller.save();
  const reloaded = harness(snapshot(), h.history);
  reloaded.commit();
  assert.equal(reloaded.current.projectTab, 'documents');
  assert.equal(reloaded.current.scrollY, 715);
  assert.equal(reloaded.controller.back(), true);
  reloaded.flush();
  assert.equal(reloaded.current.target, null);
});

test('연속 popstate 중 렌더 전 상태로 중간 프로젝트를 덮어쓰지 않는다', () => {
  const h = harness();
  const p = snapshot({ target: project, projectTab: 'tasks', scrollY: 200 });
  h.push(p);
  h.push(snapshot({ target: work }));
  h.nativeBack(false);
  h.nativeBack(false);
  assert.deepEqual(h.current.target, work, 'simulate delayed React commit');
  h.commit();
  assert.equal(h.current.target, null);
  h.forward();
  assert.deepEqual(h.current, p);
});

test('같은 프로젝트를 재방문한 기록도 연속 이동 중 이전 탭을 보존한다', () => {
  const h = harness();
  const first = snapshot({ target: project, projectTab: 'farms' });
  h.push(first);
  h.push(snapshot({ target: work }));
  h.push(snapshot({ target: project, projectTab: 'documents' }));
  h.nativeBack(false);
  h.nativeBack(false);
  h.forward(false);
  h.commit();
  assert.deepEqual(h.current.target, work);
  h.nativeBack();
  assert.deepEqual(h.current, first);
});

test('복원 렌더 이전 저장·버튼 클릭은 최신 예정 화면을 손상시키지 않는다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.push(snapshot({ target: work }));
  h.nativeBack(false);
  h.controller.save();
  assert.deepEqual(
    readDetailNavigation(h.history.state).snapshot.target,
    project,
  );
  assert.equal(h.controller.push(snapshot({ target: farm })), false);
  assert.equal(h.controller.replace(snapshot()), false);
  h.controller.back();
  assert.equal(h.history.queue.length, 0);
  h.commit();
  h.nativeBack();
  assert.equal(h.current.target, null);
});

test('지난 렌더의 완료 신호로 더 최신 복원의 보호를 해제하지 않는다', () => {
  const h = harness();
  h.push(snapshot({ target: project }));
  h.push(snapshot({ target: work }));
  h.nativeBack(false);
  const stale = h.restores.at(-1);
  h.nativeBack(false);
  h.controller.committed(stale);
  assert.equal(h.controller.push(snapshot({ target: farm })), false);
  h.commit();
  h.push(snapshot({ target: farm }));
});

test('잘못된 history marker는 복원하지 않고 현재 목록에서 시작한다', () => {
  const h = harness();
  const valid = structuredClone(h.history.state);
  const key = '__farmLedgerDetailNavigation';
  for (const change of [
    { version: 2 },
    { position: -1 },
    { position: 1.5 },
    { snapshot: snapshot({ view: 'unknown' }) },
    { snapshot: snapshot({ target: { kind: 'work' } }) },
    { snapshot: snapshot({ scrollY: NaN }) },
    { snapshot: snapshot({ trail: [{}] }) },
  ]) {
    const malformed = { ...valid, [key]: { ...valid[key], ...change } };
    assert.equal(readDetailNavigation(malformed), null);
  }
});

function hookHarness() {
  const history = new FakeHistory(),
    listeners = new Map(),
    slots = [];
  let cursor = 0,
    effects = [];
  const mockWindow = {
    history,
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    removeEventListener(name, fn) {
      if (listeners.get(name) === fn) listeners.delete(name);
    },
  };
  const react = {
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useState(initial) {
      const i = cursor++;
      const slot = (slots[i] ??= { value: initial });
      return [
        slot.value,
        (value) => {
          slot.value = value;
        },
      ];
    },
    useEffect(callback, deps) {
      const i = cursor++,
        previous = slots[i];
      if (
        !previous ||
        !deps ||
        deps.some((value, n) => value !== previous.deps?.[n])
      ) {
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          slots[i].cleanup?.();
          slots[i].cleanup = callback();
        });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    compile('app/use-detail-navigation.ts', ts.ModuleKind.CommonJS),
    {
      module,
      exports: module.exports,
      window: mockWindow,
      crypto: webcrypto,
      require: (name) => (name === 'react' ? react : navigationModule),
    },
  );
  return {
    history,
    listeners,
    render(capture, restore, guard = () => true) {
      cursor = 0;
      effects = [];
      const ref = module.exports.useDetailNavigation(capture, restore, guard);
      for (const effect of effects) effect();
      return ref;
    },
    flush() {
      history.flush((state) => listeners.get('popstate')({ state }));
    },
    cleanup() {
      for (const slot of slots) slot?.cleanup?.();
    },
  };
}

test('hook은 popstate·pagehide를 연결하고 해제 시 원래 스크롤 정책을 복구한다', () => {
  const h = hookHarness();
  h.render(
    () => snapshot(),
    () => {},
  );
  assert.equal(h.history.scrollRestoration, 'manual');
  assert.equal(h.listeners.size, 2);
  h.cleanup();
  assert.equal(h.listeners.size, 0);
  assert.equal(h.history.scrollRestoration, 'auto');
});

test('hook은 최신 렌더의 콜백을 저장하고 React 반영 후 이동 잠금을 해제한다', () => {
  const h = hookHarness();
  let current = snapshot(),
    restored = null;
  const render = () => {
    const rendered = current;
    return h.render(
      () => rendered,
      (next) => {
        restored = next;
      },
    );
  };
  const ref = render();
  const next = snapshot({ target: project });
  assert.equal(ref.current.push(next), true);
  assert.equal(ref.current.push(snapshot({ target: work })), false);
  current = next;
  render();
  current = { ...next, projectTab: 'documents', scrollY: 444 };
  render();
  h.listeners.get('pagehide')();
  assert.equal(readDetailNavigation(h.history.state).snapshot.scrollY, 444);
  ref.current.back();
  h.flush();
  assert.equal(restored.target, null);
  assert.equal(ref.current.push(snapshot({ target: work })), false);
  current = restored;
  render();
  assert.equal(ref.current.push(snapshot({ target: farm })), true);
  h.cleanup();
});

test('hook은 렌더 전 뒤로·앞으로 왕복해 같은 snapshot으로 돌아와도 이동 잠금을 해제한다', () => {
  const h = hookHarness();
  let current = snapshot();
  const render = () =>
    h.render(
      () => current,
      (next) => {
        current = next;
      },
    );
  const ref = render();
  const next = snapshot({ target: project });
  ref.current.push(next);
  current = next;
  render();
  // No React render/effect between these two native events.
  h.history.back();
  h.flush();
  h.history.go(1);
  h.flush();
  render();
  assert.equal(ref.current.push(snapshot({ target: work })), true);
  h.cleanup();
});

test('대시보드 복원은 검색·필터·펼침 상태를 초기화하지 않고 DOM을 history에서 제외한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const restore = dashboard.slice(
    dashboard.indexOf('  function restoreDetailNavigation('),
    dashboard.indexOf('  function openScopedWork('),
  );
  assert.doesNotMatch(restore, /set\w*(?:Filter|Search|Expanded|Collapsed)\(/);
  assert.match(restore, /focusElement: null/);
  assert.match(
    restore,
    /pendingNavigationScrollRef.current = snapshot.scrollY/,
  );
  const capture = dashboard.slice(
    dashboard.indexOf('  function captureDetailNavigation('),
    dashboard.indexOf('  function canGoBackDetail('),
  );
  assert.doesNotMatch(capture, /focusElement/);
  assert.match(capture, /pendingNavigationScrollRef.current \?\?/);
  const open = dashboard.slice(
    dashboard.indexOf('  function openDetail('),
    dashboard.indexOf('  function closeDetails('),
  );
  assert.match(open, /sameDetailTarget\(current, target\)/);
  assert.match(open, /detailNavigation.current.push\(next\)/);
});

test('빠른 수정 팝업은 기존 뒤로가기 보호에 포함되고 모든 업무 목록에서 열림을 연결한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const guard = dashboard.slice(
    dashboard.indexOf('  function canGoBackDetail('),
    dashboard.indexOf('  function restoreDetailNavigation('),
  );
  assert.match(guard, /workQuickEditOpen/);
  const surfaces = [
    ...dashboard.matchAll(
      /<WorkTaskSurface\b([\s\S]*?)\bonSave=\{saveQuickWork\}/g,
    ),
  ];
  assert.equal(surfaces.length, 4);
  for (const [, props] of surfaces)
    assert.match(props, /onEditingChange=\{setWorkQuickEditOpen\}/);
  const list = surfaces.find(([, props]) => props.includes('items={filteredWorkItems}') && props.includes('mode="list"'));
  assert.ok(list, 'the filtered task list is connected');
  assert.match(list[1], /searching=\{Boolean\(workSearch.trim\(\)\)\}/);
  const controls = source('app/work-task-controls.tsx');
  assert.doesNotMatch(controls, /scrollIntoView/);
});
