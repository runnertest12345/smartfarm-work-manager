'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  canRegisterMembers,
  type AppMember,
  type Department,
} from '@/lib/organization';
import { loginEmail, normalizeLoginId } from '@/lib/login-identity';
import { firebaseWorkspaceId } from '@/lib/firebase/client';
import {
  registerMember,
  type MemberRegistrationResult,
} from '@/lib/firebase/member-registration';

export function MemberRegistrationButton({
  current,
  departments,
}: {
  current: AppMember | null;
  departments: Department[];
}) {
  const [open, setOpen] = useState(false);
  if (!canRegisterMembers(current, firebaseWorkspaceId)) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>회원 추가</Button>
      {open && (
        <MemberRegistrationForm
          departments={departments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MemberRegistrationForm({
  departments,
  onClose,
}: {
  departments: Department[];
  onClose: () => void;
}) {
  const requestId = useRef(crypto.randomUUID());
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [departmentId, setDepartmentId] = useState(
    departments.length === 1 ? departments[0].id : '',
  );
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MemberRegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85svh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{result ? '회원 등록 완료' : '회원 추가'}</DialogTitle>
          <DialogDescription>
            {result
              ? '등록 정보를 새 직원에게 안전하게 전달해 주세요.'
              : '이메일 없이 아이디로 로그인하는 직원 계정을 만듭니다. 관리자 권한은 부여되지 않습니다.'}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4" aria-live="polite" aria-atomic="true">
            <p className="font-semibold">
              {result.displayName} · 아이디 {result.loginId}
            </p>
            {result.initialPassword ? (
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-sm text-slate-600">임시 비밀번호</p>
                <code className="mt-2 block break-all text-base">
                  {result.initialPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `아이디: ${result.loginId}\n임시 비밀번호: ${result.initialPassword}\n첫 로그인 시 비밀번호를 변경해 주세요.`,
                      );
                      setCopied(true);
                    } catch {
                      setError(
                        '복사하지 못했습니다. 등록 정보를 직접 전달해 주세요.',
                      );
                    }
                  }}
                >
                  {copied ? '복사됨' : '로그인 정보 복사'}
                </Button>
              </div>
            ) : (
              <p>
                이미 등록된 계정입니다. 사용 중인 비밀번호는 변경하지
                않았습니다.
              </p>
            )}
            <p className="text-sm text-slate-600">
              새 직원은 첫 로그인 때 본인의 비밀번호로 변경해야 합니다.
            </p>
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button onClick={onClose}>닫기</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setError('');
              try {
                loginEmail(loginId);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : '아이디를 확인해 주세요.',
                );
                return;
              }
              if (!departmentId) {
                setError('부서를 선택해 주세요.');
                return;
              }
              setBusy(true);
              setSubmitted(true);
              try {
                setResult(
                  await registerMember({
                    requestId: requestId.current,
                    loginId: normalizeLoginId(loginId),
                    displayName: displayName.trim(),
                    departmentId,
                  }),
                );
              } catch (e) {
                setError(
                  e instanceof Error && e.name !== 'TimeoutError'
                    ? e.message
                    : '응답을 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="new-member-name">이름</Label>
              <Input
                id="new-member-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                required
                disabled={busy || submitted}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="new-member-id">아이디</Label>
              <Input
                id="new-member-id"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                minLength={2}
                maxLength={10}
                required
                disabled={busy || submitted}
                autoComplete="off"
                placeholder="한글·영문·숫자·밑줄 2~10자"
              />
            </div>
            <div>
              <Label htmlFor="new-member-department">부서</Label>
              <Select
                value={departmentId || 'none'}
                disabled={busy || submitted}
                onValueChange={(value) =>
                  setDepartmentId(value === 'none' ? '' : String(value))
                }
              >
                <SelectTrigger id="new-member-department">
                  <SelectValue>
                    {departments.find((d) => d.id === departmentId)?.name ||
                      '부서 선택'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">부서 선택</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-600">
              직책은 ‘직원’으로 등록됩니다. 임시 비밀번호는 자동 발급하며 첫
              로그인 시 변경을 안내합니다.
            </p>
            {!departments.length && (
              <p className="text-amber-800">
                등록할 부서가 없습니다. 러너에게 부서 추가를 요청해 주세요.
              </p>
            )}
            {error && (
              <p role="alert" className="text-red-700">
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
              <Button type="submit" disabled={busy || !departments.length}>
                {busy
                  ? '등록 중…'
                  : submitted
                    ? '같은 내용으로 다시 시도'
                    : '회원 등록'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
