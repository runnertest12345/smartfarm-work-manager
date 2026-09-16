# 기존 운영 서버: Compute Engine 정적 배포

이 문서는 **기존 운영 대상 전용** `.github/workflows/deploy-gce-static.yml`을 설명합니다. 새 서버/별도 Firebase용 재현은 [새 서버 설치 가이드](deployment/server-setup.md)를 먼저 사용하세요. 기존 workflow의 Firebase 설정 hash와 작업공간 고정을 임의로 제거해 다른 조직에 재사용하지 않습니다.

이 정적 배포는 Next.js의 `out/`만 Google Compute Engine VM으로 전송합니다. 비공개 GitHub 저장소 읽기 키나 Firebase 관리 JSON 키는 정적 배포를 위해 VM에 저장하지 않습니다. 직원 계정 생성은 [별도 제한 서비스](../deploy/gce/members/README.md)가 담당하며, 그 서비스의 신원·저널·secret은 정적 배포와 별개입니다.

2026-09-16 확인 기준 운영 웹은 `manual-20260916-work-ui-836c517b9251`, OS는 Ubuntu 26.04.1 LTS x86_64, Caddy는 2.11.4, 별도 회원 서비스의 Node는 24.21.0입니다. CI 빌드 Node는 `.node-version`, pnpm은 `package.json`을 기준으로 고정합니다. 자세한 기술 스택은 [구조 문서](deployment/architecture.md)를 참고하세요.

```text
GitHub Actions (수동 실행)
  → Next.js 정적 빌드
  → 비밀정보가 없는 빌드 작업에서 SHA-256과 함께 artifact 생성
  → main 전용 별도 배포 작업이 SSH로 압축본만 VM에 전송
  → Caddy가 무중단으로 새 릴리스 전환
  → 기존 접속 호스트 + 자동 HTTPS
```

## 1. 임시 호스트 정하기

별도 도메인을 구입하지 않을 때는 VM의 외부 IPv4 주소를 `sslip.io`에 붙여 사용할 수 있습니다.

```text
외부 IP: 34.64.62.115
임시 호스트: 34-64-62-115.sslip.io
서비스 주소: https://34-64-62-115.sslip.io
```

위 값은 현재 배포 대상의 주소입니다. 별도 서버의 외부 IP가 다르면 `IP의 점을 하이픈으로 바꾼 값.sslip.io` 형식의 임시 주소를 사용할 수 있지만, 지속 운영에는 소유 도메인을 준비하는 편이 관리하기 쉽습니다. 임시 외부 IP는 VM 중지·재시작 때 바뀔 수 있으므로 필요한 경우 고정 IP로 예약하고 비용을 확인합니다. VM·디스크·외부 IPv4·트래픽·백업은 무료로 보장되지 않습니다.

`sslip.io`는 외부 DNS 서비스이므로 자체 소유 도메인과 같은 관리 권한/가용성을 가정하지 않습니다. 소유권 확인이 필요한 Google OAuth 리디렉션 도메인으로 사용하지 않습니다. Firebase 웹 앱의 기존 `authDomain`은 그대로 두고 이 호스트는 앱 접속 주소와 Firebase Authorized domains 항목으로만 사용합니다.

Google Cloud 방화벽에서 TCP 80과 443을 허용해야 Caddy가 TLS 인증서를 발급하고 갱신할 수 있습니다.

## 2. VM 최초 준비

**새 VM 최초 설치에만** Ubuntu VM에 아래 네 파일을 복사합니다. 기존 운영 VM에 bootstrap을 재실행하면 Caddy 설정이 덮어써지고 서비스가 재시작될 수 있습니다. 일상 업데이트에는 6절의 릴리스 승격만 사용합니다.

```text
deploy/gce/Caddyfile
deploy/gce/caddy.service.conf
deploy/gce/promote-release.sh
deploy/gce/bootstrap-ubuntu.sh
```

VM에서 다음 명령을 한 번 실행합니다. 호스트와 인증서 알림 이메일을 실제 값으로 바꿉니다.

```bash
sudo bash bootstrap-ubuntu.sh \
  34-64-62-115.sslip.io \
  admin@example.com
```

이 스크립트는 Caddy의 공식 Debian 저장소를 사용하고 `/srv/smartfarm-work-manager`를 준비합니다. 또한 비밀번호가 잠겨 있고 `sudo` 권한이 없는 전용 `smartfarm-deploy` 계정을 만듭니다. 기존 관리자나 기본 GCE 사용자를 배포 계정으로 사용하지 않습니다. Firebase 프로젝트나 앱 설정은 변경하지 않습니다.

다음 명령으로 초기 상태를 확인합니다.

```bash
systemctl status caddy --no-pager
curl -I https://34-64-62-115.sslip.io
```

## 3. 전용 SSH 키 준비

개인 SSH 키를 재사용하지 말고 GitHub 배포 전용 Ed25519 키를 만듭니다. 공개 키는 VM의 `/home/smartfarm-deploy/.ssh/authorized_keys`에 다음과 같이 제한 옵션을 붙여 등록합니다. `PUBLIC_KEY` 부분만 실제 공개 키 한 줄로 바꿉니다.

```bash
sudo install -d -m 0700 -o smartfarm-deploy -g smartfarm-deploy \
  /home/smartfarm-deploy/.ssh
printf '%s\n' 'restrict PUBLIC_KEY' | \
  sudo tee /home/smartfarm-deploy/.ssh/authorized_keys >/dev/null
sudo chown smartfarm-deploy:smartfarm-deploy \
  /home/smartfarm-deploy/.ssh/authorized_keys
sudo chmod 0600 /home/smartfarm-deploy/.ssh/authorized_keys
```

`PUBLIC_KEY`는 `ssh-ed25519 AAAA... github-actions-smartfarm` 전체입니다. `restrict`는 포트·에이전트·X11 전달과 PTY를 막지만 이 배포에 필요한 SFTP와 승격 명령은 허용합니다. 개인 키는 GitHub Repository secret에만 저장합니다. `smartfarm-deploy`를 `sudo`, `admin`, `wheel`, `google-sudoers` 그룹에 추가하면 안 됩니다.

VM의 SSH 호스트 키는 Google Cloud 웹 SSH처럼 신뢰할 수 있는 경로에서 지문을 확인한 뒤 `known_hosts` 형식으로 저장합니다. GitHub Actions에서 `ssh-keyscan`으로 즉석 신뢰하지 않습니다.

## 4. GitHub Actions 설정

이 workflow는 수동 `workflow_dispatch` 전용이며 Git push로 자동 실행되지 않습니다. workflow 자체에서 `main` 이외의 ref를 거부하고, 빌드와 배포 작업을 분리하며, SSH secret을 단일 배포 단계에서만 읽습니다. 저장소 write/admin 권한은 신뢰할 수 있는 운영자에게만 부여합니다. 사용하는 GitHub 요금제/저장소 공개 범위에서 지원된다면 `production` Environment의 main 제한과 승인자를 추가합니다. 지원 여부는 현재 저장소 설정에서 확인합니다.

다음 값은 **Settings → Secrets and variables → Actions → Variables**의 Repository variables로 등록합니다. 빌드 작업은 공개 Repository variables만 읽고 Repository secrets에는 접근하지 않습니다.

| 이름                           | 값                                      |
| ------------------------------ | --------------------------------------- |
| `VM_HOST`                      | VM 고정 외부 IPv4                       |
| `VM_USER`                      | 반드시 `smartfarm-deploy`               |
| `VM_SITE_HOST`                 | `외부IP.sslip.io` 형식의 호스트         |
| `FIREBASE_API_KEY`             | Firebase 웹 앱의 apiKey                 |
| `FIREBASE_AUTH_DOMAIN`         | 등록한 Firebase 웹 앱의 authDomain      |
| `FIREBASE_PROJECT_ID`          | Firebase 프로젝트 ID                    |
| `FIREBASE_STORAGE_BUCKET`      | Firebase 웹 앱의 storageBucket          |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase 웹 앱의 messagingSenderId      |
| `FIREBASE_APP_ID`              | Firebase 웹 앱의 appId                  |

다음 값은 같은 화면의 Repository secrets로 등록합니다.

| 이름                 | 값                              |
| -------------------- | ------------------------------- |
| `VM_SSH_PRIVATE_KEY` | 배포 전용 Ed25519 개인 키 전체  |
| `VM_KNOWN_HOSTS`     | 검증한 VM의 `known_hosts` 한 줄 |

Firebase 웹 구성값은 브라우저에 포함되는 공개 식별자입니다. 배포 설정으로 주입하되 이 운영 workflow는 **검증된 기존 Firebase 설정 묶음의 SHA-256까지 검사**하여 다른 프로젝트로 잘못 배포하지 못하게 합니다. 정적 빌드/업로드에는 서비스 계정 JSON이나 Firebase Admin 키가 필요하지 않습니다.

운영 데이터 작업공간은 workflow에서 `sheet-20260903-579dfadc`로 고정되어 있습니다. 앱에는 미설정 시 운영 작업공간을 선택하는 기본값이 없습니다. 다른 작업공간으로 전환할 때는 사용자 승인 문서·데이터·등록 서비스까지 함께 검토합니다. 새 환경에서는 공개 설정을 명시하는 포터블 빌드 도구를 사용합니다.

## 5. Firebase 로그인 허용

Firebase Console의 **Authentication → Settings → Authorized domains**에 `VM_SITE_HOST` 값만 추가합니다. 프로토콜(`https://`)과 경로는 넣지 않습니다.

이 저장소의 Firestore 규칙과 승인 사용자 문서(`appMembers/{uid}`) 설정은 별도로 완료되어 있어야 합니다. 활성 여부 하나만 입력하면 회원 초기 구성이 끝나는 것이 아닙니다. 작업공간·역할·부서·계정 식별자·비밀번호 변경 조건을 현재 정책에 맞게 승인해야 합니다. Caddy는 정적 화면과 API 프록시를 제공하지만 Firestore 보안을 대신하지 않습니다.

## 6. 배포와 확인

GitHub의 `main` 브랜치에서 **Actions → Deploy static site to Compute Engine → Run workflow**를 실행합니다. 이 동작은 실제 운영 배포이므로 승인된 변경에만 실행합니다. workflow는 고정 의존성 설치, lint/회귀 테스트, 운영용 빌드 도구를 거쳐 `out/release.json`이 포함된 정적 artifact와 SHA-256을 만듭니다. 별도 배포 작업의 SSH 단계만 키를 읽습니다. 서버는 압축 파일의 항목을 사전 검사한 후 `/srv/smartfarm-work-manager/current`를 새 릴리스로 원자적으로 전환합니다.

소스 커밋과 `release.json`의 Firebase 프로젝트·작업공간·접속 주소·Node/Next 버전을 배포 기록에 남깁니다. 웹 빌드는 Rules/인덱스/계정/API 서비스를 배포하거나 업무 데이터를 초기화하지 않습니다. 릴리스 ID는 서버 승격기의 제한인 **64자 이내** 안전한 영문·숫자·점·밑줄·하이픈을 사용합니다.

성공 후 다음 항목을 확인합니다.

- `https://VM_SITE_HOST`에서 인증서 경고 없이 화면이 열림
- 승인되지 않은 Google 계정은 데이터 접근이 거부됨
- 승인된 계정은 로그인 후 사업·농가 데이터를 읽을 수 있음
- 저장 검증은 승인된 테스트 대상이 있을 때만 수행하며, 수행하지 않았으면 기록
- 모바일과 PC에서 로그아웃 후 다시 로그인할 수 있음

릴리스는 `/srv/smartfarm-work-manager/releases` 아래에 최근 5개까지 보존됩니다. 서버는 압축본 64 MiB, 해제 후 256 MiB, 항목 20,000개를 상한으로 두고 일반 파일과 디렉터리만 허용합니다. 문제가 생기면 검증된 이전 릴리스 경로를 `current` 심볼릭 링크로 다시 지정하여 화면을 되돌릴 수 있습니다. 업무 데이터/Rules/API 서비스까지 되돌리는 것은 아닙니다. 백업과 계층별 롤백은 [운영 가이드](deployment/operations.md)를 따릅니다.

## 종료할 때

임시 호스트는 외부 IP 소유권과 연결되므로 다음 순서를 지킵니다. 외부 IP를 먼저 반납하면 같은 sslip.io 호스트를 받은 제3자가 Firebase 로그인을 유도할 수 있습니다.

1. 필요한 Firestore 데이터를 내보내고 실제로 복원 가능한지 확인합니다.
2. `appMembers`를 비활성화하고 필요하면 Firebase 사용자를 비활성화하거나 refresh token을 폐기합니다.
3. Firebase Authentication의 Authorized domains에서 임시 호스트를 제거하고 더 이상 로그인되지 않는지 확인합니다.
4. GitHub Repository SSH secrets를 삭제하고 VM의 `authorized_keys`에서 배포 키를 제거합니다.
5. Caddy를 중지한 뒤 VM, 부팅 디스크, 스냅샷, 고정 외부 IP와 이 서비스 전용 방화벽 규칙을 삭제합니다.
6. Cloud Billing 보고서와 Asset Inventory에서 남은 유료 리소스가 없는지 확인합니다. Firestore 데이터와 별도 Firebase 프로젝트의 삭제 여부는 백업 확인 후 결정합니다.

## 참고

- [sslip.io/nip.io 동작과 TLS 안내](https://nip.io/)
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Firebase Google 로그인과 사용자 지정 리디렉션 도메인](https://firebase.google.com/docs/auth/web/google-signin#customizing-the-redirect-domain-for-google-sign-in)
