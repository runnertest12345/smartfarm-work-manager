import type { FarmProject, FarmProjectInput } from './farm-types';
import {
  assertSettlementTransition,
  parseSettlementRounds,
  withSettlementRounds,
} from './project-settlements';

const SETTLEMENT_FIELDS = [
  'contractAmount',
  'settlementStatus',
  'settlementDueDate',
  'settlementClaimAmount',
  'settlementApprovedAmount',
  'settlementPaidAmount',
  'settledAt',
  'settlementOwner',
  'settlementEvidenceUrl',
  'settlementNote',
] as const;

/** A detached form snapshot, without document metadata or registration state. */
export function projectSettlementDraft(project: FarmProject): FarmProjectInput {
  return {
    name: project.name,
    projectType: project.projectType,
    year: project.year,
    institution: project.institution,
    status: project.status,
    description: project.description,
    targetFarmCount: project.targetFarmCount,
    manager: project.manager,
    startDate: project.startDate,
    endDate: project.endDate,
    currentStage: project.currentStage,
    contractAmount: project.contractAmount,
    settlementStatus: project.settlementStatus,
    settlementDueDate: project.settlementDueDate,
    settlementClaimAmount: project.settlementClaimAmount,
    settlementApprovedAmount: project.settlementApprovedAmount,
    settlementPaidAmount: project.settlementPaidAmount,
    settledAt: project.settledAt,
    settlementOwner: project.settlementOwner,
    settlementEvidenceUrl: project.settlementEvidenceUrl,
    settlementNote: project.settlementNote,
    ...(project.settlementRounds
      ? { settlementRounds: structuredClone(project.settlementRounds) }
      : {}),
  };
}

/** Settlement editing never changes basic information or bypasses legacy
 * preservation. The caller still sends base.updatedAt to the existing store. */
export function projectSettlementInput(
  base: FarmProject,
  draft: FarmProjectInput,
): FarmProjectInput {
  if (base.deletedAt)
    throw new Error('삭제된 프로젝트는 정산을 수정할 수 없습니다.');
  if (base.projectType === 'internal')
    throw new Error('내부 프로젝트는 사업 정산을 사용하지 않습니다.');
  if (base.status === 'completed')
    throw new Error(
      '완료 프로젝트는 기본정보에서 진행 중 또는 보류로 변경해 저장한 뒤 정산을 수정해 주세요.',
    );
  if (
    !Number.isSafeInteger(draft.contractAmount) ||
    draft.contractAmount < 0 ||
    draft.contractAmount > 1e15
  )
    throw new Error('계약금액은 0 이상의 정수로 입력해 주세요.');

  let input = projectSettlementDraft(base);
  for (const field of SETTLEMENT_FIELDS)
    Object.assign(input, { [field]: draft[field] });
  if (draft.settlementRounds) {
    input = withSettlementRounds(
      input,
      parseSettlementRounds(draft.settlementRounds),
    );
  } else {
    delete input.settlementRounds;
  }
  assertSettlementTransition(base, input);
  return input;
}
