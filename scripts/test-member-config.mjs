import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertRootOwnedStat, validateInstallInput, validateMemberConfig } from '../server/members/config.mjs';
import { memberFiles, packageMemberService, validateBootstrapConfig } from './package-member-service.mjs';

const input = () => ({ project: 'fixture-project', workspace: 'fixture-workspace', origin: 'https://farm.example.invalid' });
const config = () => ({ ...input(), passwordSecret: 'synthetic-fixture-only-not-a-production-secret-123456789' });
const bootstrap = () => ({ originalIdentity: '12345-compute@developer.gserviceaccount.com', runtimeIdentity: 'members@fixture-vm.iam.gserviceaccount.com', nodeVersion: 'v24.21.0', nodeSha256: 'a'.repeat(64) });

test('member routing accepts explicit targets without expanding registrar policy', () => {
  assert.deepEqual(validateInstallInput(input()), input());
  assert.equal(validateMemberConfig(config()).origin, input().origin);
  assert.equal(validateMemberConfig({ ...config(), project: 'smartfarm-work-manager', workspace: 'sheet-20260903-579dfadc', origin: 'https://34-64-62-115.sslip.io' }).project, 'smartfarm-work-manager');
  assert.equal(validateInstallInput({ ...input(), origin: 'https://farm.example.invalid:8443' }).origin, 'https://farm.example.invalid:8443');
  assert.equal(validateInstallInput({ ...input(), workspace: 'team.data-2026_1' }).workspace, 'team.data-2026_1');
});

for (const [name, patch] of [
  ['empty project', { project: '' }], ['project traversal', { project: '../project' }],
  ['project whitespace', { project: ' fixture-project' }], ['project uppercase', { project: 'Fixture-project' }],
  ['project trailing dash', { project: 'fixture-project-' }], ['project too short', { project: 'short' }],
  ['empty workspace', { workspace: '' }], ['workspace traversal', { workspace: '../data' }],
  ['workspace embedded slash', { workspace: 'workspace/data' }], ['workspace whitespace', { workspace: 'workspace name' }],
  ['workspace too long', { workspace: 'a'.repeat(129) }],
  ['workspace leading dot', { workspace: '.workspace' }], ['empty origin', { origin: '' }],
  ['HTTP origin', { origin: 'http://farm.example.invalid' }],
  ['credentials in origin', { origin: 'https://user:password@farm.example.invalid' }],
  ['trailing slash', { origin: 'https://farm.example.invalid/' }],
  ['origin with path', { origin: 'https://farm.example.invalid/api' }],
  ['origin with query', { origin: 'https://farm.example.invalid?foo=bar' }],
  ['origin with fragment', { origin: 'https://farm.example.invalid#foo' }],
  ['wildcard origin', { origin: 'https://*.example.invalid' }],
  ['multiple origins', { origin: 'https://a.invalid,https://b.invalid' }],
  ['noncanonical origin', { origin: 'https://FARM.EXAMPLE.INVALID' }],
  ['origin whitespace', { origin: ' https://farm.example.invalid' }],
  ['extra registrar override', { registrars: ['anyone'] }],
]) test(`routing config rejects ${JSON.stringify(name)}`, () => assert.throws(() => validateInstallInput({ ...input(), ...patch })));

for (const value of [null, [], {}, '', { ...input(), project: undefined }])
  test(`routing config rejects malformed input ${JSON.stringify(value)}`, () => assert.throws(() => validateInstallInput(value)));

for (const [name, patch] of [
  ['missing secret', { passwordSecret: undefined }], ['empty secret', { passwordSecret: '' }],
  ['short secret', { passwordSecret: 'a'.repeat(47) }], ['oversize secret', { passwordSecret: 'a'.repeat(513) }],
  ['whitespace secret', { passwordSecret: ' '.repeat(64) }], ['object secret', { passwordSecret: {} }],
  ['extra allowlist', { registrars: ['anyone'] }], ['extra credential path', { keyFile: '/tmp/key' }],
]) test(`member config rejects ${JSON.stringify(name)}`, () => assert.throws(() => validateMemberConfig({ ...config(), ...patch })));

const stat = (patch = {}) => ({ uid: 0, mode: 0o100640, nlink: 1, isFile: () => true, isDirectory: () => false, ...patch });
test('configuration ownership allows only root-owned non-writable regular files', () => {
  assert.doesNotThrow(() => assertRootOwnedStat(stat()));
  assert.doesNotThrow(() => assertRootOwnedStat(stat({ mode: 0o100600 })));
  assert.doesNotThrow(() => assertRootOwnedStat(stat({ mode: 0o40750, isFile: () => false, isDirectory: () => true }), true));
  for (const patch of [{ uid: 1001 }, { mode: 0o100660 }, { mode: 0o100644 }, { mode: 0o100602 }, { nlink: 2 }, { isFile: () => false }])
    assert.throws(() => assertRootOwnedStat(stat(patch)));
  for (const patch of [{ uid: 1001 }, { mode: 0o40777 }, { isDirectory: () => false }])
    assert.throws(() => assertRootOwnedStat(stat({ mode: 0o40755, isDirectory: () => true, ...patch }), true));
});

test('bootstrap is explicit, contains only public values and supports reviewed Node 22/24', () => {
  assert.deepEqual(validateBootstrapConfig(bootstrap()), bootstrap());
  assert.equal(validateBootstrapConfig({ ...bootstrap(), nodeVersion: 'v22.18.0' }).nodeVersion, 'v22.18.0');
});
for (const patch of [
  { runtimeIdentity: bootstrap().originalIdentity }, { originalIdentity: '' },
  { runtimeIdentity: "bad'; command" }, { nodeVersion: 'v22.17.0' },
  { nodeVersion: 'v20.20.0' }, { nodeVersion: 'latest' }, { nodeSha256: '' },
  { nodeSha256: 'g'.repeat(64) }, { passwordSecret: 'never-allowed' },
]) test(`bootstrap rejects invalid or private input ${Object.keys(patch).join(',')}`, () => assert.throws(() => validateBootstrapConfig({ ...bootstrap(), ...patch })));

test('packager rejects implicit revisions and incomplete arguments without generating files', () => {
  for (const args of [['r1'], ['--bootstrap-config'], ['--revision'], ['--revision', 'unsafe/'], ['--whatever']])
    assert.throws(() => packageMemberService(args));
});

test('app allowlist, root helper, service wiring and installer remain coherent', () => {
  const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const installer = source('deploy/gce/members/install-members.sh');
  const allowlist = installer.match(/required = \{([\s\S]*?)\n\}/)[1];
  assert.deepEqual([...allowlist.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort((a, b) => a.localeCompare(b)), [...memberFiles].sort((a, b) => a.localeCompare(b)));
  assert.match(source('server/members/index.mjs'), /loadMemberConfig\(\)/);
  assert.match(source('server/members/index.mjs'), /server\.listen\(8787, '127\.0\.0\.1'/);
  assert.doesNotMatch(source('server/members/index.mjs'), /34-64-62-115|smartfarm-work-manager|sheet-20260903/);
  assert.match(installer, /member-config\.mjs/);
  assert.match(installer, /configure-members\.mjs/);
  assert.match(installer, /is-active --quiet farmlog-metadata-guard\.service/);
  assert.match(installer, /for isolated_user in smartfarm-deploy caddy/);
  assert.match(installer, /Caddy SITE_HOST must exactly match/);
  assert.doesNotMatch(installer, /34-64-62-115|sheet-20260903/);
  assert.doesNotMatch(source('deploy/gce/members/farmlog-members.service'), /Environment=GOOGLE_CLOUD_PROJECT=/);
  assert.match(source('deploy/gce/members/startup-template.sh'), /__ORIGINAL_IDENTITY__/);
  assert.match(source('deploy/gce/members/startup-template.sh'), /__RUNTIME_IDENTITY__/);
  assert.match(source('deploy/gce/members/verify-runtime.mjs'), /projectId: config.project/);
  assert.match(source('deploy/gce/members/verify-runtime.mjs'), /\['firebaseauth.users.create', 'firebaseauth.users.get'\]/);
  assert.match(source('deploy/gce/members/configure-members.mjs'), /openSync\(configPath, 'wx', 0o600\)/);
  assert.match(source('deploy/gce/members/configure-members.mjs'), /not overwriting/);
});
