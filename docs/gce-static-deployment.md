# Compute Engine 3개월 정적 배포

이 구성은 Next.js의 `out/`만 Google Compute Engine VM으로 전송합니다. 비공개 GitHub 저장소의 읽기 키나 Firebase 관리 자격 증명은 VM에 저장하지 않습니다.

```text
GitHub Actions (수동 실행)
  → Next.js 정적 빌드
  → 비밀정보가 없는 빌드 작업에서 서명값과 함께 artifact 생성
  → main 전용 별도 배포 작업이 SSH로 압축본만 VM에 전송
  → Caddy가 무중단으로 새 릴리스 전환
  → 무료 임시 호스트 + 자동 HTTPS
```

## 1. 임시 호스트 정하기

별도 도메인을 구입하지 않을 때는 VM의 외부 IPv4 주소를 `sslip.io`에 붙여 사용할 수 있습니다.

```text
외부 IP: 34.64.62.115
임시 호스트: 34-64-62-115.sslip.io
서비스 주소: https://34-64-62-115.sslip.io
```

위 값은 현재 배포 대상의 기본 예시입니다. VM의 외부 IP가 다르면 `IP의 점을 하이픈으로 바꾼 값.sslip.io` 형식으로 바꿉니다. 임시 외부 IP는 VM 중지·재시작 때 바뀔 수 있으므로 운영을 시작하기 전에 3개월 동안 유지할 고정 외부 IPv4로 승격합니다. 외부 IPv4에는 사용 요금이 발생할 수 있으므로 예산 알림도 함께 설정합니다.

`sslip.io`는 구매나 가입이 필요 없는 외부 DNS 서비스이지만 가용성 보장이 없습니다. 3개월 한시 사용 주소로만 쓰고, 소유권 확인이 필요한 Google OAuth 리디렉션 도메인으로 등록하지 않습니다. Firebase 웹 앱의 기존 `authDomain`은 그대로 두고 이 호스트는 앱 접속 주소와 Firebase Authorized domains 항목으로만 사용합니다.

Google Cloud 방화벽에서 TCP 80과 443을 허용해야 Caddy가 TLS 인증서를 발급하고 갱신할 수 있습니다.

## 2. VM 최초 준비

Ubuntu 26.04 VM에 이 디렉터리의 네 파일을 복사합니다.

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

GitHub Free 개인계정의 비공개 저장소에서는 Environment secrets와 required reviewer를 사용할 수 없습니다. 이 무료 구성은 워크플로 자체에서 `main` 이외의 ref를 거부하고, 빌드와 배포 작업을 분리하며, SSH secret을 단일 배포 단계에서만 읽습니다. 저장소의 write/admin 권한은 신뢰할 수 있는 운영자에게만 부여합니다. 나중에 GitHub Pro로 전환하거나 저장소를 공개할 경우 `production` Environment의 main 전용 deployment branch와 required reviewer를 추가할 수 있습니다.

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

Firebase 웹 구성값은 브라우저에 포함되는 공개 식별자이지만, 저장소에 특정 프로젝트를 고정하지 않도록 배포 설정으로 주입합니다. 서비스 계정 JSON이나 Firebase Admin 키는 필요하지 않습니다.

운영 데이터 작업공간은 검증된 스냅샷과 함께 워크플로에 `sheet-20260903-579dfadc`로 고정되어 있습니다. 다음 데이터 이관으로 작업공간을 바꿀 때는 새 작업공간 검증 후 워크플로와 앱 기본값을 함께 갱신합니다.

## 5. Firebase 로그인 허용

Firebase Console의 **Authentication → Settings → Authorized domains**에 `VM_SITE_HOST` 값만 추가합니다. 프로토콜(`https://`)과 경로는 넣지 않습니다.

이 저장소의 Firestore 규칙과 승인 사용자 문서(`appMembers/{uid}`) 설정은 별도로 완료되어 있어야 합니다. VM은 화면만 제공하며 Firestore 보안을 대신하지 않습니다.

## 6. 배포와 확인

GitHub의 `main` 브랜치에서 **Actions → Deploy static site to Compute Engine → Run workflow**를 실행합니다. 비밀정보가 없는 빌드 작업이 정적 artifact와 SHA-256을 만들고, 별도 배포 작업의 SSH 단계만 키를 읽어 배포합니다. 서버는 압축 파일의 항목을 모두 사전 검사한 후 `/srv/smartfarm-work-manager/current`를 새 릴리스로 원자적으로 전환합니다.

성공 후 다음 항목을 확인합니다.

- `https://VM_SITE_HOST`에서 인증서 경고 없이 화면이 열림
- 승인되지 않은 Google 계정은 데이터 접근이 거부됨
- 승인된 계정은 로그인 후 사업·농가 데이터를 읽고 저장할 수 있음
- 모바일과 PC에서 로그아웃 후 다시 로그인할 수 있음

릴리스는 `/srv/smartfarm-work-manager/releases` 아래에 최근 5개까지 보존됩니다. 서버는 압축본 64 MiB, 해제 후 256 MiB, 항목 20,000개를 상한으로 두고 일반 파일과 디렉터리만 허용합니다. 문제가 생기면 보존된 이전 릴리스 경로를 `current` 심볼릭 링크로 다시 지정해 즉시 되돌릴 수 있습니다.

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
