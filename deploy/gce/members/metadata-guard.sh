#!/usr/bin/env bash
# Limit this VM's service identity to root/Google agents and the member API.
# This dedicated table never changes public HTTP/SSH traffic or metadata DNS.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || exit 1
member_uid=$(id -u farmlog-members)
[[ $member_uid =~ ^[0-9]+$ && $member_uid -ne 0 ]] || exit 1
nft=/usr/sbin/nft
[[ -x $nft ]] || exit 1
rules=$(mktemp /run/farmlog-metadata-XXXXXX.nft)
trap 'unlink "$rules"' EXIT
if "$nft" list table inet farmlog_metadata >/dev/null 2>&1; then
  printf '%s\n' 'delete table inet farmlog_metadata' > "$rules"
fi
printf '%s\n' \
  'table inet farmlog_metadata {' \
  '  chain output {' \
  '    type filter hook output priority -150; policy accept;' \
  "    ip daddr 169.254.169.254 tcp dport { 80, 443 } meta skuid != { 0, $member_uid } counter reject" \
  "    ip6 daddr fd20:ce::254 tcp dport { 80, 443 } meta skuid != { 0, $member_uid } counter reject" \
  '  }' \
  '}' >> "$rules"
"$nft" --check --file "$rules"
"$nft" --file "$rules"
