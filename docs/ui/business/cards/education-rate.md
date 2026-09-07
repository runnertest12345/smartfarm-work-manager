# 교육률

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

선택한 사업 참여 정보 중 교육 완료 날짜가 입력된 비율을 확인합니다.

## 표시값·계산식

완료 건수는 `educationDate`가 비어 있지 않은 사업 참여 레코드 수(`businessEducation`)입니다. 비율은 `Math.round(완료 건수 / businessRecords.length × 100)`이며 정수 %로 표시합니다. 보조값은 완료 건수/전체 참여 건수입니다. 분모가 0이면 `-`입니다.

날짜의 실제 도래 여부를 검사하지 않으므로 미래 날짜도 입력되어 있으면 완료 건수에 포함됩니다. 사업 안에서 같은 `farmId`가 중복되면 `lastActivityAt`이 가장 큰 참여 레코드 1개를 사용합니다. 다른 사업에 참여한 같은 농가는 사업마다 별도로 남습니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

사업 집계의 사업연도와 사업 유형을 모두 적용합니다. 프로젝트 관리 및 구독 화면의 검색·필터는 적용하지 않습니다.

## 데이터·소스 근거

[화면·집계 코드](../../../../app/farm-ledger-dashboard.tsx) — `businessProjects`, `businessProjectSummaries`, `businessRecords` (2026~~2173행), 사업 집계 화면(6941~~7384행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmProject`, `FarmRecord`, `Farm`.

[화면 안내](../README.md)
