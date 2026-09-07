# 주간 검토

기준 커밋: `141faaa` · 작성일: 2026-09-07

[업무 현황](README.md) → ‘주간 검토’. 별도 주차 선택 없이 오늘을 기준으로 전체 업무의 다음 조치를 점검한다. 검색·유형·상태 필터는 적용하지 않는다.

상단 [다음 행동 누락](cards/missing-next-action.md), [마감 지연](cards/overdue-count.md), [검토일 도래·지남](cards/review-due.md), [7일 넘은 대기](cards/stale-waiting.md) 지표를 보여준다. 목록은 이 네 집합과 ‘응답 목표 초과’를 업무 ID로 중복 제거한 뒤 최근 활동이 오래된 순으로 정렬한다. 각 [업무 카드](cards/work-item.md)를 열어 진행 기록과 계획을 갱신한다.

‘최근 완료’ 배지는 `status='completed' && completedAt >= 오늘 0시-7일`인 전체 건수다. 목록에 완료 업무를 섞는 기능은 아니다. 검토 대상이 없으면 ‘검토가 필요한 업무가 없습니다. 이번 주 정리가 끝났습니다’를 표시한다.

코드 근거: `app/farm-ledger-dashboard.tsx:1877`, `:2018`(`weeklyReviewItems`), `:5810`.

[대시보드](../../../app/farm-ledger-dashboard.tsx) · [상위 화면](README.md)
