# 현재 막힘 KPI

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

프로젝트 진행을 막는 항목의 총수를 빠르게 확인합니다.

## 표시값·계산식

`openProjectBlockers.length + blockedItems.length + documentRisks.length`건입니다. 프로젝트 막힘은 `kind === blocker`이고 해결일이 없는 기록, 농가 업무 막힘은 상태가 `waiting`인 업무, 서류 위험은 보완 요청·반려 또는 필수·미승인·기한초과 서류입니다.

보조문구는 프로젝트 막힘→농가 업무 막힘→서류 위험의 순서로 첫 번째 존재하는 종류의 건수만 보여줍니다. 주값은 세 종류의 합입니다. 구독·정산 위험은 이 값에 포함하지 않습니다. 0이면 ‘현재 막힌 항목 없음’입니다.

## 클릭·버튼

조회 전용이며 카드 자체의 클릭 동작은 없습니다.

## 필터 적용 범위

선택한 프로젝트 전체가 대상입니다. 목록의 검색·연도·위험 필터는 어떤 프로젝트를 여는지에만 영향을 주고 상세 내부 데이터를 추가로 줄이지 않습니다. 다른 화면의 필터도 적용하지 않습니다.

## 데이터·소스 근거

[계산 및 상세 화면](../../../../app/farm-ledger-dashboard.tsx) — `projectSnapshot`(1354~~1524행), 프로젝트 상세(8456~~9244행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `FarmProjectDocument`, `FarmProjectUpdate`, `FarmWorkItem`.

[프로젝트 목록](../README.md) · [프로젝트 상세](../detail.md)
