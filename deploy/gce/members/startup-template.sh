#!/usr/bin/env bash
# FARMLOG_MEMBER_SERVICE_BOOTSTRAP_V1
# FARMLOG_MEMBER_SERVICE_PREPARE_GUARD_V1
# Generated only from reviewed, hash-pinned files. Contains no credentials.
set -Eeuo pipefail
umask 077
status=/opt/farmlog-members/provision-status.json
finish_failure() {
  printf '%s\n' '{"ready":false,"phase":"provisioning-failed","accountsCreated":0}' > "$status"
  chmod 0644 "$status"
}
trap 'result=$?; if (( result != 0 )); then finish_failure; fi' EXIT
[[ $EUID -eq 0 ]]
python3 - <<'PY'
import hashlib, os, stat
from pathlib import Path
incoming = Path('/srv/smartfarm-work-manager/incoming')
target = Path('/opt/farmlog-members/provision')
for path in [target.parent, target]:
    if path.is_symlink():
        raise SystemExit('Unexpected provision symlink')
    path.mkdir(exist_ok=True, mode=0o755)
    if path.stat().st_uid != 0 or path.stat().st_mode & 0o022:
        raise SystemExit('Unsafe provision directory owner or mode')
    # Only reviewed code/status lives here. The service identity must traverse
    # this directory for the read-only runtime probe; secrets live under /etc.
    path.chmod(0o755)
manifest = __PROVISION_MANIFEST__
for name, expected in manifest.items():
    source = incoming / ('members-setup-' + name)
    if source.is_symlink() or not source.is_file():
        raise SystemExit('Expected regular reviewed input')
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit('Provision input checksum mismatch')
    output = target / name
    if output.is_symlink():
        raise SystemExit('Unexpected provision file symlink')
    output.write_bytes(data)
    os.chown(output, 0, 0)
    output.chmod(0o755 if name.endswith('.sh') else 0o644)
PY
if ! getent passwd farmlog-members >/dev/null; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin farmlog-members
fi
[[ $(id -u farmlog-members) -ne 0 ]]
[[ $(id -nG farmlog-members) == farmlog-members ]]
[[ $(getent passwd farmlog-members | cut -d: -f7) == /usr/sbin/nologin ]]
[[ $(id -u farmlog-members) -ne $(id -u smartfarm-deploy) ]]
[[ $(id -u farmlog-members) -ne $(id -u caddy) ]]
if [[ ! -x /usr/sbin/nft ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get -o Acquire::Retries=3 update
  apt-get -y --no-install-recommends install nftables
fi
install -m 0644 /opt/farmlog-members/provision/farmlog-metadata-guard.service /etc/systemd/system/farmlog-metadata-guard.service
install -d -o root -g root -m 0755 /etc/systemd/system/nftables.service.d
printf '%s\n' '[Service]' \
  'ExecStartPost=/opt/farmlog-members/provision/metadata-guard.sh' \
  'ExecReload=/opt/farmlog-members/provision/metadata-guard.sh' \
  > /etc/systemd/system/nftables.service.d/farmlog-metadata.conf
systemctl daemon-reload
systemctl enable farmlog-metadata-guard.service
systemctl restart farmlog-metadata-guard.service
if runuser -u smartfarm-deploy -- curl --fail --silent --max-time 3 -H 'Metadata-Flavor: Google' http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/email >/dev/null 2>&1; then
  printf '%s\n' 'Metadata isolation verification failed.' >&2
  exit 1
fi
identity=$(runuser -u farmlog-members -- curl --fail --silent --max-time 3 -H 'Metadata-Flavor: Google' http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/email)
if [[ $identity == '__ORIGINAL_IDENTITY__' ]]; then
  # First boot deliberately retains the ORIGINAL scopes/identity. Install and
  # verify isolation BEFORE the operator attaches the new Auth-capable identity.
  printf '%s\n' '{"ready":false,"phase":"guard-prepared","metadataIsolation":true,"accountsCreated":0}' > "$status"
  chmod 0644 "$status"
  trap - EXIT
  exit 0
fi
[[ $identity == '__RUNTIME_IDENTITY__' ]]
if [[ $(readlink -f /opt/farmlog-members/current 2>/dev/null || true) != /opt/farmlog-members/releases/__RELEASE_ID__ ]]; then
  /opt/farmlog-members/provision/install-members.sh \
    '/srv/smartfarm-work-manager/incoming/__APP_ARCHIVE__' '__APP_SHA__' '__RELEASE_ID__' \
    '__NODE_VERSION__' '__NODE_SHA__'
fi
runuser -u farmlog-members -- /opt/farmlog-members/current/runtime/bin/node /opt/farmlog-members/provision/verify-runtime.mjs
printf '%s\n' '{"ready":true,"release":"__RELEASE_ID__","runtimePermissionCheck":true,"metadataIsolation":true,"accountsCreated":0}' > "$status"
chmod 0644 "$status"
trap - EXIT
