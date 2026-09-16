import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = new Map();
function load(path, overrides = {}, extra = '', cache = new Map()) {
  if (cache.has(path)) return cache.get(path);
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const result = {};
  cache.set(path, result);
  vm.runInNewContext(compiled.get(path) + extra, {
    exports: result, module: { exports: result }, crypto: webcrypto, TextEncoder, TextDecoder, Date, Error, Response,
    console: { error() {} },
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts', overrides, '', cache);
      if (name.startsWith('.')) return load(posix.normalize(posix.join(posix.dirname(path), name + '.ts')), overrides, '', cache);
      throw new Error('Unexpected dependency ' + name);
    },
  }, { filename: path });
  return result;
}
const helpers = load('lib/project-installation-farms.ts');
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const requestId = '12345678-1234-4321-9876-123456789012';
const projectId = 'registration-' + requestId;
const projectInput = (targetFarmCount, patch = {}) => ({
  name: '설치 개소 검증 프로젝트', projectType: 'general', year: 2026,
  institution: '기관', status: 'active', description: '', targetFarmCount,
  manager: '담당자', startDate: '2026-09-14', endDate: '2027-03-13', currentStage: 'agreement',
  settlementStatus: 'not_started', settlementDueDate: '', contractAmount: 0,
  settlementClaimAmount: 0, settlementApprovedAmount: 0, settlementPaidAmount: 0,
  settledAt: '', settlementOwner: '', settlementEvidenceUrl: '', settlementNote: '', ...patch,
});

function harness() {
  let state = new Map(), queue = Promise.resolve(), transactionNumber = 0;
  let failureAt = 0, lostResponseAt = 0, actorUid = 'creator';
  const committedWrites = [];
  const firestore = {
    doc: (_db, ...parts) => ({ path: parts.join('/') }),
    collection: (_db, ...parts) => ({ path: parts.join('/') }),
    runTransaction: (_db, callback) => {
      const task = queue.then(async () => {
        transactionNumber += 1;
        const operations = [];
        const transaction = {
          get: async (reference) => {
            assert.equal(operations.length, 0, 'Every read precedes every write');
            const data = clone(state.get(reference.path));
            return { exists: () => data !== undefined, data: () => clone(data) };
          },
          set: (reference, data) => operations.push(['set', reference.path, clone(data)]),
          update: (reference, data) => operations.push(['update', reference.path, clone(data)]),
        };
        const result = await callback(transaction);
        if (failureAt === transactionNumber) throw new Error('Simulated interrupted commit');
        const next = new Map(state);
        for (const [kind, path, data] of operations) {
          assert.ok(data.id === undefined || data.id.length <= 160);
          if (kind === 'update') {
            assert.ok(next.has(path));
            next.set(path, { ...next.get(path), ...data });
          } else {
            assert.ok(!next.has(path), 'Provisioning must never overwrite existing records');
            next.set(path, data);
          }
        }
        state = next;
        committedWrites.push(operations);
        if (lostResponseAt === transactionNumber) throw new Error('Simulated commit response lost');
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
  const api = load('lib/firebase/farm-ledger-store.ts', {
    'firebase/firestore': firestore,
    react: { useEffect() {}, useState() {} },
    './client': { firebaseWorkspaceId: 'test', getFirebaseServices: () => ({ db: {} }), requireSignedInUser: () => ({ uid: actorUid }) },
  }, '\nexports.post = body => mutateFarmLedger("POST", body);');
  const put = (collection, value) => state.set(`workspaces/test/${collection}/${value.id}`, clone(value));
  const list = (collection) => [...state.entries()].filter(([path]) => path.startsWith(`workspaces/test/${collection}/`)).map(([, value]) => clone(value));
  return {
    api, put, list, committedWrites,
    failAt: (value) => { failureAt = value; }, loseResponseAt: (value) => { lostResponseAt = value; },
    actor: (value) => { actorUid = value; },
    create: (count, patch = {}) => api.post({ kind: 'project', requestId, project: projectInput(count, patch) }),
    resume: () => api.post({ kind: 'project_installation_farms', projectId }),
  };
}

for (const count of [0, 3, 23, helpers.MAX_PROJECT_INSTALLATION_FARMS]) test(`${count} installation sites create exact neutral farm/record pairs in bounded chunks`, async () => {
  const h = harness();
  const result = await h.create(count);
  assert.equal(result.installationSetupError, undefined);
  assert.deepEqual(clone(result.project.installationFarmSetup), { requestedCount: count, completedCount: count });
  assert.equal(h.list('projects').length, 1);
  assert.equal(h.list('farms').length, count);
  assert.equal(h.list('farmRecords').length, count);
  assert.equal(h.list('farmCodeReservations').length, count);
  assert.equal(h.list('farmRecordReservations').length, count);
  assert.equal(h.list('projectDocuments').length, 5);
  assert.equal(h.list('projectUpdates').length, 1);
  for (const collection of ['workItems', 'historyEntries', 'subscriptionEvents']) assert.equal(h.list(collection).length, 0);
  for (const farm of h.list('farms')) {
    assert.match(farm.name, /^미입력 농가 \d{3}$/);
    assert.equal(farm.region, '미입력');
    assert.equal(farm.phone, ''); assert.equal(farm.address, '');
  }
  for (const record of h.list('farmRecords')) {
    assert.equal(record.projectId, result.project.id);
    assert.equal(record.subscriptionStatus, 'unregistered');
    assert.equal(record.subscriptionYears, 0); assert.equal(record.warrantyYears, 0);
    assert.equal(record.stageCompletionConfirmed, undefined);
    for (const field of ['installationDate', 'commissioningDate', 'educationDate', 'currentSubscriptionExpiresAt', 'lastPaymentDate']) assert.equal(record[field], '');
  }
  for (const writes of h.committedWrites) {
    assert.ok(writes.filter(([, path]) => path.includes('/farms/')).length <= helpers.PROJECT_INSTALLATION_FARM_CHUNK_SIZE);
    assert.ok(writes.length <= helpers.PROJECT_INSTALLATION_FARM_CHUNK_SIZE * 4 + 1);
  }
});

test('internal project creates no farm placeholders or business templates', async () => {
  const h = harness();
  const result = await h.create(3, { projectType: 'internal', institution: '' });
  assert.equal(result.project.targetFarmCount, 0);
  assert.equal(result.project.installationFarmSetup, undefined);
  assert.equal(h.list('farms').length, 0); assert.equal(h.list('farmRecords').length, 0);
  assert.equal(h.list('projectDocuments').length, 0); assert.equal(h.list('projectUpdates').length, 1);
  await assert.rejects(h.resume(), /내부 프로젝트/);
});

test('invalid counts and request identifiers are rejected before any writes', async () => {
  for (const count of [-1, 0.1, NaN, Infinity, 501, Number.MAX_SAFE_INTEGER + 1]) {
    const h = harness();
    await assert.rejects(h.create(count));
    assert.equal(h.committedWrites.length, 0);
  }
  const h = harness();
  await assert.rejects(h.api.post({ kind: 'project', requestId: '../../invalid', project: projectInput(1) }), /요청 ID/);
  assert.equal(h.list('projects').length, 0);
});

test('mid-provisioning failure exposes saved progress and explicit retry only fills the rest', async () => {
  const h = harness(); h.failAt(3);
  const partial = await h.create(23);
  assert.match(partial.installationSetupError, /interrupted/);
  assert.equal(partial.project.installationFarmSetup.completedCount, 10);
  assert.equal(h.list('farms').length, 10);
  h.failAt(0);
  const result = await h.resume();
  assert.equal(result.project.installationFarmSetup.completedCount, 23);
  assert.equal(h.list('farms').length, 23); assert.equal(h.list('projectUpdates').length, 1);
});

test('lost initial registration commit response can be retried without duplicate projects or audit documents', async () => {
  const h = harness(); h.loseResponseAt(1);
  await assert.rejects(h.create(3), /response lost/);
  assert.equal(h.list('projects').length, 1); assert.equal(h.list('farms').length, 0);
  h.loseResponseAt(0);
  const result = await h.create(3);
  assert.equal(result.project.installationFarmSetup.completedCount, 3);
  assert.equal(h.list('projects').length, 1); assert.equal(h.list('projectUpdates').length, 1); assert.equal(h.list('projectDocuments').length, 5);
});

test('failed initial registration is atomic and a retry with the same request creates one project', async () => {
  const h = harness(); h.failAt(1);
  await assert.rejects(h.create(3), /interrupted/);
  for (const collection of ['projects', 'farms', 'projectUpdates', 'projectDocuments']) assert.equal(h.list(collection).length, 0);
  h.failAt(0); await h.create(3);
  assert.equal(h.list('projects').length, 1); assert.equal(h.list('farms').length, 3);
});

test('lost site commit response and concurrent invocations do not duplicate installation sites', async () => {
  const h = harness(); h.loseResponseAt(2);
  const partial = await h.create(23);
  assert.match(partial.installationSetupError, /response lost/);
  assert.equal(h.list('farms').length, 10);
  h.loseResponseAt(0);
  const results = await Promise.all([h.resume(), h.resume(), h.create(23)]);
  for (const result of results) assert.equal(result.project.installationFarmSetup.completedCount, 23);
  assert.equal(h.list('farms').length, 23); assert.equal(h.list('farmRecords').length, 23);
  assert.equal(h.list('projects').length, 1); assert.equal(h.list('projectUpdates').length, 1);
});

test('request replay does not overwrite edited project or edited placeholder identity/contact details', async () => {
  const h = harness(); await h.create(3);
  const project = h.list('projects')[0];
  h.put('projects', { ...project, name: '수정한 프로젝트', targetFarmCount: 1 });
  const farm = h.list('farms')[0];
  const editedFarm = { ...farm, name: '김농가', address: '변경 주소', phone: '010-0000-0000', farmCode: 'REAL-001' };
  h.put('farms', editedFarm);
  const result = await h.create(3);
  assert.equal(result.project.name, '수정한 프로젝트'); assert.equal(result.project.targetFarmCount, 1);
  assert.deepEqual(h.list('farms').find(({ id }) => id === farm.id), editedFarm);
  assert.equal(h.list('farms').length, 3);
  await assert.rejects(h.create(4), /다른 프로젝트 등록/);
  h.actor('another-user');
  await assert.rejects(h.create(3), /다른 프로젝트 등록/);
});

test('already-created deterministic pair is preserved when resuming an earlier progress checkpoint', async () => {
  const h = harness(); await h.create(3);
  const project = h.list('projects')[0];
  h.put('projects', { ...project, installationFarmSetup: { requestedCount: 3, completedCount: 0 } });
  const farm = h.list('farms')[0];
  h.put('farms', { ...farm, name: '수정된 농가', farmCode: 'REAL-002' });
  const oldClaim = h.list('farmCodeReservations').find(({ entityId }) => entityId === farm.id);
  h.put('farmCodeReservations', { ...oldClaim, active: false });
  await h.resume();
  assert.equal(h.list('farms')[0].name, '수정된 농가');
  assert.equal(h.list('farms')[0].farmCode, 'REAL-002');
  assert.equal(h.list('farmCodeReservations').find(({ id }) => id === oldClaim.id).active, false);
  assert.equal(h.list('farms').length, 3);
});

test('reservation collision leaves existing claim intact and creates no partial farm/record pair', async () => {
  const h = harness();
  const claim = { id: `temp-${projectId}-001`, entityId: 'unrelated-farm', active: true };
  h.put('farmCodeReservations', claim);
  const result = await h.create(3);
  assert.match(result.installationSetupError, /이미 예약/);
  assert.equal(result.project.installationFarmSetup.completedCount, 0);
  assert.equal(h.list('farms').length, 0); assert.equal(h.list('farmRecords').length, 0);
  assert.deepEqual(h.list('farmCodeReservations'), [claim]);
});

test('deleted or completed projects cannot resume or receive new farms', async () => {
  for (const patch of [{ deletedAt: Date.now() }, { status: 'completed', currentStage: 'closed' }]) {
    const h = harness(); h.failAt(2); await h.create(3); h.failAt(0);
    h.put('projects', { ...h.list('projects')[0], ...patch });
    await assert.rejects(h.resume(), /삭제된|완료된/);
    assert.equal(h.list('farms').length, 0);
  }
});

test('legacy project creation without requestId still receives a unique registration identity', async () => {
  const h = harness();
  const result = await h.api.post({ kind: 'project', project: projectInput(0) });
  assert.match(result.project.registrationRequestId, /^[a-f\d-]{36}$/);
  assert.equal(h.list('projects').length, 1);
});

test('signature ignores object insertion order but binds the registration snapshot', async () => {
  assert.equal(await helpers.projectRegistrationSignature({ a: 1, b: { x: 2, y: 3 } }), await helpers.projectRegistrationSignature({ b: { y: 3, x: 2 }, a: 1 }));
  assert.notEqual(await helpers.projectRegistrationSignature(projectInput(3)), await helpers.projectRegistrationSignature(projectInput(4)));
});
