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
} from '@/lib/farm-types';
import {
  assignLegacySettlement,
  emptySettlement,
  legacySettlement,
  settlementEntries,
  withSettlementRounds,
  settlementsEqual,
} from '@/lib/project-settlements';

const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;

function SettlementFacts({ entry }: { entry: ProjectSettlement }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            ['청구액', entry.claimAmount],
            ['승인액', entry.approvedAmount],
            ['입금액', entry.paidAmount],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className="mt-1 break-all font-semibold">{money(value)}</dd>
          </div>
        ))}
      </dl>
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
  return (
    <div className="space-y-4">
      <h3 className="font-bold">회차별 정산</h3>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ['전체 계약금액', project.contractAmount],
            ['총 청구액', project.settlementClaimAmount],
            ['총 승인액', project.settlementApprovedAmount],
            ['총 입금액', project.settlementPaidAmount],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="mt-1 break-all font-bold">{money(value)}</dd>
          </div>
        ))}
      </dl>
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
                {FARM_SETTLEMENT_STATUS_LABELS[entry.status]}
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
          ['청구액', 'claimAmount'],
          ['승인액', 'approvedAmount'],
          ['입금액', 'paidAmount'],
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
  const [assignedRound, setAssignedRound] = useState<'first' | 'second' | null>(
    null,
  );
  const change = (next: ProjectSettlementRounds) => {
    if (!locked) onChange(withSettlementRounds(value, next));
  };
  return (
    <fieldset
      disabled={locked}
      className="space-y-4 rounded-2xl border bg-slate-50 p-4 disabled:opacity-70"
    >
      <legend className="px-1 font-semibold">1차·2차 정산 관리</legend>
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
          계약금액은 프로젝트 전체 금액입니다. 청구·승인·입금액은 회차별로
          입력합니다.
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
                second: emptySettlement(),
                unassigned: legacySettlement(value),
              })
            }
          >
            기존 내역 보존하고 1·2차 관리 시작
          </Button>
          <p className="text-sm text-slate-600">
            기존 내역은 그대로 보존하며, 아래에서 회차를 지정할 수 있습니다.
            완료된 프로젝트는 먼저 진행 중으로 변경해 저장하세요.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            각 회차를 펼쳐 입력하세요. 1차만 끝나면 전체 정산은 완료되지
            않습니다.
          </p>
          {(['first', 'second'] as const).map((key, index) => (
            <details key={key} className="rounded-xl border bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {index + 1}차 정산 ·{' '}
                {FARM_SETTLEMENT_STATUS_LABELS[rounds[key].status]} · 입금{' '}
                {money(rounds[key].paidAmount)}{' '}
                <span className="ml-2 text-emerald-800">상세 입력</span>
              </summary>
              {locked || assignedRound === key ? (
                <div className="mt-4 space-y-3">
                  <SettlementFacts entry={rounds[key]} />
                  {assignedRound === key && (
                    <p
                      role="status"
                      className="text-sm font-semibold text-emerald-800"
                    >
                      기존 내역의 회차를 지정했습니다. 먼저 수정 저장한 뒤 다시
                      열어 내용을 변경하세요.
                    </p>
                  )}
                </div>
              ) : (
                <RoundFields
                  id={`project-settlement-${key}`}
                  entry={rounds[key]}
                  onChange={(entry) => change({ ...rounds, [key]: entry })}
                />
              )}
            </details>
          ))}
          {rounds.unassigned && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-semibold">회차 미지정 (기존 정산)</h4>
              <SettlementFacts entry={rounds.unassigned} />
              <p className="text-sm">
                해당 회차가 맞는지 확인하고 지정하세요. 입력 내용이 없는
                회차에만 옮길 수 있으며, 중복 합산되지 않습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {(['first', 'second'] as const).map((key, index) => (
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
          <p className="text-sm font-semibold">
            총 청구 {money(value.settlementClaimAmount)} · 총 승인{' '}
            {money(value.settlementApprovedAmount)} · 총 입금{' '}
            {money(value.settlementPaidAmount)}
          </p>
        </>
      )}
    </fieldset>
  );
}
