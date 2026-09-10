import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const require = createRequire(import.meta.url);
const source = (path) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
let state = [],
  cursor = 0;
const hooks = {
  ...React,
  useId: () => 'farm-progress-details',
  useState(initial) {
    const id = cursor++;
    if (!(id in state))
      state[id] = typeof initial === 'function' ? initial() : initial;
    return [
      state[id],
      (next) => {
        state[id] = typeof next === 'function' ? next(state[id]) : next;
      },
    ];
  },
  useRef(initial) {
    return this.useState(() => ({ current: initial }))[0];
  },
};
// Transpiled imports call useRef as a standalone function.
hooks.useRef = (initial) => hooks.useState(() => ({ current: initial }))[0];
function loadCode(code, aliases = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      Error,
      Date,
      crypto: webcrypto,
      ...globals,
      require: (name) =>
        name === 'react' ? hooks : aliases[name] || require(name),
    },
  );
  return module.exports;
}
const load = (path, aliases = {}) => loadCode(source(path), aliases);
const { summarizeProjectFarms } = load('lib/project-farm-progress.ts');
const { projectLifecyclePatch } = load('lib/project-lifecycle.ts');
const tag = (name) =>
  function Primitive({
    children,
    variant,
    size,
    onValueChange,
    onOpenChange,
    render,
    ...props
  }) {
    return React.createElement(name, props, children);
  };
const button = tag('button'),
  input = tag('input');
const table = Object.fromEntries(
  [
    'Table',
    'TableBody',
    'TableCell',
    'TableHead',
    'TableHeader',
    'TableRow',
  ].map((name, i) => [
    name,
    tag(['table', 'tbody', 'td', 'th', 'thead', 'tr'][i]),
  ]),
);
const collapseContext = React.createContext(false);
const collapsible = {
  Collapsible: ({ open, children }) =>
    React.createElement(
      collapseContext.Provider,
      { value: open },
      React.createElement('section', {}, children),
    ),
  CollapsibleContent: ({ children, ...props }) =>
    React.useContext(collapseContext)
      ? React.createElement('div', props, children)
      : null,
  CollapsibleTrigger: button,
};
const selects = Object.fromEntries(
  ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(
    (name) => [name, tag('div')],
  ),
);
const alerts = Object.fromEntries(
  [
    'AlertDialog',
    'AlertDialogContent',
    'AlertDialogHeader',
    'AlertDialogTitle',
    'AlertDialogDescription',
    'AlertDialogFooter',
    'AlertDialogCancel',
    'AlertDialogAction',
  ].map((name) => [name, tag('div')]),
);
const aliases = {
  '@/lib/project-farm-progress': load('lib/project-farm-progress.ts'),
  '@/components/ui/button': { Button: button },
  '@/components/ui/input': { Input: input },
  '@/components/ui/table': table,
  '@/components/ui/collapsible': collapsible,
  '@/components/ui/alert-dialog': alerts,
  '@/components/ui/select': selects,
  '@/components/ui/field': { Field: tag('div'), FieldLabel: tag('label') },
  '@/components/ui/card': { Card: tag('div'), CardContent: tag('div') },
  '@/lib/farm-types': load('lib/farm-types.ts'),
  '@/lib/dashboard-kpis': {},
};
const { ProjectFarmProgressCard, ProjectStageFigures, ProjectStageSummary } =
  load('app/project-farm-progress.tsx', aliases);
const { ProjectDeletionDialog } = load(
  'app/project-deletion-dialog.tsx',
  aliases,
);
const { ProjectYearSelector } = load('app/farm-kpi-panels.tsx', aliases);
const lifecycle = load('lib/work-lifecycle.ts', {
  './organization': load('lib/organization.ts'),
});
const { WorkDeletionDialog, DeletedWorkList } = load(
  'app/work-deletion-controls.tsx',
  { ...aliases, '@/lib/work-lifecycle': lifecycle },
);
const render = (component, props) => {
  cursor = 0;
  return component(props);
};
const reset = () => {
  state = [];
  cursor = 0;
};
const nodes = (element) =>
  !element || typeof element !== 'object'
    ? []
    : [
        element,
        ...React.Children.toArray(element.props?.children).flatMap(nodes),
      ];
const find = (tree, predicate) => {
  const node = nodes(tree).find(predicate);
  assert.ok(node, 'control found');
  return node;
};
const farmRecord = (farmId, patch = {}) => ({
  id: farmId,
  farmId,
  projectId: 'p1',
  lastActivityAt: 10,
  crop: '사과',
  installationDate: '',
  commissioningDate: '',
  educationDate: '',
  ...patch,
});
const records = [
  farmRecord('a', {
    installationDate: '2026-01-02',
    commissioningDate: '2026-01-03',
  }),
  farmRecord('b', { installationDate: '2026-01-02' }),
  farmRecord('c'),
];

test('농가 KPI는 같은 분모에서 완료율·완료·미완료 개소를 계산한다', () => {
  const before = structuredClone(records);
  const summary = summarizeProjectFarms(records, 'p1');
  assert.equal(summary.total, 3);
  assert.deepEqual(
    Array.from(summary.stages, (stage) => [
      stage.rate,
      stage.completed,
      stage.remaining,
    ]),
    [
      [67, 2, 1],
      [33, 1, 2],
      [0, 0, 3],
    ],
  );
  for (const stage of summary.stages)
    assert.equal(stage.completed + stage.remaining, summary.total);
  assert.deepEqual(records, before);
});
test('동일 농가 중 최신 참여 기록만 집계하며 다른 프로젝트는 섞지 않는다', () => {
  const summary = summarizeProjectFarms(
    [
      farmRecord('a', { id: 'old', installationDate: '2026-01-01' }),
      farmRecord('a', { id: 'new', lastActivityAt: 20 }),
      farmRecord('a', {
        projectId: 'p2',
        lastActivityAt: 30,
        installationDate: '2026-02-01',
      }),
    ],
    'p1',
  );
  assert.equal(summary.total, 1);
  assert.equal(summary.records[0].id, 'new');
  assert.equal(summary.stages[0].completed, 0);
});
test('농가 없음은 비율 공란·0개소, 날짜가 없으면 0%·전체 미완료다', () => {
  const empty = summarizeProjectFarms([], 'p1');
  assert.ok(
    empty.stages.every(
      (stage) =>
        stage.rate === null && stage.completed === 0 && stage.remaining === 0,
    ),
  );
  assert.ok(
    summarizeProjectFarms([farmRecord('a')], 'p1').stages.every(
      (stage) => stage.rate === 0 && stage.remaining === 1,
    ),
  );
});
test('농가 세부 보기는 화면 이동 없이 KPI 아래 표를 펼치고 다시 접는다', () => {
  reset();
  const props = {
    progress: summarizeProjectFarms(records, 'p1'),
    farmName: (id) => `테스트 농가 ${id}`,
  };
  let tree = render(ProjectFarmProgressCard, props);
  assert.doesNotMatch(renderToStaticMarkup(tree), /테스트 농가 a/);
  const toggle = find(tree, (node) => node.props?.['aria-controls']);
  assert.equal(toggle.props['aria-expanded'], false);
  toggle.props.onClick();
  tree = render(ProjectFarmProgressCard, props);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /세부 접기/);
  assert.match(html, /테스트 농가 a/);
  assert.match(html, /2026-01-03/);
  assert.match(html, /미완료/);
  assert.ok(html.indexOf('농가별 설치') > html.indexOf('67%'));
  assert.equal((html.match(/테스트 농가 /g) || []).length, 3);
  find(tree, (node) => node.props?.['aria-controls']).props.onClick();
  tree = render(ProjectFarmProgressCard, props);
  assert.doesNotMatch(renderToStaticMarkup(tree), /테스트 농가 a/);
  assert.match(renderToStaticMarkup(tree), /세부 보기/);
});
test('프로젝트 표의 KPI 표시가 요약 카드와 같은 수치를 사용한다', () => {
  const stage = summarizeProjectFarms(records, 'p1').stages[0];
  const html = renderToStaticMarkup(render(ProjectStageFigures, { stage }));
  assert.match(html, /67%/);
  assert.match(html, /완료 2개소/);
  assert.match(html, /미완료 1개소/);
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(
    dashboard,
    /<ProjectStageSummary\s+progress=\{snapshot.farmProgress\}/,
  );
  assert.match(dashboard, /progress=\{selectedProjectSnapshot.farmProgress\}/);
});

test('프로젝트 표는 비율만 먼저 표시하고 상세 보기에서 완료·미완료 개소를 펼친다', () => {
  reset();
  const props = {
    progress: summarizeProjectFarms(records, 'p1'),
    projectName: '테스트 사업',
  };
  let tree = render(ProjectStageSummary, props);
  let html = renderToStaticMarkup(tree);
  assert.match(html, /67%/);
  assert.match(html, /상세 보기/);
  assert.doesNotMatch(html, /완료 2개소|미완료 1개소/);
  find(tree, (node) => node.props?.onOpenChange).props.onOpenChange(true);
  tree = render(ProjectStageSummary, props);
  html = renderToStaticMarkup(tree);
  assert.match(html, /상세 접기/);
  assert.match(html, /완료 2개소/);
  assert.match(html, /미완료 1개소/);
  find(tree, (node) => node.props?.onOpenChange).props.onOpenChange(false);
  assert.doesNotMatch(
    renderToStaticMarkup(render(ProjectStageSummary, props)),
    /완료 2개소|미완료 1개소/,
  );
});

test('사업 기준 연도는 로그인 후 현재 연도로 시작하며 연도를 고정하지 않는다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(
    dashboard,
    /const \[projectYearFilter, setProjectYearFilter\] = useState\(\(\) =>\s*localDateString\(\)\.slice\(0, 4\)/,
  );
  const localDate = dashboard.match(
    /function localDateString\([\s\S]*?\n}/,
  )?.[0];
  assert.ok(localDate);
  for (const year of [2026, 2027]) {
    const date = new Date(year, 0, 1);
    const output = vm.runInNewContext(
      `${localDate}; localDateString(input).slice(0, 4)`,
      { input: date },
    );
    assert.equal(output, String(year));
  }
});
test('통합 현황은 연도 드롭다운을 사용하고 같은 선택값을 KPI와 목록에 전달한다', () => {
  const chosen = [];
  const props = {
    id: 'overview-project-year',
    projects: [
      { id: 'a', year: 2026 },
      { id: 'b', year: 2025 },
      { id: 'deleted', year: 2024, deletedAt: 1 },
    ],
    value: '2026',
    onChange: (year) => chosen.push(year),
  };
  const tree = render(ProjectYearSelector, props);
  assert.equal(nodes(tree).filter((node) => node.type === 'button').length, 0);
  const select = find(tree, (node) => node.type === selects.Select);
  assert.equal(
    find(tree, (node) => node.type === selects.SelectTrigger).props.id,
    props.id,
  );
  assert.equal(select.props.value, '2026');
  select.props.onValueChange('2025');
  select.props.onValueChange('all');
  select.props.onValueChange('invalid');
  assert.deepEqual(chosen, ['2025', 'all']);
  assert.deepEqual(
    nodes(tree)
      .filter((node) => node.type === selects.SelectItem)
      .map((node) => node.props.value),
    ['all', '2026', '2025'],
  );
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const overview = dashboard.slice(
    dashboard.indexOf("{view === 'overview'"),
    dashboard.indexOf("{view === 'work'"),
  );
  assert.match(overview, /<ProjectYearSelector/);
  assert.doesNotMatch(overview, /<ProjectYearSummary/);
  assert.match(overview, /value=\{projectYearFilter\}/);
  assert.match(overview, /summary=\{yearProjectKpis\}/);
  assert.match(overview, /overviewProjectRows.map/);
  assert.match(
    dashboard,
    /const yearProjects = filterProjectsByScope\(\s*activeProjects,\s*projectYearFilter/,
  );
});

test('프로젝트 관리도 연도 버튼 없이 선택 연도의 KPI와 표·카드 목록을 표시한다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const projects = dashboard.slice(
    dashboard.indexOf("{view === 'projects'"),
    dashboard.indexOf("{view === 'business'"),
  );
  assert.match(
    projects,
    /<ProjectYearSelector\s+id="management-project-year"\s+projects=\{activeProjects\}\s+value=\{projectYearFilter\}\s+onChange=\{setProjectYearFilter\}/,
  );
  assert.doesNotMatch(dashboard, /ProjectYearSummary/);
  assert.doesNotMatch(
    source('app/farm-kpi-panels.tsx'),
    /연도별 사업 집계|aria-pressed/,
  );
  assert.match(
    projects,
    /summary=\{yearProjectKpis\}\s+year=\{projectYearFilter\}/,
  );
  assert.equal((projects.match(/filteredProjects\.map/g) || []).length, 2);
  assert.match(dashboard, /const filteredProjects = yearProjects\s*\.filter/);
});

test('연도 선택은 빈 연도와 전체 연도를 유지하며 두 화면의 라벨을 연결한다', () => {
  for (const value of ['all', '2024']) {
    const tree = render(ProjectYearSelector, {
      id: 'management-project-year',
      projects: [{ id: 'a', year: 2026 }],
      value,
      onChange() {},
    });
    assert.equal(
      find(tree, (node) => node.props?.htmlFor).props.htmlFor,
      'management-project-year',
    );
    assert.equal(
      find(tree, (node) => node.type === selects.Select).props.value,
      value,
    );
    assert.ok(
      nodes(tree).some(
        (node) =>
          node.type === selects.SelectItem && node.props.value === value,
      ),
    );
  }
});

const project = { id: 'p1', name: '태백 사업', year: 2026, updatedAt: 10 };
test('삭제·복구는 새 시각과 감사 ID만 변경하며 중복 요청은 안전하다', () => {
  const patch = projectLifecyclePatch(project, 10, true, 20, 'user', 'audit1');
  assert.equal(patch.deletedAt, 20);
  assert.equal(patch.deletedByUid, 'user');
  assert.equal(patch.lifecycleUpdateId, 'audit1');
  assert.equal('name' in patch, false);
  assert.equal(
    projectLifecyclePatch(
      { ...project, ...patch },
      10,
      true,
      30,
      'user',
      'audit2',
    ),
    null,
  );
  const restored = projectLifecyclePatch(
    { ...project, ...patch },
    20,
    false,
    30,
    'user',
    'audit3',
  );
  assert.equal(restored.deletedAt, 0);
  assert.equal(restored.deletedByUid, '');
  assert.equal(project.deletedAt, undefined);
});
test('다른 변경 뒤 삭제·복구 또는 잘못된 확인 버전은 거절한다', () => {
  assert.throws(
    () => projectLifecyclePatch(project, 9, true, 20, 'user', 'audit'),
    /다른 변경/,
  );
  assert.throws(
    () =>
      projectLifecyclePatch(
        { ...project, deletedAt: 5 },
        9,
        false,
        20,
        'user',
        'audit',
      ),
    /다른 변경/,
  );
  assert.throws(
    () => projectLifecyclePatch(project, NaN, true, 20, 'user', 'audit'),
    /확인 시각/,
  );
});
test('삭제 확인은 프로젝트명 일치 후에만 실행하며 중복 저장·저장 중 닫기를 막는다', async () => {
  reset();
  let resolve,
    closed = 0;
  const sent = [];
  const props = {
    project,
    onClose: () => closed++,
    onConfirm: async (...args) => {
      sent.push(args);
      await new Promise((done) => {
        resolve = done;
      });
    },
  };
  let tree = render(ProjectDeletionDialog, props);
  assert.equal(
    find(tree, (node) => node.type === alerts.AlertDialogAction).props.disabled,
    true,
  );
  find(tree, (node) => node.type === input).props.onChange({
    target: { value: project.name },
  });
  tree = render(ProjectDeletionDialog, props);
  const action = find(tree, (node) => node.type === alerts.AlertDialogAction);
  assert.equal(action.props.disabled, false);
  const saving = action.props.onClick();
  await action.props.onClick();
  tree = render(ProjectDeletionDialog, props);
  let blocked = false;
  find(tree, (node) => node.type === alerts.AlertDialog).props.onOpenChange(
    false,
    {
      cancel() {
        blocked = true;
      },
    },
  );
  assert.equal(blocked, true);
  assert.equal(closed, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].id, 'p1');
  assert.equal(sent[0][1], true);
  resolve();
  await saving;
  assert.equal(closed, 1);
});
test('삭제 실패는 확인 입력·오류를 유지하고 복구는 원래 프로젝트만 대상으로 한다', async () => {
  reset();
  let closed = 0;
  const props = {
    project,
    onClose: () => closed++,
    onConfirm: async () => {
      throw new Error('다른 변경이 먼저 저장됐습니다');
    },
  };
  let tree = render(ProjectDeletionDialog, props);
  find(tree, (node) => node.type === input).props.onChange({
    target: { value: project.name },
  });
  tree = render(ProjectDeletionDialog, props);
  await find(
    tree,
    (node) => node.type === alerts.AlertDialogAction,
  ).props.onClick();
  tree = render(ProjectDeletionDialog, props);
  assert.equal(closed, 0);
  assert.equal(
    find(tree, (node) => node.type === input).props.value,
    project.name,
  );
  assert.match(
    find(tree, (node) => node.props?.role === 'alert').props.children,
    /다른 변경/,
  );
  reset();
  let sent;
  tree = render(ProjectDeletionDialog, {
    project: { ...project, deletedAt: 20 },
    onClose() {},
    onConfirm: async (...args) => {
      sent = args;
    },
  });
  assert.equal(
    nodes(tree).some((node) => node.type === input),
    false,
  );
  await find(
    tree,
    (node) => node.type === alerts.AlertDialogAction,
  ).props.onClick();
  assert.equal(sent[0].id, 'p1');
  assert.equal(sent[1], false);
});
test('추가 팝업 너비가 문자열로 전달되어 설치된 스타일 병합 과정에서 유지된다', () => {
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  const wrapper = dashboard.slice(
    dashboard.indexOf('function DialogContent('),
    dashboard.indexOf('const FARM_LOG_TYPE_LABELS'),
  );
  const BaseDialogContent = tag('div'),
    DialogClose = tag('button');
  const { DialogContent } = loadCode(
    'export ' + wrapper,
    {},
    { BaseDialogContent, DialogClose, Button: button, X: tag('span') },
  );
  const tree = render(DialogContent, {
    className: 'max-h-[92dvh] sm:max-w-[1100px]',
  });
  assert.equal(typeof tree.props.className, 'string');
  const className = twMerge(clsx('sm:max-w-sm', tree.props.className));
  assert.match(className, /farm-app farm-dialog/);
  assert.match(className, /sm:max-w-\[1100px\]/);
  assert.doesNotMatch(className, /sm:max-w-sm/);
  assert.match(
    dashboard,
    /<DialogContent className="max-h-\[92dvh\].*sm:max-w-\[1100px\]/,
  );
});
test('업무 삭제는 세부 업무를 먼저 정리하고 확인·복원·중복 저장 방지를 제공한다', async () => {
  reset();
  const task = {
    id: 'work1',
    title: '검토 업무',
    workType: 'communication',
    status: 'open',
    childWorkItemIds: ['child'],
  };
  let tree = render(WorkDeletionDialog, {
    task,
    onClose() {},
    onConfirm() {
      throw new Error('must not run');
    },
  });
  assert.equal(
    find(tree, (node) => node.type === alerts.AlertDialogAction).props.disabled,
    true,
  );
  reset();
  let closed = 0,
    done;
  const sent = [];
  const props = {
    task: { ...task, childWorkItemIds: [] },
    onClose: () => closed++,
    onConfirm: async (...args) => {
      sent.push(args);
      await new Promise((resolve) => (done = resolve));
    },
  };
  tree = render(WorkDeletionDialog, props);
  const action = find(tree, (node) => node.type === alerts.AlertDialogAction);
  const saving = action.props.onClick();
  await action.props.onClick();
  tree = render(WorkDeletionDialog, props);
  let canceled = false;
  find(tree, (node) => node.type === alerts.AlertDialog).props.onOpenChange(
    false,
    { cancel: () => (canceled = true) },
  );
  assert.equal(canceled, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], true);
  assert.ok(sent[0][2]);
  done();
  await saving;
  assert.equal(closed, 1);
  reset();
  let restored;
  tree = render(WorkDeletionDialog, {
    task: { ...task, deletedAt: 10, childWorkItemIds: [] },
    onClose() {},
    onConfirm: async (...args) => (restored = args),
  });
  await find(
    tree,
    (node) => node.type === alerts.AlertDialogAction,
  ).props.onClick();
  assert.equal(restored[1], false);
});

test('삭제된 업무 목록은 관리자·등록자에게만 복원을 보여주며 금융 증빙은 제외한다', () => {
  const member = {
    id: 'creator',
    active: true,
    email: 'creator@example.test',
    workspaceId: 'ws',
  };
  const tasks = [
    {
      id: 'task1',
      title: '지운 업무',
      status: 'waiting',
      workType: 'communication',
      createdByUid: member.id,
      deletedAt: 10,
    },
    { id: 'task2', title: '원래 업무', status: 'open' },
  ];
  for (const [person, count] of [
    [member, 1],
    [{ ...member, id: 'assignee' }, 0],
    [{ ...member, id: 'admin', admin: true }, 1],
    [{ ...member, active: false }, 0],
  ]) {
    reset();
    const tree = render(DeletedWorkList, {
      tasks,
      member: person,
      contextLabel: () => '내부 업무',
      onRestore() {},
    });
    assert.equal(
      nodes(tree).filter((node) => node.type === button).length,
      count,
    );
    assert.ok(!renderToStaticMarkup(tree).includes('원래 업무'));
  }
  assert.equal(
    lifecycle.canManageWorkDeletion(
      { ...tasks[0], workType: 'payment' },
      { ...member, admin: true },
    ),
    false,
  );
});

test('날짜 없는 완료 확인도 설치·시운전·교육 KPI와 상세에 반영하되 실제 날짜는 만들지 않는다', () => {
  reset();
  const record = farmRecord('a', {
    stageCompletionConfirmed: {
      installationDate: true,
      commissioningDate: true,
      educationDate: true,
      confirmedAt: 10,
      source: '사용자 확인',
    },
  });
  const summary = summarizeProjectFarms([record], 'p1');
  assert.ok(
    summary.stages.every(
      (stage) => stage.rate === 100 && stage.remaining === 0,
    ),
  );
  assert.equal(record.installationDate, '');
  const props = { progress: summary, farmName: () => '농가' };
  let tree = render(ProjectFarmProgressCard, props);
  find(tree, (node) => node.type === button).props.onClick();
  tree = render(ProjectFarmProgressCard, props);
  assert.match(renderToStaticMarkup(tree), /완료 확인 · 일자 미기록/);
});

test('삭제는 서버 최신 문서의 트랜잭션과 감사 기록만 쓰고 연결 컬렉션은 보존한다', () => {
  const store = source('lib/firebase/farm-ledger-store.ts');
  const deletion = store.slice(
    store.indexOf('async function changeProjectDeletion'),
    store.indexOf('async function changeWorkDeletion'),
  );
  assert.match(deletion, /runTransaction/);
  assert.match(deletion, /transaction.get\(reference\)/);
  assert.match(deletion, /projectLifecyclePatch/);
  assert.match(deletion, /transaction.update\(reference, patch\)/);
  assert.match(deletion, /setCreated\(transaction, 'projectUpdates', audit\)/);
  assert.doesNotMatch(
    deletion,
    /deleteDoc|\.delete\(|'farms'|'farmRecords'|'historyEntries'|'subscriptionEvents'/,
  );
  const dashboard = source('app/farm-ledger-dashboard.tsx');
  assert.match(
    dashboard,
    /workspace.projects.filter\(\(project\) => !project.deletedAt\)/,
  );
  assert.match(dashboard, /삭제한 프로젝트/);
  assert.match(dashboard, /projectDeletionTarget \|\|/);
  const rules = source('firestore.rules');
  assert.match(rules, /allow delete: if false/);
});
test('삭제 프로젝트의 기존 업무·입금 처리는 허용하되 새 프로젝트 연결은 막는다', () => {
  const store = source('lib/firebase/farm-ledger-store.ts');
  const guard = store.slice(
    store.indexOf('function assertProjectEditable('),
    store.indexOf('function systemProjectUpdate('),
  );
  const { assertProjectEditable } = loadCode('export ' + guard);
  const deleted = { ...project, status: 'active', deletedAt: 20 };
  assert.throws(() => assertProjectEditable(deleted), /삭제된 프로젝트/);
  assert.equal(assertProjectEditable(deleted, true).id, project.id);
  assert.throws(
    () => assertProjectEditable({ ...deleted, status: 'completed' }, true),
    /완료된 사업/,
  );
  for (const fn of ['saveVisit', 'toggleChecklist']) {
    const start = store.indexOf(`async function ${fn}(`);
    const body = store.slice(start, store.indexOf('\n}', start) + 2);
    assert.match(body, /assertProjectEditable\([\s\S]*?undefined,\s*true,/);
  }
  const payment = store.slice(
    store.indexOf('if (!existingWork)'),
    store.indexOf('if (!existingWork)') + 160,
  );
  assert.match(
    payment,
    /assertProjectEditable\(projectSnapshot.data\(\) as FarmProject, true\)/,
  );
  for (const fn of ['createFarmWithRecord', 'createRecord']) {
    const start = store.indexOf(`async function ${fn}(`);
    const body = store.slice(start, store.indexOf('\n}', start) + 2);
    assert.match(
      body,
      /runTransaction[\s\S]*?transaction.get\(\s*documentRef\('projects', project.id\),?\s*\)/,
    );
    assert.match(body, /assertProjectEditable\(\s*latestProject.exists\(\)/);
  }
});
