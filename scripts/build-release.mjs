// Build a static release locally. Never uploads, deploys rules, or writes business data.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportEnvironment } from './check-environment.mjs';

const hash = (data) => createHash('sha256').update(data).digest('hex');
export function inspectStaticDirectory(directory) {
  const files = [];
  function walk(folder) {
    if (lstatSync(folder).isSymbolicLink()) throw new Error('Release files must not contain symbolic links or junctions.');
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, item.name);
      if (item.isSymbolicLink()) throw new Error('Release files must not contain symbolic links or junctions.');
      if (item.name.startsWith('.') || /\.(?:map|pem|key|p12|pfx|sqlite|db)$/i.test(item.name)
        || /(?:service[-_]?account|credentials)/i.test(item.name)) throw new Error('Unsafe file name detected in public/static output; no release was produced.');
      if (item.isDirectory()) walk(path);
      else if (item.isFile()) {
        const data = readFileSync(path);
        if (/(?:-----BEGIN [^-]*PRIVATE KEY-----|"private_key"\s*:|sourceMappingURL=data:)/.test(data.toString('utf8'))) throw new Error('Private credential or inline source-map content detected; no release was produced.');
        files.push({ path: relative(directory, path).split(sep).join('/'), sha256: hash(data) });
      } else throw new Error('Unsupported special file in static output.');
    }
  }
  walk(directory);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function releaseMetadata({ release, gitSha, dirty, env, versions, files, builtAt = new Date().toISOString() }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(release)) throw new Error('Release ID must be 1–64 safe letters, numbers, dots, underscores or hyphens.');
  if (!/^[0-9a-f]{40,64}$/.test(gitSha)) throw new Error('A valid Git commit is required to identify the source.');
  return {
    release, gitSha, sourceDirty: dirty, builtAt, output: 'next-static-export',
    runtime: { node: versions.node, next: versions.next, react: versions.react, packageManager: versions.packageManager },
    // Explicit allowlist: API key, tokens, shell variables, and env file contents are omitted.
    target: {
      firebaseProjectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      workspaceId: env.NEXT_PUBLIC_FIREBASE_WORKSPACE_ID,
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
      emulators: false,
    },
    staticFiles: files.length,
    staticSha256: hash(files.map((file) => `${file.path}:${file.sha256}`).join('\n')),
  };
}

export function buildRelease({ root = process.cwd(), release } = {}) {
  const checked = reportEnvironment({ root, production: true });
  if (!checked.valid) throw new Error('Production configuration failed. Nothing was built or deployed.');
  const require = createRequire(import.meta.url);
  let gitSha;
  let dirty;
  try {
    gitSha = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { throw new Error('Build releases from a Git clone with a valid HEAD commit.'); }
  const releaseId = release || `build-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${gitSha.slice(0, 12)}${dirty ? '-dirty' : ''}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(releaseId)) throw new Error('Invalid release ID. Use only 1–64 safe letters, numbers, dots, underscores or hyphens.');
  if (existsSync(resolve(root, 'public'))) inspectStaticDirectory(resolve(root, 'public'));
  const output = resolve(root, 'out');
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) throw new Error('out/ must be a normal directory, not a link or junction.');
  if (dirty) console.log('NOTE: Working tree has changes; release metadata will record sourceDirty=true. Commit reviewed changes for a reproducible production release.');
  // Invoke Node directly, never .cmd/shell command strings; works on Windows and Linux.
  const child = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack'], {
    cwd: root, env: { ...checked.env, NODE_ENV: 'production' }, stdio: 'inherit', shell: false,
  });
  if (child.error || child.signal || child.status !== 0) throw new Error('Next.js build failed. No release was deployed.');
  if (!existsSync(join(output, 'index.html'))) throw new Error('Static export out/index.html is missing. Check output: export in next.config.ts.');
  const files = inspectStaticDirectory(output).filter((file) => file.path !== 'release.json');
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const metadata = releaseMetadata({ release: releaseId, gitSha, dirty, env: checked.env, files, versions: {
    node: process.versions.node,
    next: require('next/package.json').version,
    react: require('react/package.json').version,
    packageManager: packageJson.packageManager || 'not-declared',
  } });
  writeFileSync(join(output, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
  console.log(`Static release ready: out/ (${metadata.staticFiles} files plus release.json).`);
  console.log('Only out/ is suitable for static publishing; never upload .env, node_modules, source, or member-service credentials.');
  console.log('No server, Firebase rules, accounts, or live data were changed.');
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && (args.length !== 2 || args[0] !== '--release')) throw new Error('Usage: node scripts/build-release.mjs [--release SAFE_ID]');
    buildRelease({ release: args[1] });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
