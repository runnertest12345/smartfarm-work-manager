'use client';

import {
  useEffect,
  useRef,
  useState,
  isValidElement,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  MoreHorizontal,
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
import { isStandaloneWork, isHeadPriority } from '@/lib/project-work';
import { buildWorkHierarchy } from '@/lib/work-hierarchy';
import { buildWorkBoardGroups, workBoardDropIntent } from '@/lib/work-board';
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
type QuickWorkField = 'status' | 'owner' | 'dueDate';

/** Compose the supplied deletion trigger so its permission and confirmation stay intact. */
export function WorkTaskMoreMenu({
  title,
  onAddChild,
  addChildDisabled = false,
  deleteAction,
  disabled = false,
}: {
  title: string;
  onAddChild?: () => void;
  addChildDisabled?: boolean;
  deleteAction?: ReactNode;
  disabled?: boolean;
}) {
  const deleteButton = isValidElement<{ disabled?: boolean }>(deleteAction)
    ? deleteAction
    : null;
  if (!onAddChild && !deleteButton) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`${title} 더보기`}
        title={onAddChild ? '세부 업무 추가·삭제' : '업무 삭제'}
        render={<Button type="button" variant="ghost" size="icon" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {onAddChild && (
          <DropdownMenuItem
            aria-label={`${title} 세부 업무 추가`}
            disabled={disabled || addChildDisabled}
            onClick={onAddChild}
            className="min-h-10"
          >
            <Plus className="size-4" />
            세부 업무 추가
          </DropdownMenuItem>
        )}
        {deleteButton && (
          <DropdownMenuItem
            nativeButton
            disabled={disabled || deleteButton.props.disabled}
            variant="destructive"
            label="삭제"
            className="min-h-10 w-full justify-start"
            render={deleteButton}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  initialField = 'status',
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
  initialField?: QuickWorkField;
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
        <Collapsible defaultOpen={initialField === 'owner' || initialField === 'dueDate'}>
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
                disabled={Boolean(task.assigneeUid)}
                onChange={(event) => setOwner(event.target.value)}
                className="mt-1 h-10"
              />
              {task.assigneeUid && (
                <span className="mt-1 block text-xs text-slate-500">
                  배정된 직원 계정의 이름입니다.
                </span>
              )}
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
                initialField === 'owner' && !task.assigneeUid
                  ? `work-control-3-${task.id}`
                  : initialField === 'dueDate' || initialField === 'owner'
                    ? `work-control-4-${task.id}`
                    : `${prefix}-${statusLocked ? 'action' : 'status'}`,
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
  deleteAction,
  contextRootId,
}: {
  items: FarmWorkItem[];
  allItems: FarmWorkItem[];
  contextRootId?: string;
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
  deleteAction?: (item: FarmWorkItem, disabled?: boolean) => ReactNode;
}) {
  const tree = buildWorkHierarchy(allItems);
  const projectLabel = (item: FarmWorkItem) =>
    [projectName(item), farmLabel(item)].filter(Boolean).join(' · ');
  // Store only explicit user choices. New deep branches stay collapsed on live updates.
  const [expansion, setExpansion] = useState<Map<string, boolean>>(new Map());
  const [editing, setEditing] = useState<{
    id: string;
    status?: FarmWorkStatus;
    field?: QuickWorkField;
  } | null>(null);
  const [dragged, setDragged] = useState<FarmWorkItem | null>(null);
  const [over, setOver] = useState<FarmWorkStatus | null>(null);
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');
  const surfaceElement = useRef<HTMLDivElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const editorOpen = Boolean(editing);
  useEffect(() => {
    if (
      !editing ||
      allItems.some((item) => item.id === editing.id && !item.deletedAt)
    )
      return;
    // Close an editor whose task was removed by the live subscription.
    let current = true;
    void Promise.resolve().then(() => {
      if (current) setEditing(null);
    });
    return () => {
      current = false;
    };
  }, [allItems, editing]);
  useEffect(() => {
    if (!editorOpen) return;
    onEditingChange?.(true);
    return () => onEditingChange?.(false);
  }, [editorOpen, onEditingChange]);
  const canEdit = (item: FarmWorkItem) =>
    !isClosed(item) &&
    !tree.ancestors(item.id).some((parent) => parent.status === 'completed');
  function beginEdit(
    item: FarmWorkItem,
    status?: FarmWorkStatus,
    field: QuickWorkField = 'status',
  ) {
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
    setEditing({ id: item.id, status, field });
  }
  function openItem(item: FarmWorkItem, clickedAt: number) {
    if (clickedAt - lastDrag.current <= 500) return;
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
  const status = (item: FarmWorkItem) => (
    <button
      type="button"
      aria-label={`${item.title} 상태 확인·수정`}
      disabled={Boolean(savingId || editing)}
      onClick={() => beginEdit(item)}
      className={`inline-block min-h-9 rounded-full px-2.5 py-1 text-sm font-medium hover:ring-1 hover:ring-current focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 ${statusColors[item.status]}`}
    >
      {FARM_WORK_STATUS_LABELS[item.status]}
    </button>
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
      <WorkTaskMoreMenu
        title={item.title}
        onAddChild={isStandaloneWork(item) ? () => onAddChild(item) : undefined}
        addChildDisabled={item.status === 'completed' || isClosed(item) || !canEdit(item)}
        disabled={Boolean(savingId || editing)}
        deleteAction={deleteAction?.(item, Boolean(savingId || editing))}
      />
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
  const executableIds = new Set(tree.leaves.map((item) => item.id));
  const progress = (item: FarmWorkItem) => {
    if (!tree.children.get(item.id)?.length && !item.childWorkItemIds?.length)
      return null;
    const summary = tree.progress(item.id);
    const executable = tree.descendants(item.id).filter((child) => executableIds.has(child.id));
    const processing = executable.filter((child) => child.status === 'in_progress').length;
    const waiting = executable.filter((child) => child.status === 'waiting').length;
    // Completion and execution states use leaves only. A waiting intermediate
    // parent remains important, but must not be added to that denominator.
    const intermediateWaiting = summary.blocked - waiting;
    return (
      <div
        data-child-progress={item.id}
        aria-label={`${item.title} 하위 업무 진행 요약`}
        title="전체 하위 업무 기준입니다. 완료율·처리 중·대기·막힘은 최하위 실행 업무만 집계하며, 중간 업무의 대기·막힘은 별도로 표시합니다. 접기와 검색은 집계에 영향을 주지 않습니다."
        className="mb-1 max-w-md space-y-1 text-xs tabular-nums"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={summary.rate === 100 ? 'font-medium text-emerald-800' : 'font-medium text-slate-600'}>
            {summary.total ? `최하위 실행 완료 ${summary.completed}/${summary.total}` : '하위 실행 업무 확인 필요'}
            {summary.rate !== null ? ` · ${summary.rate}%` : ''}
          </span>
          {summary.total > 0 && <>
            <span className={processing ? 'text-blue-800' : 'text-slate-400'}>처리 중 {processing}</span>
            <span className={waiting ? 'rounded bg-amber-50 px-1 text-amber-900' : 'text-slate-400'}>대기·막힘 {waiting}</span>
          </>}
        </p>
        {summary.rate !== null && (
          <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${summary.rate}%` }} />
          </div>
        )}
        {(intermediateWaiting > 0 || summary.missing) && (
          <p className="flex flex-wrap gap-x-2 gap-y-1 text-amber-900">
            {intermediateWaiting > 0 && <span>중간 업무 대기·막힘 {intermediateWaiting}건</span>}
            {summary.missing && <span>일부 하위 업무 미조회 · 완료율 확인 필요</span>}
          </p>
        )}
      </div>
    );
  };
  function beginDrag(
    item: FarmWorkItem,
    event: DragEvent<HTMLElement>,
    occurredAt: number,
  ) {
    event.stopPropagation();
    if (
      editing ||
      savingId ||
      dragLock.current ||
      !canEdit(item)
    ) {
      event.preventDefault();
      return;
    }
    lastDrag.current = occurredAt;
    editorTrigger.current = surfaceElement.current;
    setNotice('');
    setDragged(item);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-farmlog-work', item.id);
  }
  function endDrag(occurredAt: number) {
    setDragged(null);
    setOver(null);
    lastDrag.current = occurredAt;
  }
  const handle = (item: FarmWorkItem) => {
    // Nested parents keep the explicit status editor in the expanded family.
    if (
      item.parentWorkItemId &&
      (tree.children.get(item.id)?.length || item.childWorkItemIds?.length)
    )
      return null;
    return (
      <button
        type="button"
        draggable={!savingId && !editing && canEdit(item)}
        aria-label={`${item.title} 이동 또는 상태 선택`}
        title="드래그로 상태 이동 · 클릭하여 빠른 수정"
        onDragStart={(event) => beginDrag(item, event, Date.now())}
        onDragEnd={() => endDrag(Date.now())}
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
    if (!item || dragLock.current || savingId) return;
    const current = tree.byId.get(item.id);
    if (!current || current.deletedAt || current.updatedAt !== item.updatedAt) {
      setNotice(
        '업무가 변경되었거나 삭제되었습니다. 최신 내용을 확인하고 다시 이동해 주세요.',
      );
      return;
    }
    if (!canEdit(item)) {
      setNotice('완료된 사업 또는 상위 업무를 먼저 다시 열어 주세요.');
      return;
    }
    if (editing) {
      setNotice('작성 중인 빠른 수정을 적용하거나 취소한 뒤 이동해 주세요.');
      return;
    }
    const group = buildWorkBoardGroups(allItems).find(
      (group) => group.item.id === item.id,
    );
    if (group) {
      const intent = workBoardDropIntent(group, status);
      if (intent === 'blocked') {
        setNotice(
          '세부 업무 연결을 확인한 후 이동해 주세요. 상태는 변경하지 않았습니다.',
        );
        return;
      }
      if (intent === 'none') {
        if (group.lane !== status)
          setNotice(
            '상위 업무의 상태는 그대로입니다. 하위 업무에 대기·막힘이 있어 카드는 대기·막힘 열에 표시됩니다.',
          );
        return;
      }
      if (intent === 'confirm' || intent === 'reopen') {
        beginEdit(item, status);
        setNotice(
          intent === 'confirm'
            ? '세부 업무가 모두 완료되었습니다. 상위 업무의 최종 완료를 확인하고 적용해 주세요.'
            : '완료된 상위 업무를 먼저 다시 열어 주세요. 세부 업무는 자동으로 변경하지 않습니다.',
        );
        return;
      }
      if (intent === 'incomplete') {
        setNotice(
          '하위 업무를 모두 완료한 뒤 상위 업무를 완료할 수 있습니다. 상위·하위 업무 상태는 변경하지 않았습니다.',
        );
        return;
      }
    }
    if (item.status === status) return;
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
        `‘${item.title}’ 상태를 ${FARM_WORK_STATUS_LABELS[status]}(으)로 변경했습니다.${group?.waiting.some((task) => task.id !== item.id) ? ' 하위 업무에 대기·막힘이 있어 카드는 대기·막힘 열에 표시됩니다.' : ''}`,
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
  // Keep full ancestry for permissions, but start a detail list below its selected task.
  const displayRoots = contextRootId
    ? tree.children.get(contextRootId) || []
    : tree.roots;
  const outlineNumbers = new Map<string, string>();
  function numberBranch(item: FarmWorkItem, number: string) {
    if (outlineNumbers.has(item.id)) return;
    outlineNumbers.set(item.id, number);
    (tree.children.get(item.id) || []).forEach((child, index) =>
      numberBranch(child, `${number}.${index + 1}`),
    );
  }
  displayRoots.forEach((item, index) => numberBranch(item, String(index + 1)));
  let fallbackNumber = displayRoots.length;
  for (const item of items)
    if (!outlineNumbers.has(item.id)) numberBranch(item, String(++fallbackNumber));
  const expansionKey = (id: string) => `${contextRootId || 'all'}:${id}`;
  const expanded = (id: string) =>
    searching ||
    !visible.has(id) ||
    (expansion.get(expansionKey(id)) ??
      (!contextRootId && outlineNumbers.get(id)?.split('.').length === 1));
  const toggle = (id: string) => {
    const nextExpanded = !expanded(id);
    setExpansion((current) => new Map(current).set(expansionKey(id), nextExpanded));
  };
  const branches = [...outlineNumbers.keys()].filter((id) =>
    included.has(id) && tree.children.get(id)?.length,
  );
  const setAllExpanded = (open: boolean) => setExpansion((current) => {
    const next = new Map(current);
    branches.forEach((id) => next.set(expansionKey(id), open));
    return next;
  });
  const rows: { item: FarmWorkItem; depth: number; branchGuides: boolean[] }[] = [];
  const visited = new Set<string>();
  function visit(item: FarmWorkItem, depth: number, branchGuides: boolean[] = []) {
    if (visited.has(item.id) || !included.has(item.id)) return;
    visited.add(item.id);
    rows.push({ item, depth, branchGuides });
    if (expanded(item.id)) {
      const children = (tree.children.get(item.id) || []).filter((child) => included.has(child.id));
      children.forEach((child, index) =>
        visit(child, depth + 1, [...branchGuides, index < children.length - 1]),
      );
    }
  }
  displayRoots.forEach((item) => visit(item, 0));
  for (const item of items)
    if (
      !visited.has(item.id) &&
      !tree
        .ancestors(item.id)
        .some((parent) => !expanded(parent.id))
    )
      visit(item, 0);
  return (
    <div ref={surfaceElement} tabIndex={-1} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {mode === 'board'
          ? '업무명을 누르면 전체 팝업에서 조회·수정합니다. 카드를 옮기면 상위 상태만 변경하며, 하위 대기·막힘이 있으면 해당 열에 우선 표시됩니다.'
          : searching
            ? '검색 결과의 상하위 관계를 펼쳐서 표시합니다. 검색을 지우면 기존 접힘 상태로 돌아갑니다.'
            : '업무명으로 조회하고 상태·담당자·기한을 눌러 바로 수정하세요. 깊은 세부 업무는 화살표로 펼칩니다.'}
        </p>
        {mode === 'list' && branches.length > 0 && (
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" variant="outline" disabled={searching} onClick={() => setAllExpanded(false)}>모두 접기</Button>
            <Button type="button" size="sm" variant="outline" disabled={searching} onClick={() => setAllExpanded(true)}>모두 펼치기</Button>
          </div>
        )}
      </div>
      {notice && (
        <output
          className="block rounded-lg border bg-white p-3 text-sm"
          aria-live="polite"
        >
          {notice}
        </output>
      )}
      {editing && tree.byId.get(editing.id) && (
        <WorkQuickEditor
          popup
          returnFocus={() =>
            editorTrigger.current?.isConnected
              ? editorTrigger.current
              : surfaceElement.current
          }
          key={`${editing.id}-${editing.status || ''}`}
          task={tree.byId.get(editing.id)!}
          initialStatus={editing.status}
          initialField={editing.field}
          statusLocked={!canEdit(tree.byId.get(editing.id)!)}
          recorder={recorder}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}
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
          onDrop={(column, occurredAt) => {
            void drop(column, occurredAt);
          }}
          onDragStart={beginDrag}
          onDragEnd={endDrag}
          handle={handle}
          actions={actions}
          historySummary={historySummary}
          canEdit={canEdit}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <Table className="work-outline min-w-[860px] border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead>업무·세부 업무</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>기한</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ item, depth, branchGuides }, index) => (
                <TaskTableRows
                  key={item.id}
                  item={item}
                  depth={depth}
                  branchGuides={branchGuides}
                  connectChildren={rows[index + 1]?.depth > depth}
                  number={outlineNumbers.get(item.id) || ''}
                  level={tree.ancestors(item.id).length}
                  hasChildren={Boolean(tree.children.get(item.id)?.length)}
                  expanded={expanded(item.id)}
                  searching={searching}
                  onToggle={() => { if (!searching) toggle(item.id); }}
                  onOpen={() => openItem(item, Date.now())}
                  onEditField={(field) => beginEdit(item, undefined, field)}
                  editingDisabled={Boolean(savingId || editing)}
                  projectLabel={projectLabel(item)}
                  parentTitle={
                    tree.byId.get(item.parentWorkItemId || '')?.title
                  }
                  status={status(item)}
                  progress={progress(item)}
                  history={historySummary(item)}
                  actions={actions(item)}
                  editor={null}
                />
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
  branchGuides,
  connectChildren,
  number,
  level,
  hasChildren,
  expanded,
  searching,
  onToggle,
  onOpen,
  onEditField,
  editingDisabled,
  projectLabel,
  parentTitle,
  status,
  progress,
  history,
  actions,
  editor,
}: {
  item: FarmWorkItem;
  depth: number;
  branchGuides: boolean[];
  connectChildren: boolean;
  number: string;
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  searching: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onEditField: (field: QuickWorkField) => void;
  editingDisabled: boolean;
  projectLabel: string;
  parentTitle?: string;
  status: ReactNode;
  progress: ReactNode;
  history: ReactNode;
  actions: ReactNode;
  editor: ReactNode;
}) {
  const isSubtask = Boolean(item.parentWorkItemId || level);
  const visualDepth = Math.min(depth, 4);
  const needsParentContext = Boolean(parentTitle && (!depth || searching || depth > 4));
  return (
    <>
      <TableRow
        data-work-id={item.id}
        data-work-depth={depth}
        data-parent-work-id={item.parentWorkItemId || undefined}
        data-work-number={number}
        className={
          !isSubtask
            ? 'bg-emerald-50/60 hover:bg-emerald-50 has-aria-expanded:bg-emerald-50/60 [&>td]:border-b [&>td]:border-emerald-100'
            : 'bg-white hover:bg-slate-50 has-aria-expanded:bg-white [&>td]:border-b [&>td]:border-slate-100'
        }
      >
        <TableCell className="relative w-[52%] whitespace-normal px-2 py-0 align-top">
          {connectChildren && depth < 4 && (
            <span aria-hidden="true" data-tree-stem className="pointer-events-none absolute bottom-0 top-10 border-l border-slate-300" style={{ left: `${22 + visualDepth * 32}px` }} />
          )}
          {/* Each rail belongs to a displayed ancestor, so siblings share the same gutter. */}
          {branchGuides.slice(0, 4).map((continues, index) => {
            const currentBranch = index === visualDepth - 1;
            return (
              <span key={index} aria-hidden="true" data-tree-guide={currentBranch ? 'branch' : 'ancestor'}>
                {(currentBranch || continues) && (
                  <span
                    className="pointer-events-none absolute top-0 border-l border-slate-300"
                    style={{ left: `${22 + index * 32}px`, ...(currentBranch && !continues ? { height: '24px' } : { bottom: 0 }) }}
                  />
                )}
                {currentBranch && (
                  <span className="pointer-events-none absolute top-6 w-[18px] border-t border-slate-300" style={{ left: `${22 + index * 32}px` }} />
                )}
              </span>
            );
          })}
          <div
            style={{ marginLeft: `${visualDepth * 32}px` }}
            className="relative py-2"
          >
            <div className="flex min-w-0 items-start gap-1">
              {hasChildren ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={expanded}
                  aria-label={`${item.title} 세부 업무 ${searching ? '검색 중 펼침' : expanded ? '접기' : '펼치기'}`}
                  disabled={searching}
                  onClick={onToggle}
                  data-tree-toggle
                  className="size-8 shrink-0 p-0 text-slate-600 hover:bg-slate-200/60"
                >
                  {expanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </Button>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true"><span className="size-1.5 rounded-full bg-slate-300" /></span>
              )}
              <div className="min-w-0 flex-1">
                {isHeadPriority(item) && (
                  <p className="mb-1 text-sm font-bold text-amber-900">
                    부서장 지시 · 최우선
                  </p>
                )}
                <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={onOpen}
                    title={`목록 ${number}${parentTitle ? ` · 상위: ${parentTitle}` : ''}`}
                    className={`min-h-8 min-w-0 break-words whitespace-normal text-left text-sm hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-700 ${!isSubtask || hasChildren ? 'font-semibold' : 'font-medium'}`}
                  >
                    {item.title}
                  </button>
                  <span className="sr-only" aria-label={`목록 번호 ${number}`}>{number}</span>
                  {isSubtask && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500" title={`목록 ${number}`}>
                    하위 업무{level > 1 ? ` · ${level}단계` : ''}
                  </span>}
                </div>
                {progress}
                {item.parentWorkItemId && !parentTitle && <p className="text-xs text-amber-800">상위 업무 연결 확인 필요</p>}
                {needsParentContext && (
                  <p className="break-words text-xs text-slate-500">
                    상위: {parentTitle}
                  </p>
                )}
                {!isSubtask && <p className="break-words text-xs text-slate-500">{projectLabel}</p>}
                {(history || item.nextAction) && (
                  <details className="text-xs text-slate-500">
                    <summary className="w-fit cursor-pointer rounded py-0.5 focus-visible:outline-2 focus-visible:outline-emerald-700">최근 기록·다음 행동</summary>
                    {history}
                    {item.nextAction && (
                      <p className="mt-1 max-w-sm whitespace-normal text-sm text-slate-600">
                        다음: {item.nextAction}
                      </p>
                    )}
                  </details>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>{status}</TableCell>
        <TableCell>
          <button
            type="button"
            aria-label={`${item.title} 담당자 확인·수정`}
            onClick={() => onEditField('owner')}
            disabled={editingDisabled}
            className="block min-h-9 rounded px-1 text-left text-sm hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"
          >
            {item.owner || '미지정'}
          </button>
        </TableCell>
        <TableCell>
          <button
            type="button"
            aria-label={`${item.title} 기한 수정`}
            onClick={() => onEditField('dueDate')}
            disabled={editingDisabled}
            className="block min-h-9 rounded px-1 text-left text-sm text-slate-500 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"
          >
            {item.dueDate || '기한 미지정'}
          </button>
        </TableCell>
        <TableCell>{actions}</TableCell>
      </TableRow>
      {editor && (
        <TableRow>
          <TableCell colSpan={5} className="bg-emerald-50 p-3">
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
