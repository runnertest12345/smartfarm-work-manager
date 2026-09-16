'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import type { FarmProject, FarmProjectInput } from '@/lib/farm-types';
import {
  projectSettlementDraft,
  projectSettlementInput,
} from '@/lib/project-settlement-edit';
import {
  ProjectSettlementDetails,
  ProjectSettlementEditor,
} from './project-settlement-panels';

export function ProjectSettlementWorkspace({
  project,
  onSave,
  onEditingChange,
}: {
  project: FarmProject;
  onSave: (base: FarmProject, values: FarmProjectInput) => Promise<FarmProject>;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<{
    base: FarmProject;
    draft: FarmProjectInput;
  } | null>(null);
  const [lastSaved, setLastSaved] = useState<FarmProject | null>(null);
  const latest =
    lastSaved?.id === project.id && lastSaved.updatedAt > project.updatedAt
      ? lastSaved
      : project;
  const base = editing?.base ?? latest;
  const draft = editing?.draft ?? projectSettlementDraft(latest);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const callback = useRef(onEditingChange);
  useEffect(() => {
    callback.current = onEditingChange;
  }, [onEditingChange]);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(projectSettlementDraft(base));
  const conflict = Boolean(editing && latest.updatedAt > base.updatedAt);
  const locked =
    Boolean(project.deletedAt || latest.deletedAt) ||
    base.status === 'completed' ||
    latest.status === 'completed' ||
    base.projectType === 'internal' ||
    latest.projectType === 'internal';

  useEffect(() => {
    callback.current(dirty || busy);
  }, [dirty, busy]);
  useEffect(() => () => callback.current(false), []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);

  function change(next: FarmProjectInput) {
    if (busyRef.current || locked) return;
    callback.current(
      JSON.stringify(next) !== JSON.stringify(projectSettlementDraft(base)),
    );
    setEditing({ base, draft: next });
    setError('');
    setSaved(false);
  }

  async function submit(
    event: Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0],
  ) {
    event.preventDefault();
    if (busyRef.current || !dirty || locked || conflict) return;
    busyRef.current = true;
    setBusy(true);
    callback.current(true);
    setError('');
    try {
      const result = await onSave(base, projectSettlementInput(base, draft));
      setLastSaved(result);
      setEditing(null);
      setSaved(true);
      callback.current(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '정산을 저장하지 못했습니다. 입력 내용은 유지됩니다.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="프로젝트 정산"
      className="space-y-4 rounded-xl border bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">정산·수금 관리</h2>
          <p className="mt-1 text-xs text-slate-500">
            고객·기관에 청구하고 우리 회사가 입금받는 프로젝트 대금을 관리합니다.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {!editing && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                setEditing({
                  base: latest,
                  draft: projectSettlementDraft(latest),
                });
                setError('');
                setSaved(false);
              }}
            >
              정산 수정
            </Button>
          )}
          <output aria-live="polite" className="text-xs text-slate-500">
            {busy
              ? '저장 중…'
              : dirty
                ? '저장하지 않은 변경 사항'
                : saved
                  ? '정산 저장됨'
                  : ''}
          </output>
        </div>
      </div>
      {locked && (
        <p className="text-sm text-slate-600">
          {project.deletedAt || latest.deletedAt
            ? '삭제된 프로젝트는 정산을 수정할 수 없습니다.'
            : latest.projectType === 'internal'
              ? '내부 프로젝트는 사업 정산을 사용하지 않습니다.'
              : '완료 프로젝트의 정산은 잠겨 있습니다. 기본정보에서 진행 중 또는 보류로 변경해 저장한 뒤 수정해 주세요.'}
        </p>
      )}
      {editing ? (
        <form
          aria-label="프로젝트 정산 수정"
          onSubmit={submit}
          className="space-y-4"
        >
          <ProjectSettlementEditor
            value={draft}
            onChange={change}
            locked={busy || locked}
          />
          {conflict && (
            <p role="alert" className="text-sm text-amber-800">
              다른 변경이 먼저 저장되었습니다. 입력 내용은 유지됩니다. 필요한
              초안을 복사한 뒤 변경 취소를 누르면 최신 정산을 불러옵니다.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (busyRef.current) return;
                setEditing(null);
                setError('');
                callback.current(false);
              }}
            >
              변경 취소
            </Button>
            <Button
              type="submit"
              disabled={busy || !dirty || locked || conflict}
            >
              {busy ? '저장 중…' : '정산 저장'}
            </Button>
          </div>
        </form>
      ) : (
        <ProjectSettlementDetails project={projectSettlementDraft(latest)} />
      )}
    </section>
  );
}
