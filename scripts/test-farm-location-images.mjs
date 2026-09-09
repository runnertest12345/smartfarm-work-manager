import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = (path) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function loadCode(code, aliases = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      atob,
      Error,
      Date,
      ...globals,
      require: (name) => aliases[name] || require(name),
    },
  );
  return module.exports;
}
const images = loadCode(source('lib/received-images.ts'));
const { parseFarmLocationChange, resolveFarmLocationImages } = loadCode(
  source('lib/farm-location-images.ts'),
  { './received-images': images },
);
const photo = (id = 'location-photo-0001') => ({
  id,
  name: '위치도.png',
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  mimeType: 'image/png',
  size: 8,
  width: 1,
  height: 1,
});
const change = (kept = [], expected = [], added = [photo()]) =>
  parseFarmLocationChange({
    locationImageIds: kept,
    expectedLocationImageIds: expected,
    locationImages: added,
  });

test('위치도 입력은 이미지 본문과 보존 ID를 분리하고 기존 클라이언트는 보존한다', () => {
  assert.equal(parseFarmLocationChange({}), undefined);
  assert.equal(
    resolveFarmLocationImages(['existing-photo-0001']).join(','),
    'existing-photo-0001',
  );
  assert.equal(resolveFarmLocationImages([], change()).join(','), photo().id);
  assert.equal(
    resolveFarmLocationImages(
      ['existing-photo-0001'],
      change([], ['existing-photo-0001']),
    ).join(','),
    photo().id,
  );
});
test('위치도는 최대 3장·중복 금지·기존 참조 소유 범위를 검증한다', () => {
  assert.throws(() => change(['missing-photo-0001'], []));
  assert.throws(() => change([photo().id], [photo().id]));
  assert.throws(() => change([], [], [photo(), photo()]));
  assert.throws(() =>
    change(
      ['existing-photo-0001', 'existing-photo-0002', 'existing-photo-0003'],
      ['existing-photo-0001', 'existing-photo-0002', 'existing-photo-0003'],
    ),
  );
  assert.throws(() => parseFarmLocationChange({ locationImages: [photo()] }));
  assert.throws(() =>
    change([], [], [{ ...photo(), mimeType: 'image/svg+xml' }]),
  );
});
test('동시에 바뀐 위치도는 덮어쓰지 않으며 제외는 참조만 변경한다', () => {
  const input = change([], ['existing-photo-0001'], []);
  assert.throws(
    () => resolveFarmLocationImages(['another-photo-0001'], input),
    /다른 사용자가/,
  );
  assert.equal(
    resolveFarmLocationImages(['existing-photo-0001'], input).length,
    0,
  );
  assert.equal(input.expectedIds.join(','), 'existing-photo-0001');
});

function storeHarness({
  latestIds = ['existing-photo-0001'],
  fail = false,
} = {}) {
  const code = source('lib/firebase/farm-ledger-store.ts');
  const latest = {
    id: 'farm1',
    farmCode: 'F1',
    locationImageIds: latestIds,
    folderUrl: 'https://example.com/folder',
    locationUrl: 'https://example.com/map',
    createdAt: 1,
    updatedAt: 10,
  };
  const writes = [],
    reads = [];
  const workspace = {
    farms: [{ ...latest, locationImageIds: [] }],
    projects: [{ id: 'p1', name: '사업' }],
  };
  const globals = {
    currentWorkspace: () => workspace,
    farmCodeKey: (id) => id,
    recordKey: (...ids) => ids.join('-'),
    documentRef: (kind, id) => `${kind}/${id}`,
    internalDocumentRef: (kind, id) => `${kind}/${id}`,
    getFirebaseServices: () => ({ db: {} }),
    requireSignedInUser: () => ({ uid: 'member' }),
    createdData: (value) => value,
    updatedData: (value) => value,
    resolveFarmLocationImages,
    assertProjectEditable: (value) => value,
    crypto: {
      randomUUID: (() => {
        let n = 0;
        return () => `created-${++n}`;
      })(),
    },
    auditArtifacts: () => ({
      workItem: { id: 'work1' },
      historyEntry: { id: 'entry1' },
    }),
    writeReceivedImages: (writer, images, parentCollection, parentId) =>
      images.forEach((image) =>
        writer.set(`imageAttachments/${image.id}`, {
          ...image,
          parentCollection,
          parentId,
        }),
      ),
    runTransaction: async (_db, handler) => {
      const staged = [];
      await handler({
        get: async (ref) => {
          assert.equal(staged.length, 0, 'all reads precede writes');
          reads.push(ref);
          return {
            exists: () => ref === 'farms/farm1' || ref === 'projects/p1',
            data: () =>
              ref === 'farms/farm1' ? latest : { id: 'p1', name: '사업' },
          };
        },
        set: (ref, data) => staged.push([ref, data]),
        update: (ref, data) => staged.push([ref, data]),
      });
      if (fail) throw new Error('save failed');
      writes.push(...staged);
    },
  };
  const update = code.slice(
    code.indexOf('async function updateFarm('),
    code.indexOf('async function updateRecord('),
  );
  const create = code.slice(
    code.indexOf('async function createFarmWithRecord('),
    code.indexOf('async function createRecord('),
  );
  return {
    ...loadCode(
      `${create}\n${update}\nexport { updateFarm, createFarmWithRecord };`,
      {},
      globals,
    ),
    writes,
    reads,
    latest,
  };
}
test('농가 수정은 서버 최신 사진을 보존하고 새 이미지에만 쓰기를 수행한다', async () => {
  const h = storeHarness();
  const result = await h.updateFarm(
    'farm1',
    { farmCode: 'F1', name: '수정 농가' },
    change(['existing-photo-0001'], ['existing-photo-0001']),
  );
  assert.equal(
    result.farm.locationImageIds.join(','),
    `existing-photo-0001,${photo().id}`,
  );
  assert.equal(result.farm.folderUrl, h.latest.folderUrl);
  assert.equal(result.farm.locationUrl, h.latest.locationUrl);
  assert.equal(
    h.writes.filter(([ref]) => ref.startsWith('imageAttachments/')).length,
    1,
  );
  assert.ok(!('dataUrl' in result.farm));
  assert.equal(h.writes.at(-1)[1].parentId, 'farm1');
  assert.equal(h.reads[0], 'farms/farm1');
});
test('이전 입력 형식의 저장도 최신 위치도 ID를 지우지 않는다', async () => {
  const h = storeHarness();
  const result = await h.updateFarm('farm1', { farmCode: 'F1' });
  assert.equal(result.farm.locationImageIds.join(','), 'existing-photo-0001');
  assert.equal(h.writes.length, 1);
});
test('사진 외 링크·기본정보가 먼저 바뀌어도 이전 폼으로 덮어쓰지 않는다', async () => {
  const h = storeHarness();
  await assert.rejects(
    h.updateFarm(
      'farm1',
      { farmCode: 'F1', locationUrl: 'old' },
      change(['existing-photo-0001'], ['existing-photo-0001']),
      9,
    ),
    /다른 곳에서 변경/,
  );
  assert.equal(h.writes.length, 0);
});
test('새 농가와 위치도는 같은 트랜잭션으로 저장되고 실패하면 모두 남지 않는다', async () => {
  for (const fail of [false, true]) {
    const h = storeHarness({ fail });
    const save = h.createFarmWithRecord(
      { farmCode: 'F2', name: '새 농가' },
      { projectId: 'p1' },
      '담당',
      change(),
    );
    if (fail) {
      await assert.rejects(save, /save failed/);
      assert.equal(h.writes.length, 0);
    } else {
      const result = await save;
      assert.equal(result.farm.locationImageIds.join(','), photo().id);
      assert.equal(
        h.writes.find(([ref]) => ref.startsWith('imageAttachments/'))[1]
          .parentId,
        result.farm.id,
      );
    }
  }
});

let slots = [],
  cursor = 0;
const hooks = {
  ...React,
  useEffect: () => {},
  useState(initial) {
    const i = cursor++;
    if (!(i in slots))
      slots[i] = typeof initial === 'function' ? initial() : initial;
    return [
      slots[i],
      (value) => {
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
      },
    ];
  },
};
hooks.useRef = (initial) => hooks.useState(() => ({ current: initial }))[0];
const primitive =
  (tag) =>
  ({ children, variant, size, ...props }) =>
    React.createElement(tag, props, children);
const { ReceivedContentInput } = loadCode(source('app/received-images.tsx'), {
  react: hooks,
  '@/components/ui/button': { Button: primitive('button') },
  '@/components/ui/textarea': { Textarea: primitive('textarea') },
  '@/lib/received-images': {
    ...images,
    prepareReceivedImage: async (file) => {
      if (file.fail) throw new Error('잘못된 이미지');
      return photo();
    },
  },
  '@/lib/firebase/received-images-store': {
    loadReceivedImage: () => {
      throw new Error('not requested');
    },
  },
});
const nodes = (node) =>
  node && typeof node === 'object'
    ? [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)]
    : [];
const find = (tree, predicate) => {
  const found = nodes(tree).find(predicate);
  assert.ok(found);
  return found;
};
const render = (props) => {
  cursor = 0;
  return ReceivedContentInput(props);
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('사진 선택·붙여넣기는 같은 첨부를 만들고 처리 상태·미리보기·제거를 지원한다', async () => {
  slots = [];
  const busy = [],
    props = {
      imageOnly: true,
      images: [],
      onImagesChange: (value) => {
        props.images = value;
      },
      onBusyChange: (value) => busy.push(value),
    };
  let tree = render(props);
  assert.doesNotMatch(renderToStaticMarkup(tree), /textarea/);
  const file = find(tree, (node) => node.props?.type === 'file');
  file.props.onChange({ target: { files: [{}], value: 'selected' } });
  await tick();
  assert.equal(busy.join(','), 'true,false');
  assert.equal(props.images.length, 1);
  tree = render(props);
  assert.match(renderToStaticMarkup(tree), /위치도.png/);
  find(
    tree,
    (node) => node.props?.['aria-label'] === '위치도.png 첨부 제거',
  ).props.onClick();
  assert.equal(props.images.length, 0);
  tree = render(props);
  let prevented = false;
  find(tree, (node) => node.props?.onPaste).props.onPaste({
    clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({}) }],
      getData: () => '',
    },
    preventDefault: () => {
      prevented = true;
    },
  });
  await tick();
  assert.equal(prevented, true);
  assert.equal(props.images.length, 1);
});
test('기존 사진 포함 3장 제한과 처리 오류는 기존 첨부를 유지한다', async () => {
  slots = [];
  const props = {
    imageOnly: true,
    images: [],
    existingCount: 3,
    onImagesChange: () => assert.fail('must not change'),
    onBusyChange() {},
  };
  let tree = render(props);
  find(tree, (node) => node.props?.type === 'file').props.onChange({
    target: { files: [{}], value: '' },
  });
  await tick();
  assert.match(renderToStaticMarkup(render(props)), /최대 3장/);
  props.existingCount = 0;
  tree = render(props);
  find(tree, (node) => node.props?.type === 'file').props.onChange({
    target: { files: [{ fail: true }], value: '' },
  });
  await tick();
  assert.match(renderToStaticMarkup(render(props)), /잘못된 이미지/);
});
test('농가 폼은 별도 사진 초안과 최신 참조를 보내고 저장 중 닫기·중복 실행을 막는다', () => {
  const code = source('app/farm-ledger-dashboard.tsx');
  assert.match(code, /farmId: editingFarmId/);
  assert.match(code, /expectedLocationImageIds: farmLocationExpectedIds/);
  assert.match(code, /farmSaveBusyRef.current \|\| farmImageBusyRef.current/);
  assert.match(
    code,
    /!farmImageBusyRef.current\s*&&\s*!farmSaveBusyRef.current/,
  );
  assert.match(code, /disabled=\{submitting \|\| farmLocationBusy\}/);
  assert.match(
    code,
    /<ReceivedImages\s+imageIds=\{selectedFarm.locationImageIds\}/,
  );
  assert.match(code, /folderUrl: farmForm.folderUrl/);
  assert.match(code, /locationUrl: farmForm.locationUrl/);
  assert.ok(/expectedFarmUpdatedAt: editingFarmVersion/.test(code));
  assert.ok(/!kept &&\s*farmLocationIds.length \+\s*farmLocationImages.length >=\s*3/.test(code));
});
