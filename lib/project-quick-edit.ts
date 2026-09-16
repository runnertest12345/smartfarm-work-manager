import {
  FARM_PROJECT_STAGES,
  FARM_PROJECT_STATUSES,
  FARM_PROJECT_TYPES,
  type FarmProject,
  type FarmProjectInput,
} from './farm-types';

export type ProjectQuickValues = Pick<
  FarmProjectInput,
  | 'name'
  | 'projectType'
  | 'year'
  | 'institution'
  | 'targetFarmCount'
  | 'manager'
  | 'status'
  | 'currentStage'
  | 'startDate'
  | 'endDate'
  | 'description'
>;
export type ProjectQuickField = keyof ProjectQuickValues;

export function projectQuickValues(project: FarmProject): ProjectQuickValues {
  return {
    name: project.name,
    projectType: project.projectType,
    year: project.year,
    institution: project.institution,
    targetFarmCount: project.targetFarmCount,
    manager: project.manager,
    status: project.status,
    currentStage: project.currentStage,
    startDate: project.startDate,
    endDate: project.endDate,
    description: project.description,
  };
}

/** Match the full form's status/stage controls, without normalizing away business
 * fields when a user only previews another project type. The store validates
 * type transitions before applying internal-project normalization on save. */
export function updateProjectQuickValues<K extends ProjectQuickField>(
  draft: ProjectQuickValues,
  key: K,
  value: ProjectQuickValues[K],
): ProjectQuickValues {
  const next = { ...draft, [key]: value };
  if (key === 'status') {
    next.currentStage =
      next.status === 'completed'
        ? 'closed'
        : draft.currentStage === 'closed'
          ? 'settlement'
          : draft.currentStage;
  } else if (key === 'currentStage') {
    next.status =
      next.currentStage === 'closed'
        ? 'completed'
        : draft.status === 'completed'
          ? 'active'
          : draft.status;
  }
  return next;
}

/** Keep every non-edited business/settlement field intact; the existing store
 * still validates permissions, completion and the original updatedAt version. */
export function projectQuickInput(
  project: FarmProject,
  values: ProjectQuickValues,
): FarmProjectInput {
  const name = values.name.trim();
  if (!name) throw new Error('프로젝트명을 입력해 주세요.');
  if (!FARM_PROJECT_STATUSES.includes(values.status))
    throw new Error('프로젝트 상태를 확인해 주세요.');
  if (!FARM_PROJECT_TYPES.includes(values.projectType))
    throw new Error('프로젝트 유형을 확인해 주세요.');
  if (!FARM_PROJECT_STAGES.includes(values.currentStage))
    throw new Error('현재 사업 단계를 확인해 주세요.');
  if (
    !Number.isInteger(values.year) ||
    values.year < 2000 ||
    values.year > 2100
  )
    throw new Error('기준 연도는 2000~2100 사이의 정수로 입력해 주세요.');
  if (
    !Number.isSafeInteger(values.targetFarmCount) ||
    values.targetFarmCount < 0
  )
    throw new Error('설치 개소는 0 이상의 정수로 입력해 주세요.');
  return {
    name,
    manager: values.manager.trim(),
    status: values.status,
    endDate: values.endDate,
    projectType: values.projectType,
    year: values.year,
    institution: values.institution.trim(),
    description: values.description,
    targetFarmCount: values.targetFarmCount,
    startDate: values.startDate,
    currentStage: values.currentStage,
    settlementStatus: project.settlementStatus,
    settlementDueDate: project.settlementDueDate,
    contractAmount: project.contractAmount,
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
