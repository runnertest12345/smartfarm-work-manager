// Synthetic fixtures only: no network, live credentials, or business data writes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, readdirSync, lstatSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseEnv } from 'node:util';
import { demoEnvironment, setup } from './setup.mjs';
import { validateEnvironment } from './check-environment.mjs';
import { inspectStaticDirectory, releaseMetadata } from './build-release.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));
const synthetic = {
  NEXT_PUBLIC_FIREBASE_API_KEY: `AIza${'z'.repeat(35)}`,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fixture-project.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fixture-project',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'fixture-project.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:1234567890:web:123abc',
  NEXT_PUBLIC_FIREBASE_WORKSPACE_ID: 'fixture-workspace',
  NEXT_PUBLIC_SITE_URL: 'https://fixture-site.test',
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false',
};
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'farmlog-portable-test-'));
  try { return run(root); }
  finally {
    // Never recursively delete a junction or broad computed root.
    function clean(folder) {
      assert.equal(lstatSync(folder).isSymbolicLink(), false);
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = join(folder, entry.name);
        assert.equal(entry.isSymbolicLink(), false);
        if (entry.isDirectory()) clean(path);
        else unlinkSync(path);
      }
      rmdirSync(folder);
    }
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    assert.ok(root.includes('farmlog-portable-test-'));
    clean(root);
  }
}
function cli(name, root, args = [], overrides = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NEXT_PUBLIC_') && !['NODE_ENV', '__NEXT_PROCESSED_ENV'].includes(key)));
  return spawnSync(process.execPath, [join(scripts, name), ...args], { cwd: root, env: { ...env, ...overrides }, encoding: 'utf8', shell: false });
}
const envText = (data) => Object.entries(data).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';

test('setup copies placeholders only once and never overwrites an existing file', () => fixture((root) => {
  writeFileSync(join(root, '.env.example'), 'fixture=placeholder\n');
  assert.equal(setup({ root }).created, true);
  writeFileSync(join(root, '.env.local'), 'existing=do-not-touch\n');
  assert.equal(setup({ root, demo: true }).created, false);
  assert.equal(readFileSync(join(root, '.env.local'), 'utf8'), 'existing=do-not-touch\n');
}));
test('demo setup is local, synthetic, and passes local checks but not production', () => fixture((root) => {
  assert.equal(setup({ root, demo: true }).created, true);
  const env = parseEnv(readFileSync(join(root, '.env.local'), 'utf8'));
  assert.equal(validateEnvironment(env).valid, true);
  assert.equal(validateEnvironment(env, { production: true }).valid, false);
}));
test('complete consistent production tuple passes without classifying public key as a secret', () => {
  const result = validateEnvironment(synthetic, { production: true });
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join(' '), /cannot prove/);
});
for (const [name, patch] of [
  ['missing workspace', { NEXT_PUBLIC_FIREBASE_WORKSPACE_ID: '' }],
  ['placeholder', { NEXT_PUBLIC_FIREBASE_API_KEY: 'replace-with-api-key' }],
  ['wrong auth project', { NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'other-project.firebaseapp.com' }],
  ['wrong bucket project', { NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'other-project.appspot.com' }],
  ['wrong sender', { NEXT_PUBLIC_FIREBASE_APP_ID: '1:111:web:abc' }],
  ['HTTP release', { NEXT_PUBLIC_SITE_URL: 'http://fixture-site.test' }],
  ['local HTTPS release', { NEXT_PUBLIC_SITE_URL: 'https://127.0.0.1' }],
  ['site credentials', { NEXT_PUBLIC_SITE_URL: 'https://user:password@fixture-site.test' }],
  ['site path', { NEXT_PUBLIC_SITE_URL: 'https://fixture-site.test/app' }],
  ['invalid flag', { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'yes' }],
  ['private key field', { NEXT_PUBLIC_PRIVATE_KEY: 'fixture-secret-never-log' }],
  ['private key content', { NEXT_PUBLIC_RANDOM: '-----BEGIN PRIVATE KEY-----fixture' }],
  ['leading whitespace', { NEXT_PUBLIC_FIREBASE_WORKSPACE_ID: ' fixture' }],
  ['workspace slash', { NEXT_PUBLIC_FIREBASE_WORKSPACE_ID: 'one/two' }],
]) {
  if (typeof name !== 'string') throw new Error('Invalid synthetic test label.');
  test(`rejects ${name}`, () => assert.equal(validateEnvironment({ ...synthetic, ...patch }, { production: true }).valid, false));
}
test('Node minimum is checked separately from optional member service minimum', () => {
  assert.equal(validateEnvironment(synthetic, { nodeVersion: '22.12.0' }).valid, false);
  assert.equal(validateEnvironment(synthetic, { nodeVersion: '22.13.0' }).valid, true);
  assert.match(validateEnvironment(synthetic, { nodeVersion: '22.13.0' }).warnings.join(' '), /22.18/);
});
test('emulator cannot silently connect to an actual Firebase project', () => {
  assert.equal(validateEnvironment({ ...synthetic, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true' }).valid, false);
  assert.equal(validateEnvironment({ ...parseEnv(demoEnvironment), NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'false' }).valid, false);
});
test('real CLI setup works and refuses unsupported options', () => fixture((root) => {
  assert.equal(cli('setup.mjs', root, ['--demo']).status, 0);
  assert.equal(cli('setup.mjs', root, ['--overwrite']).status, 1);
  assert.equal(readFileSync(join(root, '.env.local'), 'utf8'), demoEnvironment);
}));
test('Next loader uses production.local before local before production and expands variables', () => fixture((root) => {
  writeFileSync(join(root, '.env'), envText(synthetic));
  writeFileSync(join(root, '.env.production'), 'NEXT_PUBLIC_SITE_URL=http://invalid.test\n');
  writeFileSync(join(root, '.env.local'), 'NEXT_PUBLIC_SITE_URL=http://local-file.test\n');
  writeFileSync(join(root, '.env.production.local'), 'SITE_HOST=production-file.test\nNEXT_PUBLIC_SITE_URL=https://$SITE_HOST\n');
  const result = cli('check-environment.mjs', root, ['--production']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const failure = cli('check-environment.mjs', root, ['--production'], { NEXT_PUBLIC_SITE_URL: 'http://shell-wins.test' });
  assert.equal(failure.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr + failure.stdout + failure.stderr, /shell-wins|production-file|local-file|AIza/);
  unlinkSync(join(root, '.env.production.local'));
  writeFileSync(join(root, '.env.local'), 'NEXT_PUBLIC_SITE_URL=https://local-file.test\n');
  assert.equal(cli('check-environment.mjs', root, ['--production']).status, 0);
  unlinkSync(join(root, '.env.local'));
  assert.equal(cli('check-environment.mjs', root, ['--production']).status, 1);
}));
test('local CLI loads demo and incompatible NODE_ENV is rejected', () => fixture((root) => {
  setup({ root, demo: true });
  const result = cli('check-environment.mjs', root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(cli('check-environment.mjs', root, ['--production']).status, 1);
  assert.equal(cli('check-environment.mjs', root, [], { NODE_ENV: 'test' }).status, 1);
}));
test('build check loads production env files while permitting local demo configuration', () => fixture((root) => {
  setup({ root, demo: true });
  writeFileSync(join(root, '.env.development.local'), 'NEXT_PUBLIC_FIREBASE_WORKSPACE_ID=\n');
  writeFileSync(join(root, '.env.production.local'), 'NEXT_PUBLIC_FIREBASE_WORKSPACE_ID=build-demo-workspace\n');
  assert.equal(cli('check-environment.mjs', root).status, 1);
  const buildCheck = cli('check-environment.mjs', root, ['--build']);
  assert.equal(buildCheck.status, 0, buildCheck.stdout + buildCheck.stderr);
  assert.match(buildCheck.stdout, /production env, local demo allowed/);
  assert.equal(cli('check-environment.mjs', root, ['--build'], { NODE_ENV: 'production' }).status, 0);
  assert.equal(cli('check-environment.mjs', root, ['--build'], { NODE_ENV: 'development' }).status, 1);
  assert.equal(cli('check-environment.mjs', root, ['--production']).status, 1);
  assert.equal(cli('check-environment.mjs', root, ['--production', '--build']).status, 1);
}));
test('production build blocks unsafe configuration before starting Next or producing output', () => fixture((root) => {
  setup({ root, demo: true });
  const result = cli('build-release.mjs', root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production configuration failed/);
  assert.deepEqual(readdirSync(root), ['.env.local']);
}));
test('release metadata only contains allowlisted public target information', () => {
  const metadata = releaseMetadata({ release: 'fixture-r1', gitSha: 'a'.repeat(40), dirty: false, env: { ...synthetic, PRIVATE_TOKEN: 'fixture-secret-never-log' }, versions: { node: '24.19.0', next: '16.3.4', react: '19.2.6', packageManager: 'pnpm@11.19.0' }, files: [{ path: 'index.html', sha256: 'x' }], builtAt: '2026-09-16T00:00:00Z' });
  assert.equal(metadata.target.firebaseProjectId, synthetic.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  assert.equal(metadata.gitSha, 'a'.repeat(40));
  assert.doesNotMatch(JSON.stringify(metadata), /AIza|PRIVATE_TOKEN|fixture-secret|FIREBASE_API_KEY/);
  assert.throws(() => releaseMetadata({ release: '../escape' }), /Release ID/);
  assert.equal(releaseMetadata({ release: 'a'.repeat(64), gitSha: 'a'.repeat(40), dirty: false, env: synthetic, versions: {}, files: [] }).release.length, 64);
  assert.throws(() => releaseMetadata({ release: 'a'.repeat(65) }), /Release ID/);
});
test('static scan permits normal files and rejects sourcemaps and private credentials', () => fixture((root) => {
  mkdirSync(join(root, '_next'));
  writeFileSync(join(root, 'index.html'), '<html>fixture</html>');
  writeFileSync(join(root, '_next', 'app.js'), 'console.log("fixture")');
  assert.equal(inspectStaticDirectory(root).length, 2);
  writeFileSync(join(root, '_next', 'app.js.map'), '{}');
  assert.throws(() => inspectStaticDirectory(root), /Unsafe file name/);
  unlinkSync(join(root, '_next', 'app.js.map'));
  writeFileSync(join(root, '_next', 'app.js'), '"private_key":"fixture"');
  assert.throws(() => inspectStaticDirectory(root), /Private credential/);
}));
