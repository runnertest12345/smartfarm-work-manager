# 카드 전체 목록

작성일: 2026-09-07 · 구현 기준: 연도·구독 KPI 개선

카드·지표·표·반복 영역 132개 문서의 목차다. 실제 농가나 프로젝트마다 생성되는 개별 데이터 카드는 같은 구조의 문서를 공유한다. 카드 이름을 눌러 표시 정보·계산·동작·코드 근거를 확인한다.

[전체 화면 목차](README.md) · [입력창 목차](forms/README.md) · [공통 계산 기준](common/calculation-rules.md)

## 공통 안내

[화면 설명](common/navigation.md) · 3개 문서

| 카드·영역                                                           | 파일                  |
| ------------------------------------------------------------------- | --------------------- |
| [승인 사용자·관리 규모 안내 카드](common/cards/workspace-notice.md) | `workspace-notice.md` |
| [접속 계정 카드](common/cards/account-summary.md)                   | `account-summary.md`  |

[사업 타입 선택](common/cards/project-type-filter.md) — 통합 현황·프로젝트·구독 관리의 집계 범위

## 로그인·접근 승인

[화면 설명](auth/README.md) · 2개 문서

| 카드·영역                                         | 파일              |
| ------------------------------------------------- | ----------------- |
| [관리대장 접속 카드](auth/cards/sign-in.md)       | `sign-in.md`      |
| [권한·연결 상태 카드](auth/cards/access-state.md) | `access-state.md` |

## 통합 현황

[화면 설명](overview/README.md) · 19개 문서 (상단 KPI는 프로젝트 관리와 공유)

| 카드·영역                                                                 | 파일                          |
| ------------------------------------------------------------------------- | ----------------------------- |
| [연도별 사업 현황·선택](overview/cards/year-selector.md)                  | `year-selector.md`            |
| [진행 중 프로젝트 KPI](overview/cards/active-projects.md)                     | `active-projects.md`          |
| [완료 프로젝트 KPI](overview/cards/completed-projects.md)                     | `completed-projects.md`       |
| [보류 사업 KPI](overview/cards/on-hold-projects.md)                       | `on-hold-projects.md`         |
| [참여 농가 KPI](overview/cards/participating-farms.md)                    | `participating-farms.md`      |
| [설치·시운전·교육 KPI](overview/cards/operation-rates.md)                 | `operation-rates.md`          |
| [유효 구독률 KPI](overview/cards/active-subscription-rate.md)             | `active-subscription-rate.md` |
| [필수서류 승인율 KPI](overview/cards/document-approval-rate.md)           | `document-approval-rate.md`   |
| [정산 완료 KPI](overview/cards/settled-projects.md)                       | `settled-projects.md`         |
| [전체 프로젝트 KPI](overview/cards/total-projects.md)                     | `total-projects.md`           |
| [처리 필요 업무 KPI](overview/cards/incomplete-work-items.md)             | `incomplete-work-items.md`    |
| [최근 업무·처리 히스토리 카드](overview/cards/recent-history.md)          | `recent-history.md`           |
| [프로젝트 아코디언](overview/cards/project-accordion.md)                  | `project-accordion.md`        |
| [프로젝트 하위 업무 행](overview/cards/child-work-row.md)                 | `child-work-row.md`           |
| [프로젝트 하위 업무 KPI](overview/cards/project-work-items.md)            | `project-work-items.md`       |
| [하위 업무 완료율 KPI](overview/cards/completion-rate.md)                 | `completion-rate.md`          |
| [확인 필요 · 구독 만료·미등록](overview/cards/attention-subscriptions.md) | `attention-subscriptions.md`  |
| [확인 필요 · 데이터 점검](overview/cards/attention-quality.md)            | `attention-quality.md`        |
| [확인 필요 · 마감 지연 업무](overview/cards/attention-overdue.md)         | `attention-overdue.md`        |

## 업무 현황·업무 상세

[화면 설명](work/README.md) · 27개 문서

| 카드·영역                                                 | 파일                     |
| --------------------------------------------------------- | ------------------------ |
| [72시간 이내 대응 KPI](work/cards/response-soon.md)       | `response-soon.md`       |
| [7일 넘은 대기 KPI](work/cards/stale-waiting.md)          | `stale-waiting.md`       |
| [7일 이내 마감 KPI](work/cards/due-soon-count.md)         | `due-soon-count.md`      |
| [검토일 도래·지남 KPI](work/cards/review-due.md)          | `review-due.md`          |
| [공통 업무 카드](work/cards/work-item.md)                 | `work-item.md`           |
| [다음 행동 누락 KPI](work/cards/missing-next-action.md)   | `missing-next-action.md` |
| [다음 행동 카드](work/cards/next-action.md)               | `next-action.md`         |
| [담당자 업무 신호 카드](work/cards/owner-load.md)         | `owner-load.md`          |
| [마감 지연 KPI](work/cards/overdue-count.md)              | `overdue-count.md`       |
| [막힘 이력 카드](work/cards/blocker-episode.md)           | `blocker-episode.md`     |
| [막힘·대기 큐 카드](work/cards/blocked-queue.md)          | `blocked-queue.md`       |
| [막힘·대기 KPI](work/cards/blocked-count.md)              | `blocked-count.md`       |
| [미완료 업무 KPI](work/cards/open-count.md)               | `open-count.md`          |
| [사업 자동 위험 신호 카드](work/cards/project-health.md)  | `project-health.md`      |
| [서비스 목표 큐 카드](work/cards/response-queue.md)       | `response-queue.md`      |
| [업무 전환 완료 목록 카드](work/cards/inbox-converted.md) | `inbox-converted.md`     |
| [오늘 현장 방문 KPI](work/cards/today-visits.md)          | `today-visits.md`        |
| [완료 기준 카드](work/cards/expected-outcome.md)          | `expected-outcome.md`    |
| [응답 목표 초과 KPI](work/cards/response-breached.md)     | `response-breached.md`   |
| [전체 진행 히스토리 카드](work/cards/history-entry.md)    | `history-entry.md`       |
| [정리 전 수신 카드](work/cards/inbox-item.md)             | `inbox-item.md`          |
| [진행 차단 요인 카드](work/cards/blocker-detail.md)       | `blocker-detail.md`      |
| [참고 보관 목록 카드](work/cards/inbox-reference.md)      | `inbox-reference.md`     |
| [최초 대응 관리 카드](work/cards/response-detail.md)      | `response-detail.md`     |
| [현장 방문 일정 카드](work/cards/visit-queue.md)          | `visit-queue.md`         |
| [현장 방문 카드](work/cards/visit-detail.md)              | `visit-detail.md`        |
| [현장 체크리스트 카드](work/cards/checklist.md)           | `checklist.md`           |

## 농가 관리대장·농가 상세

[화면 설명](farms/README.md) · 10개 문서

| 카드·영역                                                | 파일                    |
| -------------------------------------------------------- | ----------------------- |
| [구독 농가 KPI](farms/cards/subscribed-farms.md)         | `subscribed-farms.md`   |
| [농가 대장표](farms/cards/ledger-table.md)               | `ledger-table.md`       |
| [농가 상세 정보](farms/cards/farm-information.md)        | `farm-information.md`   |
| [농가 업무 카드](farms/cards/farm-work.md)               | `farm-work.md`          |
| [농가 전체 히스토리 카드](farms/cards/farm-history.md)   | `farm-history.md`       |
| [미구독 농가 KPI](farms/cards/unsubscribed-farms.md)     | `unsubscribed-farms.md` |
| [작목별 농가 카드](farms/cards/crops.md)                 | `crops.md`              |
| [전체 농가 KPI](farms/cards/total-farms.md)              | `total-farms.md`        |
| [지역별 농가 카드](farms/cards/regions.md)               | `regions.md`            |
| [참여 사업·설치 정보 카드](farms/cards/participation.md) | `participation.md`      |

## 프로젝트 관리·프로젝트 상세

[화면 설명](projects/README.md) · 30개 문서

| 카드·영역                                                                | 파일                            |
| ------------------------------------------------------------------------ | ------------------------------- |
| [검수·교육 단계](projects/cards/stage-verification.md)                   | `stage-verification.md`         |
| [교육 완료율](projects/cards/education-rate.md)                          | `education-rate.md`             |
| [마지막 받은 내용](projects/cards/latest-received.md)                    | `latest-received.md`            |
| [마지막 처리 내용](projects/cards/latest-action.md)                      | `latest-action.md`              |
| [사업 마감 단계](projects/cards/stage-closed.md)                         | `stage-closed.md`               |
| [사업 진행 단계 영역](projects/cards/stage-progress.md)                  | `stage-progress.md`             |
| [설치 완료율](projects/cards/installation-rate.md)                       | `installation-rate.md`          |
| [설치·시운전 단계](projects/cards/stage-installation.md)                 | `stage-installation.md`         |
| [설치·운영 완료율 영역](projects/cards/operation-completion.md)          | `operation-completion.md`       |
| [시운전 완료율](projects/cards/commissioning-rate.md)                    | `commissioning-rate.md`         |
| [운영·구독 단계](projects/cards/stage-operation.md)                      | `stage-operation.md`            |
| [유효 구독률·유효 구독 카드](projects/cards/active-subscription-rate.md) | `active-subscription-rate.md`   |
| [정산 상태 KPI](projects/cards/settlement-status-kpi.md)                 | `settlement-status-kpi.md`      |
| [정산·서류 단계](projects/cards/stage-settlement.md)                     | `stage-settlement.md`           |
| [제출서류 대장](projects/cards/documents.md)                             | `documents.md`                  |
| [증빙기반 진행률](projects/cards/evidence-progress.md)                   | `evidence-progress.md`          |
| [참여 농가 KPI](projects/cards/participating-farms.md)                   | `participating-farms.md`        |
| [참여 농가·구독 표](projects/cards/participation-table.md)               | `participation-table.md`        |
| [참여농가 확정 단계](projects/cards/stage-farms.md)                      | `stage-farms.md`                |
| [회차별 정산](projects/cards/settlement.md)                                | `settlement.md`                 |
| [회차별 정산 · 계약금액](projects/cards/contract-amount.md)                | `contract-amount.md`            |
| [회차별 정산 · 승인액](projects/cards/settlement-approved-amount.md)       | `settlement-approved-amount.md` |
| [회차별 정산 · 입금액](projects/cards/settlement-paid-amount.md)           | `settlement-paid-amount.md`     |
| [회차별 정산 · 청구액](projects/cards/settlement-claim-amount.md)          | `settlement-claim-amount.md`    |
| [프로젝트 최근 히스토리](projects/cards/recent-history.md)               | `recent-history.md`             |
| [프로젝트 통합 현황 목록 카드](projects/cards/project-list.md)           | `project-list.md`               |
| [필수 제출서류 KPI](projects/cards/required-documents-kpi.md)            | `required-documents-kpi.md`     |
| [현재 막힌 곳](projects/cards/blockers.md)                               | `blockers.md`                   |
| [현재 막힘 KPI](projects/cards/current-blockers-kpi.md)                  | `current-blockers-kpi.md`       |
| [협약·계약 단계](projects/cards/stage-agreement.md)                      | `stage-agreement.md`            |

## 사업 집계

[화면 설명](business/README.md) · 11개 문서

| 카드·영역                                                        | 파일                            |
| ---------------------------------------------------------------- | ------------------------------- |
| [교육률](business/cards/education-rate.md)                       | `education-rate.md`             |
| [대상 사업](business/cards/target-projects.md)                   | `target-projects.md`            |
| [사업별 설치 진행](business/cards/project-installation-table.md) | `project-installation-table.md` |
| [설치율](business/cards/installation-rate.md)                    | `installation-rate.md`          |
| [시운전율](business/cards/commissioning-rate.md)                 | `commissioning-rate.md`         |
| [연도별 사업 현황](business/cards/annual-summary.md)             | `annual-summary.md`             |
| [유효 구독률](business/cards/active-subscription-rate.md)        | `active-subscription-rate.md`   |
| [작물 분포](business/cards/crop-distribution.md)                 | `crop-distribution.md`          |
| [제품 분포](business/cards/product-distribution.md)              | `product-distribution.md`       |
| [지역 분포](business/cards/region-distribution.md)               | `region-distribution.md`        |
| [참여 농가](business/cards/participating-farms.md)               | `participating-farms.md`        |

## 구독·입금·구독 실적

[화면 설명](subscriptions/README.md) · 24개 문서

| 카드·영역                                                                       | 파일                         |
| ------------------------------------------------------------------------------- | ---------------------------- |
| [최초 구독·입금 확인](subscriptions/cards/cycle-initial.md)                     | `cycle-initial.md`           |
| [1차 연장](subscriptions/cards/cycle-first.md)                                  | `cycle-first.md`             |
| [2차 연장](subscriptions/cards/cycle-second.md)                                 | `cycle-second.md`            |
| [3차 이상 연장](subscriptions/cards/cycle-third-plus.md)                        | `cycle-third-plus.md`        |
| [최초 입금·회차 미확인](subscriptions/cards/cycle-unverified.md)                | `cycle-unverified.md`        |
| [오늘 기준 만료 후 결과 미등록](subscriptions/cards/current-expired-pending.md) | `current-expired-pending.md` |
| [오늘 기준 만료 예정](subscriptions/cards/current-upcoming.md)                  | `current-upcoming.md`        |
| [만료일 미입력 KPI](subscriptions/cards/current-missing-expiry.md)              | `current-missing-expiry.md`  |
| [90일 이내 만료](subscriptions/cards/expiring-90-days.md)                       | `expiring-90-days.md`        |
| [갱신](subscriptions/cards/report-renewed.md)                                   | `report-renewed.md`          |
| [갱신률](subscriptions/cards/report-renewal-rate.md)                            | `report-renewal-rate.md`     |
| [결과 미등록·만료일 미입력 안내](subscriptions/cards/report-data-warning.md)    | `report-data-warning.md`     |
| [농가별 구독 만료일과 입금 표](subscriptions/cards/management-table.md)         | `management-table.md`        |
| [만료 대상](subscriptions/cards/report-target.md)                               | `report-target.md`           |
| [만료 예정](subscriptions/cards/report-upcoming.md)                             | `report-upcoming.md`         |
| [만료·미등록](subscriptions/cards/inactive.md)                                  | `inactive.md`                |
| [보고문 복사](subscriptions/cards/report-copy.md)                               | `report-copy.md`             |
| [사용중](subscriptions/cards/active.md)                                         | `active.md`                  |
| [이탈](subscriptions/cards/report-churned.md)                                   | `report-churned.md`          |
| [입금 기록 합계](subscriptions/cards/payment-total.md)                          | `payment-total.md`           |
| [입금 농가당 평균](subscriptions/cards/average-payment.md)                      | `average-payment.md`         |
| [재가입](subscriptions/cards/report-rejoined.md)                                | `report-rejoined.md`         |
| [최근 구독 처리](subscriptions/cards/report-recent-events.md)                   | `report-recent-events.md`    |
| [최근 월별 입금](subscriptions/cards/monthly-payments.md)                       | `monthly-payments.md`        |

## A/S 업무

[화면 설명](service/README.md) · 1개 문서

| 카드·영역                                      | 파일              |
| ---------------------------------------------- | ----------------- |
| [A/S 업무 카드](service/cards/service-item.md) | `service-item.md` |

## 데이터 점검

[화면 설명](quality/README.md) · 5개 문서

| 카드·영역                                                 | 파일                    |
| --------------------------------------------------------- | ----------------------- |
| [구독 기준 누락 KPI](quality/cards/subscription.md)       | `subscription.md`       |
| [기본·설치 누락 KPI](quality/cards/basic-installation.md) | `basic-installation.md` |
| [데이터 점검 이슈 카드](quality/cards/issue.md)           | `issue.md`              |
| [전체 확인 항목 KPI](quality/cards/total.md)              | `total.md`              |
| [중복 가능성 KPI](quality/cards/duplicates.md)            | `duplicates.md`         |
