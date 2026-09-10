// Operator-only, not bundled into the public site. inspect is read-only remotely.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { buildPastProjectPlan } from './lib/past-project-plan.mjs';
const require = createRequire(import.meta.url);
require('firebase-tools/lib/logger').logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const project = 'smartfarm-work-manager';
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = (name) =>
  envText
    .match(new RegExp('^' + name + '=["\']?([^"\'\\r\\n]+)', 'm'))?.[1]
    .trim();
const workspace = env('NEXT_PUBLIC_FIREBASE_WORKSPACE_ID');
assert.ok(
  workspace && env('NEXT_PUBLIC_FIREBASE_PROJECT_ID') === project,
  'Project/workspace mismatch',
);
const root = `/projects/${project}/databases/(default)/documents`;
const fullRoot = root.slice(1);
const hidden = () => ({
  skipLog: { body: true, resBody: true, queryParams: true },
});
const hash = (text) => createHash('sha256').update(text).digest('hex');
const names = ['projects', 'farmRecords', 'projectDocuments'];
try {
  const options = { project, nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({
    urlPrefix: 'https://firestore.googleapis.com',
    apiVersion: 'v1',
    auth: true,
  });
  async function list(name) {
    const docs = [];
    let pageToken;
    do {
      const { body } = await client.get(
        `${root}/workspaces/${workspace}/${name}`,
        {
          ...hidden(),
          queryParams: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) },
        },
      );
      docs.push(...(body.documents || []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return docs;
  }
  const mode = process.argv[2] || 'inspect';
  if (mode === 'inspect') {
    const collections = Object.fromEntries(
      await Promise.all(names.map(async (name) => [name, await list(name)])),
    );
    const now = Date.now();
    const runId = `past-complete-${randomUUID().slice(0, 8)}`;
    const plan = buildPastProjectPlan(collections, now, runId);
    const dir = resolve('work', runId);
    mkdirSync(dir, { recursive: true });
    const backup = JSON.stringify(
      { project, workspace, capturedAt: now, collections },
      null,
      2,
    );
    const backupHash = hash(backup);
    writeFileSync(resolve(dir, 'before.json'), backup, { flag: 'wx' });
    const planText = JSON.stringify(
      { ...plan, backupHash, project, workspace },
      null,
      2,
    );
    writeFileSync(resolve(dir, 'plan.json'), planText, { flag: 'wx' });
    console.log(
      JSON.stringify({
        directory: dir,
        planSha256: hash(planText),
        backupSha256: backupHash,
        ...plan.summary,
        targets: plan.targets,
      }),
    );
  } else if (mode === 'apply' || mode === 'verify') {
    const planPath = resolve(process.argv[3] || '');
    assert.ok(
      planPath.startsWith(resolve('work') + '\\') ||
        planPath.startsWith(resolve('work') + '/'),
      'Plan must be in workspace work directory',
    );
    const planText = readFileSync(planPath, 'utf8');
    assert.equal(hash(planText), process.argv[4], 'Plan SHA256 mismatch');
    const plan = JSON.parse(planText);
    assert.equal(plan.project, project);
    assert.equal(plan.workspace, workspace);
    const backupText = readFileSync(
      resolve(planPath, '../before.json'),
      'utf8',
    );
    assert.equal(hash(backupText), plan.backupHash, 'Backup SHA256 mismatch');
    const before = JSON.parse(backupText);
    const rebuilt = buildPastProjectPlan(
      before.collections,
      plan.now,
      plan.runId,
    );
    assert.deepEqual(
      plan.writes,
      rebuilt.writes,
      'Plan differs from bounded planner',
    );
    for (const write of plan.writes)
      assert.ok(
        write.update.name.startsWith(`${fullRoot}/workspaces/${workspace}/`),
        'Write outside workspace',
      );
    if (mode === 'apply') {
      assert.ok(
        plan.writes.length > 0 && plan.writes.length <= 500,
        'Must fit one atomic commit',
      );
      assert.ok(
        Buffer.byteLength(JSON.stringify(plan.writes)) < 9000000,
        'Commit too large',
      );
      // updateTime for each existing document prevents overwriting concurrent edits.
      await client.post(`${root}:commit`, { writes: plan.writes }, hidden());
    }
    const current = Object.fromEntries(
      await Promise.all(names.map(async (name) => [name, await list(name)])),
    );
    let verified = 0;
    for (const name of names) {
      const actual = new Map(current[name].map((doc) => [doc.name, doc]));
      assert.equal(
        actual.size,
        before.collections[name].length,
        'Collection count changed; review concurrent changes',
      );
      for (const doc of before.collections[name]) {
        const patch =
          plan.writes.find((write) => write.update.name === doc.name)?.update
            .fields || {};
        assert.deepEqual(
          actual.get(doc.name)?.fields,
          { ...doc.fields, ...patch },
          `Field verification failed: ${name}/${doc.name.split('/').at(-1)}`,
        );
        verified++;
      }
    }
    for (const write of plan.writes.filter(
      (item) => item.currentDocument.exists === false,
    )) {
      const { body } = await client.get('/' + write.update.name, hidden());
      assert.deepEqual(body.fields, write.update.fields, 'Audit mismatch');
    }
    writeFileSync(
      resolve(planPath, '../verification.json'),
      JSON.stringify(
        {
          runId: plan.runId,
          verifiedAt: Date.now(),
          verified,
          planSha256: hash(planText),
          summary: plan.summary,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        mode,
        result: 'verified',
        verifiedDocuments: verified,
        ...plan.summary,
        backupDirectory: resolve(planPath, '..'),
      }),
    );
  } else throw new Error('Use inspect, apply, or verify');
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Past-project completion failed',
  );
  process.exitCode = 1;
}
