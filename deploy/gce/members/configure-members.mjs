// Reviewed installer-side code only. Never execute this from an app bundle.
import { chownSync, chmodSync, existsSync, lstatSync, openSync, writeFileSync, closeSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readRootJson, validateInstallInput, validateMemberConfig } from './member-config.mjs';

if (process.getuid?.() !== 0) throw new Error('Root installation required');
const configPath = '/etc/farmlog-members/config.json';
const inputPath = '/etc/farmlog-members/install-input.json';
const present = (path) => {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
let config;
if (present(configPath)) {
  config = validateMemberConfig(readRootJson(configPath));
  if (present(inputPath)) {
    const input = validateInstallInput(readRootJson(inputPath));
    if (Object.keys(input).some((key) => input[key] !== config[key]))
      throw new Error('Existing config differs from installation input; not overwriting');
  }
  // Preserve content, ownership, permissions and the existing password secret.
} else {
  if (!existsSync(inputPath)) throw new Error('First install requires root-reviewed /etc/farmlog-members/install-input.json');
  const input = validateInstallInput(readRootJson(inputPath));
  config = validateMemberConfig({ ...input, passwordSecret: randomBytes(64).toString('base64url') });
  const groupLine = execFileSync('getent', ['group', 'farmlog-members'], { encoding: 'utf8' }).trim();
  const gid = Number(groupLine.split(':')[2]);
  if (!Number.isSafeInteger(gid) || gid <= 0) throw new Error('Invalid member service group');
  const descriptor = openSync(configPath, 'wx', 0o600);
  try { writeFileSync(descriptor, JSON.stringify(config) + '\n'); } finally { closeSync(descriptor); }
  chownSync(configPath, 0, gid);
  chmodSync(configPath, 0o640);
}
// No password secret is returned or logged.
console.log(JSON.stringify({ project: config.project, workspace: config.workspace, origin: config.origin }));
