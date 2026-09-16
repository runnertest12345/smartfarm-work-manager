# 팜로그 — 스마트팜 업무관리

프로젝트, 농가, 설치·시운전·교육, 구독·입금, 정산, 제출서류, 내부 업무와 처리 이력을 관리하는 비공개 업무 프로그램입니다.

**Next.js로 개발하지만 운영 화면은 정적 파일로 제공합니다.** 로그인·업무 데이터는 Firebase를 사용하고, 제한된 직원 계정 생성만 별도 Node.js 서비스가 처리합니다. `git clone`은 프로그램 소스만 복제합니다. 운영 데이터, 계정, 비밀번호, 서버 설정까지 복제하지 않습니다.

## 먼저 읽을 문서

| 목적 | 문서 |
| --- | --- |
| 어떤 기술·환경에서 동작하는지 이해 | [구조와 실행 환경](docs/deployment/architecture.md) |
| 새 PC/서버에서 복제·설정·실행·배포 | [새 서버 설치 가이드](docs/deployment/server-setup.md) |
| 업데이트·백업·복구·장애 대응 | [운영 가이드](docs/deployment/operations.md) |
| 기존 운영 서버 전용 GitHub Actions | [기존 GCE 배포 가이드](docs/gce-static-deployment.md) |
| 제한된 회원등록 서비스 설치 | [회원등록 서비스](deploy/gce/members/README.md) |
| 재현 검증 결과와 미검증 범위 | [2026-09-16 검증 기록](docs/deployment/validation-20260916.md) |
| 화면·버튼·집계 기준 | [화면 사용 설명서](docs/ui/README.md) |

## 실행 환경 요약

| 구분 | 사용 기술/버전 | 역할 |
| --- | --- | --- |
| 화면 프레임워크 | Next.js **16.3.4**, App Router | 개발 및 정적 사이트 빌드 |
| UI | React/React DOM **19.2.6** | 브라우저 화면·상태 관리 |
| 언어/스타일 | TypeScript **5.9.3**, Tailwind CSS **4.2.1** | 타입 검사·스타일 |
| UI 구성요소 | Base UI **1.7.0**, shadcn, Lucide, Recharts | 입력·팝업·아이콘·차트 |
| 브라우저 SDK | Firebase **12.18.0** | Authentication 및 Firestore |
| 패키지 도구 | pnpm **11.19.0** | 웹 의존성 고정 설치 |
| 빌드용 Node.js | **24.19.0 권장·검증 기준** | 개발 및 정적 빌드 |
| 운영 웹 서버 | Caddy + HTTPS | `out/` 정적 제공, 회원등록 경로 프록시 |
| 제한된 API | Node.js + Firebase Admin **14.4.0** | 허용된 운영자의 직원 계정 생성 |
| 등록 요청 저널 | Node.js 내장 SQLite | 중복 요청 방지·안전한 재시도 |

웹 소스의 최소 Node.js 조건은 `>=22.13.0`, 회원등록 서비스는 `>=22.18.0`입니다. 실제 운영 VM은 **Ubuntu 26.04.1 LTS x86_64 / Caddy 2.11.4 / 회원등록 Node.js 24.21.0**으로 확인되었습니다. 빌드 검증 환경과 서버 실행 버전은 구분합니다. Windows/macOS에서는 웹 개발·빌드가 가능하지만 Linux 서비스 설치 스크립트는 실행하지 않습니다.

## 빠른 시작

저장소 접근 권한과 권장 Node.js/pnpm을 먼저 준비합니다. 아래 명령은 저장소 최상위에서 실행합니다.

```bash
git clone https://github.com/runnertest12345/smartfarm-work-manager.git farmlog
cd farmlog
node scripts/setup.mjs
```

생성된 `.env.local`을 [설치 가이드](docs/deployment/server-setup.md)의 환경변수 표에 맞게 편집한 뒤:

```bash
pnpm install --frozen-lockfile
node scripts/check-environment.mjs
pnpm dev
```

개발 화면은 기본 `http://localhost:3000`입니다. **localhost라고 테스트 데이터가 되는 것은 아닙니다.** 실제 Firebase 프로젝트/작업공간을 지정하면 운영 데이터를 읽고 수정할 수 있습니다. 새 복제본에서 에뮬레이터용 설정으로 시작하려면 최초 `setup`에 `--demo`를 사용합니다. 기존 설정은 덮어쓰지 않습니다.

배포용 파일은 다음 순서로 만듭니다.

```bash
node scripts/check-environment.mjs --production
pnpm run build:release
```

결과물은 `out/`입니다. 공개 환경설정은 빌드 때 JavaScript에 고정됩니다. 도메인, Firebase 프로젝트, 작업공간을 바꾸면 다시 빌드해야 합니다. 이 명령 자체는 서버에 업로드하거나 Firestore 규칙을 변경하지 않습니다. 실제 서버 설치와 전환은 [새 서버 설치 가이드](docs/deployment/server-setup.md)를 따릅니다.

## 주요 기능

- 연도·프로젝트 유형·진행/보류/완료 상태별 프로젝트와 농가 현황
- 프로젝트 기본정보 수정, 내부 프로젝트, 농가·구독·설치·시운전·교육 관리
- 업무명 직접 수정, 계층형 하위 업무, 진행률·막힘 요약, 처리 기록
- 월간·주간·일간 업무 달력과 완료 포함 필터
- 회차별 청구·승인·받은 입금액 및 남은 금액 관리
- 직원·부서, 제한된 직원 계정 생성과 첫 비밀번호 변경

이 소스의 운영 기능 기준은 `manual-20260916-work-ui-836c517b9251`입니다. [기준 기록](docs/deployment/production-baseline.json)에 출처 해시가 있습니다. 이후 추가된 이식 도구·문서는 별도 개선이며, 미완성 전국 농장 지도는 이 기준 소스에 포함하지 않습니다.

## Git에 포함되지 않는 것

- `.env.local`, SSH 개인 키, 서비스 계정 자격 증명, 비밀번호 파생 비밀값
- Firestore 업무 데이터와 Firebase Authentication 계정
- 회원등록 SQLite 저널과 `/etc/farmlog-members/config.json`
- VM, DNS, TLS 인증서, IAM 권한, 방화벽, 시스템 서비스 상태
- 사용자 원본 Excel과 개인정보가 포함된 운영 자료

**같은 Firebase 프로젝트와 같은 작업공간을 연결하면 기존 운영 데이터를 함께 사용합니다.** 독립 운영/테스트 환경은 별도 Firebase 프로젝트, 계정 승인, 데이터 초기화/이관 절차가 필요합니다. 단순히 작업공간 이름만 바꾸거나 VM만 복제해서는 독립 환경이 완성되지 않습니다.

## 보안·비용

정적 파일과 Firebase 웹 설정은 브라우저에 공개되지만 업무 데이터는 로그인과 Firestore 보안 규칙으로 보호합니다. 회원등록 서비스의 권한은 계정 조회·생성으로 제한하며, 일반 직원의 관리자 승격·계정 삭제·임의 데이터 수정 권한을 주지 않습니다.

이 프로그램의 **무료 운영을 보장하지 않습니다.** VM·디스크·고정 외부 IP·트래픽·도메인·백업·Firebase 사용량은 선택한 요금제와 할당량에 따라 비용 또는 이용 제한이 발생할 수 있습니다. 기존 프로젝트의 과거 무료 요금제 상태를 새 환경의 조건으로 가정하지 마세요.

소스 동기화나 Git push는 운영 서버 배포가 아닙니다. 신규 서버 프로비저닝, IAM 변경, 데이터 이관, 서비스 재시작은 대상과 영향 범위를 확인하고 별도 실행합니다.
