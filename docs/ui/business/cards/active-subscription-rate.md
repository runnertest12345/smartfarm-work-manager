# 유효 구독률

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

선택 사업의 참여 레코드 중 오늘 유효한 구독 비율을 확인합니다.

## 표시값·계산식

`subscriptionStatus === active`이고 현재 만료일이 있으며 오늘 이상인 참여 레코드를 합산합니다. `Math.round(businessSubscriptions / businessRecords.length × 100)`을 표시하며 분모가 0이면 `-`입니다. 만료일이 없는 사용중 레코드는 유효 구독에 포함하지 않습니다.

갱신 실적의 갱신률과 다른 지표입니다. 사업 안에서 같은 `farmId`가 중복되면 `lastActivityAt`이 가장 큰 참여 레코드 1개를 사용합니다. 다른 사업에 참여한 같은 농가는 사업마다 별도로 남습니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

사업 집계의 사업연도와 사업 유형을 모두 적용합니다. 프로젝트 관리 및 구독 화면의 검색·필터는 적용하지 않습니다.

## 데이터·소스 근거

[화면·집계 코드](../../../../app/farm-ledger-dashboard.tsx) — `businessProjects`, `businessProjectSummaries`, `businessRecords` (2026~~2173행), 사업 집계 화면(6941~~7384행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `Farm`.

[화면 안내](../README.md)
