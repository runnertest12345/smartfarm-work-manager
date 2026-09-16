// Generate reviewed deployment artifacts only. No Google calls or deployment.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
const hash = (data) => createHash('sha256').update(data).digest('hex');
export const memberFiles = Object.freeze([
  'server/members/index.mjs', 'server/members/core.mjs', 'server/members/config.mjs',
  'server/members/http.mjs', 'server/members/firestore.mjs', 'server/members/journal.mjs',
  'server/members/package.json', 'server/members/package-lock.json', 'lib/login-identity.ts',
]);
export function validateBootstrapConfig(value) {
  const keys = ['originalIdentity', 'runtimeIdentity', 'nodeVersion', 'nodeSha256'];
  const account = /^[a-z0-9][a-z0-9-]*@[a-z0-9-]+\.(?:iam\.gserviceaccount\.com|gserviceaccount\.com)$/;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key)) ||
      keys.some((key) => typeof value[key] !== 'string') ||
      !account.test(value.originalIdentity) || !account.test(value.runtimeIdentity) ||
      value.originalIdentity === value.runtimeIdentity ||
      !/^v(?:22|24)\.\d+\.\d+$/.test(value.nodeVersion) ||
      !/^[a-f0-9]{64}$/.test(value.nodeSha256))
    throw new Error('Explicit reviewed bootstrap identity/runtime inputs are required');
  if (value.nodeVersion.startsWith('v22.') && Number(value.nodeVersion.split('.')[1]) < 18)
    throw new Error('Node 22.18.0 or later is required');
  return Object.freeze({ ...value });
}

export function packageMemberService(args = process.argv.slice(2)) {
  let bootstrapPath;
  let revision = '';
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--bootstrap-config' && !bootstrapPath) bootstrapPath = args[++index];
    else if (args[index] === '--revision' && !revision) revision = args[++index];
    else throw new Error('Usage: node scripts/package-member-service.mjs [--bootstrap-config reviewed-public-input.json] [--revision rN]');
  }
  if (revision && !/^r[1-9][0-9]?$/.test(revision)) throw new Error('Invalid deployment revision');
  if (args.includes('--revision') && !revision) throw new Error('Missing revision');
  if (args.includes('--bootstrap-config') && !bootstrapPath) throw new Error('Missing bootstrap config');
  let bootstrap = null;
  if (bootstrapPath) {
    let input;
    try { input = JSON.parse(readFileSync(bootstrapPath, 'utf8')); }
    catch { throw new Error('Cannot read a valid public bootstrap input JSON file'); }
    bootstrap = validateBootstrapConfig(input);
  }
  const sourceDigest = hash(memberFiles.map((file) => file + ':' + hash(readFileSync(file))).join('\n'));
  const release = `members-${sourceDigest.slice(0, 12)}${revision ? '-' + revision : ''}`;
  mkdirSync('outputs', { recursive: true });
  const archive = resolve('outputs', release + '.tar.gz');
  execFileSync('tar', ['-czf', archive, ...memberFiles]);
  const archiveSha = hash(readFileSync(archive));
  const directory = 'deploy/gce/members/';
  const names = ['install-members.sh', 'farmlog-members.service', 'api.caddy', 'metadata-guard.sh', 'farmlog-metadata-guard.service', 'verify-runtime.mjs', 'configure-members.mjs', 'member-config.mjs'];
  const manifest = Object.fromEntries(names.map((name) => {
    // Same helper is separately reviewed as root setup code, never run from an app upload.
    const source = name === 'member-config.mjs' ? 'server/members/config.mjs' : directory + name;
    const data = readFileSync(source, 'utf8').replaceAll('\r\n', '\n');
    writeFileSync(resolve('outputs', 'members-setup-' + name), data);
    return [name, hash(data)];
  }));
  let startupPath = null;
  let startupSha = null;
  if (bootstrap) {
    let startup = readFileSync(directory + 'startup-template.sh', 'utf8').replaceAll('\r\n', '\n');
    const replacements = {
      __PROVISION_MANIFEST__: JSON.stringify(manifest), __APP_ARCHIVE__: basename(archive),
      __APP_SHA__: archiveSha, __RELEASE_ID__: release,
      __ORIGINAL_IDENTITY__: bootstrap.originalIdentity, __RUNTIME_IDENTITY__: bootstrap.runtimeIdentity,
      __NODE_VERSION__: bootstrap.nodeVersion, __NODE_SHA__: bootstrap.nodeSha256,
    };
    for (const [key, value] of Object.entries(replacements)) startup = startup.replaceAll(key, value);
    if (/__[A-Z_]+__/.test(startup)) throw new Error('Unresolved provisioning input');
    startupPath = resolve('outputs', 'members-startup.sh');
    writeFileSync(startupPath, startup);
    startupSha = hash(startup);
  }
  writeFileSync('outputs/members-deployment-manifest.json', JSON.stringify({ release, sourceDigest, archive: basename(archive), archiveSha, startup: startupPath ? basename(startupPath) : null, startupSha, bootstrap, files: manifest }, null, 2) + '\n');
  console.log(JSON.stringify({ release, archive, archiveSha, startup: startupPath, startupSha, note: bootstrap ? 'Review all files before privileged installation.' : 'Bundle/setup only. Any older startup file is outside this manifest; provide explicit bootstrap inputs to generate one.' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) packageMemberService();
