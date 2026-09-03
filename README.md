# 팜로그

스마트팜 사업, 농가, 장비 설치, 보증·구독, 입금, A/S와 연락 내용을 농가별 히스토리로 연결해 관리하는 비공개 웹 프로그램입니다.

## 현재 구현 범위

- 통합 현황: 등록 농가, 진행 사업, 구독 확인, 설치·A/S 후속 조치
- 농가 관리대장: 농장번호, 연락처, 주소, 지역, 경영체번호와 관련 링크
- 사업 관리: 사업 유형, 연도, 기관, 참여 농가, 목표 농가와 설치 진행률
- 설치 관리: 제작·세팅, 설치, 시운전, 교육 일자를 각각 보존
- 보증·구독 관리: 최초/현재 만료일, 마지막 입금일, 갱신횟수, 구독 상태
- 농가별 통합 히스토리: 메일, 카톡, 구두, 전화, 회의, 설치, 입금, A/S 기록
- A/S 관리: 접수 내용, 처리 내용, 상태, 기록자와 참고 링크
- 농가명, 연락처, 지역, 사업, 장비 통합 검색과 상태 필터
- 데스크톱, 태블릿, 모바일 대응
- Google Cloud SQL(PostgreSQL) 영구 저장
- Google Cloud IAP를 통한 회사 계정 로그인
- GitHub Actions에서 Cloud Run 자동 배포

## 원본 관리대장과 데이터

Google 관리대장의 탭과 필드 구조를 분석해 화면과 저장 구조에 반영했습니다. 현재 프로그램에는 개인정보가 없는 예시 농가만 포함되며, 원본 297개 농가·입금·A/S 데이터는 복사하거나 변경하지 않았습니다. 실제 데이터 이관은 별도 승인과 검증 후 진행합니다.

## 운영 구성

```text
GitHub 비공개 저장소
  → Cloud Build 컨테이너 빌드
  → Cloud Run 비공개 서비스 + IAP
  → Cloud SQL for PostgreSQL
  → Secret Manager 비밀번호 보관
```

운영 서비스는 익명 접근을 허용하지 않습니다. Cloud Run에 IAP를 직접
활성화하고 회사 Google Workspace 계정 또는 허용 사용자에게만
`IAP-secured Web App User` 역할을 부여해야 합니다.

## 로컬 개발

Node.js 22 이상과 PostgreSQL이 필요합니다. `.env.example`을 `.env.local`로
복사한 뒤 로컬 데이터베이스 주소를 입력합니다.

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

예시 농가가 필요한 로컬 시연에서만 `ENABLE_SAMPLE_DATA=true`를 사용합니다.
운영에서는 반드시 `false`로 유지합니다.

데이터 구조를 변경한 뒤에는 PostgreSQL 마이그레이션을 생성하고 검토합니다.

```bash
pnpm db:generate
```

## Google Cloud 준비 항목

과금이 발생하는 자원은 Google Cloud 프로젝트에서 별도로 생성합니다.

- Cloud Run 서비스: `farmlog`
- Cloud SQL for PostgreSQL 인스턴스와 `farmlog` 데이터베이스
- Artifact Registry 저장소
- Secret Manager 비밀: `farmlog-db-password`
- Cloud Run 실행 서비스 계정: Cloud SQL Client, Secret Manager Secret Accessor
- GitHub 배포 서비스 계정과 Workload Identity Federation
- Cloud Run 직접 IAP와 허용 사용자 또는 Google Workspace 그룹

GitHub 저장소의 `production` 환경에 다음 Variables를 등록합니다.

- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_REGION` (`asia-northeast3` 권장)
- `GCP_WIF_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_RUNTIME_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REPOSITORY`
- `CLOUD_SQL_CONNECTION_NAME`
- `PGUSER`
- `PGDATABASE`
- `ALLOWED_EMAIL_DOMAIN`
- `SITE_URL` (정식 HTTPS 주소)

`main` 브랜치에 반영되면 `.github/workflows/deploy-google-cloud.yml`이
컨테이너를 빌드하고 IAP가 적용된 비공개 Cloud Run 서비스로 배포합니다.
장기 서비스 계정 키 파일은 사용하지 않습니다.

배포 워크플로는 IAP 서비스 에이전트에 Cloud Run 호출 권한을 부여하고,
애플리케이션은 매 요청의 서명된 IAP JWT를 검증합니다. 프로젝트가 Google
조직에 속하지 않았다면 최초 한 번은 Cloud Run 콘솔에서 IAP OAuth 설정을
완료해야 합니다.

## 운영 전 확인

- `/api/health`가 `200`을 반환하는지 확인
- 익명 창에서 서비스가 열리지 않는지 확인
- 허용된 회사 계정만 로그인되는지 확인
- `ENABLE_SAMPLE_DATA=false`인지 확인
- Cloud SQL 자동 백업과 Point-in-time recovery 설정
- 관리대장 이관 전 테이블별 건수·금액 합계와 표본 대조
- 복구 시험이 끝나기 전에는 실제 농가 개인정보를 입력하지 않기
