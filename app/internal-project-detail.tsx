import type { ReactNode } from 'react';
import type { FarmProject } from '@/lib/farm-types';

export function InternalProjectDetail({
  project,
  canAddTask,
  children,
}: {
  project: FarmProject;
  canAddTask: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label="내부 프로젝트 상세" className="space-y-4">
      {!canAddTask && (
        <p className="mt-2 text-sm text-slate-600">
          내부 업무 등록은 승인된 개인 계정으로 로그인해 주세요.
        </p>
      )}
      {project.status === 'completed' && (
        <p className="text-sm text-slate-600">
          완료된 프로젝트입니다. 새 업무를 등록하려면 기본정보에서 상태를 변경해
          주세요.
        </p>
      )}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-base font-bold">연결된 내부 업무</h2>
        {children}
      </div>
    </section>
  );
}
