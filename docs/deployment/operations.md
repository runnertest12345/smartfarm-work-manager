# 운영·업데이트·백업·복구 가이드

이 문서는 이미 설치한 환경의 운영 절차입니다. 처음 설치하는 경우 [새 서버 설치](server-setup.md)를 먼저 읽습니다. 명령의 호스트·프로젝트·릴리스는 예시이며 실제 대상과 일치하는지 확인한 뒤 실행합니다. 현재 소스 동기화 작업은 신규 서버를 만들거나 기존 운영 VM/API를 재시작하지 않습니다.

## 1. 배포 단위를 나누어 관리하기

| 변경 단위 | 배포 대상 | 함께 확인할 것 | 자동으로 따라 바뀌지 않는 것 |
| --- | --- | --- | --- |
| 화면/계산/UI | Caddy `out/` 릴리스 | 공개 Firebase 설정·커밋·릴리스 해시 | Rules, DB, Auth, 회원 API |
| 데이터 보안 규칙 | Firebase Rules release | 운영 대상·회귀 테스트·이전 ruleset | 화면, 실제 업무 데이터 |
| Firestore 인덱스 | Firebase 프로젝트 | 쿼리와 구축 완료 여부 | 기존 문서 내용 |
| 직원등록 API | `/opt/farmlog-members/current` | 실행 Node·최소 IAM·Origin·저널 호환성 | 웹 화면, 등록자 정책 변경 승인 |
| 업무 데이터 이관 | Firestore 데이터 | 백업·ID 참조·쓰기 중지·복원 검증 | Auth 사용자/비밀번호 |
| 로그인 계정 이전 | Firebase Authentication | UID·승인 문서·세션 정책 | Firestore 업무 문서 |
| 서버 이전 | OS/DNS/HTTPS/API 상태 | 저널+secret·신원·방화벽·전환 순서 | Firebase 데이터 자동 복제 |

문제를 수정할 때 필요한 단위만 배포합니다. 예를 들어 Rules 평가 한도 오류를 고쳤다고 미완성 화면 기능이나 데이터 이관까지 함께 실행하지 않습니다. 소스 push는 위 단위들의 배포와 별개입니다.

## 2. 일상 확인

운영자가 승인된 관리 경로에서 수행하는 읽기 전용 예시입니다.

```bash
curl --fail --silent --show-error https://work.example.com/release.json
systemctl is-active caddy
systemctl is-active farmlog-members
systemctl is-active farmlog-metadata-guard
curl --fail --silent --show-error http://127.0.0.1:8787/_health
readlink -f /srv/smartfarm-work-manager/current
readlink -f /opt/farmlog-members/current
```

첫 HTTPS curl을 제외한 나머지 명령은 해당 서버에서 실행합니다. `/_health`는 loopback 전용이며 외부 Caddy route로 추가하지 않습니다. 정적 파일 응답 성공과 업무 데이터 권한 정상 여부, 계정 생성 서비스 정상 여부는 각각 다른 검증입니다.

로그는 필요한 시간 범위만 확인합니다. 원문에 토큰·개인정보·계정 초기 비밀번호가 없는지 먼저 확인하고 채팅/이슈에 전체 로그를 붙이지 않습니다.

```bash
journalctl -u caddy --since '30 minutes ago' --no-pager
journalctl -u farmlog-members --since '30 minutes ago' --no-pager
```

디스크 사용량, 인증서 갱신 실패, HTTP 5xx, API 401/403/409 증가, Firebase 할당량/오류, 백업 성공 및 복구 훈련일을 모니터링합니다. 단순히 사이트가 뜬다는 것만으로 계정 등록이나 업무 저장이 정상이라고 단정하지 않습니다.

## 3. 웹 화면 업데이트

1. 배포할 커밋과 연결할 Firebase/작업공간/호스트를 결정합니다.
2. 깨끗한 별도 작업 복제본 또는 CI에서 고정 의존성을 설치합니다. 개발자의 미완성/개인정보 파일을 릴리스에 섞지 않습니다.
3. lint, 타입 검사, 회귀 테스트, 운영 설정 검사를 통과시킵니다.
4. `pnpm run build:release`로 `out/`을 만들고 메타데이터를 확인합니다.
5. `out/`만 압축하고 로컬/업로드 후 SHA-256을 비교합니다.
6. 대상 서버에서 릴리스 승격기를 실행합니다. `current` 이전 대상은 기록합니다.
7. HTTPS `/release.json`, 로그인/접근 차단, 주요 화면을 확인합니다.

```bash
git rev-parse HEAD
git status --short
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm run test:release
node scripts/check-environment.mjs --production
pnpm run build:release
```

실데이터 쓰기 검증은 승인된 테스트 대상에 한정합니다. 사용자의 열려 있는 입력창을 임의로 저장하거나 중복 테스트 업무/직원을 만들지 않습니다. 테스트하지 못한 쓰기 경로는 배포 기록에 남깁니다.

브라우저는 기존 JavaScript를 실행 중일 수 있으므로 사용자가 작업 내용을 저장한 뒤 새로고침하도록 안내합니다. 저장되지 않은 입력이 있을 때 강제로 새로고침하지 않습니다.

## 4. Rules와 API 업데이트

### Firestore Rules

- 현재 운영 ruleset과 소스 해시를 읽어 기록합니다.
- 원하는 변경만 있는 후보를 만들고 기존 보안 조건·권한이 유지되는지 검토합니다.
- 정상 허용뿐 아니라 무권한·다른 작업공간·잘못된 금액/계층 요청의 거부를 테스트합니다.
- 배포 직전에 현재 운영 ruleset이 검토 시점과 같은지 다시 확인합니다. 다르면 다른 배포와 충돌할 수 있으므로 중지합니다.
- 명시한 프로젝트에 필요한 규칙만 반영하고 배포 후 live ruleset/해시와 재현 사례를 확인합니다.

불특정 `firebase deploy`나 작업 중인 전체 규칙 파일을 검토 없이 운영에 덮어쓰지 않습니다. Rules 롤백은 이전 규칙으로 돌아가는 것이지 이미 저장된 데이터를 되돌리는 작업은 아닙니다.

### 회원등록 서비스

[`회원등록 설치 문서`](../../deploy/gce/members/README.md)의 exact 파일 allowlist, checksum 및 root-owned 설치 템플릿 검증을 유지합니다. 앱 패키지에 `.env`, 서비스 계정 JSON, 임의 root 스크립트 또는 secret을 넣지 않습니다. npm 의존성 설치는 비권한 계정으로 lifecycle scripts를 비활성화한 상태에서 수행합니다.

회원등록 코드 롤백/업데이트 시 기존 `config.json`, SQLite 저널을 유지합니다. 최초 설치 파일인 `install-input.json`을 바꿔 운영 대상을 몰래 전환하지 않습니다. 기존 설정과 불일치하면 설치기가 거부하는 것이 정상입니다. 프로젝트/작업공간/Origin 변경은 별도 이전 계획과 검증이 필요합니다.

## 5. 백업 대상

| 대상 | 필요한 보존물 | 유의사항 |
| --- | --- | --- |
| 소스 | Git 커밋/태그·lockfile·설치 문서 | 소스만으로 데이터 복구 불가 |
| 웹 배포 | out 압축본·SHA-256·release.json·빌드 설정 대상 | 서버의 최근 5개 보존 정책과 별도 장기 보존 |
| 보안 규칙 | 승인된 소스·해시·live ruleset ID | DB 데이터와 별개 |
| Firestore | 업무 컬렉션·appMembers·부서/설정·참조 ID | 선택한 요금제에서 가능한 방식 확인, 개인정보 보호 |
| Auth | 계정/UID 및 승인된 복구·이관 방식 | Firestore 내보내기에 포함되지 않음 |
| 회원등록 영속 상태 | `config.json` + SQLite 디렉터리의 일관된 묶음 | secret과 저널을 같은 시점 보존 |
| 서버 구성 | Caddyfile·환경설정·unit·IAM/방화벽/DNS 기록 | 개인 키와 설정 비밀값은 암호화·접근 제한 |

백업 주기·보관 기간·허용 데이터 손실 시간(RPO)·복구 목표 시간(RTO)은 업무 중요도에 따라 운영자가 정합니다. 최소한 배포/이전 직전 백업과 정기 복원 시험을 운영 절차에 포함합니다. 백업 API/저장소의 요금·권한·사용 가능 여부는 실제 환경에서 확인하며 무료를 전제하지 않습니다.

### 회원등록 journal + secret 일관성

SQLite는 WAL 모드입니다. 프로세스가 쓰는 동안 `registrations.sqlite` 파일 하나만 복사하면 최신 내용이 WAL에 남아 누락될 수 있습니다. 선택지는 다음과 같습니다.

1. 짧은 계정 생성 중단을 승인받습니다. 새 요청을 받지 않게 하고 회원등록 서비스를 정상 종료합니다.
2. 종료 상태를 확인한 후 `/etc/farmlog-members/config.json`과 `/var/lib/farmlog-members/` 전체를 같은 백업 세트로 보존합니다. 남아 있는 `-wal`, `-shm` 파일도 임의로 제거하지 않습니다.
3. 파일 소유자·권한·실행 버전·백업 시각·checksum을 기록합니다. 백업은 암호화하고 root/승인 관리자만 접근하게 합니다. `out/`, Git, 공개 스토리지, incoming 배포 아카이브에 저장하지 않습니다.
4. 서비스를 재시작하고 health와 비인증 거부를 확인합니다.

무중단 백업이 필요하면 SQLite의 일관된 온라인 백업 방식과 설정 스냅샷을 별도 검증해 사용합니다. 임의 파일 복사로 대체하지 않습니다. secret이 유실되었을 때 새 secret을 만들어 기존 저널과 조합하면 안전한 재시도 조건이 깨지므로 즉시 운영을 멈추고 복구 계획을 확인합니다.

## 6. 서버 이전 순서

같은 Firebase를 유지하는 경우 업무 DB를 새 서버로 복사할 필요는 없습니다. 하지만 이전 중 잘못된 설정으로 운영 데이터를 변경할 위험은 그대로입니다.

1. 새 호스트·DNS·인증서·Firebase Authorized domains를 준비하고 웹을 읽기 위주로 검증합니다.
2. 새 서버의 제한된 서비스 신원과 metadata 차단을 먼저 준비합니다. 회원등록 쓰기 서비스는 아직 활성화하지 않습니다.
3. 계정 생성 중단을 승인받고 이전 API를 정지합니다. 기존 journal+secret을 일관되게 백업합니다.
4. 새 서버에 승인된 코드/런타임과 영속 상태를 복원합니다. 기존 UID·작업공간·등록자 정책을 유지하는지 확인합니다. 새 origin으로 바꾸는 경우 config를 별도 승인·검증하여 변경하고 비밀값은 보존합니다.
5. 새 API만 활성화합니다. 이전과 새 API를 동시에 활성화하지 않습니다. 각 VM의 로컬 저널은 서로 동기화되지 않습니다.
6. HTTPS·로그인·데이터 연결·API 거부 조건을 확인하고 DNS/접속 주소를 전환합니다.
7. 관찰 기간 후 이전 호스트의 로그인 허용, SSH 접근, 서비스 신원과 리소스를 계획적으로 해제합니다.

기존 설정 불일치로 설치기가 중단되면 guard를 제거하거나 secret을 삭제해서 재설치하지 않습니다. 이전을 위한 root 검토 작업으로 원인을 정리합니다. 새 독립 Firebase로 옮길 때는 위 순서에 Auth/데이터/UID 이관과 등록자 정책 변경까지 추가됩니다.

## 7. 롤백

### 웹 화면

보존된 이전 릴리스의 `/release.json`과 경로를 확인하고 `/srv/smartfarm-work-manager/releases/` 내부의 정확한 대상인지 검증한 후 `current`를 원자적으로 다시 지정합니다. 현재 경로와 이전 경로를 기록합니다. 서버는 최근 5개 릴리스를 보존하므로 더 오래된 릴리스는 검증된 외부 아카이브가 필요할 수 있습니다.

새 UI로 저장된 데이터까지 화면 롤백으로 되돌아가지 않습니다. 데이터 형식의 하위 호환성이 없으면 별도 복구 계획이 필요합니다.

### 회원등록 서비스

설치 전 백업은 `/opt/farmlog-members/backups/<release-id>/`에 있습니다. 이전 코드 경로와 unit/Caddyfile을 검증한 뒤 서비스 중단, 코드 링크·unit·route 복원, daemon reload, 원래 활성 서비스 재시작 순서로 수행합니다. **journal과 secret은 코드 버전과 함께 되돌리거나 삭제하지 않습니다.**

첫 설치를 취소하는 경우 API를 중지하고 static-only Caddy 설정으로 복원할 수 있습니다. 그러나 제한된 서비스 신원이 VM에 부착된 동안 metadata guard를 계속 유지해야 합니다. API를 껐다고 배포 계정에 해당 신원 토큰 접근이 허용되어서는 안 됩니다.

### Firestore/계정

실제 데이터 복구는 읽기 확인 후 승인된 별도 절차로만 수행합니다. 현재 데이터를 백업하지 않고 과거 데이터를 덮어쓰지 않습니다. Auth 사용자를 삭제·재생성하여 UID 참조 문제를 우회하지 않습니다.

## 8. 자주 발생하는 문제

| 증상 | 먼저 확인 | 피해야 할 대응 |
| --- | --- | --- |
| 환경설정 누락 안내 | `.env.local`·shell/CI 우선값·재빌드 여부 | 운영 값을 코드에 하드코딩 |
| localhost인데 실제 데이터가 변경됨 | Firebase 프로젝트·workspace·emulator 플래그 | 개발 주소이므로 안전하다고 가정 |
| 로그인은 되지만 권한 거부 | Auth UID·appMembers·workspace·활성/비밀번호 조건·Rules | 전체 read/write 허용, 관리자 일괄 부여 |
| 하위 업무 저장만 실패 | 현재 Rules 버전·거부 코드·검증/평가 한도·transaction 형태 | 브라우저 권한만 문제라고 단정 |
| 직원 등록 401/403 | ID 토큰·Origin·허용 등록자·비밀번호 변경·최소 IAM/API | Owner/Editor 부여, Origin 검사 해제 |
| 직원 등록 409 | 동일 requestId/아이디·기존 Auth 사용자·저널·재시도 상태 | 저널 삭제, 새 UID로 중복 생성 |
| 회원 API 502 | loopback health·systemd·Caddy 정확 경로 | 8787 외부 개방 |
| 회원 API는 실패, 기존 업무는 정상 | 별도 회원등록 서비스만 점검 | Next.js 전체 서버가 고장났다고 판단 |
| TLS 발급 실패 | DNS A/AAAA·80/443·인증서 로그 | TLS 검증 해제 또는 HTTP 상시 운영 |
| 구버전 화면 유지 | release.json·브라우저 자산·current 링크 | 입력 중인 사용자의 강제 새로고침 |
| Node sqlite/TypeScript 실행 오류 | 회원 서비스 Node >=22.18, 승인 runtime 경로 | 빌드 Node와 서비스 Node를 같은 것으로 가정 |

## 9. 종료와 권한 정리

필요한 백업과 실제 복원 가능성을 먼저 확인합니다. 임시 IP 기반 주소를 사용했다면 Firebase Authorized domains에서 이전 호스트를 제거하고 새 로그인이 안 되는지 확인한 후 외부 IP를 반납합니다. IP를 먼저 반납하면 주소 소유권이 타인에게 넘어갈 수 있습니다.

배포 SSH 키, API 신원/IAM, 방화벽, DNS, CI secrets, VM/디스크/스냅샷/고정 IP와 백업 보존 정책을 각각 정리합니다. 해당 프로젝트가 다른 시스템에도 쓰이는지 확인하고 공유 리소스를 삭제하지 않습니다. 과금 보고서에서 잔여 리소스를 점검합니다.

## 10. 배포 기록 양식

```text
일시 / 작업자:
변경 목적 / 범위:
대상 호스트 / Firebase 프로젝트 / workspace:
소스 커밋 / 소스 상태(clean 여부):
Node / pnpm / Caddy / OS:
웹 releaseId / 아카이브 SHA-256:
Rules 이전·이후 ruleset / 소스 SHA-256:
회원 API 이전·이후 릴리스 / 런타임 SHA-256:
테스트 목록 / 결과 / 실데이터 쓰기 검증 여부:
백업 위치(비밀값 제외) / 복원 확인일:
롤백 대상과 방법:
미검증 사항 / 알려진 제한:
```

토큰, 개인 키, 비밀번호, `config.json` 원문이나 개인정보는 배포 기록에 붙이지 않습니다.
