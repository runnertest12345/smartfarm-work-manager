'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FARM_WORK_STATUSES,
  FARM_WORK_STATUS_LABELS,
  FARM_HISTORY_CHANNEL_LABELS,
  type FarmWorkItem,
  type FarmWorkStatus,
  type AddFarmHistoryEntryInput,
  type FarmHistoryChannel,
} from '@/lib/farm-types';
import { isProjectTask } from '@/lib/project-work';
import { buildWorkHierarchy } from '@/lib/work-hierarchy';
import { ReceivedContentInput } from './received-images';
import type { ReceivedImage } from '@/lib/received-images';
import { WorkBoard } from './work-board';

export type QuickWorkSave = (
  input: AddFarmHistoryEntryInput,
  images: ReceivedImage[],
) => Promise<void>;
const statusColors: Record<FarmWorkStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-50 text-blue-800',
  waiting: 'bg-amber-50 text-amber-900',
  completed: 'bg-emerald-50 text-emerald-800',
};

export function WorkStatusSelect({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: FarmWorkStatus;
  onChange: (value: FarmWorkStatus) => void;
  id: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (FARM_WORK_STATUSES.includes(next as FarmWorkStatus))
          onChange(next as FarmWorkStatus);
      }}
    >
      <SelectTrigger id={id} className="h-10 w-full bg-white">
        <SelectValue>{FARM_WORK_STATUS_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FARM_WORK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {FARM_WORK_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function WorkQuickEditor({
  task,
  initialStatus,
  recorder,
  onSave,
  onCancel,
  onAdvanced,
  onBusy,
  statusLocked = false,
  popup = false,
  returnFocus,
}: {
  task: FarmWorkItem;
  initialStatus?: FarmWorkStatus;
  recorder: string;
  onSave: QuickWorkSave;
  onCancel: () => void;
  onAdvanced?: () => void;
  onBusy?: (busy: boolean) => void;
  statusLocked?: boolean;
  popup?: boolean;
  returnFocus?: () => HTMLElement | null;
}) {
  // Capture the version when opened. Do not silently overwrite a draft after realtime updates.
  const [base] = useState(task);
  const [operationId] = useState(() => crypto.randomUUID());
  const [occurredAt] = useState(() => Date.now());
  const [status, setStatus] = useState(initialStatus || task.status);
  const [action, setAction] = useState('');
  const [received, setReceived] = useState('');
  const [channel, setChannel] = useState<FarmHistoryChannel>('other');
  const [images, setImages] = useState<ReceivedImage[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [owner, setOwner] = useState(task.owner);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [nextAction, setNextAction] = useState(task.nextAction);
  const [reason, setReason] = useState(task.blockedReason);
  const [blockedBy, setBlockedBy] = useState(task.blockedBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const changedElsewhere = task.updatedAt !== base.updatedAt;
  const dirty = Boolean(
    action ||
    received ||
    images.length ||
    status !== base.status ||
    owner !== base.owner ||
    dueDate !== base.dueDate ||
    nextAction !== base.nextAction ||
    reason !== base.blockedReason ||
    blockedBy !== base.blockedBy,
  );
  const prefix = `quick-${task.id}`;
  function requestClose() {
    if (locked.current || saving || imageBusy) return;
    if (popup && dirty) setConfirmDiscard(true);
    else onCancel();
  }
  const form = (
    <form
      aria-label={`${task.title} 빠른 수정`}
      className={
        popup
          ? 'space-y-3 text-left'
          : 'space-y-3 rounded-xl border border-emerald-300 bg-white p-4 text-left shadow-sm'
      }
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked.current || imageBusy || changedElsewhere) return;
        if (
          !action.trim() &&
          !received.trim() &&
          !images.length &&
          status === base.status &&
          owner === base.owner &&
          dueDate === base.dueDate &&
          nextAction === base.nextAction &&
          reason === base.blockedReason &&
          blockedBy === base.blockedBy
        ) {
          setError('변경할 상태나 처리 내용을 입력해 주세요.');
          return;
        }
        locked.current = true;
        setSaving(true);
        onBusy?.(true);
        setError('');
        try {
          await onSave(
            {
              workItemId: base.id,
              expectedUpdatedAt: base.updatedAt,
              operationId,
              occurredAt,
              recorder,
              channel,
              sender: '',
              receivedContent: received,
              actionContent: action,
              amount: 0,
              referenceUrl: '',
              newStatus: status,
              owner,
              dueDate,
              nextAction,
              blockedReason: reason,
              blockedBy,
            },
            images,
          );
          onCancel();
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : '저장하지 못했습니다. 다시 시도해 주세요.',
          );
        } finally {
          locked.current = false;
          setSaving(false);
          onBusy?.(false);
        }
      }}
    >
      {!popup && (
        <h3 className="text-base font-semibold">{task.title} · 빠른 수정</h3>
      )}
      {statusLocked && (
        <p className="text-sm text-slate-600">
          완료된 사업 또는 상위 업무를 다시 열기 전에는 상태를 바꿀 수 없습니다.
          처리 내용과 캡처는 추가할 수 있습니다.
        </p>
      )}
      {changedElsewhere && (
        <p role="alert" className="text-sm text-amber-900">
          다른 변경이 먼저 저장됐습니다. 아래 작성 내용을 복사해 보관한 뒤 닫고
          다시 열어 주세요.
        </p>
      )}
      <fieldset disabled={saving || imageBusy} className="space-y-3">
        <div>
          <label
            htmlFor={`${prefix}-status`}
            className="mb-1 block text-sm font-medium"
          >
            상태
          </label>
          <WorkStatusSelect
            id={`${prefix}-status`}
            value={status}
            onChange={setStatus}
            disabled={statusLocked}
          />
        </div>
        <div>
          <label
            htmlFor={`${prefix}-action`}
            className="mb-1 block text-sm font-medium"
          >
            {base.status === 'waiting' && status !== 'waiting'
              ? '막힘 해제 내용 (필수)'
              : '처리 내용'}
          </label>
          <Textarea
            id={`${prefix}-action`}
            value={action}
            onChange={(event) => setAction(event.target.value)}
            required={base.status === 'waiting' && status !== 'waiting'}
            placeholder="예: 견적서를 전달했고 담당자 확인을 기다리고 있습니다."
            className="min-h-24 text-base"
          />
        </div>
        {status === 'waiting' && (
          <div className="grid gap-3 rounded-lg bg-amber-50 p-3">
            <label
              className="text-sm font-medium"
              htmlFor={`work-control-1-${task.id}`}
            >
              막힌 이유
              <Input
                id={`work-control-1-${task.id}`}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="예: 내부 견적 승인 대기"
                className="mt-1 h-10 bg-white"
              />
            </label>
            <label
              className="text-sm font-medium"
              htmlFor={`work-control-2-${task.id}`}
            >
              확인이 필요한 사람·기관
              <Input
                id={`work-control-2-${task.id}`}
                required
                value={blockedBy}
                onChange={(event) => setBlockedBy(event.target.value)}
                placeholder="예: 영업팀"
                className="mt-1 h-10 bg-white"
              />
            </label>
          </div>
        )}
        <Collapsible>
          <CollapsibleTrigger className="flex min-h-10 items-center gap-2 text-sm font-medium text-emerald-800">
            <ChevronDown className="size-4" />
            받은 내용·캡처 추가 (선택)
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted className="space-y-3 pt-2">
            <label className="block text-sm" htmlFor={`${prefix}-channel`}>
              수신 경로
            </label>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as FarmHistoryChannel)}
            >
              <SelectTrigger id={`${prefix}-channel`} className="h-10 w-full">
                <SelectValue>
                  {FARM_HISTORY_CHANNEL_LABELS[channel]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    'email',
                    'kakao',
                    'phone',
                    'verbal',
                    'meeting',
                    'other',
                  ] as const
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {FARM_HISTORY_CHANNEL_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ReceivedContentInput
              aria-label="받은 내용"
              value={received}
              onChange={(event) => setReceived(event.target.value)}
              images={images}
              onImagesChange={setImages}
              onBusyChange={(busy) => {
                setImageBusy(busy);
                onBusy?.(busy);
              }}
              disabled={saving}
              placeholder="받은 내용이나 캡처가 있을 때만 추가하세요."
            />
          </CollapsibleContent>
        </Collapsible>
        <Collapsible>
          <CollapsibleTrigger className="flex min-h-10 items-center gap-2 text-sm font-medium text-emerald-800">
            <ChevronDown className="size-4" />
            담당자·기한·다음 행동 (선택)
          </CollapsibleTrigger>
          <CollapsibleContent
            keepMounted
            className="grid gap-3 pt-2 sm:grid-cols-2"
          >
            <label
              className="text-sm font-medium"
              htmlFor={`work-control-3-${task.id}`}
            >
              담당자
              <Input
                id={`work-control-3-${task.id}`}
                required
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className="mt-1 h-10"
              />
            </label>
            <label
              className="text-sm font-medium"
              htmlFor={`work-control-4-${task.id}`}
            >
              기한
              <Input
                id={`work-control-4-${task.id}`}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 h-10"
              />
            </label>
            <label
              className="text-sm font-medium sm:col-span-2"
              htmlFor={`work-control-5-${task.id}`}
            >
              다음 행동
              <Input
                id={`work-control-5-${task.id}`}
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                className="mt-1 h-10"
              />
            </label>
          </CollapsibleContent>
        </Collapsible>
      </fieldset>
      <p className="text-xs text-slate-500">
        작성자 {recorder} · 작성 시각 자동 기록 · 기존 이력은 보존됩니다.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div
        className={`flex flex-wrap justify-end gap-2 ${popup ? 'sticky -bottom-4 z-10 border-t bg-white py-3' : ''}`}
      >
        {onAdvanced && (
          <Button
            type="button"
            variant="ghost"
            disabled={saving || imageBusy || dirty}
            onClick={onAdvanced}
          >
            상세 계획
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={saving || imageBusy}
          onClick={requestClose}
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={saving || imageBusy || changedElsewhere}
        >
          {saving ? '저장 중…' : '적용'}
        </Button>
      </div>
    </form>
  );
  if (!popup) return form;
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(open, details) => {
        if (open) return;
        // Closing is controlled here; a successful save bypasses the discard guard.
        details.cancel();
        if (details.reason !== 'outside-press') requestClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="farm-app farm-dialog max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-[640px]"
        initialFocus={(interaction) =>
          interaction === 'touch'
            ? true
            : document.getElementById(
                `${prefix}-${statusLocked ? 'action' : 'status'}`,
              ) || true
        }
        finalFocus={returnFocus}
      >
        <DialogHeader>
          <DialogTitle>빠른 수정</DialogTitle>
          <DialogDescription className="break-words text-base text-slate-700">
            {task.title}
          </DialogDescription>
        </DialogHeader>
        {form}
        <DialogClose
          disabled={saving || imageBusy}
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="빠른 수정 닫기"
              disabled={saving || imageBusy}
              className="absolute right-2 top-2"
            />
          }
        >
          <X className="size-5" />
        </DialogClose>
        <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
          <AlertDialogContent className="farm-app farm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>작성 내용을 취소할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                아직 적용하지 않은 내용은 저장되지 않습니다. 기존 업무와 기록은
                그대로 유지됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>계속 작성</AlertDialogCancel>
              <AlertDialogAction
                onClick={onCancel}
                disabled={saving || imageBusy}
              >
                작성 내용 버리고 닫기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export function WorkTaskSurface({
  items,
  allItems,
  mode = 'list',
  recorder,
  projectLabel: projectName,
  farmLabel = () => '',
  onOpen,
  onAddChild,
  onSave,
  latestSummary,
  isClosed = () => false,
  searching = false,
  onEditingChange,
}: {
  items: FarmWorkItem[];
  allItems: FarmWorkItem[];
  mode?: 'board' | 'list';
  recorder: string;
  latestSummary?: (item: FarmWorkItem) => { action: string; received: string };
  projectLabel: (item: FarmWorkItem) => string;
  farmLabel?: (item: FarmWorkItem) => string;
  onOpen: (item: FarmWorkItem) => void;
  onAddChild: (item: FarmWorkItem) => void;
  onSave: QuickWorkSave;
  isClosed?: (item: FarmWorkItem) => boolean;
  searching?: boolean;
  onEditingChange?: (open: boolean) => void;
}) {
  const tree = buildWorkHierarchy(allItems);
  const projectLabel = (item: FarmWorkItem) =>
    [projectName(item), farmLabel(item)].filter(Boolean).join(' · ');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{
    id: string;
    status?: FarmWorkStatus;
  } | null>(null);
  const [dragged, setDragged] = useState<FarmWorkItem | null>(null);
  const [over, setOver] = useState<FarmWorkStatus | null>(null);
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const surfaceElement = useRef<HTMLDivElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const editorOpen = Boolean(editing);
  useEffect(() => {
    if (!editorOpen) return;
    onEditingChange?.(true);
    return () => onEditingChange?.(false);
  }, [editorOpen, onEditingChange]);
  const canEdit = (item: FarmWorkItem) =>
    !isClosed(item) &&
    !tree.ancestors(item.id).some((parent) => parent.status === 'completed');
  function beginEdit(item: FarmWorkItem, status?: FarmWorkStatus) {
    if (editing || savingId) {
      setNotice('작성 중인 내용을 적용하거나 취소한 뒤 수정해 주세요.');
      return;
    }
    if (status && status !== item.status && !canEdit(item)) {
      setNotice('완료된 사업 또는 상위 업무를 먼저 다시 열어 주세요.');
      return;
    }
    editorTrigger.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    setEditing({ id: item.id, status });
  }
  function openItem(item: FarmWorkItem) {
    if (editing || savingId) {
      setNotice(
        '작성 중인 내용을 적용하거나 취소한 뒤 다른 업무를 열어 주세요.',
      );
      return;
    }
    onOpen(item);
  }
  const dragLock = useRef(false),
    lastDrag = useRef(0);
  const visible = new Set(items.map((item) => item.id));
  const included = new Set(visible);
  for (const item of items)
    tree.ancestors(item.id).forEach((ancestor) => included.add(ancestor.id));
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const editor = (item: FarmWorkItem) =>
    editing?.id === item.id ? (
      <WorkQuickEditor
        popup
        returnFocus={() =>
          editorTrigger.current?.isConnected
            ? editorTrigger.current
            : surfaceElement.current
        }
        key={`${item.id}-${editing.status || ''}`}
        task={item}
        initialStatus={editing.status}
        statusLocked={!canEdit(item)}
        recorder={recorder}
        onSave={onSave}
        onCancel={() => setEditing(null)}
      />
    ) : null;
  const status = (item: FarmWorkItem) => (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-sm font-medium ${statusColors[item.status]}`}
    >
      {FARM_WORK_STATUS_LABELS[item.status]}
    </span>
  );
  const actions = (item: FarmWorkItem) => (
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`${item.title} 빠른 수정`}
        disabled={Boolean(savingId || editing)}
        onClick={() => beginEdit(item)}
      >
        <Pencil className="size-4" />
        빠른 수정
      </Button>
      {isProjectTask(item) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`${item.title} 세부 업무 추가`}
          disabled={
            item.status === 'completed' ||
            isClosed(item) ||
            !canEdit(item) ||
            Boolean(savingId || editing)
          }
          onClick={() => onAddChild(item)}
        >
          <Plus className="size-4" />
          세부 업무
        </Button>
      )}
    </div>
  );
  const historySummary = (item: FarmWorkItem) => {
    const latest = latestSummary?.(item);
    return latest && (latest.action || latest.received) ? (
      <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-sm">
        {latest.received && (
          <p className="line-clamp-2 text-slate-600">
            최근 수신: {latest.received}
          </p>
        )}
        {latest.action && (
          <p className="line-clamp-2 text-emerald-900">
            최근 처리: {latest.action}
          </p>
        )}
      </div>
    ) : null;
  };
  const progress = (item: FarmWorkItem) => {
    if (!tree.children.get(item.id)?.length && !item.childWorkItemIds?.length)
      return null;
    const summary = tree.progress(item.id);
    return (
      <p className="mt-2 text-sm text-slate-600">
        세부 실행 업무 {summary.completed}/{summary.total} 완료
        {summary.rate !== null ? ` · ${summary.rate}%` : ''}
        {summary.blocked ? ` · 막힘 ${summary.blocked}건` : ''}
        {summary.missing ? ' · 일부 업무 조회 필요' : ''}
      </p>
    );
  };
  const handle = (item: FarmWorkItem) => {
    // A family is positioned by its executable tasks, not by a bulk status write.
    if (tree.children.get(item.id)?.length || item.childWorkItemIds?.length)
      return null;
    return (
      <button
        type="button"
        draggable={!savingId && !editing && canEdit(item)}
        aria-label={`${item.title} 이동 또는 상태 선택`}
        title="드래그로 상태 이동 · 클릭하여 상태 선택"
        onDragStart={(event) => {
          if (editing || savingId || !canEdit(item)) {
            event.preventDefault();
            return;
          }
          lastDrag.current = Date.now();
          setDragged(item);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/x-farmlog-work', item.id);
        }}
        onDragEnd={() => {
          setDragged(null);
          setOver(null);
          lastDrag.current = Date.now();
        }}
        disabled={Boolean(savingId || editing) || !canEdit(item)}
        onClick={() => {
          if (Date.now() - lastDrag.current > 500) beginEdit(item);
        }}
        className="-ml-1 flex min-h-10 min-w-8 shrink-0 cursor-grab items-center justify-center rounded hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        <GripVertical className="size-5 text-slate-500" />
      </button>
    );
  };
  async function drop(status: FarmWorkStatus, occurredAt: number) {
    const item = dragged;
    setDragged(null);
    setOver(null);
    lastDrag.current = occurredAt;
    if (!item || item.status === status || dragLock.current) return;
    if (!canEdit(item)) {
      setNotice('완료된 사업 또는 상위 업무를 먼저 다시 열어 주세요.');
      return;
    }
    if (editing) {
      setNotice('작성 중인 빠른 수정을 적용하거나 취소한 뒤 이동해 주세요.');
      return;
    }
    if (status === 'waiting' || item.status === 'waiting') {
      beginEdit(item, status);
      setNotice('대기 사유 또는 해제 내용을 입력하고 적용해 주세요.');
      return;
    }
    dragLock.current = true;
    setSavingId(item.id);
    setNotice('');
    try {
      await onSave(
        {
          workItemId: item.id,
          expectedUpdatedAt: item.updatedAt,
          operationId: crypto.randomUUID(),
          newStatus: status,
          channel: 'system',
          sender: '',
          receivedContent: '',
          actionContent: '',
          recorder,
          occurredAt,
          amount: 0,
          referenceUrl: '',
        },
        [],
      );
      setNotice(
        `‘${item.title}’ 상태를 ${FARM_WORK_STATUS_LABELS[status]}(으)로 변경했습니다.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : '이동하지 못했습니다. 기존 상태를 유지합니다.',
      );
    } finally {
      dragLock.current = false;
      setSavingId('');
    }
  }
  const rows: { item: FarmWorkItem; depth: number }[] = [];
  const visited = new Set<string>();
  function visit(item: FarmWorkItem, depth: number) {
    if (visited.has(item.id) || !included.has(item.id)) return;
    visited.add(item.id);
    rows.push({ item, depth });
    if (!collapsed.has(item.id) || !visible.has(item.id))
      (tree.children.get(item.id) || []).forEach((child) =>
        visit(child, depth + 1),
      );
  }
  tree.roots.forEach((item) => visit(item, 0));
  for (const item of items)
    if (
      !visited.has(item.id) &&
      !tree
        .ancestors(item.id)
        .some((parent) => collapsed.has(parent.id) && visible.has(parent.id))
    )
      visit(item, 0);
  return (
    <div ref={surfaceElement} tabIndex={-1} className="space-y-3">
      <p className="text-sm text-slate-600">
        {mode === 'board'
          ? '상위 업무당 카드 한 장입니다. 세부 업무를 펼쳐 상태를 바꾸면 카드가 자동 배치됩니다. 업무명은 상세 열기, 빠른 수정은 상태·처리 내용 수정입니다. 손잡이로 개별 실행 업무를 이동할 수도 있습니다.'
          : '업무를 펼쳐 세부 업무를 확인하고, 현재 목록에서 바로 수정하세요.'}
      </p>
      {notice && (
        <output
          className="block rounded-lg border bg-white p-3 text-sm"
          aria-live="polite"
        >
          {notice}
        </output>
      )}
      {editing &&
        tree.byId.get(editing.id) &&
        editor(tree.byId.get(editing.id)!)}
      {mode === 'board' ? (
        <WorkBoard
          items={items}
          allItems={allItems}
          searching={searching}
          busy={Boolean(editing || savingId)}
          dragged={Boolean(dragged)}
          over={over}
          savingId={savingId}
          projectLabel={projectLabel}
          onOpen={openItem}
          onEdit={beginEdit}
          onOver={setOver}
          onDrop={(column) => {
            void drop(column, Date.now());
          }}
          handle={handle}
          actions={actions}
          historySummary={historySummary}
          canEdit={canEdit}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>업무·세부 업무</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>담당자·기한</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ item, depth }) => (
                <TaskTableRows
                  key={item.id}
                  item={item}
                  depth={depth}
                  hasChildren={Boolean(tree.children.get(item.id)?.length)}
                  expanded={!collapsed.has(item.id) || !visible.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onOpen={() => openItem(item)}
                  projectLabel={projectLabel(item)}
                  parentTitle={
                    tree.byId.get(item.parentWorkItemId || '')?.title
                  }
                  status={status(item)}
                  progress={
                    <>
                      {progress(item)}
                      {historySummary(item)}
                    </>
                  }
                  actions={actions(item)}
                  editor={null}
                />
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    등록된 업무가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TaskTableRows({
  item,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onOpen,
  projectLabel,
  parentTitle,
  status,
  progress,
  actions,
  editor,
}: {
  item: FarmWorkItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  projectLabel: string;
  parentTitle?: string;
  status: ReactNode;
  progress: ReactNode;
  actions: ReactNode;
  editor: ReactNode;
}) {
  return (
    <>
      <TableRow
        data-work-id={item.id}
        data-work-depth={depth}
        className={
          depth
            ? 'bg-[#f7faf8] hover:bg-[#edf5ef]'
            : 'border-t-8 border-t-white bg-[#eaf3ed] hover:bg-[#e1efe6]'
        }
      >
        <TableCell className="align-top">
          <div
            style={{ marginLeft: `${Math.min(depth, 6) * 24}px` }}
            className={
              depth
                ? 'relative border-l-2 border-[#91b8a0] pl-4 before:absolute before:left-0 before:top-5 before:h-px before:w-4 before:bg-[#91b8a0]'
                : ''
            }
          >
            <div className="flex items-start gap-1">
              {hasChildren ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={expanded}
                  aria-label={`${item.title} 세부 업무 ${expanded ? '접기' : '펼치기'}`}
                  onClick={onToggle}
                >
                  {expanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </Button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <div>
                <p
                  className={`mb-1 text-xs font-semibold ${depth ? 'text-[#52735e]' : 'text-[#285c3d]'}`}
                >
                  {depth
                    ? `↳ 세부 업무${depth > 1 ? ` · ${depth}단계` : ''}`
                    : item.parentWorkItemId
                      ? '세부 업무 · 상위 업무 연결 확인 필요'
                      : '하위 업무'}
                </p>
                {parentTitle && (
                  <p className="mb-1 max-w-sm whitespace-normal text-xs text-[#52735e]">
                    상위: {parentTitle}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onOpen}
                  className="min-h-9 max-w-sm whitespace-normal text-left text-base font-semibold hover:text-emerald-800 hover:underline"
                >
                  {item.title}
                </button>
                <p className="text-xs text-slate-500">{projectLabel}</p>
                {progress}
                {item.nextAction && (
                  <p className="mt-1 max-w-sm whitespace-normal text-sm text-slate-600">
                    다음: {item.nextAction}
                  </p>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>{status}</TableCell>
        <TableCell>
          <p className="text-sm">{item.owner || '미지정'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {item.dueDate || '기한 미지정'}
          </p>
        </TableCell>
        <TableCell>{actions}</TableCell>
      </TableRow>
      {editor && (
        <TableRow>
          <TableCell colSpan={4} className="bg-emerald-50 p-3">
            {editor}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function ChildTaskForm({
  parent,
  recorder,
  onSave,
  onCancel,
  onBusy,
}: {
  parent: FarmWorkItem;
  recorder: string;
  onSave: (
    title: string,
    owner: string,
    dueDate: string,
    content: string,
    images: ReceivedImage[],
    operationId: string,
    occurredAt: number,
  ) => Promise<void>;
  onCancel: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(''),
    [owner, setOwner] = useState(parent.owner || recorder),
    [dueDate, setDueDate] = useState(''),
    [content, setContent] = useState('');
  const [images, setImages] = useState<ReceivedImage[]>([]),
    [imageBusy, setImageBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const [operationId] = useState(() => crypto.randomUUID());
  const [occurredAt] = useState(() => Date.now());
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current || imageBusy) return;
        lock.current = true;
        setSaving(true);
        onBusy(true);
        setError('');
        try {
          await onSave(
            title,
            owner,
            dueDate,
            content,
            images,
            operationId,
            occurredAt,
          );
          onCancel();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : '등록하지 못했습니다.',
          );
        } finally {
          lock.current = false;
          setSaving(false);
          onBusy(false);
        }
      }}
    >
      <p className="text-sm text-slate-600">상위 업무: {parent.title}</p>
      <label
        className="block text-sm font-medium"
        htmlFor={`work-control-6-${parent.id}`}
      >
        세부 업무명
        <Input
          id={`work-control-6-${parent.id}`}
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 h-11 text-base"
          placeholder="예: 견적서 내부 검토"
          disabled={saving}
        />
      </label>
      <p className="text-sm text-slate-600">
        담당 {owner} · 기한 {dueDate || '미지정'}
      </p>
      <Collapsible>
        <CollapsibleTrigger className="min-h-10 text-sm font-medium text-emerald-800">
          담당자·기한 변경 (선택)
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm" htmlFor={`work-control-7-${parent.id}`}>
            담당자
            <Input
              id={`work-control-7-${parent.id}`}
              required
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              disabled={saving}
            />
          </label>
          <label className="text-sm" htmlFor={`work-control-8-${parent.id}`}>
            기한
            <Input
              id={`work-control-8-${parent.id}`}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={saving}
            />
          </label>
        </CollapsibleContent>
      </Collapsible>
      <Collapsible>
        <CollapsibleTrigger className="min-h-10 text-sm font-medium text-emerald-800">
          받은 내용·캡처 추가 (선택)
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted>
          <ReceivedContentInput
            aria-label="세부 업무 받은 내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            images={images}
            onImagesChange={setImages}
            onBusyChange={(busy) => {
              setImageBusy(busy);
              onBusy(busy);
            }}
            disabled={saving}
          />
        </CollapsibleContent>
      </Collapsible>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving || imageBusy}
        >
          취소
        </Button>
        <Button type="submit" disabled={saving || imageBusy}>
          {saving ? '등록 중…' : '세부 업무 등록'}
        </Button>
      </div>
    </form>
  );
}
