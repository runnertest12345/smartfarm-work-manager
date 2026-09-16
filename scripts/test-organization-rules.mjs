// Rules API evaluates only synthetic documents: no accounts, grants, or business data are written.
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
check('internal work must not link to a missing project', 'DENY', {
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

// These production-shaped paths and registrar IDs are function mocks only.
// The Rules test endpoint never creates Auth users or Firestore memberships.
const registrationWorkspace = 'sheet-20260903-579dfadc';
const registrationDepartment = 'registration-test-department';
const registrationDepartmentPath = `${base}/workspaces/${registrationWorkspace}/departments/${registrationDepartment}`;
const registrationUid = 'staff-member-11111111-2222-4333-8444-555555555555';
const usernameEmail = (name) =>
  `u${Buffer.from(name, 'utf8').toString('hex')}@staff.smartfarm-work-manager.invalid`;
const registrars = [
  member('staff-bootstrap-3c039722dfe5ab50da57d128', {
    email: usernameEmail('러너'),
    workspaceId: registrationWorkspace,
    departmentId: registrationDepartment,
    admin: true,
    passwordChangeRequired: false,
  }),
  member('staff-bootstrap-cbbc0b0b0bce4dfea455a415', {
    email: usernameEmail('평화'),
    workspaceId: registrationWorkspace,
    departmentId: registrationDepartment,
    passwordChangeRequired: false,
  }),
];
const registrationReads = {
  ...Object.fromEntries(registrars.map((person) => [memberPath(person.id), person])),
  [registrationDepartmentPath]: {
    ...department,
    id: registrationDepartment,
    headUid: '',
  },
};
const registrationData = (actor = registrars[0]) => ({
  email: usernameEmail('테스트직원'),
  displayName: '합성 테스트 직원',
  active: true,
  admin: false,
  workspaceId: registrationWorkspace,
  departmentId: registrationDepartment,
  requestedDepartment: '',
  jobTitle: '직원',
  passwordChangeRequired: true,
  createdAt: now,
  updatedAt: now,
  createdByUid: actor.id,
  registrationRequestId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
});
function registrationCheck(name, expectation, options = {}) {
  const actor = options.actor === undefined ? registrars[0] : options.actor;
  check(`member registration: ${name}`, expectation, {
    actor,
    verified: false,
    target: memberPath(registrationUid),
    data: registrationData(actor || registrars[0]),
    ...options,
    reads: { ...registrationReads, ...options.reads },
  });
}
for (const [index, registrar] of registrars.entries()) {
  registrationCheck(`designated registrar ${index + 1} creates ordinary member`, 'ALLOW', {
    actor: registrar,
  });
  const existing = {
    ...registrationData(registrar),
    email: usernameEmail('기존직원'),
    displayName: '기존 직원 보존',
    registrationRequestId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
    createdAt: now - 1000,
    updatedAt: now - 1000,
  };
  registrationCheck(`registrar ${index + 1} cannot overwrite existing identity`, 'DENY', {
    actor: registrar,
    method: 'update',
    before: existing,
    data: { ...registrationData(registrar), updatedAt: now + 1 },
    reads: { [memberPath(registrationUid)]: existing },
  });
}
for (const [label, baseActor] of [['ordinary admin', admin], ['ordinary staff', staff], ['shared account', shared]]) {
  const actor = {
    ...baseActor,
    workspaceId: registrationWorkspace,
    departmentId: registrationDepartment,
    passwordChangeRequired: false,
  };
  registrationCheck(`${label} cannot register members`, 'DENY', {
    actor,
    verified: true,
    reads: { [memberPath(actor.id)]: actor },
  });
}
registrationCheck('signed-out request denied', 'DENY', { actor: null });
for (const [label, patch] of [
  ['inactive registrar', { active: false }],
  ['wrong workspace', { workspaceId: 'other-workspace' }],
  ['wrong member email', { email: usernameEmail('다른회원') }],
  ['password change required', { passwordChangeRequired: true }],
]) {
  registrationCheck(`${label} denied`, 'DENY', {
    reads: { [memberPath(registrars[0].id)]: { ...registrars[0], ...patch } },
  });
}
const registrarWithoutPasswordFlag = { ...registrars[0] };
delete registrarWithoutPasswordFlag.passwordChangeRequired;
registrationCheck('missing password acknowledgement denied', 'DENY', {
  reads: { [memberPath(registrars[0].id)]: registrarWithoutPasswordFlag },
});
registrationCheck('wrong token email denied', 'DENY', {
  actor: { ...registrars[0], email: usernameEmail('다른로그인') },
});
for (const provider of ['custom', 'anonymous', 'google.com']) {
  registrationCheck(`${provider} provider denied`, 'DENY', { provider });
}
for (const [label, patch] of [
  ['admin escalation', { admin: true }],
  ['custom workspace', { workspaceId: 'other-workspace' }],
  ['custom job role', { jobTitle: '팀장' }],
  ['inactive initial member', { active: false }],
  ['password reminder skipped', { passwordChangeRequired: false }],
  ['real email', { email: 'new-member@example.test' }],
  ['blank name', { displayName: '' }],
  ['oversized name', { displayName: '가'.repeat(41) }],
  ['requested department injection', { requestedDepartment: '직접 승인 요청' }],
  ['blank department', { departmentId: '' }],
  ['wrong creator', { createdByUid: staff.id }],
  ['invalid request ID', { registrationRequestId: 'not-a-request-id' }],
  ['future timestamp', { createdAt: now + 300001, updatedAt: now + 300001 }],
  ['mismatched timestamps', { updatedAt: now + 1 }],
  ['unexpected field', { unexpected: true }],
]) {
  registrationCheck(`${label} denied`, 'DENY', {
    data: { ...registrationData(), ...patch },
  });
}
registrationCheck('invalid department denied', 'DENY', {
  reads: { [registrationDepartmentPath]: { id: 'different-department' } },
});
registrationCheck('invalid member UID denied', 'DENY', {
  target: memberPath('ordinary-unrestricted-uid'),
});
for (const field of Object.keys(registrationData())) {
  const data = registrationData();
  delete data[field];
  registrationCheck(`missing ${field} denied`, 'DENY', { data });
}

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

// Exercise app-shaped child transactions, including a parent that is itself a child.
// Each request is evaluated independently; this does not measure the batch read limit.
const diagnosticActor = {
  ...staff,
  email: 'u7374616666@staff.smartfarm-work-manager.invalid',
};
for (const [taskScope, nested] of ['internal', 'project', 'internal-project'].flatMap((scope) =>
  [false, true].map((nested) => [scope, nested]),
)) {
  for (const existingCount of [0, 1, 2]) {
    const prefix = taskScope + '-' + (nested ? 'nested' : 'flat') + '-existing-' + existingCount;
    const baseTask = {
      ...work,
      scope: taskScope.startsWith('internal') ? 'internal' : '',
      projectId: taskScope === 'internal' ? '' : 'synthetic-project',
      owner: staff.displayName,
      assigneeUid: staff.id,
      assignedByUid: staff.id,
      createdByUid: staff.id,
      updatedByUid: staff.id,
      headAssigned: false,
      lastActivityAt: now,
    };
    const rootId = prefix + '-root';
    const middleId = prefix + '-middle';
    const newId = prefix + '-new-child';
    const previousChildren = Array.from({ length: existingCount }, (_, i) => ({
      ...baseTask,
      id: prefix + '-old-' + i,
      parentWorkItemId: middleId,
      status: i === 0 ? 'open' : 'completed',
      childWorkItemIds: [],
      openChildCount: 0,
    }));
    const root = {
      ...baseTask,
      id: rootId,
      parentWorkItemId: '',
      childWorkItemIds: [middleId],
      openChildCount: 1,
      lastChildMutationId: middleId,
    };
    const middleBefore = {
      ...baseTask,
      id: middleId,
      parentWorkItemId: nested ? rootId : '',
      childWorkItemIds: previousChildren.map((child) => child.id),
      openChildCount: previousChildren.filter((child) => child.status !== 'completed').length,
      ...(existingCount ? { lastChildMutationId: previousChildren.at(-1).id } : {}),
    };
    const newChild = {
      ...baseTask,
      id: newId,
      parentWorkItemId: middleId,
      childWorkItemIds: [],
      openChildCount: 0,
    };
    const middleAfter = {
      ...middleBefore,
      childWorkItemIds: [...middleBefore.childWorkItemIds, newId],
      openChildCount: middleBefore.openChildCount + 1,
      lastChildMutationId: newId,
      updatedAt: now + 1,
      lastActivityAt: now + 1,
    };
    const history = (id, workItemId) => ({
      id, workItemId, channel: 'system', sender: '', receivedContent: '',
      actionContent: 'Synthetic child creation', amount: 0,
      recorder: staff.displayName, occurredAt: now, referenceUrl: '',
      createdAt: now, updatedAt: now,
      createdByUid: staff.id, updatedByUid: staff.id,
    });
    const childHistory = history(prefix + '-child-history', newId);
    const parentHistory = history(prefix + '-parent-history', middleId);
    const reads = {
      [memberPath(staff.id)]: diagnosticActor,
      [path('projects', 'synthetic-project')]: { id: 'synthetic-project', status: 'active', projectType: taskScope === 'internal-project' ? 'internal' : 'general' },
      [path('workItems', rootId)]: root,
      [path('workItems', middleId)]: middleBefore,
      [path('workItems', newId)]: null,
      [path('historyEntries', childHistory.id)]: null,
      [path('historyEntries', parentHistory.id)]: null,
      ...Object.fromEntries(previousChildren.map((child) => [path('workItems', child.id), child])),
    };
    const after = {
      [path('workItems', rootId)]: root,
      [path('workItems', middleId)]: middleAfter,
      [path('workItems', newId)]: newChild,
      [path('historyEntries', childHistory.id)]: childHistory,
      [path('historyEntries', parentHistory.id)]: parentHistory,
    };
    const common = { actor: diagnosticActor, verified: false, provider: 'password', reads, after };
    check(prefix + ': child create', 'ALLOW', { ...common, target: path('workItems', newId), data: newChild });
    check(prefix + ': parent update', 'ALLOW', { ...common, method: 'update', target: path('workItems', middleId), before: middleBefore, data: middleAfter });
    check(prefix + ': child history', 'ALLOW', { ...common, target: path('historyEntries', childHistory.id), data: childHistory });
    check(prefix + ': parent history', 'ALLOW', { ...common, target: path('historyEntries', parentHistory.id), data: parentHistory });
  }
}

// The internal fast path must not skip assignment or relation validation.
for (const [label, patch] of [
  ['missing farm record', { farmRecordId: undefined }],
  ['null farm record', { farmRecordId: null }],
  ['numeric farm record', { farmRecordId: 0 }],
  ['linked farm record', { farmRecordId: 'record' }],
  ['linked farm', { farmId: 'farm' }],
  ['linked project', { projectId: 'project' }],
  ['financial type', { workType: 'payment' }],
  ['changed scope', { scope: '' }],
]) {
  const data = { ...work, ...patch, updatedAt: now + 1 };
  if (data.farmRecordId === undefined) delete data.farmRecordId;
  check('internal relation guard: ' + label, 'DENY', {
    method: 'update', before: work, data,
  });
}
for (const [label, patch] of [
  ['changed id', { id: 'different-id' }],
  ['changed creator', { createdByUid: staff.id }],
  ['changed creation time', { createdAt: now - 1 }],
  ['backdated update', { updatedAt: now - 1 }],
  ['wrong updater', { updatedByUid: staff.id }],
  ['missing creator', { createdByUid: undefined }],
]) {
  const data = { ...work, updatedAt: now + 1, ...patch };
  if (data.createdByUid === undefined) delete data.createdByUid;
  check('audit invariant: ' + label, 'DENY', {
    method: 'update', before: work, data,
  });
}

const internalProject = {
  id: 'internal-project', projectType: 'internal', status: 'active', currentStage: 'operation',
  targetFarmCount: 0, contractAmount: 0, settlementStatus: 'not_started',
  settlementClaimAmount: 0, settlementApprovedAmount: 0, settlementPaidAmount: 0,
  settlementDueDate: '', settledAt: '', createdAt: now, updatedAt: now,
  createdByUid: head.id, updatedByUid: head.id,
};
const linkedInternal = { ...work, projectId: internalProject.id };
const projectReads = { [path('projects', internalProject.id)]: internalProject };
for (const method of ['create', 'update']) {
  for (const [collection, kind, expected] of [
    ['projectDocuments', null, 'DENY'],
    ['projectUpdates', 'progress', 'DENY'],
    ['projectUpdates', 'blocker', 'DENY'],
    ['projectUpdates', 'system', 'ALLOW'],
  ]) {
    const id = `internal-${collection}-${kind || 'document'}-${method}`;
    const before = { id, projectId: internalProject.id, ...(kind ? { kind } : {}), createdAt: now, updatedAt: now, createdByUid: head.id, updatedByUid: head.id };
    check('internal project rejects stale business record: ' + id, expected, {
      method, target: path(collection, id), data: { ...before, updatedAt: now + 1 },
      ...(method === 'update' ? { before } : {}), reads: projectReads,
    });
    check('business project still accepts record: ' + id, 'ALLOW', {
      method, target: path(collection, id), data: { ...before, updatedAt: now + 1 },
      ...(method === 'update' ? { before } : {}),
      reads: { [path('projects', internalProject.id)]: { ...internalProject, projectType: 'general' } },
    });
  }
}
for (const [label, projectPatch, taskStatus, expected] of [
  ['active', {}, 'open', 'ALLOW'],
  ['deleted', { deletedAt: now }, 'open', 'DENY'],
  ['completed with open work', { status: 'completed' }, 'open', 'DENY'],
  ['completed with completed work', { status: 'completed' }, 'completed', 'ALLOW'],
]) lifecycleCase('linked internal restore ' + label, expected, {
  before: { ...linkedInternal, status: taskStatus, deletedAt: now, deletedByUid: head.id },
  reads: { [path('projects', internalProject.id)]: { ...internalProject, ...projectPatch } },
  checkAudit: expected === 'ALLOW',
});
for (const status of ['completed', 'open']) check('completed internal project work update ' + status, status === 'completed' ? 'ALLOW' : 'DENY', {
  method: 'update', before: { ...linkedInternal, status: 'completed' },
  data: { ...linkedInternal, status, updatedAt: now + 1 },
  reads: { [path('projects', internalProject.id)]: { ...internalProject, status: 'completed' } },
});
for (const restoring of [false, true]) {
  const before = restoring ? { ...internalProject, deletedAt: now, deletedByUid: head.id, lifecycleUpdateId: 'old-delete' } : internalProject;
  const auditId = restoring ? 'internal-project-restore' : 'internal-project-delete';
  const data = { ...before, deletedAt: restoring ? 0 : now + 1, deletedByUid: restoring ? '' : head.id, lifecycleUpdateId: auditId, updatedAt: now + 1 };
  const audit = { id: auditId, projectId: internalProject.id, kind: 'system', channel: 'system', projectLifecycleAction: restoring ? 'restore' : 'delete', createdAt: now + 1, updatedAt: now + 1, createdByUid: head.id, updatedByUid: head.id };
  const after = { [path('projects', internalProject.id)]: data, [path('projectUpdates', auditId)]: audit };
  check('internal project lifecycle ' + auditId, 'ALLOW', { method: 'update', target: path('projects', internalProject.id), before, data, after });
  check('internal project audit ' + auditId, 'ALLOW', { target: path('projectUpdates', auditId), data: audit, after });
}
check('internal project create without business settlement', 'ALLOW', { target: path('projects', internalProject.id), data: internalProject });
check('internal project work create', 'ALLOW', { data: linkedInternal, reads: projectReads });
check('internal project work update', 'ALLOW', { method: 'update', before: linkedInternal, data: { ...linkedInternal, status: 'in_progress', updatedAt: now + 1 }, reads: projectReads });
for (const [name, project, allowed] of [
  ['general project', { ...internalProject, projectType: 'general' }, false],
  ['research project', { ...internalProject, projectType: 'research' }, false],
  ['deleted project', { ...internalProject, deletedAt: now }, false],
  ['completed project', { ...internalProject, status: 'completed' }, false],
]) check('internal create rejects ' + name, allowed ? 'ALLOW' : 'DENY', { data: linkedInternal, reads: { [path('projects', internalProject.id)]: project } });
check('business work cannot bypass internal account assignment', 'DENY', { data: { ...linkedInternal, scope: '' }, reads: projectReads });
check('internal project link cannot be swapped on update', 'DENY', { method: 'update', before: work, data: { ...linkedInternal, updatedAt: now + 1 }, reads: projectReads });
for (const method of ['create', 'update']) {
  const record = { ...internalProject, id: 'internal-farm-record', farmId: 'synthetic-farm', projectId: internalProject.id };
  check('internal farm participation ' + method + ' rejected', 'DENY', { method, target: path('farmRecords', record.id), data: record,
    ...(method === 'update' ? { before: { ...record, projectId: 'old-project' } } : {}),
    reads: { ...projectReads, [path('farms', record.farmId)]: { id: record.farmId } } });
}
for (const [name, before, data, expected] of [
  ['internal to business', internalProject, { ...internalProject, projectType: 'general' }, 'DENY'],
  ['unused business to internal', { ...internalProject, projectType: 'general' }, internalProject, 'ALLOW'],
  ['unused research to internal', { ...internalProject, projectType: 'research' }, internalProject, 'ALLOW'],
  ['conversion cannot erase a contract', { ...internalProject, projectType: 'general', contractAmount: 100 }, internalProject, 'DENY'],
  ['conversion cannot erase settlement evidence', { ...internalProject, projectType: 'general', settlementEvidenceUrl: 'https://example.com/receipt' }, internalProject, 'DENY'],
  ['conversion cannot erase settlement notes', { ...internalProject, projectType: 'general', settlementNote: 'keep' }, internalProject, 'DENY'],
  ['conversion cannot erase settlement owner', { ...internalProject, projectType: 'general', settlementOwner: 'staff' }, internalProject, 'DENY'],
  ['conversion cannot rewrite completed project', { ...internalProject, projectType: 'general', status: 'completed' }, internalProject, 'DENY'],
  ['conversion cannot simultaneously complete', { ...internalProject, projectType: 'general' }, { ...internalProject, status: 'completed', currentStage: 'closed' }, 'DENY'],
  ['conversion cannot use deleted project', { ...internalProject, projectType: 'general', deletedAt: now }, { ...internalProject, deletedAt: now }, 'DENY'],
  ['general to research', { ...internalProject, projectType: 'general' }, { ...internalProject, projectType: 'research' }, 'ALLOW'],
  ['internal completed without fabricated payment', internalProject, { ...internalProject, status: 'completed', currentStage: 'closed' }, 'ALLOW'],
  ['internal financial fields', internalProject, { ...internalProject, contractAmount: 100 }, 'DENY'],
]) check(name, expected, { method: 'update', target: path('projects', internalProject.id), before, data: { ...data, updatedAt: now + 1 } });

const unusedConversionRound = { status: 'not_started', dueDate: '', claimAmount: 0, approvedAmount: 0, paidAmount: 0, settledAt: '', owner: '', evidenceUrl: '', note: '' };
for (const [name, round, expected] of [
  ['empty', unusedConversionRound, 'ALLOW'],
  ['paid', { ...unusedConversionRound, approvedAmount: 100, paidAmount: 100 }, 'DENY'],
  ['evidence', { ...unusedConversionRound, evidenceUrl: 'https://example.com/round' }, 'DENY'],
  ['note', { ...unusedConversionRound, note: 'preserve' }, 'DENY'],
]) check('conversion settlement round ' + name, expected, {
  method: 'update', target: path('projects', internalProject.id),
  before: { ...internalProject, projectType: 'general', settlementRounds: { first: round, second: unusedConversionRound } },
  data: { ...internalProject, updatedAt: now + 1 },
});

if (process.env.RULE_TEST_NAME) {
  const selected = cases.filter((entry) =>
    entry.name.includes(process.env.RULE_TEST_NAME),
  );
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
  const source = {
    files: [
      {
        name: 'firestore.rules',
        content: process.argv[2]
          ? execFileSync('git', ['show', `${process.argv[2]}:firestore.rules`], {
              encoding: 'utf8',
            })
          : readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      },
    ],
  };
  const body = { issues: [], testResults: [] };
  async function evaluate(entries) {
    const response = await client.post(
      '/projects/smartfarm-work-manager:test',
      {
        source,
        testSuite: { testCases: entries.map((entry) => entry.test) },
      },
      { skipLog: { body: true, resBody: true, queryParams: true } },
    );
    return response.body;
  }
  // Bound request size as the fixture suite grows. Preserve the exact fixture
  // and expectation for every test; splitting does not relax rule assertions.
  for (let offset = 0; offset < cases.length; offset += 50) {
    const entries = cases.slice(offset, offset + 50);
    console.log(
      `Organization rules batch ${offset + 1}-${offset + entries.length}/${cases.length}`,
    );
    const result = await evaluate(entries);
    body.issues.push(...(result.issues || []));
    body.testResults.push(...(result.testResults || []));
  }
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
