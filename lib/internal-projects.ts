import type { FarmProject, FarmProjectInput, FarmWorkItem, FarmLedgerWorkspace } from './farm-types';
import { isInternalTask } from './project-work';
import { summarizeWorkHierarchy } from './work-hierarchy';
import { emptySettlement, settlementsEqual } from './project-settlements';

export function isInternalProject(
  project: Pick<FarmProject, 'projectType'> | null | undefined,
) {
  return project?.projectType === 'internal';
}

export function hasBusinessSettlementData(project: FarmProjectInput) {
  return (project.settlementStatus && project.settlementStatus !== 'not_started') ||
    [project.contractAmount, project.settlementClaimAmount, project.settlementApprovedAmount, project.settlementPaidAmount].some((value) => Boolean(value)) ||
    [project.settlementDueDate, project.settledAt, project.settlementOwner, project.settlementEvidenceUrl, project.settlementNote].some((value) => Boolean(value)) ||
    Object.values(project.settlementRounds || {}).some((round) => !settlementsEqual(round, emptySettlement()));
}

/** Change an unused business project without silently migrating any linked records. */
export function assertProjectKindTransition(
  before: FarmProject,
  after: FarmProjectInput,
  related: Pick<FarmLedgerWorkspace, 'records' | 'workItems' | 'projectDocuments' | 'projectUpdates'>,
) {
  if (isInternalProject(before) === isInternalProject(after)) return;
  if (isInternalProject(before))
    throw new Error(
      '내부 프로젝트를 일반·연구 사업으로 바꾸려면 별도 프로젝트를 등록해 주세요.',
    );
  if (before.deletedAt || before.status === 'completed' || after.status === 'completed')
    throw new Error('진행 중 또는 보류 프로젝트만 내부 프로젝트로 바꿀 수 있습니다. 먼저 복구하거나 진행 상태로 열어 주세요.');
  if (hasBusinessSettlementData(before) || hasBusinessSettlementData(after))
    throw new Error('계약·정산 정보가 있어 내부 프로젝트로 바꿀 수 없습니다. 기존 정산 기록을 보존하고 별도 내부 프로젝트를 등록해 주세요.');
  if (related.records.some((record) => record.projectId === before.id))
    throw new Error('연결된 농가가 있어 내부 프로젝트로 바꿀 수 없습니다. 기존 농가 기록을 보존하고 별도 내부 프로젝트를 등록해 주세요.');
  if (related.workItems.some((work) => work.projectId === before.id))
    throw new Error('연결된 업무가 있어 내부 프로젝트로 바꿀 수 없습니다. 삭제된 업무도 포함됩니다. 기존 업무는 보존되며 별도 이관이 필요합니다.');
  const templates: Record<string, string> = { agreement: '협약서·계약서', farm: '참여농가 확정 명단', installation: '설치·시운전 확인서', inspection: '검수·교육 확인서', settlement: '정산보고서·증빙' };
  const documents = related.projectDocuments.filter((document) => document.projectId === before.id);
  if (documents.length > 5 || documents.some((document) =>
    document.title !== templates[document.category] || document.isRequired !== true ||
    document.createdAt !== before.createdAt || document.updatedAt !== document.createdAt ||
    document.status !== 'not_started' || document.submittedAt || document.approvedAt || document.referenceUrl || document.note || document.dueDate || document.revision !== 1) ||
    related.projectUpdates.some((update) => update.projectId === before.id &&
      (update.kind !== 'system' || update.title?.startsWith('제출서류'))))
    throw new Error('작성된 서류·진행 기록이 있어 내부 프로젝트로 바꿀 수 없습니다. 기존 기록을 보존하고 별도 내부 프로젝트를 등록해 주세요.');
}

export function assertBusinessProject(project: FarmProject | undefined) {
  if (isInternalProject(project))
    throw new Error(
      '내부 프로젝트에는 농가·구독 또는 수신함 자동 업무를 연결할 수 없습니다. 내부 업무 등록을 사용해 주세요.',
    );
}

export function assertWorkProjectKind(
  work: Pick<FarmWorkItem, 'scope'>,
  project: FarmProject,
) {
  if ((work.scope === 'internal') !== isInternalProject(project))
    throw new Error(
      '내부 업무는 내부 프로젝트에, 프로젝트·농가 업무는 일반·연구 사업에 연결해 주세요.',
    );
}

export function normalizeInternalProject(
  input: FarmProjectInput,
): FarmProjectInput {
  if (!isInternalProject(input)) return input;
  const { settlementRounds: _rounds, ...fields } = input;
  return {
    ...fields,
    targetFarmCount: 0,
    currentStage: input.status === 'completed' ? 'closed' : 'operation',
    contractAmount: 0,
    settlementStatus: 'not_started',
    settlementDueDate: '',
    settlementClaimAmount: 0,
    settlementApprovedAmount: 0,
    settlementPaidAmount: 0,
    settledAt: '',
    settlementOwner: '',
    settlementEvidenceUrl: '',
    settlementNote: '',
  };
}

/** Internal work has no common business year. Keep complete families across years. */
export function summarizeInternalWorkKpis(
  items: FarmWorkItem[],
  projects: FarmProject[],
  today: string,
) {
  const tasks = [
    ...new Map(
      items
        .filter((item) => !item.deletedAt && isInternalTask(item))
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const hierarchy = summarizeWorkHierarchy(tasks);
  const leaves = hierarchy.leaves;
  const incomplete = leaves.filter((item) => item.status !== 'completed');
  const internalProjects = projects.filter(
    (project) => !project.deletedAt && isInternalProject(project),
  );
  return {
    projects: internalProjects.length,
    activeProjects: internalProjects.filter(
      (project) => project.status === 'active',
    ).length,
    completedProjects: internalProjects.filter(
      (project) => project.status === 'completed',
    ).length,
    tasks: tasks.length,
    rootTasks: hierarchy.rootCount,
    subtasks: hierarchy.subtaskCount,
    executableTasks: hierarchy.leafCount,
    completedTasks: hierarchy.completed,
    completionRate: hierarchy.completionRate,
    incompleteTasks: incomplete.length,
    waitingTasks: incomplete.filter((item) => item.status === 'waiting').length,
    overdueTasks: incomplete.filter(
      (item) => item.dueDate && item.dueDate < today,
    ).length,
  };
}

export type InternalWorkKpis = ReturnType<typeof summarizeInternalWorkKpis>;
