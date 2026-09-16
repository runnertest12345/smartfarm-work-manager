'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FarmWorkItem } from '@/lib/farm-types';
import { MAX_WORK_TITLE_LENGTH, validateWorkTitle } from '@/lib/work-title';

type TitleDraft = { base: FarmWorkItem; title: string };

export function WorkTitleEditor({
  task,
  canEdit,
  onSave,
  onEditingChange,
  headingLevel = 1,
}: {
  task: FarmWorkItem;
  canEdit: boolean;
  onSave: (base: FarmWorkItem, title: string, operationId: string) => Promise<FarmWorkItem>;
  onEditingChange: (dirtyOrBusy: boolean) => void;
  headingLevel?: 1 | 3;
}) {
  const fieldId = useId();
  const [editing, setEditing] = useState<TitleDraft | null>(null);
  const editingRef = useRef<TitleDraft | null>(null);
  const [lastSaved, setLastSaved] = useState<FarmWorkItem | null>(null);
  const latest = !task.deletedAt && lastSaved?.id === task.id && lastSaved.updatedAt > task.updatedAt
    ? lastSaved : task;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const attemptRef = useRef<{ title: string; operationId: string } | null>(null);
  const composingRef = useRef(false);
  const mountedRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const liveRef = useRef({ latest, canEdit, onSave, onEditingChange });
  useLayoutEffect(() => {
    liveRef.current = { latest, canEdit, onSave, onEditingChange };
  }, [latest, canEdit, onSave, onEditingChange]);
  const isEditing = Boolean(editing);
  const dirty = Boolean(editing && editing.title.trim() !== editing.base.title.trim());
  const locked = !canEdit || Boolean(latest.deletedAt);
  const conflict = Boolean(editing && (
    latest.id !== editing.base.id || latest.updatedAt !== editing.base.updatedAt || latest.title !== editing.base.title
  ));
  const Heading = headingLevel === 3 ? 'h3' : 'h1';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      liveRef.current.onEditingChange(false);
    };
  }, []);
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      (titleRef.current ?? headingRef.current)?.focus({ preventScroll: true });
    }
  }, [isEditing]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);

  function finishEditing() {
    editingRef.current = null;
    setEditing(null);
    attemptRef.current = null;
    composingRef.current = false;
    restoreFocusRef.current = true;
    liveRef.current.onEditingChange(false);
  }

  function beginEditing() {
    const live = liveRef.current;
    if (busyRef.current || !live.canEdit || live.latest.deletedAt) return;
    const next = { base: { ...live.latest }, title: live.latest.title };
    editingRef.current = next;
    setEditing(next);
    attemptRef.current = null;
    setError('');
    setSaved(false);
    live.onEditingChange(false);
  }

  function change(title: string) {
    const current = editingRef.current;
    if (!current || busyRef.current || !liveRef.current.canEdit || liveRef.current.latest.deletedAt) return;
    if (attemptRef.current && title.trim() !== attemptRef.current.title) attemptRef.current = null;
    const next = { ...current, title };
    editingRef.current = next;
    // Update the navigation guard before React commits this input change.
    liveRef.current.onEditingChange(title.trim() !== current.base.title.trim());
    setEditing(next);
    setError('');
  }

  function cancel() {
    if (busyRef.current) return;
    finishEditing();
    setError('');
    setSaved(false);
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    // oxlint-disable-next-line typescript/no-deprecated -- Safari can finish composition before its final Enter keydown.
    const legacyComposition = event.keyCode === 229;
    if (event.key === 'Enter' && (composingRef.current || event.nativeEvent.isComposing || legacyComposition)) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!composingRef.current && !event.nativeEvent.isComposing) {
        event.preventDefault();
        cancel();
      }
    }
  }

  async function submit(event: Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]) {
    event.preventDefault();
    const current = editingRef.current;
    const live = liveRef.current;
    if (!current || busyRef.current || composingRef.current) return;
    if (!live.canEdit || live.latest.deletedAt || live.latest.id !== current.base.id ||
      live.latest.updatedAt !== current.base.updatedAt || live.latest.title !== current.base.title) return;
    let title: string;
    try {
      title = validateWorkTitle(current.title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업무명을 확인해 주세요.');
      return;
    }
    if (title === current.base.title.trim()) {
      cancel();
      return;
    }
    busyRef.current = true;
    live.onEditingChange(true);
    setBusy(true);
    setError('');
    try {
      // An uncertain retry of the same payload must use the same mutation ID.
      const attempt = attemptRef.current?.title === title
        ? attemptRef.current : { title, operationId: crypto.randomUUID() };
      attemptRef.current = attempt;
      const result = await live.onSave(current.base, title, attempt.operationId);
      if (!mountedRef.current) return;
      setLastSaved(result);
      finishEditing();
      setSaved(true);
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : '업무명을 저장하지 못했습니다. 입력한 내용은 유지됩니다.');
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
        const remaining = editingRef.current;
        liveRef.current.onEditingChange(Boolean(remaining && remaining.title.trim() !== remaining.base.title.trim()));
      }
    }
  }

  return (
    <div className="min-w-0">
      <Heading ref={headingRef} tabIndex={-1} className={editing ? 'sr-only' : `mt-2 min-w-0 font-semibold [overflow-wrap:anywhere] ${headingLevel === 1 ? 'text-2xl' : 'text-lg'}`}>
        {!editing && !locked ? (
          <button ref={titleRef} type="button" aria-label={`업무명 수정: ${latest.title}`} onClick={beginEditing}
            className="group inline-flex max-w-full items-start gap-2 rounded-md text-left outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600">
            <span className="min-w-0 [overflow-wrap:anywhere]">{latest.title}</span>
            <Pencil aria-hidden="true" className="mt-1.5 size-4 shrink-0 text-slate-400 group-hover:text-emerald-700" />
          </button>
        ) : latest.title}
      </Heading>
      {editing && (
        <form aria-label="업무명 수정" onSubmit={submit} className="mt-2 min-w-0 space-y-2">
          <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600">업무명</label>
          <Input ref={inputRef} id={fieldId} name="title" value={editing.title} maxLength={MAX_WORK_TITLE_LENGTH}
            disabled={busy || locked} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined}
            onChange={(event) => change(event.target.value)}
            onKeyDown={keyboard}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }} />
          {locked && <p role="alert" className="text-xs text-amber-800">{latest.deletedAt ? '삭제된 업무는 수정할 수 없습니다.' : '업무명을 수정할 권한이 없습니다.'} 입력한 내용은 유지됩니다.</p>}
          {conflict && <p role="alert" className="text-xs text-amber-800">다른 변경이 먼저 저장되었습니다. 입력한 내용은 유지됩니다. 초안을 복사한 뒤 취소하면 최신 업무명을 확인할 수 있습니다.</p>}
          {error && <p id={`${fieldId}-error`} role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" onKeyDown={keyboard} disabled={busy || locked || conflict}>{busy ? '저장 중…' : '저장'}</Button>
            <Button type="button" size="sm" variant="ghost" onKeyDown={keyboard} disabled={busy} onClick={cancel}>취소</Button>
            <span className="text-xs text-slate-500">{editing.title.length}/{MAX_WORK_TITLE_LENGTH}</span>
          </div>
        </form>
      )}
      <output aria-live="polite" className="text-xs text-emerald-700">{saved && !editing ? '업무명 저장됨' : ''}</output>
    </div>
  );
}
