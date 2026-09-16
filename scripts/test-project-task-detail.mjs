import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, aliases = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL('../' + path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    require: (name) => aliases[name] || require(name),
  });
  return testModule.exports;
}

const { ProjectTaskDetail } = load('app/project-task-detail.tsx', {
  '@/components/ui/button': {
    Button: ({ children, variant: _variant, ...props }) =>
      React.createElement('button', props, children),
  },
  '@/lib/farm-types': load('lib/farm-types.ts'),
  '@/lib/project-work': { isInternalTask: (task) => task.scope === 'internal' },
  './received-images': { ReceivedImages: () => null },
  './work-task-controls': { WorkTaskMoreMenu: () => null },
});

function renderHistory(entry) {
  return renderToStaticMarkup(
    React.createElement(ProjectTaskDetail, {
      task: {
        id: 'task',
        scope: 'internal',
        title: '감사 대상 업무',
        status: 'open',
        owner: '담당 직원',
      },
      history: [{
        id: 'history',
        channel: 'system',
        occurredAt: 1_789_344_000_000,
        recorder: '기록 직원',
        actionContent: '처리 내용을 기록했습니다.',
        ...entry,
      }],
      onBack: () => {},
      onRecord: () => {},
      onAddChild: () => {},
    }),
  );
}

for (const sender of [undefined, '', '기록 직원']) {
  test(`history renders a recorder once when sender is ${JSON.stringify(sender)}`, () => {
    const markup = renderHistory({ sender });
    assert.equal(markup.match(/기록 직원/g)?.length, 1);
    assert.doesNotMatch(markup, /기록자 /);
    assert.match(markup, /처리 내용을 기록했습니다\./);
  });
}

test('history preserves the separate sender and recorder when they differ', () => {
  const markup = renderHistory({ sender: '외부 발신자' });
  assert.equal(markup.match(/외부 발신자/g)?.length, 1);
  assert.equal(markup.match(/기록 직원/g)?.length, 1);
  assert.match(markup, /기록자 기록 직원/);
});

test('removing repeated metadata preserves the direct task actions', () => {
  const markup = renderHistory({ sender: '' });
  assert.match(markup, /처리 기록·상태 변경/);
  assert.match(markup, /세부 업무 등록/);
  assert.match(markup, /수신·처리 히스토리/);
});

test('inline title editor replaces the static title without losing hierarchy or actions', () => {
  const markup = renderToStaticMarkup(React.createElement(ProjectTaskDetail, {
    task: { id: 'task', title: '기존 업무명', scope: 'internal', status: 'open', owner: '담당' },
    history: [], onBack() {}, onRecord() {}, onAddChild() {},
    parentTask: { id: 'parent', title: '상위 업무' }, onParent() {},
    titleContent: React.createElement('h1', null, React.createElement('button', { type: 'button' }, '수정 가능한 제목')),
    childrenContent: React.createElement('section', null, '세부 업무 진행 요약'),
  }));
  assert.equal(markup.match(/<h1/g)?.length, 1);
  assert.equal(markup.match(/수정 가능한 제목/g)?.length, 1);
  assert.doesNotMatch(markup, /기존 업무명/);
  assert.match(markup, /상위 업무: 상위 업무/);
  assert.match(markup, /세부 업무 진행 요약/);
  assert.match(markup, /처리 기록·상태 변경/);
  assert.match(markup, /세부 업무 등록/);
});
