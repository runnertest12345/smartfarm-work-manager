'use client';

import { useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import type { FarmProject } from '@/lib/farm-types';

export function ProjectDeletionDialog({
  project,
  onConfirm,
  onClose,
}: {
  project: FarmProject;
  onConfirm: (project: FarmProject, deleted: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const restoring = Boolean(project.deletedAt);
  return (
    <AlertDialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (lock.current) details.cancel();
        else onClose();
      }}
    >
      <AlertDialogContent className="farm-app farm-dialog max-h-[90dvh] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-[640px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {restoring ? '프로젝트 복구' : '프로젝트 삭제'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {project.year}년 · {project.name}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm leading-6 text-slate-700">
          {restoring
            ? '프로젝트를 목록과 사업 집계에 다시 표시합니다. 보존된 농가·업무·서류 연결은 그대로 이어집니다.'
            : '프로젝트 목록과 사업 집계에서 제외합니다. 연결된 농가·구독·입금·업무·서류 기록은 삭제하지 않으며, ‘삭제한 프로젝트’에서 복구할 수 있습니다.'}
        </p>
        {!restoring && (
          <div>
            <label
              htmlFor="delete-project-name"
              className="mb-2 block text-sm font-medium"
            >
              삭제하려면 프로젝트명을 그대로 입력하세요.
            </label>
            <Input
              id="delete-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (!restoring && name !== project.name)}
            className={
              restoring ? '' : 'bg-red-700 text-white hover:bg-red-800'
            }
            onClick={async () => {
              if (lock.current || (!restoring && name !== project.name)) return;
              lock.current = true;
              setBusy(true);
              setError('');
              try {
                await onConfirm(project, !restoring);
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
            {busy ? '처리 중…' : restoring ? '프로젝트 복구' : '프로젝트 삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
