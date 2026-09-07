# 등록·수정 폼

기준 커밋: `141faaa` · 작성일: 2026-09-07

실제 DialogKind 15개를 각각 문서화한다. 표의 저장 명령은 `farmLedgerFetch`로 전달되는 kind/method이며, 이 함수는 브라우저의 Firebase 저장 계층으로 처리한다. 이름이 API 경로여도 여기서 설명한 흐름은 이 저장 함수 구현 기준이다.

| DialogKind              | 문서                                             | 저장                                 |
| ----------------------- | ------------------------------------------------ | ------------------------------------ |
| project                 | [사업 등록·수정](project.md)                     | project POST/PATCH                   |
| project_document        | [제출서류](project-document.md)                  | project_document POST/PATCH          |
| project_update          | [프로젝트 기록](project-update.md)               | project_update POST                  |
| project_blocker_resolve | [프로젝트 막힘 해결](project-blocker-resolve.md) | project_blocker_resolve PATCH        |
| farm                    | [농가 등록](farm.md)                             | farm POST                            |
| farm_edit               | [농가 기본 수정](farm-edit.md)                   | farm PATCH                           |
| record_add              | [사업 참여 추가](record-add.md)                  | record POST                          |
| record_edit             | [사업 참여 수정](record-edit.md)                 | record PATCH                         |
| subscription_event      | [구독 처리](subscription-event.md)               | subscription_event POST              |
| subscription_expiry     | [만료일 입력·정정](subscription-expiry.md)       | subscription_expiry_correction PATCH |
| inbox                   | [빠른 수신](inbox.md)                            | inbox POST                           |
| inbox_route             | [수신 농가·사업 연결](inbox-route.md)            | 다음 폼 준비, 저장 없음              |
| work_item               | [업무 등록](work-item.md)                        | work_item POST                       |
| history                 | [진행 기록](history.md)                          | history POST                         |
| visit                   | [현장 방문](visit.md)                            | visit POST(신규/수정)                |

일반 저장 폼은 저장 중 제출·취소·닫기 중복 작동을 제한하며 성공 시 동기화를 기다려 닫고 알림을 표시한다. 실패하면 폼에 오류를 표시한다. 필수 여부는 HTML required뿐 아니라 제출 함수와 저장 계층 검사까지 포함해 각 문서에 구분했다. 기본 문자열은 trim 후 최대 5,000자, 기본 숫자는 안전한 정수 및 절댓값 10^15 이하를 요구하는 parseShape 검사를 통과한다. 개별 폼은 추가 제한이 있다. 선택지는 [타입·한국어 라벨](../../../lib/farm-types.ts)의 실제 enum을 사용한다.

저장 영향에서 ‘감사용 업무’는 완료된 관리 메모 업무와 시스템 이력을 뜻한다. 구독 전용 변경은 업무 유형을 구독으로 바꿔 생성한다. 이 업무들도 업무 목록과 완료 통계에 포함될 수 있다. 농가 기본 수정만으로는 이 감사용 업무가 만들어지지 않는다.

코드 근거: [DialogKind와 폼 타입](../../../app/farm-ledger-dashboard.tsx#L152), [기본값](../../../app/farm-ledger-dashboard.tsx#L632), [parseShape](../../../lib/firebase/farm-ledger-store.ts#L137), [명령 분기](../../../lib/firebase/farm-ledger-store.ts#L2511), [저장 함수](../../../lib/firebase/farm-ledger-store.ts#L2628).

[화면 문서 목차](../README.md)
