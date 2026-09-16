import { createServer } from 'node:http';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRegistrar } from './core.mjs';
import { createMemberHandler } from './http.mjs';
import { openJournal } from './journal.mjs';
import { firestoreStore } from './firestore.mjs';
import { loadMemberConfig } from './config.mjs';

const config = loadMemberConfig();
const journal = openJournal('/var/lib/farmlog-members/registrations.sqlite');
const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.project,
});
const register = createRegistrar({
  auth: getAuth(app),
  store: firestoreStore(config.project, config.workspace),
  journal,
  workspace: config.workspace,
  passwordSecret: config.passwordSecret,
});
const server = createServer(
  { maxHeaderSize: 16384, requestTimeout: 35000, headersTimeout: 10000 },
  createMemberHandler({ origin: config.origin, register }),
);
server.listen(8787, '127.0.0.1', () => console.log('Member service ready'));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(() => {
      journal.close();
      process.exit(0);
    }),
  );
