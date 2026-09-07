# 입금 기록 합계

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

선택 사업에 연결된 입금 업무 히스토리의 누적 금액을 확인합니다.

## 표시값·계산식

`paymentHistory`는 연결된 업무의 `workType === payment`이고 히스토리 `amount > 0`인 항목입니다. 이 중 업무의 `farmRecordId`가 선택 사업 참여에 속하는 히스토리 금액을 모두 합산한 `subscriptionPaymentTotal`을 원화 형식으로 표시합니다.

업무 완료 여부와 무관하고 기간 제한이 없습니다. 0원·음수 히스토리는 제외합니다. 구독 처리 이벤트, 레코드의 마지막 입금일, 프로젝트 최종정산 금액에서 합산하는 값이 아닙니다. 대상이 없으면 0원입니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

관리 탭의 ‘개별 사업’만 적용합니다. 검색어·구독 상태·현재 페이지는 이 카드에 적용하지 않습니다. 보고 탭의 연도·종료월·사업 타입도 적용하지 않습니다.

## 데이터·소스 근거

[화면·계산 코드](../../../../app/farm-ledger-dashboard.tsx) — `effectiveRecordSubscriptionStatus`(589행), `subscriptionScopedRecords` 및 관리 집계(2457~~2567행), 관리 탭(7795~~8196행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmRecord`, `FarmHistoryEntry`, `FarmWorkItem`.

[구독·입금 화면](../README.md) · [만료·실적 보고](../report.md)
