import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
let states = [],
  cursor = 0,
  buttons = [],
  textareas = [],
  reads = 0;
const sample = {
  id: 'image-ui-test-0001',
  name: '캡처.png',
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  size: 8,
  width: 1,
  height: 1,
  mimeType: 'image/png',
};
function load(path, aliases = {}) {
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
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name in aliases) return aliases[name];
      if (name === 'react')
        return {
          ...React,
          useRef: (value) => ({ current: value }),
          useEffect: () => {},
          useState: (initial) => {
            const index = cursor++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (next) => {
                states[index] =
                  typeof next === 'function' ? next(states[index]) : next;
              },
            ];
          },
        };
      if (name === '@/components/ui/button')
        return {
          Button: ({ variant, size, ...props }) => {
            buttons.push(props);
            return React.createElement('button', props);
          },
        };
      if (name === '@/components/ui/textarea')
        return {
          Textarea: (props) => {
            textareas.push(props);
            return React.createElement('textarea', props);
          },
        };
      return require(name);
    },
  });
  return module.exports;
}
const types = load('../lib/farm-types.ts');
const work = load('../lib/project-work.ts');
const images = load('../app/received-images.tsx', {
  '@/lib/received-images': {
    MAX_RECEIVED_IMAGES: 3,
    prepareReceivedImage: async () => sample,
  },
  '@/lib/firebase/received-images-store': {
    loadReceivedImage: async () => {
      reads++;
      return sample;
    },
  },
});
const { ProjectTaskDetail } = load('../app/project-task-detail.tsx', {
  '@/lib/farm-types': types,
  '@/lib/project-work': work,
  './received-images': images,
});
function render(component, props) {
  cursor = 0;
  buttons = [];
  textareas = [];
  return renderToStaticMarkup(React.createElement(component, props));
}
function reset() {
  states = [];
  reads = 0;
}
const task = {
  id: 'task',
  projectId: 'p',
  farmRecordId: '',
  farmId: '',
  workType: 'communication',
  title: '견적서 제출',
  owner: '담당자',
  status: 'open',
  createdAt: 1,
  respondedAt: 0,
};

test('프로젝트 하위 업무와 실제 농가 업무를 구분하고 입금·자동 기록만 운영에서 제외한다', () => {
  assert.equal(work.isProjectTask(task), true);
  assert.equal(work.isOperationalWork(task), true);
  const farmTask = {
    ...task,
    farmId: 'f',
    farmRecordId: 'r',
    workType: 'service',
  };
  assert.equal(work.isProjectTask(farmTask), false);
  assert.equal(work.isOperationalWork(farmTask), true);
  for (const workType of ['payment', 'subscription'])
    assert.equal(work.isOperationalWork({ ...farmTask, workType }), false);
  const audit = {
    ...farmTask,
    workType: 'note',
    status: 'completed',
    title: '사업 참여 등록',
  };
  const history = [{ channel: 'system', receivedContent: '', occurredAt: 1 }];
  assert.equal(work.isOperationalWork(audit, history), false);
  assert.equal(
    work.isOperationalWork({ ...audit, respondedAt: 1 }, history),
    true,
  );
  assert.equal(
    work.isOperationalWork({ ...audit, title: '서류 확인 완료' }, history),
    true,
  );
});

test('이관된 파모스박스 교체 완료 이력만 업무 현황에서 제외하고 원본은 보존한다', () => {
  const id = `work_service_${'a'.repeat(32)}`;
  const archived = {
    ...task,
    id,
    farmId: 'farm',
    farmRecordId: 'record',
    projectId: undefined,
    workType: 'service',
    title: 'A/S 기록 이관',
    status: 'completed',
    migrationRunId: 'test-import',
    sourceFingerprint: 'b'.repeat(64),
  };
  const history = [
    {
      id: id.replace('work_', 'history_'),
      workItemId: id,
      channel: 'system',
      actionContent: '파모스박스 교체',
      occurredAt: archived.createdAt,
    },
  ];
  const original = JSON.stringify({ archived, history });
  assert.equal(work.isFarmBoxReplacementHistory(archived, history), true);
  assert.equal(work.isOperationalWork(archived, history), false);
  assert.equal(work.isProjectTask(archived), false);
  assert.equal(JSON.stringify({ archived, history }), original);
  assert.equal(
    work.isOperationalWork(archived, [
      { ...history[0], actionContent: '파모스 박스 교체 완료' },
    ]),
    false,
  );
});

test('신규 교체 요청·재개·추가 처리·다른 A/S 기록은 업무 현황에 유지한다', () => {
  const id = `work_service_${'c'.repeat(32)}`;
  const archived = {
    ...task,
    id,
    farmRecordId: 'record',
    farmId: 'farm',
    workType: 'service',
    title: 'A/S 기록 이관',
    status: 'completed',
    migrationRunId: 'test-import',
    sourceFingerprint: 'd'.repeat(64),
  };
  const entry = {
    id: id.replace('work_', 'history_'),
    workItemId: id,
    channel: 'system',
    actionContent: '파모스박스 교체',
    occurredAt: archived.createdAt,
  };
  for (const patch of [
    { id: 'new-task', title: '파모스박스 교체 요청', status: 'open' },
    { status: 'open' },
    { status: 'in_progress' },
    { status: 'waiting' },
    { migrationRunId: undefined },
    { sourceFingerprint: undefined },
    { title: '파모스박스 교체 완료 확인' },
  ])
    assert.equal(
      work.isOperationalWork({ ...archived, ...patch }, [entry]),
      true,
    );
  assert.equal(work.isOperationalWork(archived, []), true);
  for (const patch of [
    { actionContent: '센서 점검 완료' },
    { actionContent: '파모스박스 교체 요청 전달' },
    { channel: 'phone' },
    { workItemId: 'other-task' },
    { occurredAt: 2 },
  ])
    assert.equal(
      work.isOperationalWork(archived, [{ ...entry, ...patch }]),
      true,
    );
  assert.equal(
    work.isOperationalWork(archived, [
      entry,
      {
        ...entry,
        id: 'follow-up',
        channel: 'phone',
        actionContent: '교체 후 통신 점검',
      },
    ]),
    true,
  );
});

test('농가가 없어도 프로젝트 업무 상세와 수신·처리 기록이 표시되고 이동 버튼이 연결된다', () => {
  reset();
  let back = 0,
    record = 0;
  const html = render(ProjectTaskDetail, {
    task,
    project: { year: 2026, name: '태백 노지 실증단지' },
    history: [
      {
        id: 'h',
        channel: 'email',
        sender: '사업 담당',
        recorder: '담당자',
        receivedContent: '견적서를 제출해 주세요',
        actionContent: '견적서 초안 작성',
        occurredAt: 1,
      },
    ],
    onBack: () => back++,
    onRecord: () => record++,
  });
  for (const text of [
    '태백 노지 실증단지',
    '견적서 제출',
    '견적서를 제출해 주세요',
    '견적서 초안 작성',
  ])
    assert.ok(html.includes(text));
  assert.ok(!html.includes('농가 없음'));
  buttons[0].onClick();
  buttons[1].onClick();
  assert.equal(back, 1);
  assert.equal(record, 1);
});

test('이미지는 열 때만 읽고 접었다 다시 열어도 재조회하지 않는다', async () => {
  reset();
  const props = { imageIds: [sample.id] };
  const initial = render(images.ReceivedImages, props);
  assert.ok(initial.includes('첨부 이미지 1장 보기'));
  assert.equal(reads, 0);
  await buttons[0].onClick();
  await new Promise(setImmediate);
  const shown = render(images.ReceivedImages, props);
  assert.equal(reads, 1);
  assert.ok(shown.includes('download="캡처.png"'));
  buttons[0].onClick();
  assert.ok(!render(images.ReceivedImages, props).includes('<img'));
  buttons[0].onClick();
  assert.ok(render(images.ReceivedImages, props).includes('<img'));
  assert.equal(reads, 1);
});

test('캡처 Ctrl+V는 첨부로 전환하고 혼합 텍스트 붙여넣기는 막지 않는다', async () => {
  for (const text of ['', '메일 본문']) {
    reset();
    let received = [],
      busy = [],
      prevented = false;
    render(images.ReceivedContentInput, {
      images: [],
      onImagesChange: (next) => {
        received = next;
      },
      onBusyChange: (next) => busy.push(next),
    });
    textareas[0].onPaste({
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => ({ name: '캡처.png' }),
          },
        ],
        getData: () => text,
      },
      preventDefault() {
        prevented = true;
      },
    });
    await new Promise(setImmediate);
    assert.equal(received[0].id, sample.id);
    assert.deepEqual(busy, [true, false]);
    assert.equal(prevented, text === '');
  }
});

test('4번째 캡처를 붙여넣으면 기존 첨부를 유지하고 오류를 알린다', async () => {
  reset();
  let calls = 0;
  const props = {
    images: [sample, { ...sample, id: 'two' }, { ...sample, id: 'three' }],
    onImagesChange: () => calls++,
    onBusyChange() {},
  };
  render(images.ReceivedContentInput, props);
  textareas[0].onPaste({
    clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({}) }],
      getData: () => '',
    },
    preventDefault() {},
  });
  await new Promise(setImmediate);
  assert.equal(calls, 0);
  assert.ok(render(images.ReceivedContentInput, props).includes('최대 3장'));
});

test('KPI drilldown은 프로젝트 업무로 제한하고 일반 업무 목록은 농가 업무도 보존한다', () => {
  const source = readFileSync(
    new URL('../app/farm-ledger-dashboard.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /return operationalWorkItems\s*\.filter/);
  assert.match(
    source,
    /if \(workScope && !isProjectTask\(workItem\)\) return false/,
  );
  assert.match(source, /if \(directTask && isStandaloneWork\(directTask\)\)/);
  assert.match(
    source,
    /!submitting && !imagesBusy && setDialog\(open \? 'inbox' : null\)/,
  );
});
