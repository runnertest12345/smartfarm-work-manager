# 사업연도 공통 KPI

2026-09-08: 프로젝트 업무 수는 상위·세부 수를 분리 표시한다. 완료율·처리 필요·지연 수는 최하위 실행 업무 기준으로 계산하여 부모를 중복 집계하지 않는다. [계층과 집계 규칙](../work/task-hierarchy.md).

갱신일: 2026-09-07

UX/UI 개편: 전체 프로젝트·하위 업무·업무 완료율·처리 필요 업무 4개를 우선 표시하고 나머지 8개는 펼침 영역으로 제공한다. 핵심 지표는 해당 연도·사업 타입의 프로젝트 또는 업무 목록에 연결된다. [문헌 근거·배치와 이동 규칙](../ux-redesign.md).

통합 현황과 프로젝트 관리 상단은 같은 사업연도·사업 타입 상태를 공유합니다. 전체·일반 사업·연구 사업을 선택하면 연도와 타입의 교집합을 집계합니다. 연도 선택은 사업 등록연도 기준입니다. 상태 수치·업무·구독 등은 현재 저장 데이터로 계산하므로 과거 연말 스냅샷과 다릅니다. 검색·상태·위험 조건은 하단 목록만 좁힙니다.

- [사업 타입 선택](cards/project-type-filter.md)
- [연도별 사업 현황·선택](../overview/cards/year-selector.md)
- [전체 프로젝트](../overview/cards/total-projects.md)
- [프로젝트 하위 업무](../overview/cards/project-work-items.md)
- [처리 필요 업무](../overview/cards/incomplete-work-items.md)
- [하위 업무 완료율](../overview/cards/completion-rate.md)
- [진행 중 사업](../overview/cards/active-projects.md)
- [완료 사업](../overview/cards/completed-projects.md)
- [보류 사업](../overview/cards/on-hold-projects.md)
- [참여 농가](../overview/cards/participating-farms.md)
- [설치 · 시운전 · 교육](../overview/cards/operation-rates.md)
- [유효 구독률](../overview/cards/active-subscription-rate.md)
- [필수서류 승인율](../overview/cards/document-approval-rate.md)
- [정산 완료](../overview/cards/settled-projects.md)

참여율의 분모는 선택 사업 안에서 같은 사업·농가 중복을 제거한 참여 수입니다. 여러 사업에 참여한 농가는 사업마다 포함하며 ‘참여 농가’ 주 숫자만 농가 ID로 중복 제거합니다. 업무는 해당 사업의 모든 원본 참여 기록과 연결한 후 업무 ID로 중복 제거합니다. 분모가 0인 비율은 `-`입니다.

통합 현황의 최근 이력과 확인 필요도 선택 사업연도·사업 타입을 따릅니다. 농가 공통 데이터 문제는 참여 농가 기준, 설치·구독·참여 중복 문제는 선택 프로젝트 기준입니다. 지연 업무·구독 만료/미등록·점검을 누르면 해당 범위의 대상 목록으로 이동하며 범위 해제로 전체를 볼 수 있습니다.

[집계 구현](../../../lib/dashboard-kpis.ts) · [표시 구현](../../../app/farm-kpi-panels.tsx) · [전체 문서](../README.md)
