// Compare production rules to a known revision before deploy, or local rules afterward.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { logger } = require('firebase-tools/lib/logger');
logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const { rulesOrigin } = require('firebase-tools/lib/api');
try {
  const project = 'smartfarm-work-manager';
  const options = { project, nonInteractive: true };
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const client = new Client({ urlPrefix: rulesOrigin(), apiVersion: 'v1' });
  const release = (
    await client.get(`/projects/${project}/releases/cloud.firestore`, {
      skipLog: { resBody: true },
    })
  ).body;
  const ruleset = (
    await client.get(`/${release.rulesetName}`, { skipLog: { resBody: true } })
  ).body;
  const actual = ruleset.source.files.find(
    (file) => file.name === 'firestore.rules',
  )?.content;
  const expected = process.argv[2]
    ? execFileSync('git', ['show', `${process.argv[2]}:firestore.rules`], {
        encoding: 'utf8',
      })
    : readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const hash = (value) =>
    createHash('sha256')
      .update(value.replace(/\r\n/g, '\n').trim())
      .digest('hex');
  if (!actual || hash(actual) !== hash(expected))
    throw new Error(
      'Live rules differ from expected; do not overwrite without review',
    );
  console.log(
    `Production rules match ${process.argv[2] || 'local verified rules'} (${hash(actual).slice(0, 12)}).`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Rules comparison failed',
  );
  process.exitCode = 1;
}
