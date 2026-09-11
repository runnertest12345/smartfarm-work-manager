import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../app/business-completion-rate.tsx', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText,
  { module, exports: module.exports, require: createRequire(import.meta.url) },
);
const { BusinessCompletionRate } = module.exports;

for (const [rate, label, red] of [
  [0, '0%', true],
  [99, '99%', true],
  [100, '100%', false],
  [null, '-', false],
]) {
  test(`사업 집계 ${label}의 표시와 미완료 색상`, () => {
    const node = BusinessCompletionRate({ rate, className: 'text-sm' });
    assert.equal(node.props.children, label);
    assert.equal(node.props.className.includes('text-red-700'), red);
    assert.ok(node.props.className.includes('text-sm'));
  });
}

test('사업 집계 요약·연도별·사업별·평균에만 같은 표시를 적용한다', () => {
  const source = readFileSync(
    new URL('../app/farm-ledger-dashboard.tsx', import.meta.url),
    'utf8',
  );
  assert.equal((source.match(/<BusinessCompletionRate/g) || []).length, 4);
  assert.ok(source.includes("progress < 100 ? 'bg-red-700'"));
});
