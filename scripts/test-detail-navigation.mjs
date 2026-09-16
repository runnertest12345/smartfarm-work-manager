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
function functionSource(path, name) {
  const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(matches.length, 1, `${path} must contain exactly one ${name} function`);
  return matches[0].getText(file);
}
function runDashboardFunction(name, context, args = '') {
  const code = ts.transpileModule(
    functionSource('app/farm-ledger-dashboard.tsx', name),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  return vm.runInNewContext(`${code}\n${name}(${args});`, context);
}

test('외부 삭제 수신은 업무명 초안이 있는 상세를 닫거나 편집기를 제거하지 않는다', () => {
  const path = 'app/farm-ledger-dashboard.tsx';
  const dashboard = source(path);
  const file = ts.createSourceFile(path, dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let deletionEffect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'useEffect' &&
      node.arguments[0]?.getText(file).includes('selectedWorkItem?.deletedAt')) deletionEffect = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(deletionEffect);
  assert.match(deletionEffect.arguments[1].getText(file), /workTitleEditing/);
  const callback = deletionEffect.arguments[0].getText(file);
  for (const dirty of [true, false]) {
    let scheduled = 0;
    const context = {
      selectedWorkItem: { deletedAt: 123 }, workDeletionTarget: null, dialog: null,
      quickDetailTaskId: '', workQuickEditOpen: false, workTitleEditingRef: { current: dirty },
      closeDetails: () => {}, requestAnimationFrame: () => { scheduled++; return 1; }, cancelAnimationFrame: () => {},
    };
    vm.runInNewContext(`(${callback})();`, context);
    assert.equal(scheduled, dirty ? 0 : 1);
  }
  assert.match(dashboard, /\{selectedWorkItem &&\s+isStandaloneWork\(selectedWorkItem\) &&/);
});
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
  // Extract the actual function, not a range ending at an unrelated helper.
  const restore = functionSource('app/farm-ledger-dashboard.tsx', 'restoreDetailNavigation');
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
    dashboard.indexOf('  function closeDetailPanel('),
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
  assert.equal(surfaces.length, 5);
  for (const [, props] of surfaces)
    assert.match(props, /onEditingChange=\{setWorkQuickEditOpen\}/);
  const list = surfaces.find(([, props]) => props.includes('items={filteredWorkItems}') && props.includes('mode="list"'));
  assert.ok(list, 'the filtered task list is connected');
  assert.match(list[1], /searching=\{Boolean\(workSearch.trim\(\)\)\}/);
  const controls = source('app/work-task-controls.tsx');
  assert.doesNotMatch(controls, /scrollIntoView/);
});

test('같은 화면 상세 패널은 배경 목록을 유지하고 패널 스크롤을 별도로 저장·복원한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(dashboard, /<Sheet\s+open=\{Boolean\(selectedProject \|\| selectedFarm \|\| selectedWorkItem\)\}/);
  assert.match(dashboard, /data-active-content=\{\s*!selectedProject && !selectedFarm && !selectedWorkItem[\s\S]*?className="page-content"/);
  assert.match(dashboard, /<div ref=\{detailPanelRef\}/);
  const capture = dashboard.slice(
    dashboard.indexOf('  function captureDetailNavigation('),
    dashboard.indexOf('  function canGoBackDetail('),
  );
  assert.match(capture, /currentDetailTarget\(\) \? detailPanelRef.current\?\.scrollTop \?\? 0/);
  assert.match(capture, /listScrollY: Math.max\(0, listScrollYRef.current\)/);
  const open = dashboard.slice(
    dashboard.indexOf('  function openDetail('),
    dashboard.indexOf('  function closeDetailPanel('),
  );
  assert.match(open, /scrollY: detailPanelRef.current\?\.scrollTop \?\? 0/);
  assert.match(open, /listScrollYRef.current = Math.max\(0, window.scrollY\)/);
  assert.match(open, /detailPanelRef.current\?\.scrollTo\(\{ top: 0/);
  assert.doesNotMatch(open, /window.scrollTo/);
  assert.match(dashboard, /detailPanelRef.current\?\.scrollTo\(\{ top, behavior: 'auto' \}\)/);
});

test('프로젝트·업무 선택은 중앙 모달 팝업이며 내부에서 농가·업무로 이동해도 팝업 문맥을 유지한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const sheet = source('components/ui/sheet.tsx');
  assert.match(dashboard, /const detailPopup = Boolean\(selectedProject \|\| selectedWorkItem\) \|\| detailTrail.some\(\(\{ target \}\) => target.kind === 'project' \|\| target.kind === 'work'\)/);
  assert.ok(dashboard.indexOf('const detailPopup =') > dashboard.indexOf('const selectedWorkItem ='), 'resolve the selected task before deriving popup mode');
  assert.match(dashboard, /modal=\{detailPopup \|\| isMobile\} disablePointerDismissal/);
  assert.match(dashboard, /displayMode=\{detailPopup \? 'dialog' : 'panel'\} showOverlay=\{detailPopup\}/);
  assert.match(sheet, /displayMode === 'dialog'[\s\S]*?top-1\/2 left-1\/2[\s\S]*?max-w-\[1200px\][\s\S]*?-translate-x-1\/2 -translate-y-1\/2/);
  assert.match(sheet, /h-\[min\(92dvh,1100px\)\]/);
  assert.match(dashboard, /<SheetHeader className="shrink-0/);
  assert.match(dashboard, /detailPopup \? 'z-50' : 'z-40/);
});

test('프로젝트 바로 수정 초안도 상세 닫기·뒤로가기·메뉴 전환 보호에 포함된다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const guard = dashboard.slice(
    dashboard.indexOf('  function canGoBackDetail('),
    dashboard.indexOf('  function restoreDetailNavigation('),
  );
  assert.match(guard, /projectQuickEditingRef.current/);
  const close = dashboard.slice(
    dashboard.indexOf('  function closeDetailPanel('),
    dashboard.indexOf('  function backDetail('),
  );
  assert.ok(close.indexOf('if (!canGoBackDetail()) return') < close.indexOf('closeDetails()'));
  assert.match(close, /detailNavigation.current.replace/);
  assert.match(close, /listFocusRef.current[\s\S]*?focus\(\{ preventScroll: true \}\)/);
  assert.match(dashboard, /onEditingChange=\{\(editing\) => \{ projectQuickEditingRef.current = editing; \}\}/);
  const editor = source('app/project-quick-editor.tsx');
  assert.match(editor, /callback\.current\(\s*JSON\.stringify\(next\)\s*!==\s*JSON\.stringify\(projectQuickValues\(base\)\),?\s*\)/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /if \(busyRef.current \|\| !dirty \|\| project.deletedAt\) return/);
  const save = dashboard.slice(
    dashboard.indexOf('  async function saveProjectQuick('),
    dashboard.indexOf('  function projectListRow('),
  );
  assert.match(save, /expectedUpdatedAt: base.updatedAt/);
  assert.match(save, /projectQuickInput\(base, values\)/);
});

test('기본정보·정산·업무명 초안은 상세 전환과 브라우저 뒤로가기를 실제로 차단한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(dashboard, /useDetailNavigation\(\s*captureDetailNavigation,\s*restoreDetailNavigation,\s*canGoBackDetail,?\s*\)/);
  assert.match(dashboard, /onEditingChange=\{\(editing\) => \{\s*projectSettlementEditingRef\.current = editing;\s*\}\}/);
  for (const refName of ['projectQuickEditingRef', 'projectSettlementEditingRef', 'workTitleEditingRef']) {
    const context = {
      dialog: null,
      serviceRegistrationOpenRef: { current: false },
      childTaskParent: null,
      taskRegistrationOpen: false,
      quickDetailTaskId: '',
      workQuickEditOpen: false,
      projectDeletionTarget: null,
      workDeletionTarget: null,
      projectQuickEditingRef: { current: false },
      projectSettlementEditingRef: { current: false },
      workTitleEditingRef: { current: false },
      submitting: false,
      toast: { add: () => {} },
    };
    const canGoBack = () => runDashboardFunction('canGoBackDetail', context);
    assert.equal(canGoBack(), true, 'a clean project remains navigable');
    context[refName].current = true;
    assert.equal(canGoBack(), false, `${refName} must block navigation`);
    // If the draft guard is missing, execution reaches the mutation path and
    // fails because mutation helpers are deliberately unavailable here.
    assert.doesNotThrow(() => runDashboardFunction('openDetail', {
      ...context,
      currentDetailTarget: () => project,
      sameDetailTarget: () => false,
      target: work,
    }, 'target'));

    const h = harness();
    h.push(snapshot({ target: project, projectTab: 'settlement' }));
    h.guard(canGoBack());
    h.nativeBack();
    assert.equal(h.restores.length, 0, 'the dirty project must not be unmounted');
    h.flush();
    assert.deepEqual(h.current.target, project);
    assert.equal(h.current.projectTab, 'settlement');
    context[refName].current = false;
    h.guard(canGoBack());
    h.nativeBack();
    assert.equal(h.current.target, null, 'saving or cancelling releases the guard');
  }
});

test('상세 닫기·프로젝트 탭·메뉴 이동은 동일한 초안 보호를 먼저 적용한다', () => {
  const close = functionSource('app/farm-ledger-dashboard.tsx', 'closeDetailPanel');
  const changeView = functionSource('app/farm-ledger-dashboard.tsx', 'changeView');
  const changeTab = functionSource('app/farm-ledger-dashboard.tsx', 'changeProjectDetailTab');
  for (const [body, mutation] of [[close, 'closeDetails()'], [changeView, 'setView(next)']]) {
    const guardIndex = body.indexOf('if (!canGoBackDetail())');
    assert.ok(guardIndex >= 0);
    assert.ok(body.indexOf(mutation) > guardIndex, `${mutation} must follow the guard`);
  }
  assert.match(changeTab, /if \(value !== projectDetailTab && !canGoBackDetail\(\)\) return;/);
  assert.ok(changeTab.indexOf('setProjectDetailTab(value)') > changeTab.indexOf('canGoBackDetail()'));
});

test('업무명 수정은 정확한 업무와 버전만 전용 API로 보내고 다른 업무 정보는 보내지 않는다', async () => {
  const calls = [], events = [];
  const base = { id: 'task-to-rename', title: '기존 업무', updatedAt: 100, status: 'waiting', parentWorkItemId: 'parent', childWorkItemIds: ['child'] };
  const result = { ...base, title: '새 업무', updatedAt: 200 };
  const context = {
    base, title: '새 업무', operationId: 'rename-operation-123456', member: { id: 'member' },
    canRenameWork: () => true,
    farmLedgerFetch: async (url, init) => { calls.push([url, init]); return { ok: true }; },
    readResponse: async () => ({ workItem: result }),
    waitForFarmLedgerSync: async () => { events.push('synced'); },
    toast: { add: () => events.push('success') },
  };
  const saved = await runDashboardFunction('saveWorkTitle', context, 'base, title, operationId');
  assert.equal(saved, result);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/farm-ledger');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0][1].body), { kind: 'work_title', workItemId: base.id, title: '새 업무', expectedUpdatedAt: 100, operationId: 'rename-operation-123456' });
  assert.deepEqual(events, ['synced', 'success']);
  context.canRenameWork = () => false;
  await assert.rejects(runDashboardFunction('saveWorkTitle', context, 'base, title, operationId'), /개인 계정/);
  assert.equal(calls.length, 1);
  context.canRenameWork = () => true;
  context.farmLedgerFetch = async () => ({ ok: false });
  context.readResponse = async () => ({ error: '최신 업무 확인 필요' });
  await assert.rejects(runDashboardFunction('saveWorkTitle', context, 'base, title, operationId'), /최신 업무 확인/);
  assert.deepEqual(events, ['synced', 'success']);
});

test('업무명 초안 중 기록·세부 업무 추가도 먼저 막고 모든 상세 종류가 같은 편집기를 연결한다', () => {
  let warned = 0;
  const context = { workTitleEditingRef: { current: true }, canGoBackDetail: () => { warned++; return false; }, task: { id: 'task' } };
  assert.doesNotThrow(() => runDashboardFunction('openHistoryDialog', context, 'task'));
  assert.doesNotThrow(() => runDashboardFunction('addChildTask', context, 'task'));
  assert.equal(warned, 2);
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.equal((dashboard.match(/<WorkTitleEditor key=\{selectedWorkItem.id\}/g) || []).length, 2);
  assert.equal((dashboard.match(/canEdit=\{canRenameWork\(selectedWorkItem, member\)\}/g) || []).length, 2);
  assert.equal((dashboard.match(/onEditingChange=\{\(editing\) => \{ workTitleEditingRef.current = editing; setWorkTitleEditing\(editing\); \}\}/g) || []).length, 2);
  const deletion = functionSource('app/farm-ledger-dashboard.tsx', 'workDeleteAction');
  assert.ok(deletion.indexOf('workTitleEditingRef.current') < deletion.indexOf('setWorkDeletionTarget(item)'));
});
