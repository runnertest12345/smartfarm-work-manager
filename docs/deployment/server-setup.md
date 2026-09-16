# 새 PC·서버 설치 가이드

목표는 **소스 복제 → 명시적 환경설정 → 검증 → 정적 빌드 → 서버 설치/전환**을 재현하는 것입니다. 이 문서에 절차가 있다고 해서 새 VM 생성, IAM 부여, 데이터 이관이나 운영 서비스 재시작이 이미 수행된 것은 아닙니다. 그런 작업은 대상과 승인된 영향 범위를 확인한 운영자가 실행합니다.

## 1. 설치 전에 결정할 것

| 목적 | Firebase / 작업공간 | 결과와 별도 준비 |
| --- | --- | --- |
| 기존 업무를 새 주소에서도 사용 | 기존 프로젝트 + 기존 작업공간 | 같은 운영 데이터를 공유. 새 도메인 허용·HTTPS·API origin 설정 필요 |
| 현재 서버를 다른 서버로 이전 | 기존 프로젝트 + 기존 작업공간 | 데이터 DB는 그대로. API 저널+secret, 신원·권한, DNS 전환은 별도 이전 |
| 독립 테스트/다른 회사용 | 별도 Firebase 프로젝트 권장 | Auth 계정·초기 관리자·부서·작업공간·Rules·인덱스 준비/이관 필요 |
| 인터넷 데이터 없이 로컬 검증 | `demo-farmlog` + Emulator Suite | 별도 에뮬레이터 실행과 테스트 데이터 필요. 운영용 빌드 금지 |

다른 서버에 같은 소스를 설치한다고 회사별 데이터가 자동 분리되지 않습니다. 같은 프로젝트의 작업공간만 바꿔도 사용자 승인 문서와 API 등록자 정책이 자동 이전되지 않습니다. 특히 현재 제한된 회원등록은 기존 승인 등록자 UID 정책을 유지하므로 **독립 Firebase 프로젝트를 완전 자동 개통하는 도구는 아닙니다.**

## 2. 필요한 환경

### 개발·빌드 PC

- 저장소를 읽을 수 있는 Git 접근 권한
- Node.js **24.19.0** 및 pnpm **11.19.0** 권장
- Git, 외부 npm registry 다운로드가 가능한 네트워크
- `pnpm-lock.yaml` 포함한 검증된 커밋

공식 배포 파일 또는 조직이 승인한 도구로 Node.js를 설치하고 서명/checksum을 확인합니다. pnpm은 선택한 Node 환경에서 정확한 버전을 설치합니다.

```bash
node --version
npm install --global pnpm@11.19.0
pnpm --version
git --version
```

Node 설치를 시스템 관리 도구가 담당하는 PC에서는 해당 관리 정책을 우선합니다. 비관리자 터미널에서 전역 설치 권한이 없으면 조직의 사용자 전용 Node 환경을 사용합니다. 임의 원격 셸 스크립트를 다운로드 즉시 실행하는 설치는 사용하지 않습니다.

### 정적 운영 서버

현재 자동화 기준은 **Ubuntu Linux / x86_64 / systemd / apt**입니다. 실제 운영 기준은 Ubuntu 26.04.1 LTS와 Caddy 2.11.4입니다. 새 서버에서 같은 조합을 사용하면 차이를 줄일 수 있습니다. CPU/메모리/디스크 용량은 이용량·빌드 위치·로그·백업 보존량에 따라 정하고, 최소 사양을 성능 보장처럼 해석하지 않습니다.

외부에서 필요한 포트는 HTTP 80, HTTPS 443입니다. SSH 22는 관리망 또는 승인된 배포 경로로 제한합니다. 회원등록 **8787**, 로컬 개발 **3000**, 에뮬레이터 포트는 인터넷에 개방하지 않습니다. DNS, 인증서 발급/갱신 및 Firebase API에 필요한 외부 연결도 허용되어야 합니다.

## 3. Git 복제와 초기 설정

```bash
git clone https://github.com/runnertest12345/smartfarm-work-manager.git farmlog
cd farmlog
git status --short
git rev-parse HEAD
node scripts/setup.mjs
```

`setup.mjs`는 `.env.example` 기준의 로컬 설정 파일을 준비합니다. 기존 `.env.local`은 덮어쓰지 않습니다. 계정·DB·VM·권한을 만들거나 원격에 배포하지 않습니다. 새 복제본에서 데모를 선택하려면 아래 명령을 대신 사용합니다.

```bash
node scripts/setup.mjs --demo
```

데모 설정도 Emulator Suite를 자동 실행하거나 실제 계정을 만들어 주지는 않습니다. 기존 설정이 있는 디렉터리에서 `--demo`를 실행했다고 안전하게 테스트 대상으로 바뀌었다고 가정하지 마세요. 출력과 설정을 직접 확인합니다.

### `.env.local` 설정표

| 변수 | 값의 출처/예시 | 주의 |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 웹 앱의 `apiKey` | 브라우저용 공개 식별자; Admin 키가 아님 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<프로젝트ID>.firebaseapp.com` | 현재 검사기는 기본 Firebase Auth 도메인 사용을 요구 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 실제 연결할 Firebase 프로젝트 ID | GCE VM 프로젝트와 다를 수 있음 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 같은 웹 앱의 `storageBucket` | 같은 Firebase 설정 묶음을 사용 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 같은 웹 앱의 `messagingSenderId` | appId와 일치해야 함 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 같은 웹 앱의 `appId` | 프로젝트에서 등록한 웹 앱 |
| `NEXT_PUBLIC_FIREBASE_WORKSPACE_ID` | 승인된 작업공간 ID | 누락값을 기존 운영 공간으로 자동 대체하지 않음 |
| `NEXT_PUBLIC_SITE_URL` | `https://업무.소유도메인` | 경로 없는 실제 사이트 origin; 개발은 localhost |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | 운영 `false`, 데모 `true` | true인 빌드는 운영 릴리스 도구에서 거부 |

Firebase Console의 같은 웹 앱에서 설정 전체를 복사합니다. 서로 다른 프로젝트의 일부 값만 섞지 않습니다. `.env.local`은 Git에 올리지 않습니다. 공개 접두사의 값에는 비밀번호, 서비스 계정 JSON, SSH 개인 키, 액세스 토큰을 절대 넣지 않습니다.

설정은 운영체제 환경변수가 파일보다 우선합니다. 개발 및 운영에 따라 `.env.development*` / `.env.production*`이 적용되며, 운영 검사/빌드는 대체로 **프로세스 환경 → `.env.production.local` → `.env.local` → `.env.production` → `.env`** 순서입니다. 기존 셸이나 CI 변수에 운영 프로젝트 값이 남아 있으면 `.env.local`만 바꿔도 연결 대상이 바뀌지 않을 수 있습니다.

## 4. 설치·개발·검증

```bash
pnpm install --frozen-lockfile
node scripts/check-environment.mjs
pnpm dev
```

기본 개발 주소는 `http://localhost:3000`입니다. Firebase 설정을 읽는 검사는 의존성의 Next 환경 로더를 사용하므로 **설치 후 검사** 순서를 지킵니다. 브라우저에서 접속이 안 되면 터미널에 표시된 실제 포트와 방화벽을 확인합니다.

에뮬레이터 사용 시 별도 터미널에서 다음을 실행합니다. Firebase CLI가 요구하는 Java 런타임 등 에뮬레이터 의존성도 준비해야 합니다.

```bash
pnpm firebase:emulators
```

`firebase.json` 기준 Auth는 9099, Firestore는 8080, Hosting은 5000, 관리 UI는 4000입니다. `demo-farmlog`와 `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`가 모두 맞는지 확인합니다. Hosting 에뮬레이터로 화면을 제공해도 **이미 빌드된 SDK 연결 대상이 자동으로 에뮬레이터로 바뀌지는 않습니다.**

오프라인 소스 회귀 테스트와 빌드 전 기본 점검:

```bash
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm run test:release
node scripts/test-portable-setup.mjs
```

Firebase 규칙 API를 호출하는 별도 테스트/배포 스크립트는 위 로컬 테스트와 구분합니다. 대상 프로젝트·권한·비용·데이터 영향 여부를 확인한 뒤 실행합니다.

일반 `pnpm build`도 Next의 빌드 환경에 맞춰 `.env.production*` 설정을 읽지만 데모 빌드는 허용합니다. 따라서 일반 build 성공을 운영용 설정 검증 완료로 해석하지 않습니다. 실제 배포에는 데모/에뮬레이터 설정을 거부하고 메타데이터를 생성하는 `pnpm run build:release`를 사용합니다.

## 5. 배포용 빌드 만들기

`.env.local`이나 CI 공개 변수에 실제 **새 운영 주소**와 의도한 Firebase/작업공간을 지정합니다.

```bash
node scripts/check-environment.mjs --production
pnpm run build:release
```

명시적인 릴리스 ID를 쓰려면:

```bash
node scripts/build-release.mjs --release portable-20260916-01
```

이 도구는 운영 설정 검사 후 Next 정적 빌드를 실행하고 `out/release.json`을 생성합니다. 업로드·압축·VM 생성·Firebase 규칙 배포는 수행하지 않습니다. `out/index.html`, `out/_next/static/`, `out/release.json`이 있는지 확인합니다. 배포 대상 서버 승격기는 릴리스 ID를 64자 이내로 제한하므로 그 범위를 사용합니다.

`release.json`에는 `release`, `gitSha`, `sourceDirty`, `builtAt`, `runtime`, `target`, `staticFiles`, `staticSha256`이 기록됩니다. `target`은 Firebase 프로젝트 ID, workspace ID, 사이트 주소와 에뮬레이터 사용 여부를 포함하지만 API 키·비밀값은 기록하지 않습니다. `staticSha256`은 파일 목록/내용 해시를 합산한 값이며 압축 아카이브 SHA-256과는 다른 값입니다. 두 값을 혼동하지 않고 별도로 기록합니다.

유효한 Git HEAD가 있어야 빌드됩니다. 미커밋 변경은 자동 삭제하거나 차단하지 않고 `sourceDirty: true`로 기록합니다. 실제 운영 배포는 검토/커밋한 clean 복제본에서 만드는 것을 원칙으로 합니다. 정적 출력에서 링크/junction, 자격 증명 파일·개인 키, source map 등을 발견하면 실패하므로 원인을 해결한 뒤 재빌드합니다. 검사기가 모든 비밀정보를 완벽하게 탐지하는 것은 아니므로 `public/`에는 공개 가능한 파일만 넣습니다.

환경 검사가 `NODE_ENV` 충돌을 보고하면 현재 셸/CI의 `development` 또는 `test` 강제 설정을 제거한 뒤 운영용 명령을 다시 실행합니다. `--demo` 설정으로는 `build:release`가 운영 릴리스를 만들지 않습니다.

**같은 커밋이라도 빌드 설정이 다르면 연결 데이터가 달라집니다.** 새 주소로 빌드한 결과를 기존 운영 서버에 실수로 올리지 않도록 서버/릴리스 매핑을 기록합니다.

## 6. Firebase 쪽 최초 준비

기존 Firebase를 계속 쓰는 서버 이전이라면 기존 데이터와 Rules를 초기화하지 않습니다. 새 호스트 허용과 API 신원 구성을 검토합니다. 별도 프로젝트일 때만 신규 환경으로 다음 항목을 준비합니다.

1. 소유권이 있는 Firebase 프로젝트와 웹 앱을 만듭니다. 데이터 위치·요금제·할당량·백업 정책을 결정합니다.
2. Firestore 데이터베이스와 Authentication 로그인 공급자를 준비합니다. 기존 설정의 지원 이메일은 새 조직 설정에 맞게 검토합니다.
3. 웹 설정, 작업공간, 초기 부서, 초기 승인 계정과 등록자 정책을 설계합니다. 운영 사용자/UID를 임의로 재사용하거나 관리자 권한을 일괄 부여하지 않습니다.
4. 새 도메인을 Authentication **Authorized domains**에 등록합니다. `https://`와 경로 없이 호스트만 입력합니다.
5. 대상이 명확한 검토된 배포로 Rules와 인덱스를 설치합니다. 예시의 프로젝트 ID를 실제 **신규 대상**으로 바꾼 뒤 확인합니다.

```bash
pnpm exec firebase login
pnpm exec firebase deploy --project NEW_FIREBASE_PROJECT_ID --only firestore:rules,firestore:indexes
```

Auth 공급자 설정은 별도 승인 후 Console 또는 검토된 명령으로 구성합니다. 기존 `firebase.json`의 조직 이름/지원 이메일을 그대로 신규 회사에 배포하지 않습니다. 프로젝트를 생략한 `firebase deploy`나 무조건적인 전체 `firebase:deploy`는 사용하지 않습니다.

Firestore 백업을 복원해도 Auth 사용자와 계정 비밀번호가 자동 복원되는 것은 아닙니다. UID 참조와 회원 승인 문서의 일치 여부까지 검증해야 합니다. 이 저장소의 setup은 업무 데이터 자동 이관 도구가 아닙니다.

## 7. 새 정적 서버와 HTTPS

1. 서버와 DNS를 준비합니다. 소유 도메인의 A/AAAA 레코드가 실제 서버를 가리키게 합니다. 잘못된 IPv6 레코드도 인증서 발급에 영향을 줄 수 있으므로 확인합니다.
2. TCP 80/443을 허용하고 SSH는 제한합니다. 포트 8787/3000/에뮬레이터는 외부 개방하지 않습니다.
3. 관리자가 검토한 `deploy/gce`의 네 파일을 서버의 신뢰할 수 있는 관리 경로에 복사합니다.

```text
bootstrap-ubuntu.sh
Caddyfile
caddy.service.conf
promote-release.sh
```

4. **새 서버 최초 설치 시에만**, 관리자가 해당 디렉터리에서 실행합니다.

```bash
sudo bash bootstrap-ubuntu.sh work.example.com admin@example.com
```

위 예시 호스트/메일은 실제 소유 값으로 바꿉니다. 이 스크립트는 apt 패키지를 설치하고 Caddy 구성/서비스를 변경·재시작합니다. 기존 서비스가 있는 서버에 그대로 재실행하면 설정을 바꿀 수 있으므로 일상 업데이트 수단으로 쓰지 않습니다.

5. 전용 `smartfarm-deploy` 계정에 배포 전용 SSH 공개 키를 제한 옵션으로 등록합니다. sudo 권한은 주지 않습니다. 신뢰할 수 있는 경로에서 서버 SSH 호스트 키 지문을 확인해 `known_hosts`를 준비합니다. 자세한 제한 옵션은 [GCE 가이드](../gce-static-deployment.md)를 참고합니다.
6. 검증된 `out/`만 압축하고 SHA-256을 기록합니다. `.env*`, 소스 개인정보, 키, `node_modules`를 포함하지 않습니다.

Linux/WSL 배포 터미널 예시:

```bash
tar -czf site-portable-20260916-01.tar.gz -C out .
sha256sum site-portable-20260916-01.tar.gz
scp -o StrictHostKeyChecking=yes site-portable-20260916-01.tar.gz smartfarm-deploy@work.example.com:/srv/smartfarm-work-manager/incoming/
ssh -o StrictHostKeyChecking=yes smartfarm-deploy@work.example.com 'sha256sum /srv/smartfarm-work-manager/incoming/site-portable-20260916-01.tar.gz'
```

로컬과 원격 checksum이 일치하고 대상이 맞는 것을 확인한 후 승격합니다.

```bash
ssh -o StrictHostKeyChecking=yes smartfarm-deploy@work.example.com '/usr/local/bin/promote-smartfarm-release /srv/smartfarm-work-manager/incoming/site-portable-20260916-01.tar.gz portable-20260916-01'
```

승격기는 압축 경로/형식/용량을 검사하고 `current` 링크를 원자적으로 바꿉니다. 기존 릴리스는 최대 보존 정책에 따라 정리되므로 장기 복구용 아카이브는 따로 보관합니다. 정적 사이트 릴리스 전환 자체에 VM 재시작은 필요하지 않습니다.

## 8. 회원등록 서비스까지 동일하게 사용하기

정적 화면과 기존 로그인/업무 조회만 확인되더라도 **새 직원 생성 API까지 설치된 것은 아닙니다.** [`deploy/gce/members/README.md`](../../deploy/gce/members/README.md)의 검토된 설치 절차를 이어서 수행합니다.

- 설정 입력은 root가 검토한 `/etc/farmlog-members/install-input.json`의 `project`, `workspace`, `origin`입니다. origin은 경로·쿼리·끝 slash가 없는 단일 HTTPS 주소입니다.
- 서비스는 `127.0.0.1:8787`, Caddy는 정확히 `/api/admin/members`만 프록시합니다. `/_health`는 외부에 노출하지 않습니다.
- API 실행 계정은 잠긴 비로그인 사용자 `farmlog-members`, 코드/런타임은 root 소유입니다.
- 서비스 신원은 Auth 사용자 조회·생성만 허용합니다. Firestore 작업은 호출자 토큰과 Rules를 거칩니다.
- GCE 부착 서비스 신원을 사용하면 **신원을 부착하기 전에** metadata guard를 설치·검증합니다. 배포 계정/일반 프로세스가 메타데이터에서 자격 증명을 가져가면 안 됩니다.
- VM 프로젝트와 Firebase 프로젝트가 다르면 각각의 Identity Toolkit API 및 대상 프로젝트의 최소 IAM을 검토합니다. 넓은 기본 서비스 계정 권한으로 우회하지 않습니다.
- 비-GCE 환경의 신원 연동은 별도 설계가 필요합니다. 현재 설치기는 서비스 계정 JSON 키를 저장하거나 `GOOGLE_APPLICATION_CREDENTIALS`로 우회하는 구조를 제공하지 않습니다.
- 새 독립 설치의 secret은 서버에서 처음 한 번만 생성합니다. **기존 서비스 이전은 원래 journal+secret을 함께 복원**해야 하며 초기화를 통해 대체하지 않습니다.
- 최초 Caddy API route 활성화는 Caddy 재시작을 수반할 수 있습니다. 잠깐의 중단을 사전 안내합니다. 일반 정적 화면 업데이트와 구분합니다.

같은 Firebase 계정 생성 대상으로 회원등록 서버를 두 대 동시에 운영하면 각자의 로컬 저널 사이에 조정이 없습니다. 현재 구현은 공유 저널/다중 활성 API 구성이 아닙니다. 이전할 때 새 API 쓰기는 대기시키고 기존 API를 중지한 다음 일관된 상태를 옮겨 **하나만 활성화**합니다.

## 9. 최종 검수

- HTTPS 인증서가 정상이고 HTTP가 의도대로 전환되는가?
- `/release.json`이 업로드한 릴리스 ID와 연결 대상을 가리키는가?
- 승인 계정은 의도한 프로젝트/농가 수를 읽고 미승인 계정은 차단되는가?
- 날짜·월간/주간/일간 달력·업무 계층·정산이 정상 표시되는가?
- 개발 주소나 데모 Firebase 설정이 운영 번들에 남아 있지 않은가?
- API는 외부 8787로 접근 불가하고 비인증 요청을 거부하는가?
- API 등록자는 정확한 허용 계정만인가? 직원 생성은 별도 승인된 테스트 계정이 있을 때만 검증하는가?
- 코드, Rules, DB, Auth, API 저널/secret의 백업/복구 기록이 있는가?

새 환경의 실데이터 저장·계정 생성 테스트를 자동으로 실행하지 않습니다. 승인된 테스트용 대상이 없으면 읽기·인증 거부·가상 테스트까지만 확인하고 검증하지 못한 부분을 기록합니다.
