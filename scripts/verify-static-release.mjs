// Read-only verification of the existing production host. No account/data writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const origin = 'https://34-64-62-115.sslip.io';
const directory = resolve(process.argv[2] || 'out');
const expected = process.argv[3];
assert.match(expected || '', /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const request = (path, options = {}) => fetch(origin + path, {
  redirect: 'error', signal: AbortSignal.timeout(20000), ...options,
});
const releaseResponse = await request(`/release.json?verify=${expected}`);
assert.equal(releaseResponse.status, 200);
assert.equal((await releaseResponse.json()).release, expected);
assert.match(releaseResponse.headers.get('cache-control') || '', /no-store/);
assert.ok(releaseResponse.headers.get('strict-transport-security'));
let verified = 0;
async function inspect(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const local = join(folder, entry.name);
    if (entry.isDirectory()) await inspect(local);
    else if (entry.isFile()) {
      const path = '/' + relative(directory, local).split(sep).map(encodeURIComponent).join('/');
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(readFileSync(local)), path);
      if (path.startsWith('/_next/static/')) assert.match(response.headers.get('cache-control') || '', /immutable/);
      else assert.match(response.headers.get('cache-control') || '', /no-store/);
      verified++;
    }
  }
}
await inspect(directory);
// These requests contain no login token or account details and cannot create users.
for (const [name, options, status] of [
  ['missing origin', { method: 'POST' }, 403],
  ['missing login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }, 401],
  ['foreign origin', { method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: '{}' }, 403],
  ['GET registration', {}, 404],
]) {
  const response = await request('/api/admin/members', options);
  assert.equal(response.status, status, name);
  assert.match(response.headers.get('content-type') || '', /application\/json/, name);
  assert.match(response.headers.get('cache-control') || '', /no-store/, name);
}
assert.notEqual((await request('/_health')).status, 200);
console.log(JSON.stringify({ release: expected, staticFilesVerified: verified, publicApiGuards: 4, healthNotPublic: true, accountWrites: 0 }));
