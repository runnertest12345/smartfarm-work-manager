// Read-only checks under the dedicated Unix identity. No tokens or user data
// are logged and no account is created, updated, or deleted.
import { createRequire } from 'node:module';
import { loadMemberConfig } from './member-config.mjs';
const require = createRequire('/opt/farmlog-members/current/server/members/index.mjs');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
let phase = 'auth-lookup';
try {
  const config = loadMemberConfig();
  const app = initializeApp({ credential: applicationDefault(), projectId: config.project });
  const auth = getAuth(app);
  for (const uid of ['staff-bootstrap-3c039722dfe5ab50da57d128', 'staff-bootstrap-cbbc0b0b0bce4dfea455a415']) {
    const user = await auth.getUser(uid);
    if (user.uid !== uid || user.disabled) throw new Error('Registrar not active');
  }
  console.log(JSON.stringify({ phase, runtimeAuthRead: true, registrarAccountsActive: true }));
  phase = 'credential';
  const identity = await app.options.credential.getAccessToken();
  phase = 'iam-test';
  const response = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${config.project}:testIamPermissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${identity.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions: ['firebaseauth.users.get', 'firebaseauth.users.create', 'firebaseauth.users.update', 'firebaseauth.users.delete', 'firebaseauth.configs.update', 'datastore.entities.create'] }),
  });
  if (!response.ok) {
    console.log(JSON.stringify({ phase, httpStatus: response.status }));
    throw new Error('IAM verification unavailable');
  }
  const { permissions = [] } = await response.json();
  if (JSON.stringify([...permissions].sort((a, b) => a.localeCompare(b))) !== JSON.stringify(['firebaseauth.users.create', 'firebaseauth.users.get'])) throw new Error('Unexpected runtime permissions');
  console.log(JSON.stringify({ runtimeAuthRead: true, registrarAccountsActive: true, permissions, accountsCreated: 0 }));
} catch (error) {
  const safeCodes = ['auth/insufficient-permission', 'auth/invalid-credential', 'auth/internal-error', 'auth/user-not-found', 'app/invalid-credential'];
  console.error(JSON.stringify({ phase, code: safeCodes.includes(error?.code) ? error.code : 'verification-failed', accountsCreated: 0 }));
  process.exitCode = 1;
}
