'use client';

import { useState } from 'react';
import { accountIdentifier } from '@/lib/login-identity';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  saveDepartment,
  saveMemberAccess,
} from '@/lib/firebase/organization-store';
import {
  isOrganizationAdmin,
  SHARED_ACCESS_EMAIL,
  type AppMember,
  type Department,
} from '@/lib/organization';

export function OrganizationManagement({
  current,
  members,
  departments,
  error,
}: {
  current: AppMember | null;
  members: AppMember[];
  departments: Department[];
  error: string;
}) {
  const [search, setSearch] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<
    Department | 'new' | null
  >(null);
  if (!isOrganizationAdmin(current))
    return <p>직원·부서 관리는 승인된 관리자만 사용할 수 있습니다.</p>;
  const personal = members.filter(
    (member) => member.email !== SHARED_ACCESS_EMAIL,
  );
  const pending = personal.filter((member) => !member.active).length;
  return (
    <section className="space-y-5" aria-label="직원·부서 관리">
      <div>
        <h1 className="text-2xl font-bold">직원·부서 관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          등록된 직원의 부서·직책·접근 상태를 관리합니다. 외부 회원가입은
          차단되어 있습니다.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <section className="rounded-xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">부서 {departments.length}개</h2>
          <Button onClick={() => setEditingDepartment('new')}>부서 추가</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <article
              key={dept.id}
              className="rounded-lg border border-slate-300 p-4"
            >
              <h3 className="font-bold">{dept.name}</h3>
              <p className="mt-2 text-sm">
                부서장:{' '}
                {members.find((member) => member.id === dept.headUid)
                  ?.displayName || '미지정'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                승인 직원{' '}
                {
                  members.filter(
                    (member) =>
                      member.active && member.departmentId === dept.id,
                  ).length
                }
                명
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setEditingDepartment(dept)}
              >
                이름·부서장 변경
              </Button>
            </article>
          ))}
        </div>
        {!departments.length && (
          <p className="text-sm text-slate-600">
            먼저 부서를 추가한 뒤 가입자를 승인해 주세요.
          </p>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-bold">
          직원 계정 · 승인 대기·중지 {pending}명
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          신규 계정 생성 화면은 아직 제공하지 않습니다. 부서장 지시 업무는
          직원의 소속 부서장이 직접 계정에 배정했을 때 자동으로 최우선이 됩니다.
          가입자에게 관리자 권한은 자동으로 부여되지 않습니다.
        </p>
        <Input
          aria-label="직원 이름·아이디 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="my-4 max-w-md"
          placeholder="이름·아이디 검색"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>직원</TableHead>
              <TableHead>가입 시 소속</TableHead>
              <TableHead>부서</TableHead>
              <TableHead>직책</TableHead>
              <TableHead>접근 상태</TableHead>
              <TableHead>적용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personal
              .filter((member) =>
                `${member.displayName} ${accountIdentifier(member.email)}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .sort(
                (a, b) =>
                  Number(a.active) - Number(b.active) ||
                  a.displayName.localeCompare(b.displayName, 'ko'),
              )
              .map((member) => (
                <MemberRow
                  key={`${member.id}-${member.updatedAt}`}
                  member={member}
                  departments={departments}
                  currentUid={current!.id}
                />
              ))}
            {!personal.length && (
              <TableRow>
                <TableCell colSpan={6}>등록된 직원이 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
      {editingDepartment && (
        <DepartmentEditor
          key={editingDepartment === 'new' ? 'new' : editingDepartment.id}
          department={
            editingDepartment === 'new' ? undefined : editingDepartment
          }
          members={members}
          onClose={() => setEditingDepartment(null)}
        />
      )}
    </section>
  );
}

function MemberRow({
  member,
  departments,
  currentUid,
}: {
  member: AppMember;
  departments: Department[];
  currentUid: string;
}) {
  const [departmentId, setDepartmentId] = useState(member.departmentId);
  const [active, setActive] = useState(member.active);
  const [jobTitle, setJobTitle] = useState(member.jobTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <TableRow>
      <TableCell>
        <p className="font-semibold">
          {member.displayName}
          {member.admin ? ' · 관리자' : ''}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {accountIdentifier(member.email)}
        </p>
        {member.passwordChangeRequired && (
          <p className="mt-1 text-sm text-amber-800">
            첫 로그인 비밀번호 변경 안내 대상
          </p>
        )}
      </TableCell>
      <TableCell>{member.requestedDepartment || '미입력'}</TableCell>
      <TableCell>
        <Select
          value={departmentId || 'none'}
          onValueChange={(value) =>
            setDepartmentId(value === 'none' ? '' : String(value))
          }
          disabled={busy}
        >
          <SelectTrigger
            aria-label={`${member.displayName} 부서`}
            className="min-w-36"
          >
            <SelectValue>
              {departments.find((dept) => dept.id === departmentId)?.name ||
                '부서 선택'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">부서 선택</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {departments.some(
          (dept) =>
            dept.id === member.departmentId && dept.headUid === member.id,
        ) ? (
          '부서장'
        ) : (
          <Select
            value={jobTitle}
            onValueChange={(value) =>
              setJobTitle(value === '팀장' ? '팀장' : '직원')
            }
            disabled={busy}
          >
            <SelectTrigger
              aria-label={`${member.displayName} 직책`}
              className="min-w-24"
            >
              <SelectValue>{jobTitle}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="팀장">팀장</SelectItem>
              <SelectItem value="직원">직원</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <Select
          value={active ? 'active' : 'inactive'}
          onValueChange={(value) => setActive(value === 'active')}
          disabled={busy || currentUid === member.id}
        >
          <SelectTrigger
            aria-label={`${member.displayName} 접근 상태`}
            className="min-w-36"
          >
            <SelectValue>{active ? '승인·사용' : '대기·중지'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">승인·사용</SelectItem>
            <SelectItem value="inactive">대기·중지</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          disabled={
            busy ||
            (departmentId === member.departmentId &&
              active === member.active &&
              jobTitle === member.jobTitle)
          }
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await saveMemberAccess(member, active, departmentId, jobTitle);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : '저장하지 못했습니다.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          적용
        </Button>
        {error && (
          <p
            role="alert"
            className="mt-2 max-w-xs whitespace-normal text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

function DepartmentEditor({
  department,
  members,
  onClose,
}: {
  department?: Department;
  members: AppMember[];
  onClose: () => void;
}) {
  const [name, setName] = useState(department?.name || '');
  const [headUid, setHeadUid] = useState(department?.headUid || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const eligible = members.filter(
    (member) => member.active && member.departmentId === department?.id,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {department ? '부서 정보 변경' : '부서 추가'}
          </DialogTitle>
          <DialogDescription>
            부서장은 이 부서에 승인된 개인 계정 중에서 지정합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              await saveDepartment(name, headUid, department);
              onClose();
            } catch (error) {
              setError(
                error instanceof Error ? error.message : '저장하지 못했습니다.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <Label htmlFor="department-name">부서명</Label>
            <Input
              id="department-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="department-head">부서장</Label>
            <Select
              value={headUid || 'none'}
              onValueChange={(value) =>
                setHeadUid(value === 'none' ? '' : String(value))
              }
              disabled={busy}
            >
              <SelectTrigger id="department-head">
                <SelectValue>
                  {eligible.find((member) => member.id === headUid)
                    ?.displayName || '미지정'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미지정</SelectItem>
                {eligible.map((member) => (
                  <SelectItem value={member.id} key={member.id}>
                    {member.displayName} · {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!eligible.length && (
            <p className="text-sm text-slate-600">
              부서를 저장하고 직원을 승인한 뒤 부서장을 지정해 주세요.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
