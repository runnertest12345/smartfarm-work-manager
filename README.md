# 팜로그

스마트팜 사업, 농가, 설치·시운전·교육, 구독, 정산, 제출서류와 업무 히스토리를 프로젝트 중심으로 관리하는 비공개 웹 프로그램입니다.

## 무료 운영 구조

```text
GitHub 비공개 저장소
  → Next.js 정적 빌드
  → Google Compute Engine VM + Caddy (3개월 한시 운영)
  → Firebase Authentication (별도 Spark 무료 프로젝트)
  → Cloud Firestore (승인 사용자만 접근, Spark 무료 할당량)
```

Cloud Run, Cloud SQL, Cloud Functions, Secret Manager, Artifact Registry와 Firebase Hosting은 사용하지 않습니다. 화면은 기존 `runner-507408` VM에서 제공하고, 데이터와 로그인은 결제 계정이 연결되지 않은 별도 Firebase 프로젝트 `smartfarm-work-manager`를 사용합니다. Spark 무료 할당량을 넘으면 과금 대신 서비스 요청이 제한됩니다.

## 구현 기능

- 연도별 전체 사업과 프로젝트 진행 단계·막힘 현황
- 프로젝트별 하위 업무, 설치·시운전·교육 진행률
- 필수 제출서류, 정산 상태·금액·증빙 관리
- 전체/구독/미구독, 작목별, 지역별 농가 현황
- 구독 만료 예정, 갱신·이탈·재가입 실적
- 메일·카톡·전화·구두·회의 내용을 받은 내용과 처리 내용으로 분리 기록
- 업무별 다음 행동, 담당자, 완료 기준, 체크리스트, 현장 방문
- 전체 진행 히스토리와 프로젝트·농가·업무 연결
- 데스크톱·태블릿·모바일 대응

## Firebase 최초 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 별도 프로젝트 `smartfarm-work-manager`를 만들고 **Spark** 요금제를 유지합니다. 결제가 연결된 `runner-507408`에는 Firebase를 추가하지 않습니다.
2. Firestore Standard 데이터베이스를 서울 리전(`asia-northeast3`)에 만듭니다. 위치는 나중에 바꿀 수 없습니다.
3. `firebase.json`의 Google 로그인 지원 이메일과 OAuth 표시 이름을 확인합니다. 공급자는 6단계의 배포 명령이 활성화합니다.
4. 웹 앱을 등록하고 Firebase 구성값을 복사합니다.
5. `.env.example`을 `.env.local`로 복사한 뒤 `NEXT_PUBLIC_FIREBASE_*` 값을 입력합니다. 웹 구성값은 공개 식별자이며 비밀 키가 아닙니다.
6. Google 로그인 공급자, Firestore 규칙과 인덱스를 배포합니다.

```bash
pnpm install
pnpm exec firebase login
pnpm exec firebase deploy --only auth,firestore:rules,firestore:indexes
```

7. Firebase Authentication의 Authorized domains에 실제 HTTPS 호스트를 추가하고, 배포된 사이트에서 Google 계정으로 한 번 로그인합니다. 화면에 표시되는 UID를 복사합니다.
8. Firebase Console의 Firestore에서 `appMembers/{UID}` 문서를 만들고 Boolean 필드 `active`를 `true`로 설정합니다. 앱 사용자는 이 문서를 직접 만들거나 수정할 수 없습니다.

## 로컬 개발

Node.js 22 이상이 필요합니다.

```bash
pnpm install
pnpm dev
```

로컬 개발도 기본적으로 실제 Firebase 프로젝트를 사용합니다. 실제 데이터를 건드리지 않는 통합 테스트에는 `demo-farmlog` 에뮬레이터 프로젝트를 사용하세요.

```bash
pnpm firebase:emulators
```

## 빌드 및 배포

```bash
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm firebase:deploy
```

`pnpm firebase:deploy`는 Google 로그인 공급자와 Firestore 규칙·인덱스를 배포합니다. 정적 결과물은 `out/`에 생성되며 `.github/workflows/deploy-gce-static.yml`을 통해 VM으로 배포합니다. 3개월 임시 주소는 `https://34-64-62-115.sslip.io`입니다. VM 준비와 GitHub 변수·비밀값 설정은 [Compute Engine 배포 문서](docs/gce-static-deployment.md)를 따릅니다.

## 보안·비용 원칙

- VM의 HTML·JavaScript 파일은 공개로 내려받을 수 있지만, 농가·사업 데이터는 Firebase Auth와 Firestore Rules가 차단합니다.
- 승인 여부는 클라이언트의 이메일 검사 대신 `appMembers/{uid}` 문서로 확인합니다.
- 로그인은 브라우저 세션에만 유지하고 Firestore IndexedDB 영구 캐시는 사용하지 않습니다.
- 모든 저장은 transaction 또는 batch로 관련 농가·사업·업무·히스토리를 함께 갱신합니다.
- 저장 후 12개 컬렉션을 다시 전체 조회하지 않고 실시간 구독의 변경분만 반영합니다.
- 이력과 구독 이벤트는 삭제·수정을 허용하지 않으며 일반 데이터도 삭제 대신 상태 변경을 사용합니다.
- Firebase Storage를 사용하지 않습니다. 서류와 사진은 회사 Google Drive 링크만 저장합니다.
- Spark에는 관리형 백업/PITR이 없으므로 실제 운영 전 정기 내보내기·복구 절차를 별도로 정해야 합니다.
- 원본 Google Sheet 주소와 농가 개인정보는 공개 JavaScript 번들에 포함하지 않습니다.

2026년 9월 3일 검증 스냅샷은 별도 Firestore 작업공간에 이관했습니다. 농장번호가 없는 27행은 임의 번호를 만들지 않고 프로젝트 목표 수에만 반영했으며, 추후 번호를 확인해 등록합니다.
