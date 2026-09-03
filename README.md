# 팜로그

스마트팜 사업, 농가, 설치·시운전·교육, 구독, 정산, 제출서류와 업무 히스토리를 프로젝트 중심으로 관리하는 비공개 웹 프로그램입니다.

## 무료 운영 구조

```text
GitHub 비공개 저장소
  → Next.js 정적 빌드
  → Firebase Hosting (Spark 무료 요금제)
  → Firebase Authentication (Google 로그인)
  → Cloud Firestore (승인 사용자만 접근)
```

Cloud Run, Cloud SQL, Cloud Functions, Secret Manager, Artifact Registry는 사용하지 않습니다. Firebase 프로젝트에 결제 계정을 연결하지 않으면 Spark 무료 할당량을 넘었을 때 과금되는 대신 서비스 요청이 제한됩니다.

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

1. [Firebase Console](https://console.firebase.google.com/)에서 Google Cloud 프로젝트 `evident-minutia-460301-c9`에 Firebase를 추가합니다. 요금제는 **Spark**를 유지하고 Google Analytics는 선택 사항입니다.
2. Firestore Standard 데이터베이스를 서울 리전(`asia-northeast3`)에 만듭니다. 위치는 나중에 바꿀 수 없습니다.
3. Authentication에서 Google 로그인 공급자를 활성화합니다.
4. 웹 앱을 등록하고 Firebase 구성값을 복사합니다.
5. `.env.example`을 `.env.local`로 복사한 뒤 `NEXT_PUBLIC_FIREBASE_*` 값을 입력합니다. 웹 구성값은 공개 식별자이며 비밀 키가 아닙니다.
6. 먼저 Firestore 규칙과 인덱스를 배포합니다.

```bash
pnpm install
pnpm exec firebase login
pnpm exec firebase deploy --only firestore:rules,firestore:indexes
```

7. `pnpm dev`에서 Google 계정으로 한 번 로그인합니다. 화면에 표시되는 UID를 복사합니다.
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

정적 결과물은 `out/`에 생성되고 Firebase Hosting 주소는 `https://evident-minutia-460301-c9.web.app`입니다. 별도 사용자 도메인을 연결하면 `.env.local`의 `NEXT_PUBLIC_SITE_URL`과 Firebase Authentication의 Authorized domains도 함께 갱신합니다.

## 보안·비용 원칙

- Hosting의 HTML·JavaScript 파일은 공개로 내려받을 수 있지만, 농가·사업 데이터는 Firebase Auth와 Firestore Rules가 차단합니다.
- 승인 여부는 클라이언트의 이메일 검사 대신 `appMembers/{uid}` 문서로 확인합니다.
- 로그인은 브라우저 세션에만 유지하고 Firestore IndexedDB 영구 캐시는 사용하지 않습니다.
- 모든 저장은 transaction 또는 batch로 관련 농가·사업·업무·히스토리를 함께 갱신합니다.
- 저장 후 12개 컬렉션을 다시 전체 조회하지 않고 실시간 구독의 변경분만 반영합니다.
- 이력과 구독 이벤트는 삭제·수정을 허용하지 않으며 일반 데이터도 삭제 대신 상태 변경을 사용합니다.
- Firebase Storage를 사용하지 않습니다. 서류와 사진은 회사 Google Drive 링크만 저장합니다.
- Spark에는 관리형 백업/PITR이 없으므로 실제 운영 전 정기 내보내기·복구 절차를 별도로 정해야 합니다.
- 원본 Google Sheet 주소와 실제 농가 수는 공개 JavaScript 번들에 포함하지 않습니다.

실제 농가 개인정보는 승인 사용자 규칙, 로그인, CRUD, 내보내기와 복구 시험이 끝난 뒤 이관하세요.
