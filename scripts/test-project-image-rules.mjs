// Read-only Rules API evaluation: synthetic requests and mocked document reads.
// Uses the existing Firebase CLI login without printing or exporting credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

function treeCase(
  name,
  expectation,
  before,
  after,
  documents = {},
  afterDocuments = {},
) {
  const mocks = [
    {
      function: 'get',
      args: [{ exactValue: `${base}/appMembers/test-user` }],
      result: { value: { data: { active: true } } },
    },
  ];
  for (const [id, data] of Object.entries(documents)) {
    const path = `${workspace}/workItems/${id}`;
    mocks.push({
      function: 'exists',
      args: [{ exactValue: path }],
      result: { value: data !== null },
    });
    if (data)
      mocks.push({
        function: 'get',
        args: [{ exactValue: path }],
        result: { value: { data } },
      });
  }
  for (const [id, data] of Object.entries(afterDocuments))
    mocks.push({
      function: 'getAfter',
      args: [{ exactValue: `${workspace}/workItems/${id}` }],
      result: { value: { data } },
    });
  mocks.push({
    function: 'getAfter',
    args: [{ exactValue: `${workspace}/projects/project-test` }],
    result: { value: { data: { id: 'project-test' } } },
  });
  cases.push({
    name,
    test: {
      expectation,
      request: {
        path: `${workspace}/workItems/${after.id}`,
        method: before ? 'update' : 'create',
        auth: member,
        resource: { data: after },
      },
      ...(before ? { resource: { data: before } } : {}),
      functionMocks: mocks,
    },
  });
}
const root = {
  ...audit,
  id: 'root-task',
  farmId: '',
  farmRecordId: '',
  projectId: 'project-test',
  workType: 'communication',
  status: 'open',
  childWorkItemIds: [],
  openChildCount: 0,
};
const child = { ...root, id: 'child-task', parentWorkItemId: root.id };
const linked = {
  ...root,
  childWorkItemIds: [child.id],
  openChildCount: 1,
  lastChildMutationId: child.id,
  updatedAt: 2,
};
treeCase(
  'child create links existing same-project parent atomically',
  'ALLOW',
  null,
  child,
  { [root.id]: root },
  { [root.id]: linked },
);
treeCase(
  'child without atomic parent link denied',
  'DENY',
  null,
  child,
  { [root.id]: root },
  { [root.id]: root },
);
treeCase(
  'child from another project denied',
  'DENY',
  null,
  { ...child, projectId: 'wrong-project' },
  { [root.id]: root },
  { [root.id]: linked },
);
treeCase(
  'child under completed parent denied',
  'DENY',
  null,
  child,
  { [root.id]: { ...root, status: 'completed' } },
  { [root.id]: linked },
);
treeCase(
  'parent counter increments for new child',
  'ALLOW',
  root,
  linked,
  { [child.id]: null },
  { [child.id]: child },
);
treeCase(
  'counter cannot be forged without child transition',
  'DENY',
  linked,
  { ...linked, openChildCount: 0 },
  { [child.id]: child },
  { [child.id]: child },
);
treeCase('parent with unfinished child cannot complete', 'DENY', linked, {
  ...linked,
  status: 'completed',
});
const doneChild = { ...child, status: 'completed', updatedAt: 2 };
const readyParent = { ...linked, openChildCount: 0, updatedAt: 3 };
treeCase(
  'child completion decrements parent counter',
  'ALLOW',
  child,
  doneChild,
  { [root.id]: linked },
  { [root.id]: readyParent },
);
treeCase(
  'parent counter decrements only for completed child',
  'ALLOW',
  linked,
  readyParent,
  { [child.id]: child },
  { [child.id]: doneChild },
);
treeCase('parent can complete after children complete', 'ALLOW', readyParent, {
  ...readyParent,
  status: 'completed',
  updatedAt: 4,
});
treeCase(
  'child reopening under completed parent denied',
  'DENY',
  doneChild,
  { ...child, updatedAt: 3 },
  { [root.id]: { ...readyParent, status: 'completed' } },
  { [root.id]: { ...linked, status: 'completed' } },
);
treeCase('reparenting and self-cycle denied', 'DENY', child, {
  ...child,
  parentWorkItemId: child.id,
});
treeCase('root cannot seed fake completed descendants', 'DENY', null, {
  ...root,
  childWorkItemIds: ['invented-child'],
});

const lifecycleProject = {
  ...audit,
  id: 'project-lifecycle-test',
  name: '보존할 사업',
  status: 'active',
};
const deletedProject = {
  ...lifecycleProject,
  updatedAt: 2,
  deletedAt: 2,
  deletedByUid: 'test-user',
  lifecycleUpdateId: 'delete-audit',
};
const restoredProject = {
  ...deletedProject,
  updatedAt: 3,
  deletedAt: 0,
  deletedByUid: '',
  lifecycleUpdateId: 'restore-audit',
};
function lifecycleCase(name, expectation, before, after, overrides = {}) {
  const updateId = after.lifecycleUpdateId || 'missing';
  const auditData = {
    id: updateId,
    projectId: lifecycleProject.id,
    kind: 'system',
    channel: 'system',
    projectLifecycleAction: after.deletedAt ? 'delete' : 'restore',
    createdAt: after.updatedAt,
    createdByUid: 'test-user',
    ...overrides.audit,
  };
  cases.push({
    name,
    test: {
      expectation,
      request: {
        path: `${workspace}/projects/${lifecycleProject.id}`,
        method: overrides.method || (before ? 'update' : 'create'),
        auth: overrides.user === undefined ? member : overrides.user,
        resource: { data: after },
      },
      ...(before ? { resource: { data: before } } : {}),
      functionMocks: [
        mock('get', { active: overrides.active !== false }),
        mock('getAfter', auditData),
        {
          function: 'exists',
          args: [{ anyValue: {} }],
          result: { value: overrides.auditExists || false },
        },
      ],
    },
  });
}
lifecycleCase(
  'legacy project creation remains allowed',
  'ALLOW',
  null,
  lifecycleProject,
);
lifecycleCase(
  'normal project edit remains allowed',
  'ALLOW',
  lifecycleProject,
  { ...lifecycleProject, updatedAt: 2, name: '수정 사업' },
);
lifecycleCase(
  'recoverable project deletion requires atomic audit',
  'ALLOW',
  lifecycleProject,
  deletedProject,
);
lifecycleCase(
  'project restore requires atomic audit',
  'ALLOW',
  deletedProject,
  restoredProject,
);
lifecycleCase(
  'old full-document save cannot erase deletion marker',
  'DENY',
  deletedProject,
  { ...lifecycleProject, updatedAt: 3 },
);
lifecycleCase(
  'legacy metadata removal after restore is rejected',
  'DENY',
  restoredProject,
  { ...lifecycleProject, updatedAt: 4 },
);
lifecycleCase(
  'deletion cannot change business data',
  'DENY',
  lifecycleProject,
  { ...deletedProject, name: '변경' },
);
lifecycleCase('deletion cannot forge another actor', 'DENY', lifecycleProject, {
  ...deletedProject,
  deletedByUid: 'another',
});
lifecycleCase(
  'deletion cannot reuse an old audit',
  'DENY',
  lifecycleProject,
  deletedProject,
  { auditExists: true },
);
lifecycleCase(
  'deletion audit must belong to project',
  'DENY',
  lifecycleProject,
  deletedProject,
  { audit: { projectId: 'other' } },
);
lifecycleCase(
  'restore cannot reuse deletion audit',
  'DENY',
  deletedProject,
  restoredProject,
  { audit: { projectLifecycleAction: 'delete' } },
);
lifecycleCase(
  'inactive member cannot delete project',
  'DENY',
  lifecycleProject,
  deletedProject,
  { active: false },
);
lifecycleCase(
  'signed-out user cannot delete project',
  'DENY',
  lifecycleProject,
  deletedProject,
  { user: null },
);
lifecycleCase(
  'physical project deletion stays forbidden',
  'DENY',
  deletedProject,
  deletedProject,
  { method: 'delete' },
);
lifecycleCase('create cannot start as deleted', 'DENY', null, deletedProject);
lifecycleCase(
  'preserved linked activity can touch deleted project',
  'ALLOW',
  deletedProject,
  { ...deletedProject, updatedAt: 3 },
);
check('new farm participation cannot attach to deleted project', 'DENY', {
  collection: 'farmRecords',
  id: 'farm-link',
  data: {
    ...audit,
    id: 'farm-link',
    farmId: 'same-parent',
    projectId: 'same-parent',
  },
  parent: { id: 'same-parent', deletedAt: 2 },
});
check('new project document cannot attach to deleted project', 'DENY', {
  collection: 'projectDocuments',
  id: 'new-document',
  data: { ...audit, id: 'new-document', projectId: 'project-test' },
  parent: { id: 'project-test', deletedAt: 2 },
});
check('new project-only task cannot attach to deleted project', 'DENY', {
  collection: 'workItems',
  id: root.id,
  data: root,
  parent: { id: 'project-test', deletedAt: 2 },
});
check('new payment for preserved farm participation remains allowed', 'ALLOW', {
  collection: 'workItems',
  id: 'payment-task',
  data: {
    ...audit,
    id: 'payment-task',
    farmRecordId: 'preserved-record',
    workType: 'payment',
  },
  parent: { id: 'preserved-record', deletedAt: 2 },
});

const locationImage = {
  ...image,
  parentCollection: 'farms',
  parentId: 'farm-test',
};
check('farm location image linked to the same farm is allowed', 'ALLOW', {
  data: locationImage,
  parent: { locationImageIds: [imageId] },
});
check('farm location image without a farm link is denied', 'DENY', {
  data: locationImage,
  parent: { imageIds: [imageId] },
});
check('farm location image exceeding three links is denied', 'DENY', {
  data: locationImage,
  parent: { locationImageIds: [imageId, 'two', 'three', 'four'] },
});
check('location images retain signed-out denial', 'DENY', {
  data: locationImage,
  user: null,
  parent: { locationImageIds: [imageId] },
});
const farmDoc = { ...audit, id: 'farm-test', locationImageIds: [imageId] };
check('farm may link a new location image with matching ownership', 'ALLOW', {
  collection: 'farms',
  id: 'farm-test',
  data: farmDoc,
  parent: locationImage,
});
check('farm cannot link an image owned by another farm', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  data: farmDoc,
  parent: { ...locationImage, parentId: 'other-farm' },
});
check('farm cannot link an inbox attachment', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  data: farmDoc,
  parent: image,
});
check('farm cannot link a missing image', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  data: farmDoc,
  parent: {},
});
check('farm cannot duplicate a location image ID', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  data: { ...farmDoc, locationImageIds: [imageId, imageId] },
  parent: locationImage,
});
check('farm cannot exceed three location images', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  data: { ...farmDoc, locationImageIds: [imageId, 'two', 'three', 'four'] },
  parent: locationImage,
});
check('old farm fields remain valid without photos', 'ALLOW', {
  collection: 'farms',
  id: 'farm-test',
  data: { ...audit, id: 'farm-test' },
});
check('farm update preserves location references', 'ALLOW', {
  collection: 'farms',
  id: 'farm-test',
  method: 'update',
  resource: farmDoc,
  data: { ...farmDoc, updatedAt: 2, name: 'updated' },
});
check('stale full farm update cannot erase photo field', 'DENY', {
  collection: 'farms',
  id: 'farm-test',
  method: 'update',
  resource: farmDoc,
  data: { ...audit, id: 'farm-test', updatedAt: 2 },
});
check('explicit farm attachment exclusion removes reference only', 'ALLOW', {
  collection: 'farms',
  id: 'farm-test',
  method: 'update',
  resource: farmDoc,
  data: { ...farmDoc, locationImageIds: [], updatedAt: 2 },
});

const emptyRound = {
  status: 'not_started',
  dueDate: '',
  claimAmount: 0,
  approvedAmount: 0,
  paidAmount: 0,
  settledAt: '',
  owner: '',
  evidenceUrl: '',
  note: '',
};
const settledRound = {
  ...emptyRound,
  status: 'closed',
  claimAmount: 300,
  approvedAmount: 300,
  paidAmount: 300,
  note: '기존 내역',
};
const legacyProject = {
  ...audit,
  status: 'active',
  contractAmount: 1000,
  settlementStatus: 'closed',
  settlementDueDate: '',
  settlementClaimAmount: 300,
  settlementApprovedAmount: 300,
  settlementPaidAmount: 300,
  settledAt: '',
  settlementOwner: '',
  settlementEvidenceUrl: '',
  settlementNote: '기존 내역',
};
const splitProject = {
  ...legacyProject,
  updatedAt: 2,
  settlementStatus: 'collecting',
  settlementNote: '',
  settlementRounds: {
    first: emptyRound,
    second: emptyRound,
    unassigned: settledRound,
  },
};
const firstAssignedProject = {
  ...splitProject,
  updatedAt: 3,
  settlementRounds: { first: settledRound, second: emptyRound },
};
function settlementRule(name, expectation, before, after) {
  check(name, expectation, {
    collection: 'projects',
    id: audit.id,
    method: before ? 'update' : 'create',
    resource: before,
    data: after,
  });
}
settlementRule(
  'legacy completed project stays compatible',
  'ALLOW',
  { ...legacyProject, status: 'completed' },
  { ...legacyProject, status: 'completed', updatedAt: 2 },
);
settlementRule(
  'existing single settlement preserved as unassigned',
  'ALLOW',
  legacyProject,
  splitProject,
);
settlementRule(
  'unassigned can move to empty first without double counting',
  'ALLOW',
  splitProject,
  firstAssignedProject,
);
settlementRule('new project has two empty rounds', 'ALLOW', null, {
  ...legacyProject,
  settlementStatus: 'not_started',
  settlementClaimAmount: 0,
  settlementApprovedAmount: 0,
  settlementPaidAmount: 0,
  settlementRounds: { first: emptyRound, second: emptyRound },
});
settlementRule(
  'first done and second pending is not overall done',
  'DENY',
  firstAssignedProject,
  { ...firstAssignedProject, updatedAt: 4, settlementStatus: 'paid' },
);
settlementRule(
  'both rounds done permits project completion',
  'ALLOW',
  firstAssignedProject,
  {
    ...firstAssignedProject,
    updatedAt: 4,
    status: 'completed',
    settlementStatus: 'closed',
    settlementClaimAmount: 600,
    settlementApprovedAmount: 600,
    settlementPaidAmount: 600,
    settlementRounds: { first: settledRound, second: settledRound },
  },
);
settlementRule(
  'inflated settlement total rejected',
  'DENY',
  firstAssignedProject,
  { ...firstAssignedProject, updatedAt: 4, settlementPaidAmount: 900 },
);
settlementRule('negative round amount rejected', 'DENY', firstAssignedProject, {
  ...firstAssignedProject,
  updatedAt: 4,
  settlementRounds: {
    first: settledRound,
    second: { ...emptyRound, paidAmount: -1 },
  },
});
settlementRule(
  'old client cannot remove rounds',
  'DENY',
  firstAssignedProject,
  { ...legacyProject, updatedAt: 4 },
);
settlementRule(
  'empty map cannot bypass round validation',
  'DENY',
  legacyProject,
  { ...legacyProject, updatedAt: 2, settlementRounds: {} },
);
settlementRule(
  'unassigned original cannot be silently dropped',
  'DENY',
  splitProject,
  {
    ...splitProject,
    updatedAt: 3,
    settlementStatus: 'not_started',
    settlementClaimAmount: 0,
    settlementApprovedAmount: 0,
    settlementPaidAmount: 0,
    settlementRounds: { first: emptyRound, second: emptyRound },
  },
);
settlementRule(
  'unassigned original cannot be rewritten',
  'DENY',
  splitProject,
  {
    ...splitProject,
    updatedAt: 3,
    settlementRounds: {
      ...splitProject.settlementRounds,
      unassigned: { ...settledRound, note: '변조' },
    },
  },
);
settlementRule(
  'completed project cannot silently switch settlement basis',
  'DENY',
  { ...legacyProject, status: 'completed' },
  { ...splitProject, status: 'completed' },
);

settlementRule(
  'summary due date cannot be erased independently',
  'DENY',
  firstAssignedProject,
  { ...firstAssignedProject, updatedAt: 4, settlementDueDate: '2030-12-31' },
);
settlementRule(
  'summary closure date cannot be forged independently',
  'DENY',
  firstAssignedProject,
  { ...firstAssignedProject, updatedAt: 4, settledAt: '2030-12-31' },
);
settlementRule(
  'legacy can be assigned to second round',
  'ALLOW',
  splitProject,
  {
    ...firstAssignedProject,
    settlementRounds: { first: emptyRound, second: settledRound },
  },
);
settlementRule(
  'two populated new rounds validate within rule limits',
  'ALLOW',
  null,
  {
    ...legacyProject,
    settlementStatus: 'submitted',
    settlementClaimAmount: 600,
    settlementApprovedAmount: 300,
    settlementPaidAmount: 300,
    settlementRounds: {
      first: settledRound,
      second: {
        ...emptyRound,
        status: 'submitted',
        claimAmount: 300,
        dueDate: '2026-12-31',
        owner: '정산 담당',
        note: '제출 완료',
      },
    },
    settlementDueDate: '2026-12-31',
  },
);

const roundKeys = ['first', 'second', 'third'];
const maximumRounds = Object.fromEntries(roundKeys.map((key) => [key, { ...settledRound, status: 'submitted', dueDate: '2026-10-01', settledAt: '', note: key }]));
const maximumProject = { ...legacyProject, updatedAt: 5, settlementStatus: 'submitted', settlementClaimAmount: 900, settlementApprovedAmount: 900, settlementPaidAmount: 900, settlementRounds: maximumRounds, settlementDueDate: '2026-10-01' };
settlementRule('maximum populated rounds stay within rule limits', 'ALLOW', null, maximumProject);
settlementRule('maximum changed populated rounds stay within rule limits', 'ALLOW', maximumProject, { ...maximumProject, updatedAt: 6, settlementRounds: Object.fromEntries(roundKeys.map((key) => [key, { ...maximumRounds[key], owner: 'changed', note: key + '-changed' }])) });
settlementRule('maximum simultaneous amount changes', 'ALLOW', maximumProject, { ...maximumProject, updatedAt: 6, settlementClaimAmount: 1200, settlementApprovedAmount: 1200, settlementPaidAmount: 1200, settlementRounds: Object.fromEntries(roundKeys.map((key) => [key, { ...maximumRounds[key], claimAmount: 400, approvedAmount: 400, paidAmount: 400 }])) });
const singleProject = { ...legacyProject, updatedAt: 4, settlementRounds: { first: settledRound } };
settlementRule('maximum simultaneous complete field changes', 'ALLOW', maximumProject, { ...maximumProject, updatedAt: 6, settlementStatus: 'approved', settlementDueDate: '2026-11-01', settlementClaimAmount: 1200, settlementApprovedAmount: 1200, settlementPaidAmount: 1200, settlementRounds: Object.fromEntries(roundKeys.map((key) => [key, { ...maximumRounds[key], status: 'approved', dueDate: '2026-11-01', settledAt: '2026-10-01', claimAmount: 400, approvedAmount: 400, paidAmount: 400, owner: 'changed', note: 'changed', evidenceUrl: 'https://example.com/proof' }])) });
settlementRule('one round can be the whole settlement', 'ALLOW', null, singleProject);
settlementRule('one round allows completion', 'ALLOW', singleProject, { ...singleProject, updatedAt: 5, status: 'completed' });
settlementRule('explicitly remove an empty final round', 'ALLOW', firstAssignedProject, singleProject);
const threeProject = { ...firstAssignedProject, updatedAt: 4, settlementClaimAmount: 600, settlementApprovedAmount: 600, settlementPaidAmount: 600, settlementRounds: { ...firstAssignedProject.settlementRounds, third: settledRound } };
settlementRule('add third round with correct totals', 'ALLOW', firstAssignedProject, threeProject);
settlementRule('old client cannot drop a populated third round', 'DENY', threeProject, { ...firstAssignedProject, updatedAt: 5 });
settlementRule('third round prevents false all-done', 'DENY', null, { ...singleProject, settlementRounds: { first: settledRound, second: settledRound, third: emptyRound }, settlementClaimAmount: 600, settlementApprovedAmount: 600, settlementPaidAmount: 600 });
settlementRule('third round cannot inflate totals', 'DENY', null, { ...threeProject, settlementPaidAmount: 999 });
settlementRule('rounds cannot have gaps', 'DENY', null, { ...singleProject, settlementRounds: { first: settledRound, third: settledRound }, settlementClaimAmount: 600, settlementApprovedAmount: 600, settlementPaidAmount: 600 });
settlementRule('unsupported fourth round rejected', 'DENY', null, { ...maximumProject, settlementRounds: { ...maximumRounds, fourth: emptyRound } });
settlementRule('blank map is not a round', 'DENY', null, { ...singleProject, settlementRounds: { first: settledRound, second: {} } });
settlementRule('negative third amount rejected', 'DENY', null, { ...maximumProject, settlementRounds: { ...maximumRounds, third: { ...maximumRounds.third, paidAmount: -1 } } });
settlementRule('aggregate amount bound enforced', 'DENY', null, { ...singleProject, settlementClaimAmount: 1000000000000001, settlementRounds: { first: { ...settledRound, claimAmount: 1000000000000000 }, second: { ...emptyRound, claimAmount: 1 } } });
settlementRule('unassigned may move to new third unchanged', 'ALLOW', splitProject, { ...firstAssignedProject, settlementRounds: { first: emptyRound, second: emptyRound, third: settledRound } });
settlementRule('completed maximum-round project cannot rewrite a round', 'DENY', { ...maximumProject, status: 'completed' }, { ...maximumProject, status: 'completed', updatedAt: 6, settlementRounds: { ...maximumRounds, third: { ...maximumRounds.third, note: 'rewritten' } } });

settlementRule('legacy maximum rounds preserve unassigned original', 'ALLOW', legacyProject, { ...maximumProject, settlementClaimAmount: 1200, settlementApprovedAmount: 1200, settlementPaidAmount: 1200, settlementRounds: { ...maximumRounds, unassigned: settledRound } });
settlementRule('maximum rounds assign original to third while editing first and second', 'ALLOW', splitProject, { ...maximumProject, settlementRounds: { ...maximumRounds, third: settledRound } });
for (const [statuses, expected] of [
  [['not_started', 'revision', 'approved'], 'revision'],
  [['submitted', 'approved', 'paid'], 'submitted'],
  [['collecting', 'paid', 'closed'], 'collecting'],
  [['closed', 'paid', 'closed'], 'paid'],
  [['approved', 'paid', 'closed'], 'approved'],
  [['not_started', 'not_started', 'closed'], 'collecting'],
]) {
  const mixed = { ...maximumProject, updatedAt: 6, settlementStatus: expected, settlementClaimAmount: 600, settlementApprovedAmount: 600, settlementPaidAmount: 300, settlementRounds: Object.fromEntries(roundKeys.map((key, index) => [key, { ...maximumRounds[key], status: statuses[index], dueDate: `2026-${10 + index}-01`, claimAmount: (index + 1) * 100, approvedAmount: (index + 1) * 100, paidAmount: 100, owner: key, note: key + '-mixed' }])) };
  settlementRule(`maximum distinct fields ${statuses.join('/')}`, 'ALLOW', maximumProject, mixed);
  settlementRule(`legacy maximum mixed fields ${statuses.join('/')}`, 'ALLOW', legacyProject, { ...mixed, settlementClaimAmount: 900, settlementApprovedAmount: 900, settlementPaidAmount: 600, settlementRounds: { ...mixed.settlementRounds, unassigned: settledRound } });
}
for (const { name, test } of cases.filter((entry) => entry.name.includes('maximum') && entry.test.expectation === 'ALLOW')) {
  cases.push({ name: `staff login: ${name}`, test: { ...test, request: { ...test.request, auth: { uid: 'test-user', token: { email: 'u74657374@staff.smartfarm-work-manager.invalid', email_verified: false, firebase: { sign_in_provider: 'password' } } } } } });
}

if (process.env.RULE_TEST_NAME) {
  const selected = cases.filter((entry) => entry.name.includes(process.env.RULE_TEST_NAME));
  assert.ok(selected.length, 'Requested rule test does not exist');
  cases.splice(0, cases.length, ...selected);
}

try {
  const options = { project: 'smartfarm-work-manager', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({ urlPrefix: rulesOrigin(), apiVersion: 'v1' });
  const body = { issues: [], testResults: [] };
  async function evaluate(entries) {
  const response = await client.post(
    '/projects/smartfarm-work-manager:test',
    {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: process.argv[2]
              ? execFileSync('git', ['show', `${process.argv[2]}:firestore.rules`], { encoding: 'utf8' })
              : readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
          },
        ],
      },
      testSuite: { testCases: entries.map(({ test }) => test) },
    },
    { skipLog: { body: true, resBody: true, queryParams: true } },
  );
  return response.body;
  }
  for (let offset = 0; offset < cases.length; offset += 20) {
  console.log(`Rules batch ${offset + 1}-${Math.min(offset + 20, cases.length)}/${cases.length}`);
  const entries = cases.slice(offset, offset + 20);
  let response;
  try {
    response = { body: await evaluate(entries) };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('500')) throw error;
    response = { body: { issues: [], testResults: [] } };
    for (const entry of entries) {
      try {
        const result = await evaluate([entry]);
        response.body.issues.push(...(result.issues || []));
        response.body.testResults.push(...(result.testResults || []));
      } catch (singleError) {
        response.body.testResults.push({ state: 'FAILURE', debugMessages: [singleError instanceof Error ? singleError.message : 'Rules API error'] });
      }
    }
  }
  body.issues.push(...(response.body.issues || []));
  body.testResults.push(...(response.body.testResults || []));
  }
  if (body.issues?.length) console.log(JSON.stringify({ issues: body.issues }));
  assert.equal(
    body.issues?.some((issue) => issue.severity === 'ERROR') || false,
    false,
    'Rules compilation failed',
  );
  assert.equal(body.testResults?.length, cases.length, 'Missing rule results');
  let failures = 0;
  for (let i = 0; i < cases.length; i++) {
    const result = body.testResults[i];
    if (result.state !== 'SUCCESS') {
      failures++;
      console.log(JSON.stringify({ test: cases[i].name, failure: result }));
    }
  }
  assert.equal(failures, 0, 'Rules validation failures');
  console.log(`Rules: ${cases.length} tests passed; no data writes.`);
} catch (error) {
  // Do not print raw SDK objects, which can include authentication headers.
  console.error(
    error instanceof Error ? error.message : 'Rules validation failed',
  );
  process.exitCode = 1;
}
