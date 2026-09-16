# 구조와 실행 환경

이 문서는 저장소 소스와 배포 스크립트 기준의 기술 설명입니다. 현재 운영 기능 기준은 `manual-20260916-work-ui-836c517b9251`이며, 기준 해시는 [production-baseline.json](production-baseline.json)에 기록합니다. 도구·문서를 추가한 Git 커밋은 운영 기준 아카이브와 파일 전체 해시가 같지 않을 수 있습니다.

## 1. 전체 구성

```text
개발 PC / CI
  Next.js + React + TypeScript + Tailwind
         │ pnpm run build:release
         ▼
  out/ (HTML · CSS · JavaScript · release.json)
         │ 정적 릴리스 업로드
         ▼
  Caddy :443 ── 정적 화면 ──▶ 사용자 브라우저
         │                         ├─ 로그인 ─▶ Firebase Authentication
         │                         └─ 업무 조회/저장 ─▶ Cloud Firestore + Rules
         │
         └─ POST /api/admin/members
                   ▼
             127.0.0.1:8787
             제한된 Node.js 회원등록 서비스
                   ├─ 제한된 서비스 신원 ─▶ Firebase Auth 계정 조회·생성
                   ├─ 호출자 ID 토큰 ────▶ Firestore Rules 적용 조회·저장
                   └─ 로컬 SQLite 저널 + 비밀번호 파생 비밀값
```

이 구조에는 두 개의 서버 역할이 있지만 반드시 VM 두 대가 필요한 것은 아닙니다. 현재는 한 VM에서 Caddy와 loopback 전용 회원등록 서비스를 격리 실행합니다. 브라우저는 대부분의 업무 데이터를 Caddy나 회원등록 서버를 거치지 않고 Firebase SDK로 직접 접근합니다.

## 2. Next.js인데 운영에서 `next start`를 쓰지 않는 이유

[`next.config.ts`](../../next.config.ts)에 `output: 'export'`가 설정되어 있습니다. `next build`는 라우트의 HTML과 브라우저 자산을 `out/`으로 생성합니다. 개발할 때는 Next.js 개발 서버를 사용하지만 운영 화면은 Caddy가 파일로 제공합니다.

- 웹 화면 제공만 하는 서버에는 실행 중인 Next.js 프로세스가 필요하지 않습니다.
- 다른 PC/CI에서 빌드했다면 정적 서버에는 웹 빌드용 `node_modules`나 전체 Git 저장소도 필요하지 않습니다.
- 회원등록 API를 함께 운영하면 그 별도 서비스용 Node.js 런타임은 필요합니다.
- 이 API는 Next.js API route가 아닙니다. `server/members/index.mjs`가 `node:http`로 실행합니다.
- SSR, 요청별 Server Actions, 런타임 환경변수 변경을 전제로 한 배포 방식으로 바꾸려면 별도 설계가 필요합니다.

## 3. 버전과 지원 범위

| 계층 | 고정/검증 버전 | 근거와 주의사항 |
| --- | --- | --- |
| Next.js | 16.3.4 | 루트 `package.json`; App Router, 정적 export |
| React / React DOM | 19.2.6 | 화면 구성·이벤트·상태 |
| TypeScript | 5.9.3 | 정적 타입 검사; 운영 브라우저는 빌드된 JS 실행 |
| Tailwind CSS | 4.2.1 | `@tailwindcss/postcss` 포함 |
| Firebase 웹 SDK | 12.18.0 | Auth·Firestore 연결 |
| Firebase Admin | 14.4.0 | `server/members/package.json`; 서버 전용 |
| Firebase CLI | 15.29.0 | 규칙 검사·배포/로컬 에뮬레이터 도구 |
| pnpm | 11.19.0 | 루트 lockfile을 고정 설치 |
| 빌드용 Node.js | 24.19.0 권장/검증 기준 | 웹 engines >=22.13.0 |
| 현재 API Node.js | 24.21.0 | 서버 engines >=22.18.0; 선택 버전·checksum 함께 기록 |
| 현재 운영 OS / Caddy | Ubuntu 26.04.1 LTS x86_64 / 2.11.4 | 2026-09-16 운영 조회 결과 |
| SQLite | 선택한 Node 내장 버전 | `node:sqlite`, WAL 모드; 별도 DB 서버 아님 |

루트 웹 의존성은 `pnpm-lock.yaml`, 회원등록 서비스는 별도의 `package-lock.json`으로 고정합니다. 웹의 설치 도구를 npm으로 바꾸거나 회원등록 서비스에 루트 lockfile을 대신 사용하지 않습니다. 버전 상승은 lockfile 갱신과 회귀 테스트를 묶어 수행합니다.

웹 개발/빌드는 Node와 pnpm이 준비된 Windows, macOS, Linux에서 가능합니다. 현재 자동 VM 설치기는 apt, systemd, Linux x86_64, Python3, Bash를 전제로 합니다. ARM 서버, Windows Server, 컨테이너, 다른 배포판에 그대로 적용된다고 보장하지 않습니다.

## 4. 데이터와 인증의 경계

### Firebase Authentication

로그인 계정과 비밀번호 검증을 담당합니다. 직원 로그인 ID는 `lib/login-identity.ts`를 통해 `.invalid` 도메인의 내부 식별자로 변환됩니다. 이는 메일을 수신하는 주소가 아니며 임의로 도메인 규칙을 바꾸면 기존 직원 로그인이 깨질 수 있습니다.

### Cloud Firestore

프로젝트·농가·업무·처리 이력 등 업무 데이터와 사용자 승인 문서를 저장합니다. 사용자별 `appMembers/{uid}`의 활성화, 작업공간, 역할 및 비밀번호 변경 조건과 요청 데이터 검증은 `firestore.rules`가 통제합니다. 로그인 성공만으로 데이터 권한이 생기지 않습니다. `active: true` 필드 하나만 만들어 현재 앱의 회원 등록을 대체할 수 없습니다.

업무 데이터는 `workspaces/{workspaceId}/...` 아래에서 관리합니다. 작업공간이 다르면 조회 경로는 다르지만 Authentication 사용자와 일부 루트 구조는 동일 Firebase 프로젝트에 속합니다. 강한 테스트/회사 분리가 필요하면 프로젝트 단위 분리를 권장합니다.

### 제한된 회원등록 API

호출자의 Firebase ID 토큰·Origin·입력값·허용된 등록자 계정을 확인합니다. 현재 승인 등록자 정책은 앱/서비스/보안 규칙에 명시되어 있으므로 새 조직은 구성값만 바꿔 등록자가 자동 생성되거나 변경되지 않습니다. 새 UID로 전환할 때는 세 계층을 함께 검토하고 초기 계정을 승인해야 합니다.

서버의 서비스 신원은 Firebase Auth에서 `firebaseauth.users.get`, `firebaseauth.users.create`만 필요합니다. Firestore 관리 역할은 부여하지 않으며 DB 접근에는 호출자 토큰을 전달합니다. API에 `Owner`, `Editor`, 광범위한 Firebase Admin/Datastore 권한을 부여하는 방식으로 오류를 우회하지 않습니다.

## 5. 무엇이 어디에 저장되는가

| 대상 | 위치 | Git 포함 | 백업/이전 |
| --- | --- | --- | --- |
| 소스·문서·일반 템플릿 | 저장소 | 포함 | Git 커밋/태그 |
| 공개 Firebase 웹 설정 | 개발 `.env.local` 또는 빌드 환경 | 실제 값 제외 | 관리 설정 기록; 변경 시 재빌드 |
| 정적 화면 | `/srv/smartfarm-work-manager/releases/<id>/` | 결과물 제외 | 릴리스 아카이브·해시 |
| 현재 웹 릴리스 | `/srv/smartfarm-work-manager/current` 링크 | 제외 | 이전 링크 대상 기록 |
| 로그인 계정 | Firebase Authentication | 제외 | 별도 계정 이관 정책 |
| 업무·승인 데이터 | Cloud Firestore | 제외 | 별도 데이터 백업·복원 검증 |
| 회원등록 코드/런타임 | `/opt/farmlog-members/releases/`, `runtimes/` | 소스만 | 승인된 설치 번들 |
| API 설정·비밀번호 파생 secret | `/etc/farmlog-members/config.json` | 절대 제외 | 암호화된 제한 접근 백업 |
| 등록 요청 저널 | `/var/lib/farmlog-members/registrations.sqlite` | 절대 제외 | 위 설정과 동일 시점 보존 |
| DNS·방화벽·IAM·서비스 신원 | 클라우드/OS 설정 | 템플릿만 | 실제 적용 내역 별도 기록 |

**SQLite는 업무 데이터의 로컬 사본이 아닙니다.** 계정 생성 요청의 중복·충돌과 재시도를 관리하는 저널입니다. 비밀번호 파생 secret과 함께 보존해야 이미 진행 중인 요청을 안전하게 재시도할 수 있습니다. 저널만 복사하거나 코드 롤백 시 secret을 재생성하면 안 됩니다.

## 6. 환경변수와 비밀정보

`NEXT_PUBLIC_*`는 빌드 후 브라우저에서 볼 수 있습니다. Firebase 웹 apiKey는 클라이언트 식별 설정이지만 관리 자격 증명이 아닙니다. 실제 보안은 Auth·Rules·API 제한으로 구성합니다. 이 접두사의 변수에 서비스 계정 JSON, SSH 키, 토큰, 비밀번호 파생 secret을 넣지 않습니다.

`out/`을 그대로 다른 서버로 복사하면 원래 Firebase 프로젝트와 작업공간에 계속 연결됩니다. 새 서버의 환경변수 파일만 수정해도 이미 빌드한 브라우저 코드의 대상은 바뀌지 않습니다. 환경을 바꾸려면 다시 빌드하고 릴리스 메타데이터를 확인합니다.

## 7. 운영 기반과 비용

저장소에는 VM 자체, Cloud Firestore 서비스, Auth 계정, 도메인과 TLS 인증서가 들어 있지 않습니다. 완전한 오프라인 프로그램도 아닙니다. 정상 사용에는 Firebase와 필요한 HTTPS 외부 연결이 필요합니다.

라이브러리 사용과 인프라 운영 비용은 구분합니다. VM/디스크/외부 IP/네트워크/백업/도메인과 Firebase 요금제에는 비용 또는 사용량 제한이 있을 수 있습니다. 무료 크레딧이나 과거 Spark 설정은 영구 무료 보장이 아닙니다. 예산·할당량과 운영 중단 가능성을 각 환경에서 확인합니다.

## 8. 소스 근거

- [`package.json`](../../package.json), [`pnpm-lock.yaml`](../../pnpm-lock.yaml): 웹 버전 및 스크립트
- [`next.config.ts`](../../next.config.ts): 정적 export
- [`lib/firebase/client.ts`](../../lib/firebase/client.ts): 브라우저 Auth/Firestore 설정과 에뮬레이터 연결
- [`server/members`](../../server/members): 제한된 API·저널·서버 의존성
- [`firestore.rules`](../../firestore.rules): 데이터 접근·저장 조건
- [`deploy/gce`](../../deploy/gce): Caddy·릴리스 승격·서비스 설치

Next.js 동작의 추가 근거는 설치된 `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` 및 `environment-variables.md`입니다. 프레임워크 업그레이드 시 해당 버전의 문서를 다시 확인합니다.
