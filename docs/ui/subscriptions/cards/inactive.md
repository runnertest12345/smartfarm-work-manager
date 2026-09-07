# 만료·미등록

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

현재 유효한 사용중 구독이 아닌 건수를 확인합니다.

## 표시값·계산식

`subscriptionScopedRecords.length - subscriptionActiveCount`곳입니다. 실제 상태 판정에서 `expired` 및 `unregistered`인 레코드를 합친 값입니다. 저장 상태가 사용중이어도 만료일이 없으면 미등록으로 판정합니다. 과거 만료일이 있으면 저장 상태가 미등록이어도 만료로 판정합니다. 데이터가 없으면 0곳입니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

관리 탭의 ‘개별 사업’만 적용합니다. 검색어·구독 상태·현재 페이지는 이 카드에 적용하지 않습니다. 보고 탭의 연도·종료월·사업 타입도 적용하지 않습니다.

## 데이터·소스 근거

[화면·계산 코드](../../../../app/farm-ledger-dashboard.tsx) — `effectiveRecordSubscriptionStatus`(589행), `subscriptionScopedRecords` 및 관리 집계(2457~~2567행), 관리 탭(7795~~8196행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmRecord`, `FarmHistoryEntry`, `FarmWorkItem`.

[구독·입금 화면](../README.md) · [만료·실적 보고](../report.md)
