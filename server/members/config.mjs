import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, parse } from 'node:path';

const fail = () => { throw new Error('Invalid or unsafe member service configuration'); };
const keys = ['project', 'workspace', 'origin'];

// Public routing settings are explicit. They do not grant registrar or IAM rights.
export function validateInstallInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      keys.some((key) => typeof value[key] !== 'string') ||
      Object.keys(value).some((key) => !keys.includes(key))) fail();
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.project) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.workspace)) fail();
  let url;
  try { url = new URL(value.origin); } catch { fail(); }
  if (url.protocol !== 'https:' || url.origin !== value.origin ||
      url.username || url.password || url.search || url.hash ||
      !url.hostname || url.hostname.includes('*')) fail();
  return Object.freeze({ project: value.project, workspace: value.workspace, origin: value.origin });
}

export function validateMemberConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 4 ||
      Object.keys(value).some((key) => ![...keys, 'passwordSecret'].includes(key)) ||
      typeof value.passwordSecret !== 'string' ||
      value.passwordSecret.length < 48 || value.passwordSecret.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(value.passwordSecret)) fail();
  const publicValues = validateInstallInput(Object.fromEntries(keys.map((key) => [key, value[key]])));
  return Object.freeze({ ...publicValues, passwordSecret: value.passwordSecret });
}

export function assertRootOwnedStat(stat, directory = false) {
  if (stat.uid !== 0 || (stat.mode & 0o022) !== 0 ||
      (directory ? !stat.isDirectory() : !stat.isFile()) ||
      (!directory && ((stat.mode & 0o007) !== 0 || stat.nlink !== 1))) fail();
}

export function readRootJson(filename) {
  if (!isAbsolute(filename)) fail();
  // Never follow configuration symlinks or a writable parent directory.
  let parent = dirname(filename);
  while (true) {
    assertRootOwnedStat(lstatSync(parent), true);
    if (parent === parse(parent).root) break;
    parent = dirname(parent);
  }
  const descriptor = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = fstatSync(descriptor);
    assertRootOwnedStat(stat);
    if (stat.size > 4096) fail();
    const content = readFileSync(descriptor, 'utf8');
    try { return JSON.parse(content); } catch { fail(); }
  } finally { closeSync(descriptor); }
}

export function loadMemberConfig() {
  return validateMemberConfig(readRootJson('/etc/farmlog-members/config.json'));
}
