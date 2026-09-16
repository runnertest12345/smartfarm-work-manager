import {
  FARM_SETTLEMENT_STATUSES,
  FARM_SETTLEMENT_STATUS_LABELS,
  type FarmProjectInput,
  type ProjectSettlement,
  type ProjectSettlementRounds,
  type ProjectSettlementRoundKey,
  type FarmSettlementStatus,
} from './farm-types';

export const SETTLEMENT_ROUND_KEYS = ['first', 'second', 'third'] as const;
export const MAX_SETTLEMENT_ROUNDS = SETTLEMENT_ROUND_KEYS.length;

export function settlementRoundKeys(rounds: ProjectSettlementRounds) {
  return SETTLEMENT_ROUND_KEYS.filter((key) => rounds[key] !== undefined);
}

export function settlementRoundLabel(key: ProjectSettlementRoundKey) {
  return `${SETTLEMENT_ROUND_KEYS.indexOf(key) + 1}차 정산`;
}

export function addSettlementRound(rounds: ProjectSettlementRounds): ProjectSettlementRounds {
  const key = SETTLEMENT_ROUND_KEYS[settlementRoundKeys(rounds).length];
  if (!key) throw new Error(`정산은 최대 ${MAX_SETTLEMENT_ROUNDS}차까지 등록할 수 있습니다.`);
  return { ...rounds, [key]: emptySettlement() };
}

export function removeLastSettlementRound(rounds: ProjectSettlementRounds): ProjectSettlementRounds {
  const keys = settlementRoundKeys(rounds);
  const key = keys.at(-1)!;
  if (keys.length <= 1 || !settlementsEqual(rounds[key], emptySettlement()))
    throw new Error('비어 있는 마지막 차수만 삭제할 수 있습니다. 1차는 유지해야 합니다.');
  const next = { ...rounds };
  delete next[key];
  return next;
}

export function emptySettlement(): ProjectSettlement {
  return {
    status: 'not_started',
    dueDate: '',
    claimAmount: 0,
    approvedAmount: 0,
    paidAmount: 0,
    settledAt: '',
    owner: '',
    evidenceUrl: '',
    note: '',
  };
}

export function legacySettlement(project: FarmProjectInput): ProjectSettlement {
  return {
    status: project.settlementStatus,
    dueDate: project.settlementDueDate,
    claimAmount: project.settlementClaimAmount,
    approvedAmount: project.settlementApprovedAmount,
    paidAmount: project.settlementPaidAmount,
    settledAt: project.settledAt,
    owner: project.settlementOwner,
    evidenceUrl: project.settlementEvidenceUrl,
    note: project.settlementNote,
  };
}

export function settlementEntries(
  project: FarmProjectInput,
): Array<[string, ProjectSettlement]> {
  const rounds = project.settlementRounds;
  return rounds
    ? [
        ...settlementRoundKeys(rounds).map((key): [string, ProjectSettlement] => [settlementRoundLabel(key), rounds[key]!]),
        ...(rounds.unassigned
          ? [
              ['회차 미지정 (기존 정산)', rounds.unassigned] as [
                string,
                ProjectSettlement,
              ],
            ]
          : []),
      ]
    : [['회차 미지정 (기존 정산)', legacySettlement(project)]];
}

export const isSettlementDone = (entry: ProjectSettlement) =>
  ['paid', 'closed'].includes(entry.status);

export function settlementsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(
      (key) => key in right && settlementsEqual(left[key], right[key]),
    )
  );
}

export function settlementSummary(rounds: ProjectSettlementRounds) {
  const entries = [
    ...settlementRoundKeys(rounds).map((key) => rounds[key]!),
    ...(rounds.unassigned ? [rounds.unassigned] : []),
  ];
  const allDone = entries.every(isSettlementDone);
  const status: FarmSettlementStatus = entries.every(
    (e) => e.status === 'closed',
  )
    ? 'closed'
    : allDone
      ? 'paid'
      : entries.some((e) => e.status === 'revision')
        ? 'revision'
        : entries.every((e) => e.status === 'not_started')
          ? 'not_started'
          : entries.every((e) =>
                ['approved', 'paid', 'closed'].includes(e.status),
              )
            ? 'approved'
            : entries.every((e) =>
                  ['submitted', 'approved', 'paid', 'closed'].includes(
                    e.status,
                  ),
                )
              ? 'submitted'
              : 'collecting';
  return {
    settlementStatus: status,
    settlementDueDate:
      entries
        .filter((e) => !isSettlementDone(e))
        .map((e) => e.dueDate)
        .filter(Boolean)
        .sort()[0] || '',
    settlementClaimAmount: entries.reduce((sum, e) => sum + e.claimAmount, 0),
    settlementApprovedAmount: entries.reduce(
      (sum, e) => sum + e.approvedAmount,
      0,
    ),
    settlementPaidAmount: entries.reduce((sum, e) => sum + e.paidAmount, 0),
    settledAt:
      allDone && entries.every((e) => e.settledAt)
        ? entries
            .map((e) => e.settledAt)
            .sort()
            .at(-1)!
        : '',
    settlementOwner: [
      ...new Set(entries.map((e) => e.owner).filter(Boolean)),
    ].join(', '),
    settlementEvidenceUrl: '',
    settlementNote: '',
  };
}

export function withSettlementRounds(
  project: FarmProjectInput,
  rounds: ProjectSettlementRounds,
): FarmProjectInput {
  return { ...project, settlementRounds: rounds, ...settlementSummary(rounds) };
}

/** Derive display/KPI values from the rounds, never from a stale scalar cache. */
export function normalizeProjectSettlement<T extends FarmProjectInput>(
  project: T,
): T {
  return project.settlementRounds
    ? { ...project, ...settlementSummary(project.settlementRounds) }
    : project;
}

/** Display-only incoming-payment amounts. A contract difference is not an
 * accounting receivable, and saved workflow states never imply received money. */
export function projectReceivableSummary(project: FarmProjectInput) {
  const normalized = normalizeProjectSettlement(project);
  const contractAmount = normalized.contractAmount;
  const receivedAmount = normalized.settlementPaidAmount;
  return {
    contractAmount,
    claimedAmount: normalized.settlementClaimAmount,
    approvedAmount: normalized.settlementApprovedAmount,
    receivedAmount,
    // Zero does not distinguish an unrecorded contract from a zero-value one.
    remainingContractAmount:
      contractAmount > 0 ? Math.max(contractAmount - receivedAmount, 0) : null,
    // An over-receipt in one round must not hide unpaid money in another.
    unreceivedApprovedAmount: settlementEntries(normalized).reduce(
      (sum, [, entry]) => sum + Math.max(entry.approvedAmount - entry.paidAmount, 0),
      0,
    ),
    excessReceivedAmount:
      contractAmount > 0 ? Math.max(receivedAmount - contractAmount, 0) : 0,
  };
}

export function assignLegacySettlement(
  rounds: ProjectSettlementRounds,
  target: ProjectSettlementRoundKey,
): ProjectSettlementRounds {
  if (!rounds.unassigned) throw new Error('회차 미지정 내역이 없습니다.');
  if (!settlementsEqual(rounds[target], emptySettlement()))
    throw new Error('이미 입력된 회차에는 기존 정산을 옮길 수 없습니다.');
  const { unassigned, ...rest } = rounds;
  return { ...rest, [target]: { ...unassigned } };
}

export function parseSettlementRounds(value: unknown): ProjectSettlementRounds {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('회차별 정산 입력을 확인해 주세요.');
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).some(
      (key) => ![...SETTLEMENT_ROUND_KEYS, 'unassigned'].includes(key),
    )
  )
    throw new Error('정산 회차를 확인해 주세요.');
  const keys = SETTLEMENT_ROUND_KEYS.filter((key) => source[key] !== undefined);
  if (!keys.length || keys.some((key, index) => key !== SETTLEMENT_ROUND_KEYS[index]))
    throw new Error('정산 차수는 1차부터 순서대로 추가해 주세요.');
  function parse(value: unknown): ProjectSettlement {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('정산 내역을 확인해 주세요.');
    const source = value as Record<string, unknown>;
    const result = emptySettlement();
    for (const key of Object.keys(result) as Array<keyof ProjectSettlement>) {
      const field = source[key];
      if (typeof field !== typeof result[key])
        throw new Error('정산 입력값을 확인해 주세요.');
      if (
        typeof field === 'number' &&
        (!Number.isSafeInteger(field) || field < 0 || field > 1e15)
      )
        throw new Error('정산 금액은 0 이상의 정수로 입력해 주세요.');
      if (typeof field === 'string' && field.length > 5000)
        throw new Error('정산 입력값이 너무 깁니다.');
      Object.assign(result, { [key]: field });
    }
    if (!FARM_SETTLEMENT_STATUSES.includes(result.status))
      throw new Error('정산 상태를 확인해 주세요.');
    if (result.paidAmount > result.approvedAmount)
      throw new Error('각 회차의 입금액은 승인액보다 클 수 없습니다.');
    for (const date of [result.dueDate, result.settledAt]) {
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date)
      )
        throw new Error('정산 날짜를 확인해 주세요.');
    }
    if (result.evidenceUrl && !/^https?:\/\//i.test(result.evidenceUrl))
      throw new Error('정산 증빙은 http 또는 https 주소로 입력해 주세요.');
    return result;
  }
  const result = {
    ...Object.fromEntries(keys.map((key) => [key, parse(source[key])])),
    ...(source.unassigned === undefined
      ? {}
      : { unassigned: parse(source.unassigned) }),
  } as ProjectSettlementRounds;
  const totals = settlementSummary(result);
  if ([totals.settlementClaimAmount, totals.settlementApprovedAmount, totals.settlementPaidAmount].some((amount) => !Number.isSafeInteger(amount) || amount > 1e15))
    throw new Error('정산 합계가 입력 가능한 금액 범위를 초과했습니다.');
  return result;
}

export function projectSettlementLabel(project: FarmProjectInput) {
  return project.settlementRounds
    ? `${settlementRoundKeys(project.settlementRounds).map((key) => `${settlementRoundLabel(key).replace(' 정산', '')} ${FARM_SETTLEMENT_STATUS_LABELS[project.settlementRounds![key]!.status]}`).join(' · ')}${project.settlementRounds.unassigned ? ' · 회차 미지정 포함' : ''}`
    : FARM_SETTLEMENT_STATUS_LABELS[project.settlementStatus];
}

export function assertSettlementTransition(
  before: FarmProjectInput,
  after: FarmProjectInput,
) {
  if (!after.settlementRounds) {
    if (before.settlementRounds)
      throw new Error('회차별 정산을 지원하는 최신 화면에서 다시 열어 주세요.');
    return;
  }
  const original = before.settlementRounds
    ? before.settlementRounds.unassigned
    : legacySettlement(before);
  const next = after.settlementRounds;
  const same = settlementsEqual;
  for (const key of before.settlementRounds ? settlementRoundKeys(before.settlementRounds) : []) {
    if (!next[key] && !same(before.settlementRounds![key], emptySettlement()))
      throw new Error('입력된 정산 차수는 삭제할 수 없습니다. 최신 내용을 다시 열어 주세요.');
  }
  if (!original) {
    if (next.unassigned)
      throw new Error('회차 미지정 내역을 새로 만들 수 없습니다.');
  } else if (next.unassigned) {
    if (!same(original, next.unassigned))
      throw new Error('기존 정산 원본은 회차 지정 전까지 변경할 수 없습니다.');
  } else if (
    !settlementRoundKeys(next).some(
      (key) =>
        same(next[key], original) &&
        (!before.settlementRounds ||
          !before.settlementRounds[key] || same(before.settlementRounds[key], emptySettlement())),
    )
  ) {
    throw new Error(
      '기존 내역은 비어 있는 차수로 지정한 뒤 저장해 주세요. 지정한 내역 수정은 다음 저장부터 가능합니다.',
    );
  }
}
