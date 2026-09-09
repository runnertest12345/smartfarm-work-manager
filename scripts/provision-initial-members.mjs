// Trusted operator only. Never put this script or CLI credentials in the static site.
// inspect: read exact targets; provision: stdin temporary password, create-only;
// close-signup: disable end-user signup only, preserving other project settings.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { logger } = require('firebase-tools/lib/logger');
logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const project = 'smartfarm-work-manager';
const mode = process.argv[2] || 'inspect';
const options = { project, nonInteractive: true };
const skipLog = { body: true, resBody: true, queryParams: true };
// Firebase CLI mutates per-request options; never reuse POST options for a GET.
const hidden = () => ({ skipLog: { ...skipLog } });
const people = [
  { name: '평화', head: true, admin: false, jobTitle: '직원' },
  { name: '러너', head: false, admin: true, jobTitle: '팀장' },
  { name: '담호', head: false, admin: false, jobTitle: '직원' },
].map((p) => ({
  ...p,
  email:
    'u' +
    Buffer.from(p.name, 'utf8').toString('hex') +
    '@staff.smartfarm-work-manager.invalid',
  uid:
    'staff-bootstrap-' +
    createHash('sha256').update(p.name).digest('hex').slice(0, 24),
}));
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
function env(name) {
  return envText
    .match(new RegExp('^' + name + '=["\']?([^"\'\\r\\n]+)', 'm'))?.[1]
    .trim();
}
const workspace = env('NEXT_PUBLIC_FIREBASE_WORKSPACE_ID');
if (!workspace || env('NEXT_PUBLIC_FIREBASE_PROJECT_ID') !== project)
  throw new Error('Workspace/project mismatch');
const departmentId = 'staff-initial-team';
const root = `/projects/${project}/databases/(default)/documents`;
const memberPath = (uid) => `${root}/appMembers/${uid}`;
const deptPath = `${root}/workspaces/${workspace}/departments/${departmentId}`;
function encode(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'boolean'
        ? { booleanValue: value }
        : typeof value === 'number'
          ? { integerValue: String(value) }
          : { stringValue: value },
    ]),
  );
}
function decode(doc) {
  return Object.fromEntries(
    Object.entries(doc?.fields || {}).map(([k, v]) => [
      k,
      v.stringValue ?? v.booleanValue ?? Number(v.integerValue),
    ]),
  );
}
try {
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI login required');
  auth.setActiveAccount(options, account);
  await requireAuth(options);
  const identity = new Client({
    urlPrefix: 'https://identitytoolkit.googleapis.com',
    auth: true,
  });
  const firestore = new Client({
    urlPrefix: 'https://firestore.googleapis.com',
    apiVersion: 'v1',
    auth: true,
  });
  const readDoc = async (path) => {
    try {
      return (await firestore.get(path, hidden())).body;
    } catch (e) {
      if (e.status === 404 || e.context?.response?.statusCode === 404)
        return null;
      throw e;
    }
  };
  const getConfig = async () =>
    (await identity.get(`/admin/v2/projects/${project}/config`, hidden())).body;
  const config = await getConfig();
  console.log(
    JSON.stringify({
      project,
      mode,
      subtype: config.subtype,
      publicSignupDisabled:
        config.client?.permissions?.disabledUserSignup === true,
      passwordPolicy: config.passwordPolicyConfig || 'default',
    }),
  );
  if (mode === 'close-signup') {
    if (!config.client?.permissions?.disabledUserSignup) {
      await identity.patch(
        `/admin/v2/projects/${project}/config`,
        { client: { permissions: { disabledUserSignup: true } } },
        {
          ...hidden(),
          queryParams: { updateMask: 'client.permissions.disabledUserSignup' },
        },
      );
    }
    const after = await getConfig();
    if (after.client?.permissions?.disabledUserSignup !== true)
      throw new Error('Signup closure not confirmed');
    console.log(
      'End-user signup disabled; existing sign-in and password policy preserved.',
    );
    process.exit(0);
  }
  if (!['inspect', 'provision', 'verify', 'verify-login'].includes(mode))
    throw new Error('Unknown mode');
  const lookup = async (person) => {
    const response = await identity.post(
      `/v1/projects/${project}/accounts:lookup`,
      { email: [person.email], localId: [person.uid] },
      hidden(),
    );
    const users = response.body.users || [];
    if (
      users.length > 1 ||
      users.some(
        (u) =>
          u.localId !== person.uid ||
          u.email !== person.email ||
          u.displayName !== person.name,
      )
    )
      throw new Error(`Existing identity conflict: ${person.name}`);
    return users[0] || null;
  };
  const targets = [];
  for (const person of people) {
    const existing = await lookup(person);
    const doc = await readDoc(memberPath(person.uid));
    const data = decode(doc);
    if (
      doc &&
      (data.id !== person.uid ||
        data.email !== person.email ||
        data.workspaceId !== workspace ||
        data.active !== true ||
        typeof data.passwordChangeRequired !== 'boolean' ||
        data.admin !== person.admin ||
        data.departmentId !== departmentId ||
        data.jobTitle !== person.jobTitle ||
        data.bootstrapBatch !== 'initial-staff-20260909')
    )
      throw new Error(`Existing membership conflict: ${person.name}`);
    if (doc && !existing)
      throw new Error(`Membership without Auth identity: ${person.name}`);
    if (existing?.disabled)
      throw new Error(`Existing account disabled: ${person.name}`);
    targets.push({ person, existing, doc });
  }
  const dept = await readDoc(deptPath);
  const headUid = people.find((p) => p.head).uid;
  if (
    dept &&
    (decode(dept).id !== departmentId || decode(dept).headUid !== headUid)
  )
    throw new Error('Existing department conflict');
  console.log(
    JSON.stringify({
      targets: targets.map(({ person, existing, doc }) => ({
        name: person.name,
        authExists: Boolean(existing),
        membershipExists: Boolean(doc),
        role: person.head ? '부서장' : person.jobTitle,
        admin: person.admin,
        active: doc ? decode(doc).active : null,
        passwordChangeRequired: doc ? decode(doc).passwordChangeRequired : null,
      })),
      departmentExists: Boolean(dept),
    }),
  );
  if (mode === 'inspect') process.exit(0);
  if (mode === 'verify-login') {
    if (
      config.client?.permissions?.disabledUserSignup !== true ||
      targets.some((t) => !t.existing || !t.doc)
    )
      throw new Error(
        'Only test known existing accounts after signup is closed',
      );
    const temporaryPassword = readFileSync(0, 'utf8').trim();
    const apiKey = env('NEXT_PUBLIC_FIREBASE_API_KEY');
    const publicIdentity = new Client({
      urlPrefix: 'https://identitytoolkit.googleapis.com',
      auth: false,
    });
    for (const { person } of targets) {
      const response = await publicIdentity.post(
        '/v1/accounts:signInWithPassword',
        {
          email: person.email,
          password: temporaryPassword,
          returnSecureToken: true,
        },
        { ...hidden(), queryParams: { key: apiKey } },
      );
      if (response.body.localId !== person.uid || !response.body.idToken)
        throw new Error(`Login mismatch: ${person.name}`);
      const headers = {
        Authorization: `Bearer ${response.body.idToken}`,
        'Content-Type': 'application/json',
      };
      const memberResponse = await fetch(
        'https://firestore.googleapis.com/v1' + memberPath(person.uid),
        { headers },
      );
      if (
        !memberResponse.ok ||
        decode(await memberResponse.json()).active !== true
      )
        throw new Error(`Member access denied: ${person.name}`);
      const filters = [
        {
          fieldFilter: {
            field: { fieldPath: 'workspaceId' },
            op: 'EQUAL',
            value: { stringValue: workspace },
          },
        },
        ...(!person.admin
          ? [
              {
                fieldFilter: {
                  field: { fieldPath: 'active' },
                  op: 'EQUAL',
                  value: { booleanValue: true },
                },
              },
            ]
          : []),
      ];
      const directoryResponse = await fetch(
        'https://firestore.googleapis.com/v1' + root + ':runQuery',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'appMembers' }],
              where:
                filters.length === 1
                  ? filters[0]
                  : { compositeFilter: { op: 'AND', filters } },
              limit: 5000,
            },
          }),
        },
      );
      if (!directoryResponse.ok)
        throw new Error(`Directory query denied: ${person.name}`);
      const rows = await directoryResponse.json();
      if (!rows.some((row) => row.document?.name?.endsWith('/' + person.uid)))
        throw new Error('Directory self entry missing');
      console.log(
        `Login, own membership and directory read verified: ${person.name}`,
      );
    }
    // The email is known to exist, so an unexpected setting cannot create a test account.
    let rejection = '';
    try {
      await publicIdentity.post(
        '/v1/accounts:signUp',
        {
          email: people[0].email,
          password: temporaryPassword,
          returnSecureToken: true,
        },
        { ...hidden(), queryParams: { key: apiKey } },
      );
    } catch (error) {
      rejection = error.context?.body?.error?.message || '';
    }
    // Identity Platform may check email uniqueness before signup permissions.
    // EMAIL_EXISTS confirms only this safe duplicate probe; the fetched config
    // above is the independent evidence of disabled end-user signup.
    if (!['ADMIN_ONLY_OPERATION', 'EMAIL_EXISTS'].includes(rejection))
      throw new Error('Existing-account signup unexpectedly accepted');
    console.log(
      `Signup-disabled configuration confirmed; safe duplicate probe rejected (${rejection}). No new test accounts or password changes.`,
    );
    process.exit(0);
  }
  if (mode === 'verify') {
    if (targets.some((t) => !t.existing || !t.doc) || !dept)
      throw new Error('Initial setup incomplete');
    console.log(
      'Three accounts and department verified. No passwords printed or modified.',
    );
    process.exit(0);
  }
  // Reuse preallocated UIDs only; never reset an existing password or overwrite roles.
  const temporaryPassword = readFileSync(0, 'utf8').trim();
  if (temporaryPassword.length < 6)
    throw new Error('Temporary password too short');
  const now = Date.now();
  for (const target of targets) {
    if (!target.existing) {
      const { person } = target;
      await identity.post(
        `/v1/projects/${project}/accounts`,
        {
          localId: person.uid,
          email: person.email,
          displayName: person.name,
          password: temporaryPassword,
          emailVerified: false,
          disabled: false,
        },
        hidden(),
      );
      if (!(await lookup(person)))
        throw new Error('Created identity not confirmed');
      console.log(`Created Auth identity: ${person.name}`);
    }
  }
  const writes = targets
    .filter((t) => !t.doc)
    .map(({ person }) => ({
      update: {
        name: memberPath(person.uid).slice(1),
        fields: encode({
          id: person.uid,
          email: person.email,
          displayName: person.name,
          active: true,
          admin: person.admin,
          jobTitle: person.jobTitle,
          workspaceId: workspace,
          departmentId,
          requestedDepartment: '',
          passwordChangeRequired: true,
          bootstrapBatch: 'initial-staff-20260909',
          createdAt: now,
          updatedAt: now,
        }),
      },
      currentDocument: { exists: false },
    }));
  if (!dept)
    writes.push({
      update: {
        name: deptPath.slice(1),
        fields: encode({
          id: departmentId,
          name: '공통 부서',
          headUid,
          createdAt: now,
          updatedAt: now,
        }),
      },
      currentDocument: { exists: false },
    });
  if (writes.length)
    await firestore.post(`${root}:commit`, { writes }, hidden());
  console.log(
    'Create-only account setup complete. Re-run verify for readback.',
  );
} catch (error) {
  // Firebase SDK errors can embed request headers/body: never log whole errors.
  const upstream = error?.context?.body?.error;
  console.error(
    JSON.stringify({
      status: error?.status || upstream?.code,
      transportCode: error?.original?.code || error?.original?.cause?.code,
      transportName: error?.original?.name,
      code: upstream?.status,
      message:
        upstream?.message ||
        (error instanceof Error ? error.message : 'Operation failed'),
    }),
  );
  process.exitCode = 1;
}
