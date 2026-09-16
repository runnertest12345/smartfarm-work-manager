// Read-only/offline validation. Messages intentionally never contain env values.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const names = [
  'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID',
  'FIREBASE_WORKSPACE_ID', 'SITE_URL', 'USE_FIREBASE_EMULATORS',
].map((name) => `NEXT_PUBLIC_${name}`);
const placeholder = /replace[-_ ]?with|change[-_ ]?me|your[-_ ]|example\.(?:com|invalid)|<[^>]*>|\$\{|__[A-Z_]+__/i;

export function validateEnvironment(env, { production = false, nodeVersion = process.versions.node } = {}) {
  const errors = [];
  const warnings = [];
  const value = (name) => env[`NEXT_PUBLIC_${name}`] || '';
  const nodeParts = nodeVersion.split('.').map(Number);
  if (nodeParts[0] < 22 || (nodeParts[0] === 22 && nodeParts[1] < 13)) errors.push('Node.js >=22.13.0 is required for the web build; recommend 24.19.0.');
  if (nodeParts[0] === 22 && nodeParts[1] < 18) warnings.push('The optional member service requires Node.js >=22.18.0.');
  for (const name of names) {
    const content = env[name] || '';
    if (!content.trim()) errors.push(`${name}: explicitly set a nonempty value.`);
    else if (content !== content.trim() || /[\r\n]/.test(content)) errors.push(`${name}: whitespace/newlines are not allowed.`);
    else if (placeholder.test(content)) errors.push(`${name}: replace the template placeholder.`);
  }
  for (const [name, content] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_')) continue;
    if (/PRIVATE.?KEY|CLIENT.?SECRET|ACCESS.?TOKEN|REFRESH.?TOKEN|PASSWORD|SERVICE.?ACCOUNT/i.test(name)
      || /-----BEGIN [^-]*PRIVATE KEY-----|"private_key"\s*:/.test(content || '')) {
      errors.push(`${name}: do not expose server credentials in NEXT_PUBLIC variables.`);
    }
  }
  const project = value('FIREBASE_PROJECT_ID');
  const emulatorFlag = value('USE_FIREBASE_EMULATORS');
  const emulator = emulatorFlag === 'true';
  if (!['true', 'false'].includes(emulatorFlag)) errors.push('NEXT_PUBLIC_USE_FIREBASE_EMULATORS: explicitly choose true or false.');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID: invalid Firebase project ID format.');
  if (value('FIREBASE_AUTH_DOMAIN') !== `${project}.firebaseapp.com`) errors.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: use the intended project default PROJECT_ID.firebaseapp.com domain.');
  if (![`${project}.appspot.com`, `${project}.firebasestorage.app`].includes(value('FIREBASE_STORAGE_BUCKET'))) errors.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: expected a default bucket for the same project.');
  const sender = value('FIREBASE_MESSAGING_SENDER_ID');
  if (!/^\d+$/.test(sender)) errors.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: expected a numeric project number.');
  const appId = value('FIREBASE_APP_ID').match(/^1:(\d+):web:([a-z0-9]+)$/i);
  if (!appId || appId[1] !== sender) errors.push('NEXT_PUBLIC_FIREBASE_APP_ID: Web app ID and messaging sender project number must agree.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value('FIREBASE_WORKSPACE_ID'))) errors.push('NEXT_PUBLIC_FIREBASE_WORKSPACE_ID: choose an explicit ID (letters, numbers, dot, underscore, hyphen; up to 128 characters).');
  let site;
  try {
    site = new URL(value('SITE_URL'));
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') errors.push('NEXT_PUBLIC_SITE_URL: use an HTTP(S) origin without credentials, path, query, or fragment.');
  } catch { errors.push('NEXT_PUBLIC_SITE_URL: invalid absolute URL.'); }
  const localHost = site && ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  if (emulator) {
    if (!project.startsWith('demo-')) errors.push('Emulators require a demo-* project ID to prevent accidental live service access.');
    if (!localHost) errors.push('Emulator mode requires a localhost or loopback site URL.');
  } else {
    if (project.startsWith('demo-')) errors.push('A demo-* project must use emulator mode.');
    if (!/^AIza[A-Za-z0-9_-]{35}$/.test(value('FIREBASE_API_KEY'))) errors.push('NEXT_PUBLIC_FIREBASE_API_KEY: expected a Firebase Web API key, not a placeholder.');
    warnings.push('This config connects to a real Firebase project. Reusing its workspace shares live data.');
  }
  if (production) {
    if (emulator) errors.push('Production release must not connect to local emulators.');
    if (!site || site.protocol !== 'https:' || localHost || site.hostname.endsWith('.invalid')) errors.push('Production NEXT_PUBLIC_SITE_URL must be a real HTTPS origin, not a local/demo address.');
  }
  warnings.push('Offline validation cannot prove API key/app/project ownership, account permissions, authorized domains, or data availability; verify these in Firebase Console.');
  return { valid: errors.length === 0, errors, warnings, mode: production ? 'production' : 'local', emulator };
}

export function loadEnvironment({ root = process.cwd(), production = false } = {}) {
  // Resolve @next/env from Next itself: works with strict pnpm dependency layouts.
  const require = createRequire(import.meta.url);
  let nextRequire;
  try { nextRequire = createRequire(require.resolve('next/package.json')); }
  catch { throw new Error('Dependencies are missing. Run pnpm install --frozen-lockfile first.'); }
  const { loadEnvConfig } = nextRequire('@next/env');
  if (process.env.NODE_ENV && process.env.NODE_ENV !== (production ? 'production' : 'development')) {
    throw new Error('NODE_ENV conflicts with the selected check mode. Unset it or choose the matching mode.');
  }
  const loaded = loadEnvConfig(resolve(root), !production, { info() {}, error() {} }, true);
  return { env: loaded.combinedEnv, files: loaded.loadedEnvFiles.map((file) => file.path) };
}

export function reportEnvironment({ root = process.cwd(), production = false, build = false } = {}) {
  // A local/demo Next build still loads production env files, unlike next dev.
  // Only --production adds release safety restrictions (HTTPS/no emulators).
  const loaded = loadEnvironment({ root, production: production || build });
  const result = validateEnvironment(loaded.env, { production });
  if (build && !production) result.mode = 'build (production env, local demo allowed)';
  console.log(`Environment check: ${result.valid ? 'PASS' : 'FAIL'} (${result.mode}). No remote requests were made.`);
  console.log('Precedence: shell > mode.local > .env.local > mode > .env. Values are not printed.');
  console.log(`Loaded files: ${loaded.files.join(', ') || '(shell only)'}`);
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  for (const warning of result.warnings) console.log(`NOTE: ${warning}`);
  return { ...result, env: loaded.env };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--production', '--build'].includes(arg)) || args.length > 1) throw new Error('Usage: node scripts/check-environment.mjs [--production | --build]');
    if (!reportEnvironment({ production: args.includes('--production'), build: args.includes('--build') }).valid) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
