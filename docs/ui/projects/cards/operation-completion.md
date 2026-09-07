# 설치·운영 완료율 영역

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

설치·시운전·교육·구독의 네 가지 완료 지표를 같은 기준으로 비교합니다.

## 표시값·계산식

네 개의 하위 카드로 구성됩니다. 날짜 입력을 기준으로 한 설치·시운전·교육 비율과 오늘 유효한 구독 비율입니다. 각각 참여 농가 수를 분모로 하며 이 영역 자체의 별도 합산값은 없습니다. 카드별 상세 계산은 [설치](installation-rate.md), [시운전](commissioning-rate.md), [교육](education-rate.md), [유효 구독](active-subscription-rate.md)을 참조합니다.

## 클릭·버튼

조회 전용이며 카드 자체의 클릭 동작은 없습니다.

## 필터 적용 범위

선택한 프로젝트 전체가 대상입니다. 목록의 검색·연도·위험 필터는 어떤 프로젝트를 여는지에만 영향을 주고 상세 내부 데이터를 추가로 줄이지 않습니다. 다른 화면의 필터도 적용하지 않습니다.

## 데이터·소스 근거

[계산 및 상세 화면](../../../../app/farm-ledger-dashboard.tsx) — `projectSnapshot`(1354~~1524행), 프로젝트 상세(8456~~9244행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `FarmProjectDocument`, `FarmProjectUpdate`, `FarmWorkItem`.

[프로젝트 목록](../README.md) · [프로젝트 상세](../detail.md)
