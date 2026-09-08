'use client';

import { useRef, useState, type ReactNode } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
} from 'lucide-react';
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
}: {
  value: FarmWorkStatus;
  onChange: (value: FarmWorkStatus) => void;
  id: string;
}) {
  return (
    <Select
      value={value}
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
}: {
  task: FarmWorkItem;
  initialStatus?: FarmWorkStatus;
  recorder: string;
  onSave: QuickWorkSave;
  onCancel: () => void;
  onAdvanced?: () => void;
  onBusy?: (busy: boolean) => void;
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
  return (
    <form
      aria-label={`${task.title} 빠른 수정`}
      className="space-y-3 rounded-xl border border-emerald-300 bg-white p-4 text-left shadow-sm"
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
      <h3 className="text-base font-semibold">{task.title} · 빠른 수정</h3>
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
      <div className="flex flex-wrap justify-end gap-2">
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
          onClick={onCancel}
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
        key={`${item.id}-${editing.status || ''}`}
        task={item}
        initialStatus={editing.status}
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
        disabled={Boolean(savingId || editing)}
        onClick={() => setEditing({ id: item.id })}
      >
        <Pencil className="size-4" />
        빠른 수정
      </Button>
      {isProjectTask(item) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={
            item.status === 'completed' ||
            isClosed(item) ||
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
  async function drop(status: FarmWorkStatus, occurredAt: number) {
    const item = dragged;
    setDragged(null);
    setOver(null);
    lastDrag.current = occurredAt;
    if (!item || item.status === status || dragLock.current) return;
    if (editing) {
      setNotice('작성 중인 빠른 수정을 적용하거나 취소한 뒤 이동해 주세요.');
      return;
    }
    if (status === 'waiting' || item.status === 'waiting') {
      setEditing({ id: item.id, status });
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
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {mode === 'board'
          ? '손잡이를 끌어 상태 열로 이동하세요. 모바일·키보드에서는 빠른 수정을 사용할 수 있습니다. 각 업무는 자신의 상태 열에 표시됩니다.'
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
        <div className="flex gap-4 overflow-x-auto pb-4">
          {FARM_WORK_STATUSES.map((column) => (
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Native drop target; each card also provides a keyboard-accessible status editor.
            <section
              key={column}
              aria-label={`${FARM_WORK_STATUS_LABELS[column]} 열`}
              onDragOver={(event) => {
                if (dragged && !savingId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setOver(column);
                }
              }}
              onDragLeave={(event) => {
                if (
                  !(
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  )
                )
                  setOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                void drop(column, Date.now());
              }}
              className={`w-[320px] shrink-0 rounded-xl border p-3 xl:flex-1 ${over === column ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500' : 'border-slate-200 bg-slate-50'}`}
            >
              <h2 className="mb-3 flex items-center justify-between text-base font-semibold">
                {FARM_WORK_STATUS_LABELS[column]}
                <span className="text-sm text-slate-500">
                  {items.filter((item) => item.status === column).length}건
                </span>
              </h2>
              <div className="space-y-3">
                {items
                  .filter((item) => item.status === column)
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`space-y-3 rounded-xl border bg-white p-3 ${savingId === item.id ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          draggable={!savingId && !editing}
                          aria-label={`${item.title} 이동 또는 상태 선택`}
                          title="드래그로 상태 이동 · 클릭하여 상태 선택"
                          onDragStart={(event) => {
                            if (editing || savingId) {
                              event.preventDefault();
                              return;
                            }
                            lastDrag.current = Date.now();
                            setDragged(item);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData(
                              'application/x-farmlog-work',
                              item.id,
                            );
                          }}
                          onDragEnd={() => {
                            setDragged(null);
                            setOver(null);
                            lastDrag.current = Date.now();
                          }}
                          disabled={Boolean(savingId || editing)}
                          onClick={() => {
                            if (
                              !editing &&
                              !savingId &&
                              Date.now() - lastDrag.current > 500
                            )
                              setEditing({ id: item.id });
                          }}
                          className="-ml-1 flex min-h-10 min-w-8 cursor-grab items-center justify-center rounded hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-700"
                        >
                          <GripVertical className="size-5 text-slate-500" />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            {projectLabel(item)}
                          </p>
                          {item.parentWorkItemId && (
                            <p className="mt-1 text-xs text-emerald-800">
                              상위:{' '}
                              {tree.byId.get(item.parentWorkItemId)?.title ||
                                '연결 확인 필요'}
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(editing || savingId)}
                            onClick={() => openItem(item)}
                            className="mt-1 text-left text-base font-semibold hover:text-emerald-800 hover:underline"
                          >
                            {item.title}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">
                        {item.owner || '미지정'} ·{' '}
                        {item.dueDate || '기한 미지정'}
                      </p>
                      {item.nextAction && (
                        <p className="line-clamp-2 text-sm">
                          다음: {item.nextAction}
                        </p>
                      )}
                      {progress(item)}
                      {historySummary(item)}
                      {tree.children.get(item.id)?.length ? (
                        <Collapsible>
                          <CollapsibleTrigger className="flex min-h-9 items-center gap-1 text-sm text-emerald-800">
                            <ChevronDown className="size-4" />
                            세부 업무 {tree.children.get(item.id)!.length}개
                            보기
                          </CollapsibleTrigger>
                          <CollapsibleContent keepMounted>
                            <ul className="space-y-2 border-l-2 pl-3">
                              {tree.children.get(item.id)!.map((child) => (
                                <li key={child.id} className="text-sm">
                                  <button
                                    type="button"
                                    className="text-left underline"
                                    onClick={() => openItem(child)}
                                  >
                                    {child.title}
                                  </button>
                                  <span className="ml-2 text-xs text-slate-500">
                                    {FARM_WORK_STATUS_LABELS[child.status]}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : null}
                      {actions(item)}
                    </article>
                  ))}
                {!items.some((item) => item.status === column) && (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    업무를 이 열로 이동할 수 있습니다.
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
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
