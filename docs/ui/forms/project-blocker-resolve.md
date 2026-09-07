# 프로젝트 막힘 해결

기준 커밋: `141faaa` · 작성일: 2026-09-07

DialogKind: `project_blocker_resolve`

열리는 경로: 사업 상세의 미해결 프로젝트 막힘 카드에서 해결 처리. 대상 projectId/updateId를 고정하고 처리 담당자는 사업 담당자 또는 원 기록자로 채운다.

필드: 해결 내용, 처리 담당자. 두 항목 모두 저장 검사 필수이다. 해결 내용은 빈 값으로 시작한다.

저장: project_blocker_resolve PATCH. 원 막힘 기록에 해결시각·해결 내용·처리자를 채우고 별도의 시스템 해결 기록을 추가하며 프로젝트 수정시각을 갱신한다. 원 참고 링크는 시스템 해결 기록에도 이어진다. 대상이 없거나 막힘이 아니거나 이미 해결된 경우 저장을 거절한다. 재개/해결 취소 기능은 없다.

코드 근거: [대시보드 폼](../../../app/farm-ledger-dashboard.tsx#L11398), [저장·검증](../../../lib/firebase/farm-ledger-store.ts#L1221), [타입](../../../lib/farm-types.ts).

[폼 목차](README.md)
