# 입금 농가당 평균

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

실제 양수 입금 기록이 있는 농가 한 곳당 누적 평균을 확인합니다.

## 표시값·계산식

`Math.round(subscriptionPaymentTotal / subscriptionPaymentFarmCount)`원이며, 분모는 선택 사업 범위의 양수 입금 히스토리에 연결된 고유 `farmId` 수입니다. 분모가 0이면 0원입니다.

전체 구독 농가 수·히스토리 건수·사업 참여 건수로 나누지 않습니다. 같은 농가의 여러 사업 입금은 금액에는 합산되지만 분모에는 한 번 포함됩니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

관리 탭의 ‘개별 사업’만 적용합니다. 검색어·구독 상태·현재 페이지는 이 카드에 적용하지 않습니다. 보고 탭의 연도·종료월·사업 타입도 적용하지 않습니다.

## 데이터·소스 근거

[화면·계산 코드](../../../../app/farm-ledger-dashboard.tsx) — `effectiveRecordSubscriptionStatus`(589행), `subscriptionScopedRecords` 및 관리 집계(2457~~2567행), 관리 탭(7795~~8196행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmRecord`, `FarmHistoryEntry`, `FarmWorkItem`.

[구독·입금 화면](../README.md) · [만료·실적 보고](../report.md)
