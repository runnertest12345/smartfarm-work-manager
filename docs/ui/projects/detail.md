# 프로젝트 전체 상세

작성일: 2026-09-07 · 기준 커밋: `141faaa` · 현재 구현 설명

## 화면 목적·진입

[프로젝트 목록](README.md)의 카드를 눌러 특정 프로젝트의 농가·설치·구독·막힘·서류·최종정산·히스토리를 확인합니다. 다른 화면에서 `openProjectDetail`을 호출하는 프로젝트 항목으로도 진입할 수 있습니다. 선택된 프로젝트 ID로 전체 화면 상세를 표시하며 별도의 URL 경로를 만드는 방식은 아닙니다.

## 상단 정보·이동

사업 연도, 일반/연구 유형, 현재 단계, 사업 상태, 이름, 기관, 담당자, 시작·종료일을 표시합니다. 담당·날짜가 없으면 미지정·미입력 문구가 나타납니다. ‘이전 화면’은 상세 이동 이력을 따라가고 이전 상세 이력이 없으면 ‘목록으로’가 표시됩니다.

## 필터·버튼

이 상세 화면에는 검색 또는 기간 필터가 없습니다. 목록에서 선택한 프로젝트 전체의 데이터를 사용합니다. 목록 검색·연도·위험 필터나 사업 집계·구독 화면 필터가 상세 수치를 추가로 제한하지 않습니다.

상단 ‘프로젝트 기록 추가’, ‘사업·정산 수정’, ‘제출서류 추가’가 각각 입력창을 엽니다. 현재 막힌 곳에는 해결 처리 및 농가 업무·서류 이동이 있고, 제출서류 대장에는 추가·수정, 최종 정산에는 정보 수정·증빙 열기, 히스토리에는 막힘 추가·기록 추가가 있습니다. 입력창의 필드와 저장 동작은 [등록·수정 폼 안내](../forms/README.md)를 참조합니다.

완료 상태에서 상단·대장의 제출서류 추가, 대장의 개별 서류 버튼, 히스토리의 막힘 추가 버튼은 비활성화됩니다. 프로젝트 기록 추가와 사업·정산 수정 버튼은 활성 상태로 남습니다. 이 설명은 해당 화면에 실제로 설정된 버튼 상태를 기준으로 합니다.

## KPI 카드 목차

- [증빙기반 진행률](cards/evidence-progress.md)
- [참여 농가](cards/participating-farms.md)
- [현재 막힘](cards/current-blockers-kpi.md)
- [유효 구독률](cards/active-subscription-rate.md)
- [필수 제출서류](cards/required-documents-kpi.md)
- [정산 상태](cards/settlement-status-kpi.md)

## 설치·운영과 사업 진행 단계

- [설치·운영 완료율 영역](cards/operation-completion.md): [설치](cards/installation-rate.md), [시운전](cards/commissioning-rate.md), [교육](cards/education-rate.md), [유효 구독](cards/active-subscription-rate.md)
- [사업 진행 단계 영역](cards/stage-progress.md): [협약·계약](cards/stage-agreement.md), [참여농가 확정](cards/stage-farms.md), [설치·시운전](cards/stage-installation.md), [검수·교육](cards/stage-verification.md), [운영·구독](cards/stage-operation.md), [정산·서류](cards/stage-settlement.md), [사업 마감](cards/stage-closed.md)

## 관리 카드·표 목차

- [현재 막힌 곳](cards/blockers.md)
- [참여 농가·구독 표](cards/participation-table.md)
- [제출서류 대장](cards/documents.md)
- [최종 정산](cards/settlement.md): [계약금액](cards/contract-amount.md), [청구액](cards/settlement-claim-amount.md), [승인액](cards/settlement-approved-amount.md), [입금액](cards/settlement-paid-amount.md)
- [프로젝트 최근 히스토리](cards/recent-history.md): [마지막 받은 내용](cards/latest-received.md), [마지막 처리 내용](cards/latest-action.md)

## 빈 상태·계산 주의점

참여 농가가 없으면 표에 연결 농가가 없다는 문구를 표시하고 비율은 대체로 `-`입니다. 목표가 없으면 농가 확보율은 미설정입니다. 필수서류가 없으면 제출 수는 0/0이며 승인율은 미설정입니다. 전체 증빙 진행률은 누락값을 0으로 포함하지만 단계별 평균은 null을 제외합니다.

막힘이 없으면 ‘현재 막힌 항목이 없습니다.’, 서류가 없으면 ‘필수서류 목록이 아직 등록되지 않았습니다.’를 표시합니다. 최근 기록이 없으면 목록을 숨기며 마지막 받은/처리 내용의 빈 문구를 유지합니다.

구독 표는 과거 만료일만 상태에 우선 반영하므로 만료일 없는 저장 상태 사용중을 사용중으로 보일 수 있습니다. 유효 구독률은 그 레코드를 제외하며 별도 만료일 미입력 배지가 안내합니다. 관리 탭의 실제 구독 상태 판정과 표시 차이가 있습니다.

## 소스 근거

[상세 계산·화면](../../../app/farm-ledger-dashboard.tsx) — `projectSnapshot`(1354~~1524행), 상세 이동(2650~~2744행), `selectedProjectStageCards`(4114행), 상세 화면(8456~9244행). [프로젝트·서류·기록·참여 데이터 형식](../../../lib/farm-types.ts).

[프로젝트 목록](README.md) · [전체 화면 문서](../README.md)
