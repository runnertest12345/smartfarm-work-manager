'use client';

import { useRef, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { FARM_WORK_STATUS_LABELS, type FarmWorkItem } from '@/lib/farm-types';
import type { AppMember } from '@/lib/organization';
import { canManageWorkDeletion } from '@/lib/work-lifecycle';

export function WorkDeletionDialog({
  task,
  onConfirm,
  onClose,
}: {
  task: FarmWorkItem;
  onConfirm: (
    task: FarmWorkItem,
    deleted: boolean,
    operationId: string,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const operationId = useRef('');
  const restoring = Boolean(task.deletedAt);
  const hasChildren = Boolean(
    task.childWorkItemIds?.length || task.openChildCount,
  );
  return (
    <AlertDialog
      open
      onOpenChange={(open, details) => {
        if (!open) {
          if (lock.current) details.cancel();
          else onClose();
        }
      }}
    >
      <AlertDialogContent className="farm-app farm-dialog max-h-[90dvh] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-[560px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {restoring ? '업무 복원' : '업무 삭제'}
          </AlertDialogTitle>
          <AlertDialogDescription className="break-words font-semibold">
            {task.title}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm leading-6 text-slate-700">
          {restoring
            ? '원래 상태와 상위 업무 연결로 복원합니다. 상위 업무나 프로젝트가 삭제되어 있다면 먼저 복원해 주세요.'
            : '보드·목록과 업무 집계에서 제외합니다. 처리 이력과 첨부파일은 보존되며, ‘삭제된 업무’에서 복원할 수 있습니다.'}
        </p>
        {hasChildren && (
          <p role="alert" className="text-sm text-amber-800">
            세부 업무가 남아 있습니다. 완료된 세부 업무도 먼저 삭제한 뒤 상위
            업무를 삭제해 주세요. 세부 업무가 함께 삭제되지는 않습니다.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || hasChildren}
            className={
              restoring ? '' : 'bg-red-700 text-white hover:bg-red-800'
            }
            onClick={async () => {
              if (lock.current || hasChildren) return;
              lock.current = true;
              setBusy(true);
              setError('');
              operationId.current ||= crypto.randomUUID();
              try {
                await onConfirm(task, !restoring, operationId.current);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : '저장하지 못했습니다. 다시 시도해 주세요.',
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? '처리 중…' : restoring ? '복원' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeletedWorkList({
  tasks,
  member,
  contextLabel,
  onRestore,
}: {
  tasks: FarmWorkItem[];
  member?: AppMember | null;
  contextLabel: (task: FarmWorkItem) => string;
  onRestore: (task: FarmWorkItem) => void;
}) {
  const deleted = tasks
    .filter((task) => task.deletedAt)
    .sort((a, b) => b.deletedAt! - a.deletedAt!);
  const [search, setSearch] = useState('');
  return (
    <details className="mb-4 rounded-xl border bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-600">
        <Trash2 className="mr-2 inline size-4" />
        삭제된 업무 {deleted.length}건
      </summary>
      <p className="my-3 text-sm text-slate-600">
        업무 집계에서는 제외됩니다. 관리자 또는 해당 업무 등록자가 복원할 수
        있습니다. 상위 업무부터 복원하세요.
      </p>
      {deleted.length > 0 && (
        <input
          aria-label="삭제된 업무 검색"
          className="mb-3 w-full rounded-lg border p-2 text-sm"
          placeholder="업무명 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {deleted.length === 0 && (
          <p className="text-sm text-slate-500">삭제된 업무가 없습니다.</p>
        )}
        {deleted
          .filter((task) => task.title.includes(search.trim()))
          .map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {contextLabel(task)} · 삭제 전{' '}
                  {FARM_WORK_STATUS_LABELS[task.status]}
                </p>
                {task.parentWorkItemId && (
                  <p className="mt-1 text-xs text-slate-600">
                    상위 업무:{' '}
                    {tasks.find((parent) => parent.id === task.parentWorkItemId)
                      ?.title || '연결 확인 필요'}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  삭제일 {new Date(task.deletedAt!).toLocaleString('ko-KR')}
                </p>
              </div>
              {canManageWorkDeletion(task, member) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label={`${task.title} 복원`}
                  onClick={() => onRestore(task)}
                >
                  <RotateCcw className="size-4" />
                  복원
                </Button>
              )}
            </div>
          ))}
      </div>
    </details>
  );
}
