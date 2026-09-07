# 사업 집계

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 화면 목적·진입

왼쪽 메뉴의 ‘사업 집계’에서 사업 수와 참여 규모, 설치·시운전·교육·유효 구독 현황을 비교합니다. 내부 화면 값은 `view === 'business'`이며 별도 URL 페이지로 이동하는 구현은 아닙니다.

## 필터·버튼

사업연도(전체 또는 등록된 연도)와 사업 유형(전체·일반 사업·연구 사업)을 선택합니다. 두 필터는 상단 KPI, 사업별 설치 진행, 분포 카드에 적용됩니다. 연도별 사업 현황은 유형 필터만 적용하며 모든 해당 연도를 비교용으로 유지합니다.

연도표의 연도 버튼은 선택 연도를 켜고 끕니다. ‘전체 연도 보기’는 연도 필터를 초기화합니다. 이 화면에는 사업 추가·수정, 내보내기나 사업별 행의 상세 이동 버튼이 없습니다.

## 집계 단위

프로젝트별로 같은 농가의 중복 참여가 있으면 마지막 활동이 최신인 레코드 한 개를 사용합니다. 이후 사업별 참여를 합칩니다. ‘참여 농가’의 주값만 고유 농가 수이며 다른 비율의 분모와 분포는 사업 참여 건수입니다. 완료 날짜 입력 여부로 단계 완료를 판정합니다.

## 카드·표 목차

- [대상 사업](cards/target-projects.md)
- [참여 농가](cards/participating-farms.md)
- [설치율](cards/installation-rate.md)
- [시운전율](cards/commissioning-rate.md)
- [교육률](cards/education-rate.md)
- [유효 구독률](cards/active-subscription-rate.md)
- [연도별 사업 현황](cards/annual-summary.md)
- [사업별 설치 진행](cards/project-installation-table.md)
- [지역 분포](cards/region-distribution.md)
- [작물 분포](cards/crop-distribution.md)
- [제품 분포](cards/product-distribution.md)

## 빈 상태

대상 사업과 농가 수는 0, 분모 없는 비율은 `-`입니다. 연도표는 ‘집계할 사업연도 정보가 없습니다.’, 사업별 표는 ‘선택한 조건의 사업이 없습니다.’, 분포는 ‘집계할 정보가 없습니다.’를 표시합니다.

## 소스 근거

[화면 및 계산](../../../app/farm-ledger-dashboard.tsx) — `projectSnapshot`(1354행), 사업 집계 파생값(2026~~2173행), 사업 집계 화면(6941~~7384행). [데이터 형식·상태 이름](../../../lib/farm-types.ts).

[전체 화면 문서](../README.md)
