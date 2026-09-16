#!/usr/bin/env bash
# One-shot, reviewed root installer. Never grant this script to the deploy user
# through sudo, and never execute scripts or npm lifecycle hooks from a bundle.
set -Eeuo pipefail
umask 077

die() { printf '%s\n' "$*" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || die 'Run the reviewed installer as root.'
[[ $# -eq 5 ]] || die 'Usage: install-members.sh <bundle.tar.gz> <sha256> <release-id> <node-version> <node-tar-xz-sha256>'
archive_input=$1
archive_sha=$2
release_id=$3
node_version=$4
node_sha=$5
[[ $archive_sha =~ ^[a-f0-9]{64}$ && $node_sha =~ ^[a-f0-9]{64}$ ]] || die 'Invalid SHA-256.'
[[ $release_id =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || die 'Invalid release id.'
[[ $node_version =~ ^v(22|24)\.[0-9]+\.[0-9]+$ ]] || die 'Use a reviewed Node 22 or 24 release.'
if [[ $node_version == v22.* ]]; then
  node_minor=${node_version#v22.}
  node_minor=${node_minor%%.*}
  (( 10#$node_minor >= 18 )) || die 'Node 22.18.0 or later is required.'
fi
[[ $(uname -m) == x86_64 ]] || die 'This installer supports Linux x86_64 only.'
for tool in python3 curl xz sha256sum systemctl runuser useradd getent flock install; do
  command -v "$tool" >/dev/null || die "Missing prerequisite: $tool"
done
[[ -f $archive_input && ! -L $archive_input ]] || die 'Bundle must be a regular file.'
archive_real=$(realpath -e -- "$archive_input")
[[ $archive_real == /srv/smartfarm-work-manager/incoming/* ]] || die 'Bundle must be in the existing incoming directory.'

readonly app_root=/opt/farmlog-members
readonly releases=/opt/farmlog-members/releases
readonly caddy_config=/etc/caddy/Caddyfile
readonly caddy_env=/etc/caddy/smartfarm-work-manager.env
readonly unit_path=/etc/systemd/system/farmlog-members.service
# These are independently reviewed root-owned setup files, never app uploads.
installer_dir=$(dirname "$(realpath -e "${BASH_SOURCE[0]}")")
python3 - "$installer_dir" "$caddy_config" "$caddy_env" <<'PY'
import stat, sys
from pathlib import Path
directory = Path(sys.argv[1])
templates = ['install-members.sh', 'farmlog-members.service', 'api.caddy', 'configure-members.mjs', 'member-config.mjs']
for path in [directory, *directory.parents]:
    st = path.lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
        raise SystemExit('Installer parents must be root-owned and not group/world-writable')
for path in [*(directory / name for name in templates), *(Path(name) for name in sys.argv[2:])]:
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022 or st.st_nlink != 1:
        raise SystemExit('Unsafe reviewed installer template or Caddy configuration')
PY
for owned_path in "$app_root" "$releases" "$app_root/runtimes" "$app_root/backups" /etc/farmlog-members /var/lib/farmlog-members; do
  [[ ! -L $owned_path ]] || die "Refusing symlink directory: $owned_path"
  if [[ -e $owned_path ]]; then
    [[ -d $owned_path ]] || die "Expected directory: $owned_path"
  fi
done
install -d -o root -g root -m 0755 "$app_root" "$releases" "$app_root/runtimes"
install -d -o root -g root -m 0700 "$app_root/backups"
exec 9>"$app_root/.install.lock"
flock --exclusive --nonblock 9 || die 'Another member service installation is active.'
[[ ! -e $releases/$release_id && ! -L $releases/$release_id ]] || die 'Release id already exists; use a new release id.'
[[ ! -e $app_root/backups/$release_id ]] || die 'Backup id already exists.'
[[ -f $caddy_config && ! -L $caddy_config ]] || die 'Expected regular existing Caddyfile.'
[[ -f $caddy_env && ! -L $caddy_env ]] || die 'Expected existing Caddy environment file.'
[[ ! -L $unit_path ]] || die 'Refusing symlink unit file.'
[[ ! -e $app_root/current || -L $app_root/current ]] || die 'Current release must be a symlink.'
previous_release=''
if [[ -L $app_root/current ]]; then
  previous_release=$(realpath -e "$app_root/current")
  [[ $previous_release == "$releases/"* ]] || die 'Previous release is outside the release directory.'
fi

# A private root-owned copy prevents a deploy user replacing the input between
# checksum verification and extraction. The original upload is not deleted.
work=$(mktemp -d "$app_root/.install-${release_id}-XXXXXX")
backup="$app_root/backups/$release_id"
install -d -m 0700 "$backup"
install -m 0600 "$archive_real" "$work/bundle.tar.gz"
[[ $(sha256sum "$work/bundle.tar.gz" | cut -d ' ' -f 1) == "$archive_sha" ]] || die 'Bundle checksum mismatch.'
install -m 0600 "$caddy_config" "$backup/Caddyfile"
if [[ -f $unit_path ]]; then install -m 0600 "$unit_path" "$backup/farmlog-members.service"; fi
was_enabled=0
was_active=0
systemctl is-enabled --quiet farmlog-members.service && was_enabled=1
systemctl is-active --quiet farmlog-members.service && was_active=1
activated=0
success=0
rollback() {
  result=$?
  trap - EXIT
  if (( activated && ! success )); then
    printf '%s\n' 'Member service activation failed; restoring the previous service and Caddy configuration.' >&2
    systemctl stop farmlog-members.service || true
    install -m 0644 "$backup/Caddyfile" "$caddy_config"
    if [[ -f $backup/farmlog-members.service ]]; then
      install -m 0644 "$backup/farmlog-members.service" "$unit_path"
    else
      systemctl disable farmlog-members.service >/dev/null 2>&1 || true
      unlink "$unit_path" 2>/dev/null || true
    fi
    if [[ -n $previous_release ]]; then
      ln -s "$previous_release" "$work/previous-current"
      mv -Tf "$work/previous-current" "$app_root/current"
    elif [[ -L $app_root/current ]]; then
      unlink "$app_root/current"
    fi
    systemctl daemon-reload || true
    if (( was_enabled )); then
      systemctl enable farmlog-members.service >/dev/null 2>&1 || true
    else
      systemctl disable farmlog-members.service >/dev/null 2>&1 || true
    fi
    if (( was_active )); then systemctl start farmlog-members.service || true; fi
    systemctl restart caddy || true
  fi
  # Keep root-only staging and backups for diagnosis. Never remove a journal,
  # password secret, previous release, or user-owned incoming archive here.
  exit "$result"
}
trap rollback EXIT

install -d -m 0700 "$work/app"
python3 - "$work/bundle.tar.gz" "$work/app" <<'PY'
import os, sys, tarfile
from pathlib import Path, PurePosixPath
archive, destination = Path(sys.argv[1]), Path(sys.argv[2])
if not 0 < archive.stat().st_size <= 16 * 1024 * 1024:
    raise SystemExit('Invalid bundle size')
required = {
    'server/members/index.mjs', 'server/members/core.mjs',
    'server/members/config.mjs',
    'server/members/http.mjs', 'server/members/firestore.mjs',
    'server/members/journal.mjs', 'server/members/package.json',
    'server/members/package-lock.json', 'lib/login-identity.ts',
}
allowed_directories = {'.', 'server', 'server/members', 'lib'}
seen = set()
total = 0
with tarfile.open(archive, 'r:gz') as bundle:
    for member in bundle:
        path = PurePosixPath(member.name)
        key = path.as_posix()
        if path.is_absolute() or '..' in path.parts or key in seen:
            raise SystemExit('Unsafe or duplicate bundle path')
        seen.add(key)
        if member.isdir() and key in allowed_directories:
            continue
        if not member.isfile() or key not in required:
            raise SystemExit('Unexpected bundle entry')
        total += member.size
        if total > 16 * 1024 * 1024:
            raise SystemExit('Expanded bundle too large')
        target = destination.joinpath(*path.parts)
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with bundle.extractfile(member) as source, target.open('xb') as output:
            remaining = member.size
            while remaining:
                chunk = source.read(min(remaining, 1024 * 1024))
                if not chunk:
                    raise SystemExit('Truncated bundle')
                output.write(chunk)
                remaining -= len(chunk)
        target.chmod(0o600)
if not required <= seen:
    raise SystemExit('Incomplete member bundle')
PY

# Install a pinned official runtime, not a curl | shell bootstrap. The SHA must
# have been independently checked against Node's signed release checksums.
runtime="$app_root/runtimes/node-${node_version}-linux-x64"
if [[ -e $runtime ]]; then
  [[ -d $runtime && ! -L $runtime && -f $runtime/.archive-sha256 ]] || die 'Unexpected runtime directory.'
  [[ $(<"$runtime/.archive-sha256") == "$node_sha" ]] || die 'Existing runtime hash mismatch.'
else
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
    --connect-timeout 10 --max-time 180 \
    "https://nodejs.org/dist/${node_version}/node-${node_version}-linux-x64.tar.xz" \
    --output "$work/node.tar.xz"
  [[ $(sha256sum "$work/node.tar.xz" | cut -d ' ' -f 1) == "$node_sha" ]] || die 'Node runtime checksum mismatch.'
  python3 - "$work/node.tar.xz" "$work" "node-${node_version}-linux-x64" <<'PY'
import sys, tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1], 'r:xz') as archive:
    total = 0
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or path.parts[0] != sys.argv[3]:
            raise SystemExit('Invalid runtime archive path')
        total += member.size
        if total > 512 * 1024 * 1024:
            raise SystemExit('Expanded runtime too large')
    archive.extractall(sys.argv[2], filter='data')
PY
  printf '%s\n' "$node_sha" > "$work/node-${node_version}-linux-x64/.archive-sha256"
  chown -R root:root "$work/node-${node_version}-linux-x64"
  chmod -R go-w "$work/node-${node_version}-linux-x64"
  mv "$work/node-${node_version}-linux-x64" "$runtime"
fi
[[ $($runtime/bin/node --version) == "$node_version" ]] || die 'Unexpected Node runtime version.'

if ! getent passwd farmlog-members >/dev/null; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin farmlog-members
fi
[[ $(id -u farmlog-members) -ne 0 ]] || die 'Invalid service user.'
[[ $(id -nG farmlog-members) == farmlog-members ]] || die 'Service account must not have supplemental groups.'
[[ $(getent passwd farmlog-members | cut -d: -f7) == /usr/sbin/nologin ]] || die 'Service account must have no login shell.'
systemctl is-active --quiet farmlog-metadata-guard.service || die 'Prepare the reviewed metadata guard before installing the Auth-capable service.'
for isolated_user in smartfarm-deploy caddy; do
  [[ $(id -u "$isolated_user") -ne $(id -u farmlog-members) ]] || die 'Service identity must remain separate.'
  if runuser -u "$isolated_user" -- curl --fail --silent --max-time 3 -H 'Metadata-Flavor: Google' \
    http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/email >/dev/null 2>&1; then
    die "Metadata credentials are reachable by $isolated_user; do not install."
  fi
done

# Dependencies are installed unprivileged with lifecycle scripts disabled.
# The private staging directory is accessible only to root and this service.
chown root:farmlog-members "$work"
chmod 0710 "$work"
install -d -o farmlog-members -g farmlog-members -m 0700 "$work/npm-cache"
chown -R farmlog-members:farmlog-members "$work/app"
runuser -u farmlog-members -- env -i \
  PATH="$runtime/bin:/usr/bin:/bin" HOME=/nonexistent \
  npm_config_cache="$work/npm-cache" npm_config_registry=https://registry.npmjs.org/ \
  "$runtime/bin/node" "$runtime/lib/node_modules/npm/bin/npm-cli.js" \
  ci --prefix "$work/app/server/members" --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:root "$work/app"
chmod -R u=rwX,go=rX "$work/app"
ln -s "$runtime" "$work/app/runtime"
mv "$work/app" "$releases/$release_id"
chmod 0700 "$work"
chown root:root "$work"

install -d -o root -g farmlog-members -m 0750 /etc/farmlog-members
install -d -o farmlog-members -g farmlog-members -m 0700 /var/lib/farmlog-members
# Existing config/secret are validated and never overwritten. New installs
# require root-reviewed install-input.json; no production target is assumed.
"$runtime/bin/node" "$installer_dir/configure-members.mjs" > "$work/member-public-config.json"
python3 - "$caddy_config" "$installer_dir/api.caddy" "$work/Caddyfile" <<'PY'
import re, sys
from pathlib import Path
source = Path(sys.argv[1]).read_text()
if 'root * /srv/smartfarm-work-manager/current' not in source:
    raise SystemExit('Unexpected Caddy static root; review manually')
if '/api/admin/members' in source or 'farmlog-members' in source:
    # Repeat installs preserve an already-reviewed member route unchanged.
    if 'reverse_proxy /api/admin/members 127.0.0.1:8787' not in source:
        raise SystemExit('Existing member route differs; review manually')
    result = source
else:
    pattern = r'(?m)^(?P<indent>[ \t]*)try_files \{path\} \{path\}\.html \{path\}/index\.html\r?\n[ \t]*file_server[ \t]*$'
    matches = list(re.finditer(pattern, source))
    if len(matches) != 1:
        raise SystemExit('Expected exactly one static fallback; review manually')
    match = matches[0]
    snippet = '\n'.join(line for line in Path(sys.argv[2]).read_text().splitlines() if not line.startswith('#'))
    result = source[:match.start()] + '\n'.join(match['indent'] + line for line in snippet.splitlines()) + source[match.end():]
Path(sys.argv[3]).write_text(result)
PY
# Caddy environment is a pre-existing root-owned deployment config. Parse only
# its two known values; do not source it as shell code.
python3 - "$caddy_env" "$work/Caddyfile" "$work/member-public-config.json" <<'PY'
import json, os, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit
env = os.environ.copy()
for line in Path(sys.argv[1]).read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#'):
        continue
    key, separator, value = line.partition('=')
    if not separator or key not in {'SITE_HOST', 'ACME_EMAIL'}:
        raise SystemExit('Unexpected Caddy environment setting; review manually')
    env[key] = value.strip().strip('"').strip("'")
origin = json.loads(Path(sys.argv[3]).read_text())['origin']
if env.get('SITE_HOST') != urlsplit(origin).netloc:
    raise SystemExit('Caddy SITE_HOST must exactly match the reviewed member HTTPS origin')
subprocess.run(['/usr/bin/caddy', 'validate', '--config', sys.argv[2], '--adapter', 'caddyfile'], env=env, check=True)
PY

activated=1
install -m 0644 "$installer_dir/farmlog-members.service" "$unit_path"
ln -s "$releases/$release_id" "$work/next-current"
mv -Tf "$work/next-current" "$app_root/current"
systemctl daemon-reload
systemctl enable farmlog-members.service >/dev/null
systemctl restart farmlog-members.service
healthy=0
for attempt in {1..15}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8787/_health | "$runtime/bin/node" --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;if(JSON.parse(s).ready!==true)process.exit(1)' 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done
(( healthy )) || die 'Member service health check failed.'
install -m 0644 "$work/Caddyfile" "$caddy_config"
# Existing Caddy disables its admin API, so reload is unavailable. The user has
# authorized this deployment's brief restart; only Caddy is restarted here.
systemctl restart caddy
systemctl is-active --quiet caddy
systemctl is-active --quiet farmlog-members.service
success=1
printf 'Member service release %s installed. No accounts or ledger records were created.\n' "$release_id"
