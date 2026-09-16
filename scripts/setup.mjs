// Local bootstrap only: no network, installation, account creation, or deployment.
import { constants, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const demoEnvironment = `# Local-only demo: start Firebase emulators with --project demo-farmlog.
NEXT_PUBLIC_FIREBASE_API_KEY=demo-emulator-not-a-real-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-farmlog.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-farmlog
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-farmlog.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:demo000000000000
NEXT_PUBLIC_FIREBASE_WORKSPACE_ID=demo-workspace
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
`;

export function setup({ root = process.cwd(), demo = false } = {}) {
  const target = resolve(root, '.env.local');
  if (existsSync(target)) return { created: false, demo: false };
  try {
    if (demo) writeFileSync(target, demoEnvironment, { flag: 'wx', mode: 0o600 });
    else copyFileSync(resolve(root, '.env.example'), target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === 'EEXIST') return { created: false, demo: false };
    throw new Error('Could not create .env.local. Check .env.example and directory permissions.');
  }
  return { created: true, demo };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--demo') || args.length > 1) throw new Error('Usage: node scripts/setup.mjs [--demo]');
    const result = setup({ demo: args.includes('--demo') });
    console.log(result.created ? 'Created .env.local without contacting Firebase.' : 'Kept existing .env.local unchanged.');
    console.log('Recommended: Node.js 24.19.0 and pnpm 11.19.0; run pnpm install --frozen-lockfile.');
    if (result.demo) {
      console.log('Local demo only: run pnpm firebase:emulators, then pnpm dev in another terminal.');
      console.log('This does not seed accounts/data. Follow docs for emulator account and admin setup.');
    } else {
      console.log('Set every placeholder explicitly to one intended Firebase project and workspace.');
      console.log('An existing Firebase project/workspace shares its data; it does not make a copy.');
    }
    console.log('Check: pnpm env:check (local), pnpm env:check:production (release).');
    console.log('Shell variables override .env files. No rules, accounts, or server settings were changed.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
