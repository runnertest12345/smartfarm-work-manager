// Read-only Rules API evaluation: synthetic requests and mocked document reads.
// Uses the existing Firebase CLI login without printing or exporting credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { logger } = require('firebase-tools/lib/logger');
logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const { rulesOrigin } = require('firebase-tools/lib/api');

const imageId = 'image-rules-test-0001';
const base = '/databases/(default)/documents';
const workspace = `${base}/workspaces/rules-test-only`;
const audit = {
  id: 'task-test',
  createdAt: 1,
  updatedAt: 1,
  createdByUid: 'test-user',
  updatedByUid: 'test-user',
};
const image = {
  id: imageId,
  name: 'capture.png',
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  mimeType: 'image/png',
  size: 8,
  width: 1,
  height: 1,
  parentCollection: 'inboxItems',
  parentId: 'inbox-test',
  createdAt: 1,
  createdByUid: 'test-user',
};
const member = { uid: 'test-user', token: { email_verified: true } };
function mock(name, data) {
  return {
    function: name,
    args: [{ anyValue: {} }],
    result: { value: { data } },
  };
}
const cases = [];
function check(
  name,
  expectation,
  {
    method = 'create',
    collection = 'imageAttachments',
    id = imageId,
    data = image,
    user = member,
    active = true,
    parent = { imageIds: [imageId] },
    resource,
  } = {},
) {
  cases.push({
    name,
    test: {
      expectation,
      request: {
        path: `${workspace}/${collection}/${id}`,
        method,
        auth: user,
        resource: { data },
      },
      ...(resource ? { resource: { data: resource } } : {}),
      functionMocks: [mock('get', { active }), mock('getAfter', parent)],
    },
  });
}
check('active member creates a linked image', 'ALLOW');
check('signed-out image read', 'DENY', { method: 'get', user: null });
check('inactive member image read', 'DENY', { method: 'get', active: false });
check('unverified member image read', 'DENY', {
  method: 'get',
  user: { uid: 'test-user', token: { email_verified: false } },
});
check('active member image read', 'ALLOW', { method: 'get' });
check('image listing is forbidden', 'DENY', { method: 'list' });
check('image overwrites are forbidden', 'DENY', {
  method: 'update',
  resource: image,
});
check('image deletes are forbidden', 'DENY', {
  method: 'delete',
  resource: image,
});
check('unlinked image is forbidden', 'DENY', { parent: { imageIds: [] } });
check('oversized image is forbidden', 'DENY', {
  data: { ...image, size: 393217 },
});
check('SVG is forbidden', 'DENY', {
  data: {
    ...image,
    mimeType: 'image/svg+xml',
    dataUrl: 'data:image/svg+xml;base64,AAAA',
  },
});
check('wrong creator is forbidden', 'DENY', {
  data: { ...image, createdByUid: 'another-user' },
});
check('more than three attachments is forbidden', 'DENY', {
  parent: { imageIds: [imageId, 'two', 'three', 'four'] },
});
check('unexpected image fields are forbidden', 'DENY', {
  data: { ...image, public: true },
});
check('project task without farm is allowed', 'ALLOW', {
  collection: 'workItems',
  id: audit.id,
  data: {
    ...audit,
    farmId: '',
    farmRecordId: '',
    projectId: 'project-test',
    workType: 'communication',
  },
  parent: { id: 'project-test' },
});
check('project task without project is forbidden', 'DENY', {
  collection: 'workItems',
  id: audit.id,
  data: {
    ...audit,
    farmId: '',
    farmRecordId: '',
    projectId: '',
    workType: 'communication',
  },
});
check('project-only payment is forbidden', 'DENY', {
  collection: 'workItems',
  id: audit.id,
  data: {
    ...audit,
    farmId: '',
    farmRecordId: '',
    projectId: 'project-test',
    workType: 'payment',
  },
  parent: { id: 'project-test' },
});
check('existing farm payment relation remains allowed', 'ALLOW', {
  collection: 'workItems',
  id: audit.id,
  data: {
    ...audit,
    farmId: 'farm-test',
    farmRecordId: 'record-test',
    workType: 'payment',
  },
  parent: { id: 'record-test' },
});

try {
  const options = { project: 'smartfarm-work-manager', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({ urlPrefix: rulesOrigin(), apiVersion: 'v1' });
  const response = await client.post(
    '/projects/smartfarm-work-manager:test',
    {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: readFileSync(
              new URL('../firestore.rules', import.meta.url),
              'utf8',
            ),
          },
        ],
      },
      testSuite: { testCases: cases.map(({ test }) => test) },
    },
    { skipLog: { body: true } },
  );
  const body = response.body;
  if (body.issues?.length) console.log(JSON.stringify({ issues: body.issues }));
  assert.equal(
    body.issues?.some((issue) => issue.severity === 'ERROR') || false,
    false,
    'Rules compilation failed',
  );
  assert.equal(body.testResults?.length, cases.length, 'Missing rule results');
  for (let i = 0; i < cases.length; i++) {
    const result = body.testResults[i];
    console.log(
      JSON.stringify({
        test: cases[i].name,
        state: result.state,
        errors: result.errors,
      }),
    );
    assert.equal(result.state, 'SUCCESS', cases[i].name);
  }
  console.log(`Rules: ${cases.length} tests passed; no data writes.`);
} catch (error) {
  // Do not print raw SDK objects, which can include authentication headers.
  console.error(
    error instanceof Error ? error.message : 'Rules validation failed',
  );
  process.exitCode = 1;
}
