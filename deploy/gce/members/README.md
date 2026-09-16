# Restricted member-registration service

This directory supplements the existing static site. It does not rebuild the
site, change Firebase rules, grant IAM permissions, create accounts, change
existing ledger data, restart the VM, or install a reusable sudo/root helper.
The deploy SSH account remains unprivileged.

## 다른 서버에서 사용하기: 범위와 필수 설정

이 서비스는 **같은 Firebase 프로젝트·워크스페이스를 다른 HTTPS 호스트에서
이용하는 구성**을 지원합니다. 브라우저 앱과 회원 서비스의 Firebase 프로젝트와
워크스페이스가 일치해야 합니다. 기존 데이터를 공유하는 것이며 복제하는 것이
아닙니다. 설정값만 바꾸어 독립 회사의 회원 시스템을 즉시 만드는 기능은 아닙니다.

현재 회원 생성자는 `server/members/core.mjs`의 `REGISTRARS`에 명시된 러너·평화
두 계정뿐입니다. 단순히 관리자라는 이유로 회원 생성 권한이 생기지 않습니다.
`lib/login-identity.ts`의 로그인 ID 도메인, Firestore 회원 규칙, 최초 승인 계정도
하나의 정책으로 연결됩니다. 독립 Firebase로 이전하려면 이 정책과 초기 가입자
구성을 별도로 검토해야 하며, 본 설치 프로그램은 그 권한을 확대하지 않습니다.

### 1. 서버 root가 준비할 비공개 설정 입력

첫 설치 전에 서버 관리자가 `/etc/farmlog-members/install-input.json`을 직접
검토하여 준비합니다. 파일은 root 소유, `0600` 권한을 권장합니다. 경로의 모든
부모도 root 소유이고 그룹/다른 사용자가 쓸 수 없어야 하며 심볼릭 링크는
허용하지 않습니다. SSH 배포 사용자가 작성한 파일을 그대로 root로 실행하거나
복사하여 신뢰하지 마세요.

```json
{
  "project": "YOUR_FIREBASE_PROJECT_ID",
  "workspace": "YOUR_EXISTING_WORKSPACE_ID",
  "origin": "https://your-farmlog.example.com"
}
```

위 값은 자리표시자입니다. 실제 프로젝트 ID는 소문자 영문으로 시작하고 소문자·
숫자·하이픈으로 된 6~30자, 워크스페이스는 영문·숫자로 시작하는 1~128자이며
이후 영문·숫자·점·밑줄·하이픈을 허용합니다(웹 설정 검증과 동일). `origin`은 실제
허용할 HTTPS origin **하나**만 입력합니다. 끝의 `/`,
경로, 쿼리, fragment, 계정 정보, 와일드카드, 여러 주소를 허용하지 않습니다.
포트를 명시한 경우 Caddy `SITE_HOST`에도 같은 포트를 사용합니다. 단 기본 정적
사이트 bootstrap은 표준 443 호스트만 허용하므로 사용자 지정 포트는 수동 Caddy
설정 검토가 별도로 필요합니다.

설치 프로그램은 첫 설치 때만 64바이트 난수에서 비밀값을 생성하여
`/etc/farmlog-members/config.json`에 `root:farmlog-members`, `0640`으로 저장합니다.
그 비밀값은 로그·앱 번들·Git·인스턴스 메타데이터에 넣지 않습니다.
설정 파일이 이미 있으면 내용과 비밀값을 덮어쓰지 않습니다. 설치 입력이 남아
있으면 기존 설정과 일치하는지 검사하고, 다르면 중단합니다. 이전 서버의 SQLite
등록 저널을 옮길 때는 원래 비밀값도 안전하게 함께 보존해야 재시도 동작이
유지됩니다. 이것은 민감한 수동 이전 절차이며 자동 복사하지 않습니다.

설정 누락·빈 값·잘못된 형식·권한 문제는 운영 프로젝트로 자동 대체하지 않고
서비스 시작을 막습니다. 설정을 변경할 필요가 있다면 관리자가 서비스 중단,
백업, 단일 origin과 Caddy 호스트 일치 확인 후 명시적으로 수행해야 합니다.

### 2. 로컬에서 검토할 배포 산출물 생성

```sh
node scripts/package-member-service.mjs
```

이 명령은 `outputs/`에 앱 압축파일, SHA-256 manifest와 `members-setup-*`
설치 파일만 만듭니다. 네트워크 요청·IAM 변경·실제 배포·계정 생성은 하지 않습니다.
startup을 생성하려면 별도 공개 입력 파일을 준비합니다.

```json
{
  "originalIdentity": "original-sa@YOUR_GCE_PROJECT.iam.gserviceaccount.com",
  "runtimeIdentity": "farmlog-members-runtime@YOUR_GCE_PROJECT.iam.gserviceaccount.com",
  "nodeVersion": "v24.21.0",
  "nodeSha256": "REPLACE_WITH_VERIFIED_OFFICIAL_LINUX_X64_TAR_XZ_SHA256"
}
```

예시 값은 실행 가능한 기본값이 아닙니다. 실제 서비스 계정 주소와 공식 배포본에서
독립적으로 확인한 64자리 소문자 SHA-256을 넣어야 합니다. 이 파일에 비밀번호,
서비스 계정 JSON 키, `passwordSecret`을 추가하면 안 됩니다. 추가 키는 거부됩니다.

```sh
node scripts/package-member-service.mjs --bootstrap-config /path/to/reviewed-public-input.json --revision r1
```

원본 VM 서비스 계정과 Auth 전용 서비스 계정은 달라야 합니다. 생성된 startup은
첫 부팅에서 원본 계정으로 메타데이터 차단 장치를 먼저 준비하고, 관리자가 별도
승인한 IAM/VM identity 변경 후 두 번째 부팅에서 설치를 진행합니다. 생성된 스크립트,
manifest, 입력 대상을 반드시 검토한 뒤 사용합니다. `--bootstrap-config`를 생략하면
manifest의 `startup`은 `null`입니다. 폴더에 남은 이전 startup을 새 릴리스와 섞어
실행하지 마세요.

새 서버에서 root 설치에 필요한 설정/권한은 clone만으로 생성되지 않습니다.
Linux x86_64, systemd, Python 3.12+의 안전한 tar 추출, Caddy 정적 사이트,
`smartfarm-deploy` 배포 계정, 메타데이터 차단, 전용 서비스 계정과 제한 IAM이
먼저 준비되어야 합니다. GCE 외 서버에서는 이 메타데이터 기반 설치 절차를
그대로 사용하지 말고 키 파일 없는 별도 신원 공급 방식을 검토해야 합니다.

## Release inputs

Run only after the operator reviews the installer and configures the VM's
dedicated attached service identity and authorized access scopes. Never store a
service-account JSON key or a password secret in instance metadata or an archive.

For cross-project Firebase Auth, enable Identity Toolkit API on the VM's caller
project as well as the target Firebase project. Grant the dedicated identity only
`firebaseauth.users.get` and `firebaseauth.users.create` on the target project;
Firestore requests use the caller's Firebase token and Security Rules, not a
service-account database role. Do not attach a broader default identity or expand
its scopes to make registration work.

When using the one-shot startup template, prepare and verify the metadata guard
with the original VM identity **before** attaching the restricted Auth identity.
The deploy user must not be able to obtain its credentials. Preserve SSH metadata
and the public IP, and remove only the marked startup metadata after activation.

The gzip app archive must contain exactly these nine regular files, with their
relative paths preserved (their parent directory entries are also allowed):

```text
server/members/index.mjs
server/members/core.mjs
server/members/config.mjs
server/members/http.mjs
server/members/firestore.mjs
server/members/journal.mjs
server/members/package.json
server/members/package-lock.json
lib/login-identity.ts
```

Generate and inspect the dependency lock before packaging. Do not package
`node_modules`, any `.env` file, credentials, or arbitrary provisioning scripts.
Upload into `/srv/smartfarm-work-manager/incoming/`; give the reviewed one-shot
installer its expected SHA-256 independently of the uploaded filename.

Place `install-members.sh`, `farmlog-members.service`, `api.caddy`,
`configure-members.mjs` and generated `member-config.mjs` together in
a root-owned directory whose parents are also root-owned and not group/world-writable. The
generated helper is byte-equivalent to `server/members/config.mjs` after LF normalization,
and is separately hash-pinned in the setup manifest. Review or verify their
hashes before running them. Do not give the deploy user permission to run them as
root. The installer arguments are:

```text
install-members.sh <bundle.tar.gz> <bundle-sha256> <release-id> <node-vX.Y.Z> <node-linux-x64-tar.xz-sha256>
```

The Node checksum must come from the reviewed official release. The installer
downloads only the exact versioned `nodejs.org/dist/` archive and checks that
checksum; it never executes a remote shell installer. Node 22 must be at least
22.18.0 to support the application's type stripping and SQLite usage; Node 24 is
also supported. Linux x86_64 and Python's `tarfile` data filter are required.

## Isolation and persistence

- Service listens only on `127.0.0.1:8787` as locked, non-login `farmlog-members`.
- Versioned code/runtime live below root-owned `/opt/farmlog-members/`.
- Dependencies install as the unprivileged service user, with npm lifecycle
  scripts disabled, then become root-owned before activation.
- The only persistent service-writable directory is `/var/lib/farmlog-members`.
- Config lives at `/etc/farmlog-members/config.json`, readable only by root and
  the service group. The random password derivation secret is created locally
  only on the first install and is never printed. Later installs preserve it.
- The SQLite journal and existing secret are never removed or reset. They must
  be preserved together during recovery to retain idempotent registration.
- The exact `/api/admin/members` route proxies before the existing static
  fallback. Local `/_health` is not exposed by Caddy. Other site headers and
  static caching remain in place.

The metadata guard must already be active; the installer checks that both
`smartfarm-deploy` and `caddy` cannot retrieve the VM service identity from
metadata. Never give these users the member service group or reusable sudo access.

The installer parses only `SITE_HOST` and `ACME_EMAIL` from the existing Caddy
environment file; it does not execute that file as a shell script. It requires
`SITE_HOST` to match the reviewed member origin exactly, requires the known static fallback,
validates the candidate Caddy configuration,
starts and checks the service locally, then activates the API route. Because the
existing Caddy configuration has `admin off`, this final step restarts Caddy and
must be done during the explicitly approved brief interruption.

## Verification and rollback

Activation checks service health without creating an account. Follow with
read-only checks of the HTTPS static page and API guards (an unauthenticated
request must be denied). Never submit a real registration solely for verification
without permission to create that account.

The root-owned `provision-status.json` is a historical bootstrap probe result,
not the live health endpoint. A later API/configuration correction can leave an
old failure there while the service works. Check current systemd state, loopback
health, HTTPS guards and an authorized input-validation request instead of
rebooting solely to refresh that file. The optional effective-IAM probe requires
Cloud Resource Manager API; its unavailability is not evidence that registration
is broken and is not a reason to grant broader permissions. Record any unexecuted
probe or real-creation test accurately in the deployment record.

Before activation, the installer saves the old Caddy configuration and unit to
`/opt/farmlog-members/backups/<release-id>/`. If activation fails, its EXIT trap
restores the old Caddy configuration, service unit, enabled/active state and
`current` link, then restarts Caddy. No journal, secret, uploaded archive or old
release is deleted. Private staging directories are retained for diagnosis.

For a later operator-initiated rollback, first record and verify the exact old
release path under `/opt/farmlog-members/releases/`, stop the member service,
restore the backed-up Caddyfile and unit, atomically repoint `current` to that
verified old release, run `systemctl daemon-reload`, and restart the previously
active services. If this was the first installation, disable/stop the member
service and restore the static-only Caddyfile. Do not revert or delete the
registration journal or password secret, even when rolling back application code.
Keep the metadata guard enabled while the restricted Auth identity remains
attached, including during rollback; stopping the member service must not expose
its VM credentials to the deploy user or other processes.

The script deliberately does not grant IAM privileges, change Firebase access
rules, reserve/release IPs, or alter VM identity. Those are separate, explicitly
authorized infrastructure changes with their own rollback record.

## 로컬 검증

```sh
node scripts/test-member-config.mjs
node scripts/test-member-service.mjs
node --check server/members/config.mjs
node --check server/members/index.mjs
node --check deploy/gce/members/configure-members.mjs
node --check scripts/package-member-service.mjs
bash -n deploy/gce/members/install-members.sh
bash -n deploy/gce/members/startup-template.sh
```

합성 테스트는 공개 설정 검증, 권한 거부, 회원 생성 API 호출 제한, 중복 등록 재시도,
HTTP origin 검사, 번들 파일 목록 정합성을 검사합니다. 실제 계정이나 Firebase를
호출하지 않습니다. 이 테스트 통과만으로 새 Linux VM·systemd·Caddy·IAM 설치가
검증되는 것은 아닙니다. 실제 대상에서 별도 승인 후 상태/loopback health/HTTPS
미인증 거부/IAM 읽기 검증을 해야 합니다. 회원 생성 테스트는 실제 계정 생성이므로
별도 승인을 받기 전에는 수행하지 않습니다.
