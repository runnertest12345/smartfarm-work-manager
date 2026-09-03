#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEPLOY_USER="smartfarm-deploy"
readonly DEPLOY_HOME="/home/${DEPLOY_USER}"
readonly APP_ROOT="/srv/smartfarm-work-manager"

site_host="${1:-}"
acme_email="${2:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 77
fi

if [[ -z "${site_host}" || -z "${acme_email}" ]]; then
  echo "Usage: sudo bash bootstrap-ubuntu.sh <site-host> <acme-email>" >&2
  exit 64
fi

if [[ ! "${site_host}" =~ ^[A-Za-z0-9][A-Za-z0-9.-]{0,251}[A-Za-z0-9]$ || "${site_host}" == *..* ]]; then
  echo "Invalid site host: ${site_host}" >&2
  exit 64
fi

if [[ ! "${acme_email}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]]; then
  echo "Invalid ACME email address." >&2
  exit 64
fi

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --home-dir "${DEPLOY_HOME}" --shell /bin/bash --user-group "${DEPLOY_USER}"
fi

deploy_uid="$(id -u "${DEPLOY_USER}")"
deploy_home="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)"
if [[ "${deploy_uid}" -eq 0 || "${deploy_uid}" -lt 1000 || "${deploy_home}" != "${DEPLOY_HOME}" ]]; then
  echo "${DEPLOY_USER} must be a dedicated, unprivileged login account with home ${DEPLOY_HOME}." >&2
  exit 77
fi

for privileged_group in root sudo admin wheel google-sudoers; do
  if id -nG "${DEPLOY_USER}" | tr ' ' '\n' | grep --fixed-strings --line-regexp --quiet "${privileged_group}"; then
    echo "${DEPLOY_USER} must not belong to privileged group ${privileged_group}." >&2
    exit 77
  fi
done

if command -v sudo >/dev/null 2>&1; then
  sudo_listing="$(LC_ALL=C sudo -n -l -U "${DEPLOY_USER}" 2>&1 || true)"
  if grep --fixed-strings --quiet 'may run the following commands' <<<"${sudo_listing}"; then
    echo "${DEPLOY_USER} has sudo privileges; remove them before bootstrapping." >&2
    exit 77
  fi
fi

passwd --lock "${DEPLOY_USER}" >/dev/null

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deploy_group="$(id -gn "${DEPLOY_USER}")"
temp_dir="$(mktemp -d)"

cleanup() {
  rm -rf -- "${temp_dir}"
}
trap cleanup EXIT

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  debian-archive-keyring \
  debian-keyring \
  gnupg \
  python3 \
  util-linux

curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  --output "${temp_dir}/caddy.gpg.key"
gpg --batch --yes --dearmor \
  --output /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
  "${temp_dir}/caddy.gpg.key"

curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  --output "${temp_dir}/caddy-stable.list"
install -m 0644 "${temp_dir}/caddy-stable.list" /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg

apt-get update
apt-get install -y caddy

install -d -m 0755 -o "${DEPLOY_USER}" -g "${deploy_group}" \
  "${APP_ROOT}" \
  "${APP_ROOT}/releases"
install -d -m 0700 -o "${DEPLOY_USER}" -g "${deploy_group}" \
  "${APP_ROOT}/incoming"

if [[ ! -e "${APP_ROOT}/current" ]]; then
  install -d -m 0755 -o "${DEPLOY_USER}" -g "${deploy_group}" \
    "${APP_ROOT}/releases/bootstrap"
  printf '%s\n' '<!doctype html><meta charset="utf-8"><title>Preparing service</title><p>Preparing service.</p>' \
    > "${APP_ROOT}/releases/bootstrap/index.html"
  chown "${DEPLOY_USER}:${deploy_group}" \
    "${APP_ROOT}/releases/bootstrap/index.html"
  ln -s "${APP_ROOT}/releases/bootstrap" "${APP_ROOT}/current"
fi

install -m 0644 "${script_dir}/Caddyfile" "${temp_dir}/Caddyfile"
env SITE_HOST="${site_host}" ACME_EMAIL="${acme_email}" \
  caddy validate --config "${temp_dir}/Caddyfile" --adapter caddyfile

install -m 0644 "${temp_dir}/Caddyfile" /etc/caddy/Caddyfile
install -m 0755 "${script_dir}/promote-release.sh" \
  /usr/local/bin/promote-smartfarm-release

printf 'SITE_HOST=%s\nACME_EMAIL=%s\n' "${site_host}" "${acme_email}" \
  > /etc/caddy/smartfarm-work-manager.env
chmod 0644 /etc/caddy/smartfarm-work-manager.env

install -d -m 0755 /etc/systemd/system/caddy.service.d
install -m 0644 "${script_dir}/caddy.service.conf" \
  /etc/systemd/system/caddy.service.d/smartfarm-work-manager.conf

systemctl daemon-reload
systemctl enable --now caddy
systemctl restart caddy

echo "VM is ready for https://${site_host}."
echo "Add the restricted deployment public key to ${DEPLOY_HOME}/.ssh/authorized_keys before deploying."
