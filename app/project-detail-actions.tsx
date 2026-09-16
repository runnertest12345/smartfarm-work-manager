import { FileText, MessageSquareText, Plus, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FarmProject } from '@/lib/farm-types';

export function ProjectDetailActions({
  project,
  canAddTask,
  onAddTask,
  onRecord,
  onDocument,
  onDelete,
}: {
  project: FarmProject;
  canAddTask: boolean;
  onAddTask: () => void;
  onRecord: () => void;
  onDocument: () => void;
  onDelete: () => void;
}) {
  const deleted = Boolean(project.deletedAt);
  const closed = project.status === 'completed';
  return (
    <fieldset
      aria-label="프로젝트 작업"
      className="flex min-w-0 flex-wrap items-center gap-2 border-0 p-0 pt-3"
    >
      <Button
        type="button"
        size="sm"
        disabled={!canAddTask || deleted || closed}
        onClick={onAddTask}
      >
        <Plus />{' '}
        {project.projectType === 'internal' ? '내부 업무 등록' : '업무 추가'}
      </Button>
      {project.projectType !== 'internal' && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={deleted}
            onClick={onRecord}
          >
            <MessageSquareText /> 기록 추가
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={deleted || closed}
            onClick={onDocument}
          >
            <FileText /> 제출서류 추가
          </Button>
        </>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-red-700 hover:bg-red-50 hover:text-red-800 sm:ml-auto"
        onClick={onDelete}
      >
        {deleted ? <Undo2 /> : <Trash2 />}{' '}
        {deleted ? '프로젝트 복구' : '프로젝트 삭제'}
      </Button>
    </fieldset>
  );
}
