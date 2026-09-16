'use client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FARM_SETTLEMENT_STATUS_LABELS,
  type FarmProjectInput,
  type ProjectSettlement,
  type ProjectSettlementRounds,
  type ProjectSettlementRoundKey,
} from '@/lib/farm-types';
import {
  assignLegacySettlement,
  emptySettlement,
  legacySettlement,
  settlementEntries,
  withSettlementRounds,
  settlementsEqual,
  settlementRoundKeys,
  addSettlementRound,
  removeLastSettlementRound,
  MAX_SETTLEMENT_ROUNDS,
  projectReceivableSummary,
} from '@/lib/project-settlements';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

function SettlementFacts({ entry }: { entry: ProjectSettlement }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            ['청구한 금액', entry.claimAmount],
            ['청구 승인액', entry.approvedAmount],
            ['받은 입금액', entry.paidAmount],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className="mt-1 break-all font-semibold">{money(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-slate-600">
        승인 후 미입금 {money(Math.max(entry.approvedAmount - entry.paidAmount, 0))}
      </p>
      <p>
        담당자 {entry.owner || '미지정'} · 정산 기한 {entry.dueDate || '미입력'}
      </p>
      <p>입금·마감일 {entry.settledAt || '미입력'}</p>
      {entry.evidenceUrl && /^https?:\/\//i.test(entry.evidenceUrl) && (
        <a
          href={entry.evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-emerald-800 underline"
        >
          정산 증빙 열기
        </a>
      )}
      {entry.note && (
        <p className="whitespace-pre-wrap text-slate-600">{entry.note}</p>
      )}
    </div>
  );
}

export function ProjectSettlementDetails({
  project,
}: {
  project: FarmProjectInput;
}) {
  const summary = projectReceivableSummary(project);
  return (
    <div className="space-y-4">
      <dl aria-label="프로젝트 대금 수금 현황" className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['전체 계약금액', summary.contractAmount],
            ['받은 입금액', summary.receivedAmount],
            ['계약 기준 남은 금액', summary.remainingContractAmount],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={`rounded-xl border p-3 ${label === '계약 기준 남은 금액' ? 'border-amber-200 bg-amber-50' : label === '받은 입금액' ? 'border-emerald-100 bg-emerald-50/50' : 'bg-white'}`}>
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="mt-1 break-all text-lg font-bold">
              {value === null ? '계약금액 확인 필요' : money(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 text-sm text-slate-600">
        <p>
          청구 누계 {money(summary.claimedAmount)} · 승인 누계 {money(summary.approvedAmount)}
          {' '}· 승인 후 미입금 {money(summary.unreceivedApprovedAmount)}
        </p>
        <p className="text-xs">
          남은 금액은 계약금액에서 받은 입금액을 뺀 금액입니다. 미청구분도 포함하며,
          연체 금액을 뜻하지 않습니다. 승인과 실제 입금은 구분합니다.
        </p>
        {summary.excessReceivedAmount > 0 && (
          <output className="block font-medium text-amber-800">
            받은 입금액이 계약금액보다 {money(summary.excessReceivedAmount)} 많습니다.
            계약금액과 입금 내역을 확인해 주세요.
          </output>
        )}
      </div>
      <h3 className="font-bold">회차별 청구·수금 내역</h3>
      {(!project.settlementRounds || project.settlementRounds.unassigned) && (
        <p className="text-sm text-slate-600">
          기존 정산은 회차 미지정으로 보존됩니다. 미지정 금액도 총액에 한 번만
          포함됩니다.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {settlementEntries(project).map(([label, entry]) => (
          <section
            key={label}
            className="space-y-4 rounded-xl border bg-white p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h4 className="font-semibold">{label}</h4>
              <span className="text-sm font-semibold text-emerald-800">
                회차 상태: {FARM_SETTLEMENT_STATUS_LABELS[entry.status]}
              </span>
            </div>
            <SettlementFacts entry={entry} />
          </section>
        ))}
      </div>
    </div>
  );
}

function RoundFields({
  id,
  entry,
  onChange,
}: {
  id: string;
  entry: ProjectSettlement;
  onChange: (entry: ProjectSettlement) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${id}-status`}>정산 상태</FieldLabel>
        <Select
          value={entry.status}
          onValueChange={(value) =>
            onChange({ ...entry, status: value as ProjectSettlement['status'] })
          }
        >
          <SelectTrigger id={`${id}-status`} className="w-full bg-white">
            <SelectValue>
              {FARM_SETTLEMENT_STATUS_LABELS[entry.status]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FARM_SETTLEMENT_STATUS_LABELS).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-owner`}>정산 담당자</FieldLabel>
        <Input
          id={`${id}-owner`}
          value={entry.owner}
          onChange={(e) => onChange({ ...entry, owner: e.target.value })}
        />
      </Field>
      {(['dueDate', 'settledAt'] as const).map((key) => (
        <Field key={key}>
          <FieldLabel htmlFor={`${id}-${key}`}>
            {key === 'dueDate' ? '정산 기한' : '입금·마감일'}
          </FieldLabel>
          <Input
            id={`${id}-${key}`}
            type="date"
            value={entry[key]}
            onChange={(e) => onChange({ ...entry, [key]: e.target.value })}
          />
        </Field>
      ))}
      {(
        [
          ['청구한 금액', 'claimAmount'],
          ['청구 승인액', 'approvedAmount'],
          ['받은 입금액', 'paidAmount'],
        ] as const
      ).map(([label, key]) => (
        <Field key={key}>
          <FieldLabel htmlFor={`${id}-${key}`}>{label} (원)</FieldLabel>
          <Input
            id={`${id}-${key}`}
            type="number"
            min={0}
            step={1}
            value={entry[key]}
            onChange={(e) =>
              onChange({ ...entry, [key]: Number(e.target.value) })
            }
          />
          {key === 'paidAmount' && (
            <p className="text-xs text-slate-600">
              우리 회사가 이 회차에서 실제로 입금받은 누적 금액입니다.
            </p>
          )}
        </Field>
      ))}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-evidence`}>
          정산 증빙 링크 (선택)
        </FieldLabel>
        <Input
          id={`${id}-evidence`}
          type="url"
          value={entry.evidenceUrl}
          placeholder="https://drive.google.com/..."
          onChange={(e) => onChange({ ...entry, evidenceUrl: e.target.value })}
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-note`}>정산 메모 (선택)</FieldLabel>
        <Textarea
          id={`${id}-note`}
          value={entry.note}
          onChange={(e) => onChange({ ...entry, note: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function ProjectSettlementEditor({
  value,
  onChange,
  locked,
}: {
  value: FarmProjectInput;
  onChange: (value: FarmProjectInput) => void;
  locked: boolean;
}) {
  const rounds = value.settlementRounds;
  const summary = projectReceivableSummary(value);
  const [assignedRound, setAssignedRound] = useState<ProjectSettlementRoundKey | null>(
    null,
  );
  const change = (next: ProjectSettlementRounds) => {
    if (!locked) onChange(withSettlementRounds(value, next));
  };
  const keys = rounds ? settlementRoundKeys(rounds) : [];
  return (
    <fieldset
      disabled={locked}
      className="space-y-4 rounded-2xl border bg-slate-50 p-4 disabled:opacity-70"
    >
      <legend className="px-1 font-semibold">회차별 정산·수금 관리</legend>
      <Field>
        <FieldLabel htmlFor="project-contractAmount">
          전체 계약금액 (원)
        </FieldLabel>
        <Input
          id="project-contractAmount"
          type="number"
          min={0}
          step={1}
          value={value.contractAmount}
          onChange={(e) =>
            onChange({ ...value, contractAmount: Number(e.target.value) })
          }
        />
        <p className="text-sm text-slate-600">
          계약금액은 고객·기관에서 받을 프로젝트 전체 대금입니다. 청구한 금액,
          청구 승인액, 실제 받은 입금액을 회차별로 입력합니다.
        </p>
      </Field>
      {!rounds ? (
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <h4 className="font-semibold">
            회차 미지정 (기존 정산) ·{' '}
            {FARM_SETTLEMENT_STATUS_LABELS[value.settlementStatus]}
          </h4>
          <SettlementFacts entry={legacySettlement(value)} />
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() =>
              change({
                first: emptySettlement(),
                unassigned: legacySettlement(value),
              })
            }
          >
            기존 내역 보존하고 회차별 관리 시작
          </Button>
          <p className="text-sm text-slate-600">
            기존 내역은 그대로 보존하며, 아래에서 회차를 지정할 수 있습니다.
            완료된 프로젝트는 먼저 진행 중으로 변경해 저장하세요.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              필요한 차수만 추가하세요. 회차의 정산 마감과 전체 계약대금의 입금 완료는 구분합니다.
            </p>
            <Button type="button" variant="outline" disabled={locked || keys.length >= MAX_SETTLEMENT_ROUNDS}
              onClick={() => change(addSettlementRound(rounds))}>
              + 차수 추가
            </Button>
          </div>
          <p className="text-sm text-slate-600">현재 {keys.length}개 차수 · 최대 {MAX_SETTLEMENT_ROUNDS}차</p>
          {keys.map((key, index) => (
            <details key={key} className="rounded-xl border bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {index + 1}차 정산 ·{' '}
                {FARM_SETTLEMENT_STATUS_LABELS[rounds[key]!.status]} · 받은 입금{' '}
                {money(rounds[key]!.paidAmount)}{' '}
                <span className="ml-2 text-emerald-800">상세 입력</span>
              </summary>
              {locked || assignedRound === key ? (
                <div className="mt-4 space-y-3">
                  <SettlementFacts entry={rounds[key]!} />
                  {assignedRound === key && (
                    <output
                      className="block text-sm font-semibold text-emerald-800"
                    >
                      기존 내역의 회차를 지정했습니다. 먼저 수정 저장한 뒤 다시
                      열어 내용을 변경하세요.
                    </output>
                  )}
                </div>
              ) : (
                <RoundFields
                  id={`project-settlement-${key}`}
                  entry={rounds[key]!}
                  onChange={(entry) => change({ ...rounds, [key]: entry })}
                />
              )}
            </details>
          ))}
          {keys.length > 1 && settlementsEqual(rounds[keys.at(-1)!], emptySettlement()) && (
            <Button type="button" variant="ghost" disabled={locked}
              onClick={() => change(removeLastSettlementRound(rounds))}>
              비어 있는 {keys.length}차 삭제
            </Button>
          )}
          {rounds.unassigned && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-semibold">회차 미지정 (기존 정산)</h4>
              <SettlementFacts entry={rounds.unassigned} />
              <p className="text-sm">
                해당 회차가 맞는지 확인하고 지정하세요. 입력 내용이 없는
                회차에만 옮길 수 있으며, 중복 합산되지 않습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {keys.map((key, index) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    disabled={
                      locked ||
                      !settlementsEqual(rounds[key], emptySettlement())
                    }
                    onClick={() => {
                      if (!locked) {
                        change(assignLegacySettlement(rounds, key));
                        setAssignedRound(key);
                      }
                    }}
                  >
                    기존 내역을 {index + 1}차로 지정
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div aria-label="수금 입력 합계" className="space-y-1 text-sm">
        <p className="font-semibold">
          받은 입금 합계 {money(summary.receivedAmount)} · 계약 기준 남은 금액{' '}
          {summary.remainingContractAmount === null ? '계약금액 확인 필요' : money(summary.remainingContractAmount)}
        </p>
        <p className="text-slate-600">
          청구 누계 {money(summary.claimedAmount)} · 승인 누계 {money(summary.approvedAmount)}
          {' '}· 승인 후 미입금 {money(summary.unreceivedApprovedAmount)}
        </p>
        <p className="text-xs text-slate-600">남은 금액에는 미청구분도 포함됩니다. 연체 금액을 뜻하지 않습니다.</p>
        {summary.excessReceivedAmount > 0 && (
          <output className="block text-amber-800">
            받은 입금액이 계약금액보다 {money(summary.excessReceivedAmount)} 많습니다. 입력 내역을 확인해 주세요.
          </output>
        )}
      </div>
    </fieldset>
  );
}
