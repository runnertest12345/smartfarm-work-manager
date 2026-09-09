'use client';
import { accountIdentifier } from '@/lib/login-identity';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  farmLedgerFetch,
  waitForFarmLedgerSync,
} from '@/lib/firebase/farm-ledger-store';
import { isInternalTask } from '@/lib/project-work';
import {
  isDepartmentHeadAssignment,
  isPersonalMember,
  type AppMember,
  type Department,
} from '@/lib/organization';
import type { FarmProject, FarmWorkItem } from '@/lib/farm-types';
import type { ReceivedImage } from '@/lib/received-images';
import { ReceivedContentInput } from './received-images';

export function TaskRegistrationDialog({
  member,
  members,
  departments,
  projects,
  parent,
  onClose,
  onCreated,
}: {
  member: AppMember;
  members: AppMember[];
  departments: Department[];
  projects: FarmProject[];
  parent?: FarmWorkItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scope, setScope] = useState<'internal' | 'project'>(
    parent ? (isInternalTask(parent) ? 'internal' : 'project') : 'internal',
  );
  const [projectId, setProjectId] = useState(parent?.projectId || '');
  const [assigneeUid, setAssigneeUid] = useState(
    parent?.assigneeUid || member.id,
  );
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<ReceivedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [operationId] = useState(() => crypto.randomUUID());
  const [occurredAt] = useState(() => Date.now());
  const eligible = members.filter(
    (person) =>
      isPersonalMember(person, member.workspaceId) &&
      person.departmentId &&
      (!parent ||
        !isInternalTask(parent) ||
        person.departmentId === parent.departmentId),
  );
  const target = eligible.find((person) => person.id === assigneeUid);
  const department = departments.find(
    (dept) => dept.id === target?.departmentId,
  );
  const directed =
    target &&
    department &&
    isDepartmentHeadAssignment(member, target, department);
  function close() {
    if (!lock.current && !imageBusy) onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (!open && details.reason !== 'outside-press') close();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{parent ? '세부 업무 등록' : '업무 등록'}</DialogTitle>
          <DialogDescription>
            {parent
              ? `상위 업무: ${parent.title}`
              : '내부 업무 또는 프로젝트 업무를 직원 계정에 배정합니다.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || imageBusy) return;
            if (
              !target ||
              !title.trim() ||
              (scope === 'project' && !projectId)
            ) {
              setError('업무명, 담당 계정과 연결할 프로젝트를 확인해 주세요.');
              return;
            }
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              const response = await farmLedgerFetch('/api/farm-ledger', {
                method: 'POST',
                body: JSON.stringify({
                  kind: 'work_item',
                  operationId,
                  images,
                  checklist: [],
                  sourceInboxId: '',
                  workItem: {
                    ...(scope === 'internal' ? { scope: 'internal' } : {}),
                    assigneeUid,
                    projectId: scope === 'project' ? projectId : '',
                    parentWorkItemId: parent?.id || '',
                    farmRecordId: '',
                    workType: 'communication',
                    title: title.trim(),
                    owner: target.displayName,
                    dueDate,
                    status: 'open',
                    description: content,
                    expectedOutcome: '',
                    nextAction: '',
                    priority: 'medium',
                    reviewDate: '',
                    responseDueAt: 0,
                    blockedReason: '',
                    blockedBy: '',
                    expectedUnblockDate: '',
                  },
                  history: {
                    channel: content || images.length ? 'other' : 'system',
                    sender: member.displayName,
                    receivedContent: content,
                    actionContent: `업무 등록 · 담당 ${target.displayName}`,
                    amount: 0,
                    recorder: member.displayName,
                    occurredAt,
                    referenceUrl: '',
                  },
                }),
              });
              const result = (await response.json()) as { error?: string };
              if (!response.ok)
                throw new Error(result.error || '업무를 저장하지 못했습니다.');
              await waitForFarmLedgerSync();
              onCreated();
              onClose();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : '업무를 등록하지 못했습니다.',
              );
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          {!parent && (
            <div>
              <Label htmlFor="task-scope">업무 구분</Label>
              <Select
                value={scope}
                onValueChange={(value) =>
                  setScope(value as 'internal' | 'project')
                }
                disabled={busy}
              >
                <SelectTrigger id="task-scope">
                  <SelectValue>
                    {scope === 'internal' ? '내부 업무' : '프로젝트 업무'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">내부 업무</SelectItem>
                  <SelectItem value="project">프로젝트 업무</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {scope === 'project' && (
            <div>
              <Label htmlFor="task-project">프로젝트</Label>
              <Select
                value={projectId}
                onValueChange={(value) => setProjectId(String(value))}
                disabled={busy || Boolean(parent)}
              >
                <SelectTrigger id="task-project">
                  <SelectValue placeholder="프로젝트 선택">
                    {projects.find((project) => project.id === projectId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects
                    .filter(
                      (project) =>
                        !project.deletedAt && project.status !== 'completed',
                    )
                    .map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.year} · {project.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="task-title">업무명</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={160}
              disabled={busy}
              placeholder="예: 주간 실적 자료 정리"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-assignee">담당 계정</Label>
              <Select
                value={assigneeUid}
                onValueChange={(value) => setAssigneeUid(String(value))}
                disabled={busy}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="담당 직원 선택">
                    {target
                      ? `${target.displayName} · ${department?.name || '부서 미지정'}`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.displayName} ·{' '}
                      {
                        departments.find(
                          (dept) => dept.id === person.departmentId,
                        )?.name
                      }{' '}
                      · {accountIdentifier(person.email)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-due">기한 (선택)</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          {directed ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              부서장 지시 · 최우선 업무로 배정됩니다.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              {scope === 'internal'
                ? '내부 업무는 사업 수·농가·설치·구독 KPI에 포함하지 않습니다.'
                : '계정의 소속 부서장이 배정하면 자동으로 최우선이 됩니다.'}
            </p>
          )}
          <div>
            <Label htmlFor="task-content">받은 내용·처리 요청 (선택)</Label>
            <ReceivedContentInput
              id="task-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              images={images}
              onImagesChange={setImages}
              onBusyChange={setImageBusy}
              disabled={busy}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy || imageBusy}
              onClick={close}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy || imageBusy || !target}>
              {busy ? '등록 중…' : '업무 등록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
