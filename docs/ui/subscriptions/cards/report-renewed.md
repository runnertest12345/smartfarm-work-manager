# 갱신

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

선택한 만료 기준 기간의 갱신 처리 실적을 확인합니다.

## 표시값·계산식

`eventType === renewed`이고 `basisExpiryDate`가 보고 기간에 속하는 이벤트의 `farmRecordId:basisExpiryDate` 고유 키 수입니다. 같은 구독 주기의 중복 갱신 이벤트는 한 번 셉니다. `processedAt`가 보고 기간 밖에 있어도 기준 만료일이 기간 안이면 집계합니다. 값이 없으면 0개소입니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

보고 탭의 사업 타입과 기준 연도 1월부터 집계 종료월까지의 기간을 적용합니다. 관리 탭의 개별 사업·검색·상태 필터는 적용하지 않습니다.

## 데이터·소스 근거

[화면·계산 코드](../../../../app/farm-ledger-dashboard.tsx) — `subscriptionReport`(2303~~2455행), 보고 탭(7453~~7793행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmRecord`, `FarmSubscriptionEvent`, `FarmProject`.

[구독·입금 화면](../README.md) · [만료·실적 보고](../report.md)
