import { Button } from '@/components/ui/button';
import {
  FARM_HISTORY_CHANNEL_LABELS,
  FARM_WORK_STATUS_LABELS,
  type FarmProject,
  type FarmWorkItem,
  type FarmHistoryEntry,
} from '@/lib/farm-types';
import { ReceivedImages } from './received-images';

export function ProjectTaskDetail({
  task,
  project,
  history,
  onBack,
  onRecord,
}: {
  task: FarmWorkItem;
  project?: FarmProject;
  history: FarmHistoryEntry[];
  onBack: () => void;
  onRecord: () => void;
}) {
  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6"
      aria-label="프로젝트 하위 업무 상세"
    >
      <Button variant="outline" onClick={onBack}>
        ← 이전 화면
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-5">
        <div>
          <p className="text-sm text-emerald-800">
            {project?.year} · {project?.name || '프로젝트'} · 하위 업무
          </p>
          <h1 className="mt-2 text-2xl font-bold" tabIndex={-1}>
            {task.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {FARM_WORK_STATUS_LABELS[task.status]} · 담당{' '}
            {task.owner || '미지정'} · 기한 {task.dueDate || '미지정'}
          </p>
        </div>
        <Button onClick={onRecord}>처리 기록·상태 변경</Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">다음 행동</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {task.status === 'completed'
              ? '완료된 업무입니다.'
              : task.nextAction || '처리 기록에서 다음 행동을 정해 주세요.'}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">완료 기준</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {task.expectedOutcome || '예: 견적서를 제출하고 수신 확인받기'}
          </p>
        </div>
      </div>
      {task.status === 'waiting' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold">막힌 내용</h2>
          <p className="mt-2 whitespace-pre-wrap">{task.blockedReason}</p>
          <p className="mt-1 text-sm">
            해제 주체 {task.blockedBy} · 예상 해제일{' '}
            {task.expectedUnblockDate || '미정'}
          </p>
        </div>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">수신·처리 히스토리</h2>
        {history.map((entry) => (
          <article key={entry.id} className="rounded-xl border bg-white p-5">
            <p className="mb-3 text-sm text-slate-600">
              {FARM_HISTORY_CHANNEL_LABELS[entry.channel]} ·{' '}
              {entry.sender || entry.recorder} ·{' '}
              {new Date(entry.occurredAt).toLocaleString('ko-KR')}
            </p>
            {Boolean(entry.receivedContent || entry.imageIds?.length) && (
              <div className="rounded-lg bg-slate-50 p-3">
                <h3 className="text-sm font-semibold">받은 내용</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {entry.receivedContent}
                </p>
                <ReceivedImages imageIds={entry.imageIds} />
              </div>
            )}
            {entry.actionContent && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3">
                <h3 className="text-sm font-semibold">처리 내용</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {entry.actionContent}
                </p>
              </div>
            )}
            {entry.referenceUrl && (
              <a
                href={entry.referenceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-emerald-800 underline"
              >
                참고 링크
              </a>
            )}
            <p className="mt-3 text-xs text-slate-500">
              기록자 {entry.recorder}
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
