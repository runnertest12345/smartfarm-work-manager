# 구독 농가 KPI

작성일: 2026-09-07 · 구현 기준: `141faaa` · [화면 문서](../README.md)

## 목적과 표시값

**구독 농가 N곳**은 전체 농가 중 참여 기록 하나 이상이 유효 구독인 농가 수다. 참여 기록의 유효 구독 조건은 `subscriptionStatus === 'active'`이며 현재 만료일이 비어 있지 않고 로컬 오늘 이상인 경우다. 만료일 당일까지 포함한다.

한 농가에 여러 유효 기록이 있어도 농가는 한 번 센다. 보조 문구 **전체 대비 P%**는 `Math.round(N / 전체 농가 수 × 100)`이며 농가가 없으면 `0%`다. 등록 상태만 `active`이고 만료일이 없으면 유효 구독으로 세지 않는다.

## 동작과 필터 범위

누르면 구독 조건을 `active`로 설정하며 다른 조건은 유지한다. 선택 표시는 구독 조건이 `active`일 때 켜진다. KPI는 전체 참여 기록을 기준으로 하지만, 표에서 구독 여부를 판정할 때는 선택 사업의 참여 기록만 사용하므로 카드 수치와 표 결과 수는 다를 수 있다.

## 데이터와 코드 근거

원천은 `farms`, `records.subscriptionStatus`, `records.currentSubscriptionExpiresAt`이다. 오늘 값은 `riskNow`의 로컬 날짜이며 1분마다 갱신된다. [유효 상태 함수](../../../../app/farm-ledger-dashboard.tsx#L591), [농가 집계](../../../../app/farm-ledger-dashboard.tsx#L1145), [카드](../../../../app/farm-ledger-dashboard.tsx#L6087).
