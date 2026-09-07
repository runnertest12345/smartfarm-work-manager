# 사용중

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 목적

현재 유효한 농가·사업 구독 건수를 확인합니다.

## 표시값·계산식

선택 사업의 원본 `FarmRecord` 중 저장 상태가 `active`, 현재 만료일이 있으며 오늘 이상인 레코드 수인 `subscriptionActiveCount`를 ‘곳’으로 표시합니다. 오늘 만료인 구독도 포함합니다. 동일 농가가 여러 사업 또는 여러 레코드로 존재하면 각각 집계하며 고유 농가 수가 아닙니다. 대상이 없으면 0곳입니다.

## 클릭·버튼

조회 전용입니다.

## 필터 적용 범위

관리 탭의 ‘사업 타입’과 ‘개별 사업’을 함께 적용합니다. 검색어·구독 상태·현재 페이지는 이 카드에 적용하지 않습니다. 보고 탭의 연도·종료월·사업 타입도 적용하지 않습니다.

## 데이터·소스 근거

[화면·계산 코드](../../../../app/farm-ledger-dashboard.tsx) — `effectiveRecordSubscriptionStatus`(589행), `subscriptionScopedRecords` 및 관리 집계(2457~~2567행), 관리 탭(7795~~8196행). [데이터 형식](../../../../lib/farm-types.ts) — `FarmRecord`, `FarmHistoryEntry`, `FarmWorkItem`.

[구독·입금 화면](../README.md) · [만료·실적 보고](../report.md)
