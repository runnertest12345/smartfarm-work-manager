# 참여 농가

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

여러 사업에 참여한 농가를 통합한 실제 농가 수와 사업 참여 건수를 구분합니다.

## 표시값·계산식

주값은 `new Set(businessRecords.map(record => record.farmId)).size`곳입니다. 보조값은 `businessRecords.length`건(사업 참여)입니다. 예를 들어 같은 농가가 2개 사업에 참여하면 주값 1곳, 보조값 2건입니다. 데이터가 없으면 둘 다 0입니다.

사업 안에서 같은 `farmId`가 중복되면 `lastActivityAt`이 가장 큰 참여 레코드 1개를 사용합니다. 다른 사업에 참여한 같은 농가는 사업마다 별도로 남습니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

사업 집계의 사업연도와 사업 유형을 모두 적용합니다. 프로젝트 관리 및 구독 화면의 검색·필터는 적용하지 않습니다.

## 데이터·소스 근거

[화면·집계 코드](../../../../app/farm-ledger-dashboard.tsx) — `businessProjects`, `businessProjectSummaries`, `businessRecords` (2026~~2173행), 사업 집계 화면(6941~~7384행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `Farm`.

[화면 안내](../README.md)
