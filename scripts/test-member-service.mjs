import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  REGISTRARS,
  RequestError,
  assertRegistrar,
  createRegistrar,
  temporaryPassword,
  validateInput,
} from '../server/members/core.mjs';
import { firestoreStore } from '../server/members/firestore.mjs';
import { createMemberHandler } from '../server/members/http.mjs';
import { openJournal } from '../server/members/journal.mjs';
import { loginEmail } from '../lib/login-identity.ts';

// No Firebase Admin initialization, real credentials, network, or real users.
const workspace = 'fixture-workspace';
const secret = 'synthetic-test-secret-not-a-real-deployment-secret-123456789';
const actorUid = Object.keys(REGISTRARS)[0];
const secondActorUid = Object.keys(REGISTRARS)[1];
const token = 'synthetic.fixture.token.never.sent.to.firebase';
const origin = 'https://fixture.invalid';
const requestId = '11111111-1111-4111-8111-111111111111';
const otherRequestId = '22222222-2222-4222-8222-222222222222';
const input = () => ({
  requestId,
  loginId: '테스트직원',
  displayName: '테스트 직원',
  departmentId: 'fixture-dept',
});
const decoded = (patch = {}) => ({
  uid: actorUid,
  email: REGISTRARS[actorUid],
  firebase: { sign_in_provider: 'password' },
  ...patch,
});
const actorMember = (patch = {}) => ({
  email: REGISTRARS[actorUid],
  active: true,
  admin: false,
  workspaceId: workspace,
  passwordChangeRequired: false,
  ...patch,
});
const denied = (status) => (error) => {
  assert.ok(error instanceof RequestError);
  assert.equal(error.status, status);
  return true;
};
const notFound = () =>
  Object.assign(new Error('synthetic missing user'), {
    code: 'auth/user-not-found',
  });

function fixture(t) {
  const journal = openJournal(':memory:');
  t.after(() => journal.close());
  const state = {
    decoded: decoded(),
    members: new Map([[actorUid, actorMember()]]),
    users: new Map(),
    authCalls: [],
    commits: [],
    department: { id: 'fixture-dept' },
    failCreate: '',
    failCommit: '',
    actorReads: 0,
  };
  const auth = new Proxy(
    {
      async verifyIdToken(value, revoked) {
        state.authCalls.push(['verifyIdToken', value, revoked]);
        if (state.verifyError) throw state.verifyError;
        return state.decoded;
      },
      async getUser(uid) {
        state.authCalls.push(['getUser', uid]);
        if (state.lookupError) throw state.lookupError;
        if (!state.users.has(uid)) throw notFound();
        return state.users.get(uid);
      },
      async getUserByEmail(email) {
        state.authCalls.push(['getUserByEmail', email]);
        const user = [...state.users.values()].find(
          (user) => user.email === email,
        );
        if (!user) throw notFound();
        return user;
      },
      async createUser(data) {
        state.authCalls.push(['createUser', structuredClone(data)]);
        if (state.createGate) await state.createGate;
        if (state.failCreate === 'before') {
          state.failCreate = '';
          throw new Error('synthetic Auth failure before creation');
        }
        const user = { ...data, metadata: {} };
        state.users.set(user.uid, user);
        if (state.failCreate === 'after') {
          state.failCreate = '';
          throw new Error('synthetic Auth response lost');
        }
        return user;
      },
    },
    {
      get(target, key) {
        assert.ok(
          Object.hasOwn(target, key),
          `Forbidden Auth API: ${String(key)}`,
        );
        return target[key];
      },
    },
  );
  const store = {
    async member(value, uid) {
      assert.equal(value, token);
      if (uid === state.decoded.uid) {
        state.actorReads++;
        if (state.revokeOnSecondRead && state.actorReads > 1)
          return { ...state.members.get(uid), active: false };
      }
      return state.members.get(uid) || null;
    },
    async department(value, id) {
      assert.equal(value, token);
      assert.equal(id, 'fixture-dept');
      return state.department;
    },
    async createMember(value, uid, member) {
      assert.equal(value, token);
      state.commits.push([uid, structuredClone(member)]);
      if (state.failCommit === 'before') {
        state.failCommit = '';
        throw new RequestError(503, 'synthetic write unavailable');
      }
      assert.equal(state.members.has(uid), false, 'Never overwrite membership');
      state.members.set(uid, structuredClone(member));
      if (state.failCommit === 'after') {
        state.failCommit = '';
        throw new RequestError(503, 'synthetic commit response lost');
      }
    },
  };
  state.register = createRegistrar({
    auth,
    store,
    journal,
    workspace,
    passwordSecret: secret,
    now: () => 1789344000000,
  });
  state.createCalls = () =>
    state.authCalls.filter(([name]) => name === 'createUser');
  return state;
}

test('member input normalizes identity and forbids privilege-bearing fields', () => {
  const normalized = validateInput({
    ...input(),
    loginId: ' TEST_A ',
    displayName: '  직원  ',
  });
  assert.equal(normalized.loginId, 'test_a');
  assert.equal(normalized.displayName, '직원');
  assert.equal(normalized.email, loginEmail('test_a'));
  for (const key of [
    'admin',
    'active',
    'workspaceId',
    'uid',
    'password',
    'jobTitle',
  ])
    assert.throws(
      () => validateInput({ ...input(), [key]: true }),
      denied(400),
    );
});

for (const [name, patch] of [
  ['invalid request id', { requestId: 'not-a-request-id' }],
  ['invalid identity', { loginId: '../admin' }],
  ['email instead of login id', { loginId: 'admin@example.invalid' }],
  ['empty display name', { displayName: '  ' }],
  ['overlong display name', { displayName: 'x'.repeat(41) }],
  ['control character', { displayName: 'name\nsecret' }],
  ['invalid department path', { departmentId: '../other' }],
  ['empty department', { departmentId: '' }],
  ['non-string department', { departmentId: 7 }],
])
  test(`member input rejects ${JSON.stringify(name)}`, () => {
    assert.throws(() => validateInput({ ...input(), ...patch }), denied(400));
  });

test('member input rejects arrays, null and missing fields', () => {
  for (const value of [null, [], 'value', {}, { requestId }])
    assert.throws(() => validateInput(value), denied(400));
});

test('temporary password is stable per reservation, strong-shaped and unique per UID', () => {
  const password = temporaryPassword(secret, 'fixture-uid-1');
  assert.match(password, /^aA1![A-Za-z0-9_-]{20}$/);
  assert.equal(password, temporaryPassword(secret, 'fixture-uid-1'));
  assert.notEqual(password, temporaryPassword(secret, 'fixture-uid-2'));
  assert.notEqual(
    password,
    temporaryPassword(secret + '-rotated', 'fixture-uid-1'),
  );
});

test('only the two explicitly authorized personal accounts can register ordinary staff', () => {
  for (const uid of [actorUid, secondActorUid])
    assert.doesNotThrow(() =>
      assertRegistrar(
        decoded({ uid, email: REGISTRARS[uid] }),
        actorMember({ email: REGISTRARS[uid] }),
        workspace,
      ),
    );
  assert.equal(Object.keys(REGISTRARS).length, 2);
});

for (const [name, userPatch, memberPatch] of [
  ['different UID even if admin', { uid: 'unlisted-admin' }, { admin: true }],
  ['different identity email', { email: 'other@example.invalid' }, {}],
  [
    'non-password provider',
    { firebase: { sign_in_provider: 'google.com' } },
    {},
  ],
  ['inactive account', {}, { active: false }],
  ['different workspace', {}, { workspaceId: 'another-workspace' }],
  ['pending password change', {}, { passwordChangeRequired: true }],
  [
    'missing password-change confirmation',
    {},
    { passwordChangeRequired: undefined },
  ],
  ['member/token email mismatch', {}, { email: 'other@example.invalid' }],
])
  test(`registrar guard rejects ${JSON.stringify(name)}`, () => {
    assert.throws(
      () =>
        assertRegistrar(
          decoded(userPatch),
          actorMember(memberPatch),
          workspace,
        ),
      denied(403),
    );
  });

test('registrar guard rejects missing token or membership', () => {
  assert.throws(
    () => assertRegistrar(null, actorMember(), workspace),
    denied(403),
  );
  assert.throws(() => assertRegistrar(decoded(), null, workspace), denied(403));
});

test('successful registration uses get/create-only Auth and creates one non-admin membership', async (t) => {
  const f = fixture(t);
  const result = await f.register(token, input());
  assert.match(result.uid, /^staff-member-[a-f0-9-]{36}$/);
  assert.equal(result.alreadyCreated, false);
  assert.match(result.initialPassword, /^aA1!/);
  assert.deepEqual(f.authCalls[0], ['verifyIdToken', token, true]);
  assert.deepEqual(
    [...new Set(f.authCalls.map(([name]) => name))],
    ['verifyIdToken', 'getUser', 'getUserByEmail', 'createUser'],
  );
  const user = f.createCalls()[0][1];
  assert.deepEqual(Object.keys(user).sort(), [
    'disabled',
    'displayName',
    'email',
    'emailVerified',
    'password',
    'uid',
  ]);
  assert.equal(user.disabled, false);
  assert.equal(user.emailVerified, false);
  const member = f.members.get(result.uid);
  assert.equal(member.admin, false);
  assert.equal(member.jobTitle, '직원');
  assert.equal(member.passwordChangeRequired, true);
  assert.equal(member.workspaceId, workspace);
  assert.equal(member.createdByUid, actorUid);
  assert.equal(member.registrationRequestId, requestId);
  assert.equal(member.createdAt, 1789344000000);
  assert.equal(Object.hasOwn(member, 'password'), false);
  assert.equal(Object.hasOwn(member, 'customClaims'), false);
});

test('invalid or revoked ID token causes no account creation or store write', async (t) => {
  const f = fixture(t);
  f.verifyError = new Error('synthetic revoked token');
  await assert.rejects(f.register(token, input()), denied(401));
  assert.equal(f.createCalls().length, 0);
  assert.equal(f.commits.length, 0);
});

test('an administrator not in registrar allowlist cannot create users', async (t) => {
  const f = fixture(t);
  f.decoded = decoded({ uid: 'another-admin' });
  f.members.set('another-admin', actorMember({ admin: true }));
  await assert.rejects(f.register(token, input()), denied(403));
  assert.equal(f.createCalls().length, 0);
  assert.equal(f.commits.length, 0);
});

for (const dept of [null, { id: 'different-department' }])
  test(`unknown or mismatched department cannot create account (${JSON.stringify(dept)})`, async (t) => {
    const f = fixture(t);
    f.department = dept;
    await assert.rejects(f.register(token, input()), denied(400));
    assert.equal(f.createCalls().length, 0);
  });

test('existing login identity is never adopted, reset, overwritten or deleted', async (t) => {
  const f = fixture(t);
  const original = {
    uid: 'existing-user',
    email: loginEmail(input().loginId),
    disabled: true,
  };
  f.users.set(original.uid, original);
  await assert.rejects(f.register(token, input()), denied(409));
  assert.equal(f.createCalls().length, 0);
  assert.equal(f.commits.length, 0);
  assert.deepEqual(f.users.get(original.uid), original);
});

test('non-not-found Auth lookup error is propagated without attempting creation', async (t) => {
  const f = fixture(t);
  f.lookupError = Object.assign(new Error('synthetic IAM denied'), {
    code: 'auth/insufficient-permission',
  });
  await assert.rejects(f.register(token, input()), /synthetic IAM denied/);
  assert.equal(f.createCalls().length, 0);
});

test('same request and equivalent new request ID reuse one account, password and membership', async (t) => {
  const f = fixture(t);
  const first = await f.register(token, input());
  for (const data of [input(), { ...input(), requestId: otherRequestId }]) {
    const retry = await f.register(token, data);
    assert.equal(retry.uid, first.uid);
    assert.equal(retry.initialPassword, first.initialPassword);
    assert.equal(retry.alreadyCreated, true);
  }
  assert.equal(f.createCalls().length, 1);
  assert.equal(f.commits.length, 1);
});

test('same reservation cannot be reused with different submitted data or actor', async (t) => {
  const f = fixture(t);
  await f.register(token, input());
  await assert.rejects(
    f.register(token, { ...input(), displayName: '다른 이름' }),
    denied(409),
  );
  f.decoded = decoded({
    uid: secondActorUid,
    email: REGISTRARS[secondActorUid],
  });
  f.members.set(
    secondActorUid,
    actorMember({ email: REGISTRARS[secondActorUid] }),
  );
  await assert.rejects(f.register(token, input()), denied(409));
  assert.equal(f.createCalls().length, 1);
});

for (const failCreate of ['before', 'after'])
  test(`Auth ${failCreate} creation failure recovers with the reserved UID and no reset`, async (t) => {
    const f = fixture(t);
    f.failCreate = failCreate;
    await assert.rejects(f.register(token, input()), /synthetic Auth/);
    const reservedUid = f.createCalls()[0][1].uid;
    const retry = await f.register(token, input());
    assert.equal(retry.uid, reservedUid);
    assert.equal(f.users.size, 1);
    assert.equal(f.commits.length, 1);
    assert.equal(f.createCalls().length, failCreate === 'before' ? 2 : 1);
  });

for (const failCommit of ['before', 'after'])
  test(`Firestore ${failCommit} commit failure safely resumes without duplicate account`, async (t) => {
    const f = fixture(t);
    f.failCommit = failCommit;
    await assert.rejects(f.register(token, input()), denied(503));
    const reservedUid = f.createCalls()[0][1].uid;
    const retry = await f.register(token, input());
    assert.equal(retry.uid, reservedUid);
    assert.equal(f.createCalls().length, 1);
    assert.equal(f.commits.length, failCommit === 'before' ? 2 : 1);
  });

test('registrar approval revoked during request stops membership write', async (t) => {
  const f = fixture(t);
  f.revokeOnSecondRead = true;
  await assert.rejects(f.register(token, input()), denied(403));
  assert.equal(f.commits.length, 0);
  // Do not delete/reset the newly reserved Auth account during an ambiguous failure.
  assert.equal(f.users.size, 1);
  f.revokeOnSecondRead = false;
  assert.ok((await f.register(token, input())).uid);
  assert.equal(f.createCalls().length, 1);
});

test('conflicting existing membership is never overwritten', async (t) => {
  const f = fixture(t);
  f.failCommit = 'before';
  await assert.rejects(f.register(token, input()), denied(503));
  const uid = f.createCalls()[0][1].uid;
  const conflicting = {
    email: loginEmail(input().loginId),
    createdByUid: 'other-actor',
    registrationRequestId: 'other-request',
    admin: true,
  };
  f.members.set(uid, conflicting);
  await assert.rejects(f.register(token, input()), denied(409));
  assert.deepEqual(f.members.get(uid), conflicting);
  assert.equal(f.commits.length, 1);
});

for (const kind of ['signed-in', 'disabled', 'password-changed'])
  test(`retry never reveals initial password for ${kind} account`, async (t) => {
    const f = fixture(t);
    const created = await f.register(token, input());
    if (kind === 'signed-in')
      f.users.get(created.uid).metadata.lastSignInTime = '2026-09-14T00:00:00Z';
    if (kind === 'disabled') f.users.get(created.uid).disabled = true;
    if (kind === 'password-changed')
      f.members.get(created.uid).passwordChangeRequired = false;
    const retry = await f.register(token, input());
    assert.equal(Object.hasOwn(retry, 'initialPassword'), false);
    assert.equal(f.createCalls().length, 1);
  });

test('simultaneous requests for the same identity do not create duplicate accounts', async (t) => {
  const f = fixture(t);
  let release;
  f.createGate = new Promise((resolve) => {
    release = resolve;
  });
  const first = f.register(token, input());
  while (!f.createCalls().length)
    await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(f.register(token, input()), denied(409));
  release();
  await first;
  assert.equal(f.createCalls().length, 1);
});

function job(patch = {}) {
  return {
    uid: 'fixture-uid',
    requestId,
    email: 'fixture@example.invalid',
    fingerprint: 'fixture-fingerprint',
    actorUid: 'fixture-actor',
    createdAt: 1,
    ...patch,
  };
}
test('SQLite journal persists reservation and completion across process-style reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'farmlog-member-journal-test-'));
  const filename = join(directory, 'registrations.sqlite');
  let journal = openJournal(filename);
  t.after(() => {
    journal.close();
    for (const suffix of ['', '-wal', '-shm'])
      rmSync(filename + suffix, { force: true });
    rmdirSync(directory);
  });
  journal.reserve(job());
  journal.close();
  journal = openJournal(filename);
  assert.equal(
    journal.reserve(job({ uid: 'new-candidate' })).uid,
    'fixture-uid',
  );
  journal.complete('fixture-uid');
  journal.close();
  journal = openJournal(filename);
  assert.equal(
    journal.reserve(job({ requestId: otherRequestId })).status,
    'complete',
  );
});

test('SQLite conflict rolls back and journal remains usable', (t) => {
  const journal = openJournal(':memory:');
  t.after(() => journal.close());
  journal.reserve(job());
  assert.throws(
    () => journal.reserve(job({ fingerprint: 'different' })),
    denied(409),
  );
  assert.throws(
    () => journal.reserve(job({ actorUid: 'different' })),
    denied(409),
  );
  assert.equal(journal.reserve(job()).uid, 'fixture-uid');
  assert.equal(
    journal.reserve(
      job({
        uid: 'second',
        requestId: otherRequestId,
        email: 'second@example.invalid',
        fingerprint: 'second',
      }),
    ).uid,
    'second',
  );
});

test('Firestore uses only caller ID token, encoded scoped paths and typed decoding', async () => {
  const requests = [];
  const store = firestoreStore(
    'fixture-project',
    workspace,
    async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          fields: {
            email: { stringValue: '' },
            active: { booleanValue: false },
            createdAt: { integerValue: '17' },
          },
        }),
      };
    },
  );
  assert.deepEqual(await store.member(token, 'uid/with space'), {
    email: '',
    active: false,
    createdAt: 17,
  });
  await store.department(token, 'dept/with space');
  assert.match(requests[0].url, /\/appMembers\/uid%2Fwith%20space$/);
  assert.match(
    requests[1].url,
    /\/workspaces\/fixture-workspace\/departments\/dept%2Fwith%20space$/,
  );
  for (const { options } of requests) {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test('Firestore create uses atomic exists=false precondition and never patches an existing member', async () => {
  let captured;
  const store = firestoreStore(
    'fixture-project',
    workspace,
    async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({}) };
    },
  );
  await store.createMember(token, 'new-uid', {
    admin: false,
    createdAt: 12,
    displayName: '직원',
  });
  assert.match(captured.url, /documents:commit$/);
  assert.equal(captured.options.method, 'POST');
  const { writes } = JSON.parse(captured.options.body);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].currentDocument, { exists: false });
  assert.equal(
    writes[0].update.name,
    'projects/fixture-project/databases/(default)/documents/appMembers/new-uid',
  );
  assert.deepEqual(writes[0].update.fields, {
    admin: { booleanValue: false },
    createdAt: { integerValue: '12' },
    displayName: { stringValue: '직원' },
  });
});

test('Firestore GET 404 means absent; POST commit 404 must never report registration success', async () => {
  const store = firestoreStore('fixture-project', workspace, async () => ({
    ok: false,
    status: 404,
  }));
  assert.equal(await store.member(token, 'missing'), null);
  assert.equal(await store.department(token, 'missing'), null);
  await assert.rejects(
    store.createMember(token, 'new', { admin: false }),
    denied(503),
  );
});

for (const status of [401, 403, 409, 429, 500, 503])
  test(`Firestore status ${status} fails closed and contains no upstream body`, async () => {
    const store = firestoreStore('fixture-project', workspace, async () => ({
      ok: false,
      status,
      json: async () => ({ message: 'upstream-sensitive-fixture' }),
    }));
    await assert.rejects(store.createMember(token, 'new', {}), (error) => {
      denied(status === 401 || status === 403 ? 403 : 503)(error);
      assert.doesNotMatch(error.message, /upstream-sensitive-fixture/);
      return true;
    });
  });

async function httpRequest(handler, patch = {}) {
  const {
    body = JSON.stringify(input()),
    chunks,
    headers = {},
    ...rest
  } = patch;
  const req = {
    method: 'POST',
    url: '/api/admin/members',
    headers: {
      origin,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...headers,
    },
    ...rest,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks || [Buffer.from(body)])
        yield Buffer.from(chunk);
    },
  };
  const response = {};
  await handler(req, {
    writeHead(status, responseHeaders) {
      response.status = status;
      response.headers = responseHeaders;
    },
    end(value) {
      response.raw = value;
      response.body = JSON.parse(value);
    },
  });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  return response;
}

test('HTTP health does not execute registration and successful JSON forwards only token and input', async () => {
  const calls = [];
  const handler = createMemberHandler({
    origin,
    register: async (...args) => {
      calls.push(args);
      return { uid: 'fixture-new', initialPassword: 'synthetic-only' };
    },
  });
  assert.equal(
    (await httpRequest(handler, { method: 'GET', url: '/_health' })).body.ready,
    true,
  );
  assert.equal(calls.length, 0);
  const response = await httpRequest(handler);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [[token, input()]]);
  assert.equal(response.body.uid, 'fixture-new');
});

for (const [name, patch, status] of [
  ['GET registration', { method: 'GET' }, 404],
  ['OPTIONS registration', { method: 'OPTIONS' }, 404],
  ['unknown path', { url: '/api/admin/other' }, 404],
  ['query suffix', { url: '/api/admin/members?override=1' }, 404],
  ['foreign origin', { headers: { origin: 'https://untrusted.invalid' } }, 403],
  ['missing origin', { headers: { origin: undefined } }, 403],
  ['non-JSON body', { headers: { 'content-type': 'text/plain' } }, 415],
  ['missing token', { headers: { authorization: undefined } }, 401],
  ['wrong auth scheme', { headers: { authorization: `Basic ${token}` } }, 401],
  ['short token', { headers: { authorization: 'Bearer short' } }, 401],
  ['malformed JSON', { body: '{' }, 400],
  ['oversized body', { body: 'x'.repeat(8193) }, 413],
  [
    'chunked oversized body',
    { chunks: ['x'.repeat(4097), 'x'.repeat(4096)] },
    413,
  ],
])
  test(`HTTP rejects ${JSON.stringify(name)} before registration`, async () => {
    let calls = 0;
    const handler = createMemberHandler({
      origin,
      register: async () => {
        calls++;
      },
    });
    assert.equal((await httpRequest(handler, patch)).status, status);
    assert.equal(calls, 0);
  });

test('HTTP global fixed window rate limit rejects request 31 and resets after one minute', async () => {
  let timestamp = 1000;
  let calls = 0;
  const handler = createMemberHandler({
    origin,
    now: () => timestamp,
    register: async () => {
      calls++;
      return { uid: 'fixture' };
    },
  });
  for (let i = 0; i < 30; i++)
    assert.equal((await httpRequest(handler)).status, 200);
  assert.equal((await httpRequest(handler)).status, 429);
  assert.equal(calls, 30);
  timestamp += 60000;
  assert.equal((await httpRequest(handler)).status, 200);
});

test('HTTP known errors are precise; unexpected errors cannot leak credentials in response or logs', async () => {
  const logs = [];
  const known = createMemberHandler({
    origin,
    logError: (v) => logs.push(v),
    register: async () => {
      throw new RequestError(409, 'fixture collision');
    },
  });
  const precise = await httpRequest(known);
  assert.equal(precise.status, 409);
  assert.equal(precise.body.message, 'fixture collision');
  assert.equal(logs.length, 0);
  for (const error of [
    new Error(`sensitive ${token} ${secret}`),
    null,
    Object.assign(new Error(secret), { code: 'auth/email-already-exists' }),
  ]) {
    const handler = createMemberHandler({
      origin,
      logError: (v) => logs.push(v),
      register: async () => {
        throw error;
      },
    });
    const response = await httpRequest(handler);
    assert.equal(response.status, 503);
    assert.equal(response.raw.includes(token), false);
    assert.equal(response.raw.includes(secret), false);
  }
  assert.equal(logs.length, 3);
  assert.equal(logs.join('').includes(token), false);
  assert.equal(logs.join('').includes(secret), false);
  assert.equal(JSON.parse(logs[2]).code, 'account-conflict');
});

test('synthetic HTTP-to-core flow returns the idempotent result without using any external service', async (t) => {
  const f = fixture(t);
  const handler = createMemberHandler({ origin, register: f.register });
  const first = await httpRequest(handler);
  const retry = await httpRequest(handler);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.uid, first.body.uid);
  assert.equal(retry.body.initialPassword, first.body.initialPassword);
  assert.equal(f.createCalls().length, 1);
  assert.equal(f.commits.length, 1);
});
