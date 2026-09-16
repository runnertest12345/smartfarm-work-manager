import { Button } from '@/components/ui/button';
import type { FarmProject } from '@/lib/farm-types';

export function ProjectInstallationSetupNotice({
  project,
  busy,
  error,
  onResume,
}: {
  project: FarmProject;
  busy: boolean;
  error?: string;
  onResume: () => void;
}) {
  const setup = project.installationFarmSetup;
  if (
    project.projectType === 'internal' ||
    !setup ||
    setup.completedCount >= setup.requestedCount
  )
    return null;

  const unavailableReason =
    (project.deletedAt ?? 0) > 0
      ? '삭제된 프로젝트에서는 농가를 생성할 수 없습니다. 프로젝트를 복원한 뒤 다시 시도해 주세요.'
      : project.status === 'completed'
        ? '완료된 프로젝트에서는 농가를 생성할 수 없습니다. 프로젝트를 진행 중으로 변경한 뒤 다시 시도해 주세요.'
        : '';
  const disabled = busy || Boolean(unavailableReason);
  const descriptionId = `installation-setup-description-${encodeURIComponent(project.id)}`;

  return (
    <section
      aria-label="농가 자동 생성 현황"
      aria-busy={busy}
      className="mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <output aria-live="polite" className="font-semibold">
          농가 자동 생성 {setup.completedCount}/{setup.requestedCount}개소
        </output>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={descriptionId}
          onClick={disabled ? undefined : onResume}
        >
          {busy ? '농가 생성 중…' : '남은 농가 생성'}
        </Button>
      </div>
      <div id={descriptionId} className="space-y-1 text-xs leading-relaxed">
        <p>
          이미 생성된 농가와 수정한 정보는 그대로 보존됩니다. 남은 농가만 이어서 생성할 수 있습니다.
        </p>
        {unavailableReason && <p>{unavailableReason}</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
