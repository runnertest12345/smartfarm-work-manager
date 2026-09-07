# 대상 사업

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

선택 범위에 포함된 사업 수를 확인합니다.

## 표시값·계산식

`businessProjects.length`개. 사업 상태가 진행·보류·완료인지는 집계 제외 조건이 아닙니다. 전체 연도 또는 선택 연도가 보조문구로 표시됩니다. 사업이 없으면 0개입니다.

## 클릭·버튼

조회 전용으로 카드 클릭 동작은 없습니다.

## 필터 적용 범위

사업 집계의 사업연도와 사업 유형을 모두 적용합니다. 프로젝트 관리 및 구독 화면의 검색·필터는 적용하지 않습니다.

## 데이터·소스 근거

[화면·집계 코드](../../../../app/farm-ledger-dashboard.tsx) — `businessProjects`, `businessProjectSummaries`, `businessRecords` (2026~~2173행), 사업 집계 화면(6941~~7384행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `Farm`.

[화면 안내](../README.md)
