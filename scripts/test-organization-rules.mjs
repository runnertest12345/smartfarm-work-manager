// Rules API evaluates only synthetic documents: no accounts, grants, or business data are written.
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
const base = '/databases/(default)/documents';
const ws = 'rules-test-only';
const path = (collection, id) => `${base}/workspaces/${ws}/${collection}/${id}`;
const memberPath = (id) => `${base}/appMembers/${id}`;
const now = Date.now();
const member = (id, extra = {}) => ({
  id,
  email: `${id}@example.test`,
  displayName: id,
  active: true,
  admin: false,
  workspaceId: ws,
  departmentId: 'sales',
  requestedDepartment: '영업',
  createdAt: now,
  updatedAt: now,
  ...extra,
});
const staff = member('staff');
const head = member('head');
const admin = member('admin', { admin: true });
const other = member('other', { departmentId: 'research' });
const outsider = member('outsider', { workspaceId: 'other-workspace' });
const shared = member('shared', {
  email: 'team-access@smartfarm-work-manager.firebaseapp.com',
});
const pending = member('pending', { active: false, departmentId: '' });
const department = {
  id: 'sales',
  name: '영업',
  headUid: head.id,
  createdAt: now,
  updatedAt: now,
};
const work = {
  id: 'task-test',
  scope: 'internal',
  projectId: '',
  farmId: '',
  farmRecordId: '',
  title: '견적 검토',
  workType: 'communication',
  status: 'open',
  owner: staff.displayName,
  assigneeUid: staff.id,
  assignedByUid: head.id,
  departmentId: 'sales',
  headAssigned: true,
  assignedAt: now,
  createdAt: now,
  updatedAt: now,
  createdByUid: head.id,
  updatedByUid: head.id,
  parentWorkItemId: '',
  childWorkItemIds: [],
  openChildCount: 0,
};
const docs = Object.fromEntries([
  ...[staff, head, admin, other, outsider, shared, pending].map((person) => [
    memberPath(person.id),
    person,
  ]),
  [path('departments', 'sales'), department],
  [
    path('departments', 'research'),
    { ...department, id: 'research', headUid: other.id },
  ],
  [path('workItems', work.id), work],
]);
const cases = [];
function check(
  name,
  expectation,
  {
    actor = head,
    method = 'create',
    target = path('workItems', work.id),
    data = work,
    before,
    reads = {},
    after = {},
    query,
    verified = true,
    provider = 'password',
  } = {},
) {
  const mockDocs = { ...docs, ...reads };
  cases.push({
    name,
    test: {
      expectation,
      request: {
        path: target,
        method,
        auth: actor && {
          uid: actor.id,
          token: {
            email: actor.email,
            email_verified: verified,
            firebase: { sign_in_provider: provider },
          },
        },
        time: new Date(now).toISOString(),
        resource: { data },
        ...(query ? { query } : {}),
      },
      ...(before ? { resource: { data: before } } : {}),
      functionMocks: [
        ...['get', 'getAfter'].flatMap((fn) =>
          Object.entries(
            fn === 'get' ? mockDocs : { ...mockDocs, ...after },
          ).map(([key, value]) => ({
            function: fn,
            args: [{ exactValue: key }],
            result: { value: { data: value } },
          })),
        ),
        ...Object.keys({ ...mockDocs, ...after }).map((key) => ({
          function: 'exists',
          args: [{ exactValue: key }],
          result: { value: Boolean(mockDocs[key]) },
        })),
      ],
    },
  });
}
check('department head assignment must be top priority', 'ALLOW');
check('head may not disguise a directive as ordinary work', 'DENY', {
  data: { ...work, headAssigned: false },
});
check('staff cannot forge department-head priority', 'DENY', {
  actor: staff,
  data: {
    ...work,
    assignedByUid: staff.id,
    createdByUid: staff.id,
    updatedByUid: staff.id,
  },
});
check('ordinary self-assignment is not a head directive', 'ALLOW', {
  actor: staff,
  data: {
    ...work,
    assignedByUid: staff.id,
    createdByUid: staff.id,
    updatedByUid: staff.id,
    headAssigned: false,
  },
});
check('head self-assignment is not a directive', 'ALLOW', {
  data: {
    ...work,
    assigneeUid: head.id,
    owner: head.displayName,
    headAssigned: false,
  },
});
check('a different department head is not this employee head', 'ALLOW', {
  actor: other,
  data: {
    ...work,
    assignedByUid: other.id,
    createdByUid: other.id,
    updatedByUid: other.id,
    headAssigned: false,
  },
});
check('assignedBy cannot impersonate a head', 'DENY', { actor: staff });
check('assignment department cannot be forged', 'DENY', {
  data: { ...work, departmentId: 'research' },
});
check('assignment owner is the selected account name', 'DENY', {
  data: { ...work, owner: 'another name' },
});
check('unapproved assignee is forbidden', 'DENY', {
  reads: { [memberPath(staff.id)]: { ...staff, active: false } },
});
check('shared login cannot create assigned work', 'DENY', {
  actor: shared,
  data: {
    ...work,
    assignedByUid: shared.id,
    createdByUid: shared.id,
    updatedByUid: shared.id,
    headAssigned: false,
  },
});
check('internal work must not link to a project', 'DENY', {
  data: { ...work, projectId: 'project' },
});
check('internal billing is forbidden', 'DENY', {
  data: { ...work, workType: 'payment' },
});
check('old timestamp cannot manufacture historical head authority', 'DENY', {
  data: { ...work, assignedAt: 1, createdAt: 1 },
});
check('status updates preserve protected assignment', 'ALLOW', {
  actor: staff,
  method: 'update',
  before: work,
  data: {
    ...work,
    status: 'in_progress',
    updatedAt: now + 1,
    updatedByUid: staff.id,
  },
});
for (const [key, value] of Object.entries({
  headAssigned: false,
  assigneeUid: head.id,
  assignedByUid: staff.id,
  departmentId: 'research',
  assignedAt: now + 1,
  scope: '',
})) {
  check(`assigned work cannot change ${key}`, 'DENY', {
    actor: staff,
    method: 'update',
    before: work,
    data: { ...work, [key]: value, updatedAt: now + 1, updatedByUid: staff.id },
  });
}
for (const collection of ['workItems', 'historyEntries']) {
  check(`other workspace cannot read ${collection}`, 'DENY', {
    actor: outsider,
    method: 'get',
    target: path(collection, work.id),
    before: work,
  });
}
check('other workspace cannot modify internal work', 'DENY', {
  actor: outsider,
  method: 'update',
  before: work,
  data: {
    ...work,
    title: 'tampered',
    updatedAt: now + 1,
    updatedByUid: outsider.id,
  },
});
check('public self-signup is disabled even for pending requests', 'DENY', {
  actor: pending,
  target: memberPath(pending.id),
  data: pending,
});
const alias = member('alias', {
  email: 'ueb9faceb8488@staff.smartfarm-work-manager.invalid',
});
check(
  'approved username password account accesses own profile without email',
  'ALLOW',
  {
    actor: alias,
    verified: false,
    method: 'get',
    target: memberPath(alias.id),
    before: alias,
  },
);
check('unverified real email is not a username account', 'DENY', {
  actor: staff,
  verified: false,
  method: 'get',
  target: memberPath(staff.id),
  before: staff,
});
check('username alias cannot bypass using custom provider', 'DENY', {
  actor: alias,
  verified: false,
  provider: 'custom',
  method: 'get',
  target: memberPath(alias.id),
  before: alias,
});
check('admin cannot create memberships from public SDK', 'DENY', {
  actor: admin,
  target: memberPath('new'),
  data: member('new'),
});
const initial = { ...staff, passwordChangeRequired: true };
check('self acknowledges initial password UI', 'ALLOW', {
  actor: staff,
  method: 'update',
  target: memberPath(staff.id),
  before: initial,
  data: { ...initial, passwordChangeRequired: false, updatedAt: now + 1 },
});
for (const patch of [
  { admin: true },
  { active: false },
  { departmentId: 'research' },
  { jobTitle: '팀장' },
]) {
  check(
    `password acknowledgement cannot also change ${Object.keys(patch)[0]}`,
    'DENY',
    {
      actor: staff,
      method: 'update',
      target: memberPath(staff.id),
      before: initial,
      data: {
        ...initial,
        ...patch,
        passwordChangeRequired: false,
        updatedAt: now + 1,
      },
    },
  );
}
check('other member cannot acknowledge password reminder', 'DENY', {
  actor: head,
  method: 'update',
  target: memberPath(staff.id),
  before: initial,
  data: { ...initial, passwordChangeRequired: false, updatedAt: now + 1 },
});
check('admin assigns team-leader title separately from head/admin', 'ALLOW', {
  actor: admin,
  method: 'update',
  target: memberPath(staff.id),
  before: staff,
  data: { ...staff, jobTitle: '팀장', updatedAt: now + 1 },
});
check('signup cannot self-approve', 'DENY', {
  actor: pending,
  target: memberPath(pending.id),
  data: { ...pending, active: true },
});
check('signup cannot become admin', 'DENY', {
  actor: pending,
  target: memberPath(pending.id),
  data: { ...pending, admin: true },
});
check('signup cannot choose authoritative department', 'DENY', {
  actor: pending,
  target: memberPath(pending.id),
  data: { ...pending, departmentId: 'sales' },
});
check('signup email must be authenticated email', 'DENY', {
  actor: pending,
  target: memberPath(pending.id),
  data: { ...pending, email: head.email },
});
check('pending user reads own request', 'ALLOW', {
  actor: pending,
  method: 'get',
  target: memberPath(pending.id),
  before: pending,
});
check('staff cannot read another pending request', 'DENY', {
  actor: staff,
  method: 'get',
  target: memberPath(pending.id),
  before: pending,
});
check('admin reads pending requests', 'ALLOW', {
  actor: admin,
  method: 'get',
  target: memberPath(pending.id),
  before: pending,
});
check('staff reads approved directory entry', 'ALLOW', {
  actor: staff,
  method: 'get',
  target: memberPath(head.id),
  before: head,
});
check('admin approves employee into existing department', 'ALLOW', {
  actor: admin,
  method: 'update',
  target: memberPath(pending.id),
  before: pending,
  data: { ...pending, active: true, departmentId: 'sales', updatedAt: now + 1 },
});
check('employee cannot approve membership', 'DENY', {
  actor: staff,
  method: 'update',
  target: memberPath(pending.id),
  before: pending,
  data: { ...pending, active: true, departmentId: 'sales', updatedAt: now + 1 },
});
check('client cannot promote even when already admin', 'DENY', {
  actor: admin,
  method: 'update',
  target: memberPath(staff.id),
  before: staff,
  data: { ...staff, admin: true, updatedAt: now + 1 },
});
check('admin cannot disable self', 'DENY', {
  actor: admin,
  method: 'update',
  target: memberPath(admin.id),
  before: admin,
  data: { ...admin, active: false, updatedAt: now + 1 },
});
check('admin creates a department', 'ALLOW', {
  actor: admin,
  target: path('departments', 'sales'),
  data: department,
});
check('employee cannot designate head', 'DENY', {
  actor: staff,
  method: 'update',
  target: path('departments', 'sales'),
  before: department,
  data: { ...department, headUid: staff.id, updatedAt: now + 1 },
});
check('admin designates an approved member of department', 'ALLOW', {
  actor: admin,
  method: 'update',
  target: path('departments', 'sales'),
  before: department,
  data: { ...department, headUid: staff.id, updatedAt: now + 1 },
});
check('admin cannot designate an outsider as department head', 'DENY', {
  actor: admin,
  method: 'update',
  target: path('departments', 'sales'),
  before: department,
  data: { ...department, headUid: other.id, updatedAt: now + 1 },
});
check('head cannot be disabled without clearing department head', 'DENY', {
  actor: admin,
  method: 'update',
  target: memberPath(head.id),
  before: head,
  data: { ...head, active: false, updatedAt: now + 1 },
});
check('head disable atomically clears head designation', 'ALLOW', {
  actor: admin,
  method: 'update',
  target: memberPath(head.id),
  before: head,
  data: { ...head, active: false, updatedAt: now + 1 },
  after: {
    [path('departments', 'sales')]: {
      ...department,
      headUid: '',
      updatedAt: now + 1,
    },
  },
});
check('approved directory query permits active members only', 'ALLOW', {
  actor: staff,
  method: 'list',
  target: memberPath(head.id),
  before: head,
  query: { limit: 5000 },
});
check('staff directory query cannot include pending requests', 'DENY', {
  actor: staff,
  method: 'list',
  target: memberPath(pending.id),
  before: pending,
  query: { limit: 5000 },
});
check('admin directory query includes pending requests', 'ALLOW', {
  actor: admin,
  method: 'list',
  target: memberPath(pending.id),
  before: pending,
  query: { limit: 5000 },
});
const child = { ...work, id: 'child', parentWorkItemId: work.id };
check('internal child links same-department parent', 'ALLOW', {
  target: path('workItems', child.id),
  data: child,
  after: {
    [path('workItems', work.id)]: {
      ...work,
      childWorkItemIds: [child.id],
      openChildCount: 1,
      lastChildMutationId: child.id,
    },
  },
});
check('internal child cannot link another department', 'DENY', {
  target: path('workItems', child.id),
  data: child,
  after: {
    [path('workItems', work.id)]: {
      ...work,
      departmentId: 'research',
      childWorkItemIds: [child.id],
      openChildCount: 1,
    },
  },
});

// Each write of a lifecycle transaction is checked separately, with exact paths.
const lifecycleAuditId = 'work-delete-audit';
function lifecycleCase(name, expectation = 'ALLOW', extra = {}) {
  const actor = extra.actor || head;
  const supplied = extra.before || work;
  const before = supplied.deletedAt
    ? { ...supplied, workLifecycleEntryId: 'previous-lifecycle-audit' }
    : supplied;
  const restoring = Boolean(before.deletedAt);
  const data = {
    ...before,
    deletedAt: restoring ? 0 : now + 1,
    deletedByUid: restoring ? '' : actor.id,
    workLifecycleEntryId: lifecycleAuditId,
    updatedAt: now + 1,
    lastActivityAt: now + 1,
    updatedByUid: actor.id,
    ...extra.patch,
  };
  const audit = {
    id: lifecycleAuditId,
    workItemId: before.id,
    workLifecycleAction: restoring ? 'restore' : 'delete',
    channel: 'system',
    amount: 0,
    createdAt: now + 1,
    occurredAt: now + 1,
    updatedAt: now + 1,
    createdByUid: actor.id,
    updatedByUid: actor.id,
    ...extra.auditPatch,
  };
  const reads = { [path('workItems', before.id)]: before, ...extra.reads };
  const after = {
    [path('workItems', before.id)]: data,
    [path('historyEntries', lifecycleAuditId)]: audit,
    ...extra.after,
  };
  check(name, expectation, {
    actor,
    method: 'update',
    target: path('workItems', before.id),
    before,
    data,
    reads,
    after,
  });
  if (extra.checkAudit)
    check(name + ' audit', 'ALLOW', {
      actor,
      target: path('historyEntries', lifecycleAuditId),
      data: audit,
      reads,
      after,
    });
  return { before, data, audit, reads, after };
}
const deletedWork = lifecycleCase(
  'creator can delete with immutable audit',
  'ALLOW',
  { checkAudit: true },
).data;
lifecycleCase('admin can delete another creator task', 'ALLOW', {
  actor: admin,
});
lifecycleCase('assignee alone cannot delete', 'DENY', { actor: staff });
lifecycleCase('other employee cannot delete', 'DENY', { actor: other });
lifecycleCase('shared account cannot delete', 'DENY', { actor: shared });
lifecycleCase('inactive creator cannot delete', 'DENY', {
  reads: { [memberPath(head.id)]: { ...head, active: false } },
});
lifecycleCase('other workspace admin cannot delete', 'DENY', {
  actor: outsider,
  reads: { [memberPath(outsider.id)]: { ...outsider, admin: true } },
});
lifecycleCase('deletion requires audit', 'DENY', {
  after: { [path('historyEntries', lifecycleAuditId)]: {} },
});
lifecycleCase('deletion cannot reuse existing audit', 'DENY', {
  reads: {
    [path('historyEntries', lifecycleAuditId)]: { id: lifecycleAuditId },
  },
});
lifecycleCase('deletion cannot alter task title', 'DENY', {
  patch: { title: 'changed' },
});
lifecycleCase('deletion cannot forge actor', 'DENY', {
  patch: { deletedByUid: staff.id },
});
lifecycleCase('deletion requires fresh version', 'DENY', {
  patch: { updatedAt: now },
});
for (const workType of ['payment', 'subscription'])
  lifecycleCase(workType + ' evidence cannot be deleted', 'DENY', {
    before: {
      ...work,
      scope: '',
      workType,
      farmId: 'farm',
      farmRecordId: 'record',
    },
    reads: { [path('farmRecords', 'record')]: { id: 'record' } },
  });
lifecycleCase('parent with completed children cannot be deleted', 'DENY', {
  before: { ...work, childWorkItemIds: ['child'], openChildCount: 0 },
});
lifecycleCase('restore original task', 'ALLOW', {
  before: { ...deletedWork, updatedAt: now },
  checkAudit: true,
});
check('deleted task rejects ordinary edits', 'DENY', {
  method: 'update',
  before: deletedWork,
  data: { ...deletedWork, title: 'changed', updatedAt: now + 2 },
});
check('old client cannot strip tombstone', 'DENY', {
  method: 'update',
  before: deletedWork,
  data: { ...work, updatedAt: now + 2 },
});
check('task creation cannot start deleted', 'DENY', {
  data: { ...work, deletedAt: now },
});
for (const name of [
  'historyEntries',
  'visits',
  'checklistItems',
  'blockerEpisodes',
]) {
  check('deleted task blocks new ' + name, 'DENY', {
    target: path(name, 'blocked-record'),
    data: {
      id: 'blocked-record',
      workItemId: work.id,
      createdAt: now,
      updatedAt: now,
      createdByUid: head.id,
      updatedByUid: head.id,
    },
    after: { [path('workItems', work.id)]: deletedWork },
  });
}
for (const completed of [false, true]) {
  const originalChild = { ...child, status: completed ? 'completed' : 'open' };
  const parentBefore = {
    ...work,
    childWorkItemIds: [child.id],
    openChildCount: completed ? 0 : 1,
  };
  const parentAfter = {
    ...parentBefore,
    childWorkItemIds: [],
    openChildCount: 0,
    lastChildMutationId: child.id,
    updatedAt: now + 1,
  };
  const c = lifecycleCase(
    `delete ${completed ? 'completed' : 'open'} child`,
    'ALLOW',
    {
      before: originalChild,
      reads: { [path('workItems', work.id)]: parentBefore },
      after: { [path('workItems', work.id)]: parentAfter },
      checkAudit: true,
    },
  );
  check('delete child updates parent membership ' + completed, 'ALLOW', {
    method: 'update',
    before: parentBefore,
    data: parentAfter,
    reads: c.reads,
    after: c.after,
  });
  const restoringParent = {
    ...parentBefore,
    lastChildMutationId: child.id,
    updatedAt: now + 2,
  };
  const r = lifecycleCase('restore child ' + completed, 'ALLOW', {
    before: { ...c.data, updatedAt: now },
    reads: { [path('workItems', work.id)]: parentAfter },
    after: { [path('workItems', work.id)]: restoringParent },
  });
  check('restore child updates parent membership ' + completed, 'ALLOW', {
    method: 'update',
    before: parentAfter,
    data: restoringParent,
    reads: r.reads,
    after: r.after,
  });
  lifecycleCase(
    'child cannot delete without parent removal ' + completed,
    'DENY',
    {
      before: originalChild,
      reads: { [path('workItems', work.id)]: parentBefore },
    },
  );
  lifecycleCase(
    'child cannot restore below deleted parent ' + completed,
    'DENY',
    {
      before: { ...c.data, updatedAt: now },
      reads: {
        [path('workItems', work.id)]: { ...parentAfter, deletedAt: now },
      },
      after: {
        [path('workItems', work.id)]: { ...restoringParent, deletedAt: now },
      },
    },
  );
}

for (const [workType, nextType] of [
  ['payment', 'note'],
  ['subscription', 'service'],
]) {
  const before = {
    ...work,
    scope: '',
    workType,
    farmId: 'farm',
    farmRecordId: 'record',
  };
  check(
    'financial task cannot change type to bypass deletion ' + workType,
    'DENY',
    {
      method: 'update',
      before,
      data: { ...before, workType: nextType, updatedAt: now + 1 },
      reads: { [path('farmRecords', 'record')]: { id: 'record' } },
    },
  );
}
for (const name of ['visits', 'checklistItems', 'blockerEpisodes']) {
  const before = {
    id: 'retained-record',
    workItemId: work.id,
    createdAt: now,
    updatedAt: now,
    createdByUid: head.id,
    updatedByUid: head.id,
  };
  const reads = {
    [path('workItems', work.id)]: deletedWork,
    [path('workItems', 'active-task')]: { ...work, id: 'active-task' },
  };
  check('deleted related record cannot be edited ' + name, 'DENY', {
    method: 'update',
    target: path(name, before.id),
    before,
    data: { ...before, updatedAt: now + 1 },
    reads,
  });
  check('deleted related record cannot be relinked ' + name, 'DENY', {
    method: 'update',
    target: path(name, before.id),
    before,
    data: { ...before, workItemId: 'active-task', updatedAt: now + 1 },
    reads,
  });
}

try {
  const options = { project: 'smartfarm-work-manager', nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({ urlPrefix: rulesOrigin(), apiVersion: 'v1' });
  const { body } = await client.post(
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
      testSuite: { testCases: cases.map((entry) => entry.test) },
    },
    { skipLog: { body: true } },
  );
  if (body.issues?.length) console.log(JSON.stringify({ issues: body.issues }));
  assert.equal(
    body.issues?.some((issue) => issue.severity === 'ERROR') || false,
    false,
  );
  assert.equal(body.testResults?.length, cases.length);
  let failures = 0;
  body.testResults.forEach((result, i) => {
    if (result.state !== 'SUCCESS') {
      failures++;
      console.log(JSON.stringify({ name: cases[i].name, ...result }));
    }
  });
  assert.equal(failures, 0, 'Organization rules failures');
  console.log(
    `Organization rules: ${cases.length} synthetic cases passed; no writes.`,
  );
} catch (error) {
  if (error?.context?.body?.error)
    console.error(JSON.stringify(error.context.body.error));
  console.error(
    error instanceof Error ? error.message : 'Rules validation failed',
  );
  process.exitCode = 1;
}
