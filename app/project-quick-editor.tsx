'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FARM_PROJECT_STAGE_LABELS,
  FARM_PROJECT_TYPE_LABELS,
  type FarmProject,
} from '@/lib/farm-types';
import {
  projectQuickValues,
  updateProjectQuickValues,
  type ProjectQuickField,
  type ProjectQuickValues,
} from '@/lib/project-quick-edit';

const selectClassName =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:opacity-50';
const labelClassName = 'min-w-0 space-y-1 text-xs font-medium text-slate-600';

export function ProjectQuickEditor({
  project,
  focusRequest,
  onSave,
  onEditingChange,
}: {
  project: FarmProject;
  focusRequest: { field: ProjectQuickField; ticket: number } | null;
  onSave: (
    base: FarmProject,
    values: ProjectQuickValues,
  ) => Promise<FarmProject>;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<{
    base: FarmProject;
    draft: ProjectQuickValues;
  } | null>(null);
  const [lastSaved, setLastSaved] = useState<FarmProject | null>(null);
  const latest =
    lastSaved && lastSaved.updatedAt > project.updatedAt ? lastSaved : project;
  const base = editing?.base ?? latest;
  const draft = editing?.draft ?? projectQuickValues(latest);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const callback = useRef(onEditingChange);
  useEffect(() => {
    callback.current = onEditingChange;
  }, [onEditingChange]);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(projectQuickValues(base));
  const internal = draft.projectType === 'internal';
  const completionLocked = base.status === 'completed';

  useEffect(() => {
    callback.current(dirty || busy);
  }, [dirty, busy]);
  useEffect(() => () => callback.current(false), []);
  useEffect(() => {
    if (!focusRequest) return;
    const target = form.current?.elements.namedItem(focusRequest.field);
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }, [focusRequest]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);

  function update<K extends ProjectQuickField>(
    key: K,
    value: ProjectQuickValues[K],
  ) {
    const next = updateProjectQuickValues(draft, key, value);
    callback.current(
      JSON.stringify(next) !== JSON.stringify(projectQuickValues(base)),
    );
    setEditing(
      JSON.stringify(next) !== JSON.stringify(projectQuickValues(base))
        ? { base, draft: next }
        : null,
    );
    setError('');
    setSaved(false);
  }

  async function submit(
    event: Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0],
  ) {
    event.preventDefault();
    if (busyRef.current || !dirty || project.deletedAt) return;
    busyRef.current = true;
    setBusy(true);
    callback.current(true);
    setError('');
    try {
      const result = await onSave(base, draft);
      setLastSaved(result);
      setEditing(null);
      setSaved(true);
      callback.current(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '저장하지 못했습니다. 입력 내용은 유지됩니다.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      aria-label="프로젝트 기본정보 바로 수정"
      className="mb-4 rounded-xl border border-emerald-200 bg-white p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">기본정보</h2>
        <output className="text-xs text-slate-500" aria-live="polite">
          {busy
            ? '저장 중…'
            : dirty
              ? '저장하지 않은 변경 사항'
              : saved
                ? '저장됨'
                : '항목을 눌러 바로 수정'}
        </output>
      </div>
      <fieldset
        disabled={busy || Boolean(project.deletedAt)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label
          htmlFor="quick-project-name"
          className={`${labelClassName} sm:col-span-2 lg:col-span-3`}
        >
          프로젝트명
          <Input
            id="quick-project-name"
            name="name"
            value={draft.name}
            required
            maxLength={240}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label htmlFor="quick-project-type" className={labelClassName}>
          프로젝트 유형
          <select
            id="quick-project-type"
            name="projectType"
            className={selectClassName}
            value={draft.projectType}
            onChange={(event) =>
              update(
                'projectType',
                event.target.value as ProjectQuickValues['projectType'],
              )
            }
          >
            {Object.entries(FARM_PROJECT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="quick-project-year" className={labelClassName}>
          기준 연도
          <Input
            id="quick-project-year"
            name="year"
            type="number"
            min={2000}
            max={2100}
            step={1}
            required
            value={draft.year}
            onChange={(event) => update('year', Number(event.target.value))}
          />
        </label>
        <label htmlFor="quick-project-institution" className={labelClassName}>
          {internal ? '부서' : '주관기관'}
          <Input
            id="quick-project-institution"
            name="institution"
            value={draft.institution}
            required={!internal}
            maxLength={240}
            onChange={(event) => update('institution', event.target.value)}
          />
        </label>
        <label htmlFor="quick-project-status" className={labelClassName}>
          상태
          <select
            id="quick-project-status"
            name="status"
            className={selectClassName}
            value={draft.status}
            onChange={(event) =>
              update(
                'status',
                event.target.value as ProjectQuickValues['status'],
              )
            }
          >
            <option value="active">진행 중</option>
            <option value="on_hold">보류</option>
            <option value="completed">완료</option>
          </select>
        </label>
        <label htmlFor="quick-project-manager" className={labelClassName}>
          담당자
          <Input
            id="quick-project-manager"
            name="manager"
            value={draft.manager}
            required
            maxLength={120}
            onChange={(event) => update('manager', event.target.value)}
            placeholder="담당자 입력"
          />
        </label>
        {!internal && (
          <label htmlFor="quick-project-stage" className={labelClassName}>
            현재 사업 단계
            <select
              id="quick-project-stage"
              name="currentStage"
              className={selectClassName}
              value={draft.currentStage}
              onChange={(event) =>
                update(
                  'currentStage',
                  event.target.value as ProjectQuickValues['currentStage'],
                )
              }
            >
              {Object.entries(FARM_PROJECT_STAGE_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        {!internal && (
          <label
            htmlFor="quick-project-installations"
            className={labelClassName}
          >
            설치 개소
            <Input
              id="quick-project-installations"
              name="targetFarmCount"
              type="number"
              min={0}
              step={1}
              required
              disabled={completionLocked}
              aria-describedby="quick-project-installation-help"
              value={draft.targetFarmCount}
              onChange={(event) =>
                update('targetFarmCount', Number(event.target.value))
              }
            />
          </label>
        )}
        <label htmlFor="quick-project-start" className={labelClassName}>
          프로젝트 시작일
          <Input
            id="quick-project-start"
            name="startDate"
            type="date"
            disabled={completionLocked}
            value={draft.startDate}
            onChange={(event) => update('startDate', event.target.value)}
          />
        </label>
        <label htmlFor="quick-project-end" className={labelClassName}>
          종료 예정일
          <Input
            id="quick-project-end"
            name="endDate"
            type="date"
            disabled={completionLocked}
            value={draft.endDate}
            onChange={(event) => update('endDate', event.target.value)}
          />
        </label>
        <label
          htmlFor="quick-project-description"
          className={`${labelClassName} sm:col-span-2 lg:col-span-3`}
        >
          프로젝트 설명
          <Textarea
            id="quick-project-description"
            name="description"
            rows={2}
            maxLength={5000}
            className="min-h-16"
            value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="프로젝트 목적과 범위"
          />
        </label>
      </fieldset>
      {!internal && (
        <p
          id="quick-project-installation-help"
          className="mt-2 text-xs leading-5 text-slate-500"
        >
          설치 개소는 기준값입니다. 수정해도 농가가 자동으로 추가·삭제되지는
          않습니다.
        </p>
      )}
      {draft.projectType !== base.projectType && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          유형 변경은 저장 시 연결된 농가·업무·정산 기록을 확인합니다. 기존
          기록이 있으면 내부 프로젝트 전환이 제한될 수 있습니다.
        </p>
      )}
      {completionLocked && (
        <p className="mt-2 text-xs text-slate-500">
          완료 프로젝트의 설치 개소·기간을 바꾸려면 먼저 진행 중 또는 보류로
          전환해 저장해 주세요.
        </p>
      )}
      {dirty && latest.updatedAt > base.updatedAt && (
        <p className="mt-2 text-xs text-amber-800">
          다른 변경이 먼저 저장되었습니다. 초안을 복사한 뒤 변경 취소를 누르면
          최신 정보를 불러옵니다.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {(dirty || busy) && (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setError('');
              callback.current(false);
            }}
          >
            변경 취소
          </Button>
          <Button type="submit" disabled={busy || Boolean(project.deletedAt)}>
            {busy ? '저장 중…' : '변경 저장'}
          </Button>
        </div>
      )}
    </form>
  );
}
