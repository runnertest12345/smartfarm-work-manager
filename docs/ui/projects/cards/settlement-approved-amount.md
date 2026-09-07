# 최종 정산 · 승인액

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

최종정산의 승인액을 확인합니다.

## 표시값·계산식

`selectedProject.settlementApprovedAmount` 저장값을 원화 형식으로 표시합니다. 히스토리 합산이나 다른 정산 금액에서 추론하는 계산은 없습니다. 저장값 0은 0원으로 표시합니다.

## 클릭·버튼

금액 카드 자체는 조회 전용입니다. 바깥 ‘정산 정보 수정’으로 프로젝트·정산 입력창을 열어 변경합니다.

## 필터 적용 범위

선택한 프로젝트 전체가 대상입니다. 목록의 검색·연도·위험 필터는 어떤 프로젝트를 여는지에만 영향을 주고 상세 내부 데이터를 추가로 줄이지 않습니다. 다른 화면의 필터도 적용하지 않습니다.

## 데이터·소스 근거

[계산 및 상세 화면](../../../../app/farm-ledger-dashboard.tsx) — `projectSnapshot`(1354~~1524행), 프로젝트 상세(8456~~9244행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `FarmProjectDocument`, `FarmProjectUpdate`, `FarmWorkItem`.

[프로젝트 목록](../README.md) · [프로젝트 상세](../detail.md)
