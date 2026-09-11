'use client';

import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  onIdTokenChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  firebaseConfigurationReady,
  firebaseWorkspaceId,
  getFirebaseServices,
  missingFirebaseConfig,
} from '@/lib/firebase/client';
import { acknowledgePasswordChange } from '@/lib/firebase/organization-store';
import {
  accountIdentifier,
  loginEmail,
  loginIdFromEmail,
} from '@/lib/login-identity';
import {
  readMember,
  SHARED_ACCESS_EMAIL,
  type AppMember,
} from '@/lib/organization';
import { FarmLedgerDashboard } from './farm-ledger-dashboard';

type AccessState =
  | 'checking'
  | 'signed_out'
  | 'verify_email'
  | 'denied'
  | 'allowed';
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-4">
          <Image
            src="/farmos-ci.png"
            alt="FarmOS 파모스"
            width={2480}
            height={2266}
            unoptimized
            className="h-auto w-20 shrink-0 object-contain sm:w-24"
          />
          <div>
            <p className="text-xl font-bold text-slate-900">팜로그</p>
            <p className="mt-1 break-keep text-sm leading-6 text-slate-600">
              파모스 업무관리 프로그램
            </p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export function FirebaseAuthGate() {
  const [access, setAccess] = useState<AccessState>(
    firebaseConfigurationReady ? 'checking' : 'signed_out',
  );
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<AppMember | null>(null);
  const [mode, setMode] = useState<'login' | 'shared'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [registrationHelpOpen, setRegistrationHelpOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangedUid, setPasswordChangedUid] = useState('');
  const actionLock = useRef(false);

  useEffect(() => {
    if (!firebaseConfigurationReady) return;
    const { auth, db } = getFirebaseServices();
    let unsubscribeMember = () => {};
    let generation = 0;
    let authCheck = 0;
    let subscribedUid = '';
    const off = onIdTokenChanged(auth, async (next) => {
      const check = ++authCheck;
      setUser(next);
      // Clear another account's access before asynchronous token validation.
      if (!next || next.uid !== subscribedUid) {
        generation++;
        unsubscribeMember();
        unsubscribeMember = () => {};
        subscribedUid = '';
        setMember(null);
        setAccess(next ? 'checking' : 'signed_out');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordChangedUid('');
      }
      let eligible = next?.emailVerified === true;
      if (next && !eligible && loginIdFromEmail(next.email)) {
        try {
          eligible =
            (await next.getIdTokenResult()).signInProvider === 'password';
        } catch {
          eligible = false;
        }
      }
      if (authCheck !== check) return;
      // An ordinary token refresh must not unmount the workspace or discard open drafts.
      if (eligible && subscribedUid === next?.uid) return;
      const token = ++generation;
      unsubscribeMember();
      unsubscribeMember = () => {};
      subscribedUid = '';
      setMember(null);
      setMessage('');
      if (!next) {
        setAccess('signed_out');
        return;
      }
      if (!eligible) {
        setAccess(loginIdFromEmail(next.email) ? 'denied' : 'verify_email');
        return;
      }
      setAccess('checking');
      subscribedUid = next.uid;
      unsubscribeMember = onSnapshot(
        doc(db, 'appMembers', next.uid),
        (snapshot) => {
          if (generation !== token) return;
          const data = snapshot.exists()
            ? readMember(next.uid, snapshot.data())
            : null;
          setMember(data);
          // Legacy approved accounts retain access; new accounts must belong to this workspace.
          setAccess(
            data?.active &&
              (!data.workspaceId || data.workspaceId === firebaseWorkspaceId)
              ? 'allowed'
              : 'denied',
          );
        },
        () => {
          if (generation !== token) return;
          subscribedUid = '';
          setMessage(
            '접근 권한을 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.',
          );
          setAccess('denied');
        },
      );
    });
    return () => {
      authCheck++;
      generation++;
      off();
      unsubscribeMember();
    };
  }, []);

  async function run(action: () => Promise<unknown>, success = '') {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
      if (success) setMessage(success);
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : '';
      setMessage(
        code === 'auth/requires-recent-login'
          ? '안전을 위해 로그아웃 후 다시 로그인하고 비밀번호를 변경해 주세요.'
          : code.startsWith('auth/')
            ? code === 'auth/email-already-in-use'
              ? '이미 가입된 아이디 또는 이메일입니다. 로그인하거나 관리자에게 문의해 주세요.'
              : code === 'auth/weak-password'
                ? '더 안전한 비밀번호를 입력해 주세요.'
                : code === 'auth/too-many-requests'
                  ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
                  : code === 'auth/popup-closed-by-user'
                    ? ''
                    : '로그인 정보를 확인하거나 잠시 후 다시 시도해 주세요.'
            : error instanceof Error
              ? error.message
              : '처리하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(
        auth,
        mode === 'shared' ? SHARED_ACCESS_EMAIL : loginEmail(email),
        password,
      );
      setPassword('');
    });
  }
  const status = message && (
    <output className="mt-4 block text-sm leading-6 text-amber-800">
      {message}
    </output>
  );
  const logout = (
    <Button
      type="button"
      variant="outline"
      className="mt-4 w-full"
      disabled={busy}
      onClick={() => void run(() => signOut(getFirebaseServices().auth))}
    >
      로그아웃 · 다른 계정 사용
    </Button>
  );

  if (!firebaseConfigurationReady)
    return (
      <AuthCard>
        <h1 className="text-xl font-bold">연결 설정이 필요합니다</h1>
        <div className="mt-4 text-sm">
          {missingFirebaseConfig.map((key) => (
            <p key={key}>{key}</p>
          ))}
        </div>
      </AuthCard>
    );
  if (access === 'checking')
    return (
      <AuthCard>
        <Loader2 className="animate-spin" />
        <p className="mt-4">접근 권한을 확인하고 있습니다.</p>
      </AuthCard>
    );
  if (access === 'allowed' && user && member?.passwordChangeRequired)
    return (
      <AuthCard>
        <h1 className="text-xl font-bold">첫 로그인 · 비밀번호 변경</h1>
        <p className="mt-3 text-sm leading-6">
          {member.displayName}님, 임시 비밀번호는 다른 직원과 공통으로
          사용합니다. 안전한 사용을 위해 본인만 아는 새 비밀번호로 변경해
          주세요. 변경 후부터 새 비밀번호로 로그인합니다.
        </p>
        {passwordChangedUid === user.uid ? (
          <div className="mt-5">
            <p className="text-sm">
              비밀번호는 변경되었습니다. 계정 확인을 마쳐 주세요.
            </p>
            <Button
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => void run(acknowledgePasswordChange)}
            >
              변경 완료 확인 다시 시도
            </Button>
          </div>
        ) : (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (newPassword.length < 10)
                  throw new Error('새 비밀번호는 10자 이상 입력해 주세요.');
                if (newPassword !== confirmPassword)
                  throw new Error('새 비밀번호가 서로 다릅니다.');
                await updatePassword(user, newPassword);
                setPasswordChangedUid(user.uid);
                setNewPassword('');
                setConfirmPassword('');
                await acknowledgePasswordChange();
              });
            }}
          >
            <div>
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                disabled={busy}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="10자 이상"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                disabled={busy}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              비밀번호 변경 후 시작
            </Button>
          </form>
        )}
        {status}
        {logout}
      </AuthCard>
    );
  if (access === 'verify_email' && user)
    return (
      <AuthCard>
        <h1 className="text-xl font-bold">이메일을 인증해 주세요</h1>
        <p className="mt-3 break-all text-sm leading-6">
          {user.email}로 받은 인증 메일의 링크를 누른 뒤 아래 버튼을 눌러
          주세요. 등록된 직원 계정만 사용할 수 있습니다.
        </p>
        <Button
          className="mt-5 w-full"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await reload(user);
              await user.getIdToken(true);
              if (!user.emailVerified)
                throw new Error('아직 이메일 인증이 확인되지 않습니다.');
            })
          }
        >
          인증 완료 확인
        </Button>
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() =>
            void run(
              () => sendEmailVerification(user),
              '인증 메일을 다시 보냈습니다.',
            )
          }
        >
          인증 메일 다시 보내기
        </Button>
        {status}
        {logout}
      </AuthCard>
    );
  if (access === 'denied' && user)
    return (
      <AuthCard>
        <h1 className="text-xl font-bold">직원 계정 확인이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6">
          외부 회원가입은 제공하지 않습니다. 러너 또는 평화에게 직원 등록이나
          계정 상태 확인을 요청해 주세요. 등록된 직원만 회사 자료에 접근할 수
          있습니다.
        </p>
        <p className="mt-4 break-all text-sm text-slate-600">
          {accountIdentifier(user.email)}
        </p>
        {status}
        {logout}
      </AuthCard>
    );
  if (access === 'signed_out')
    return (
      <AuthCard>
        <h1 className="text-xl font-bold">
          {mode === 'shared' ? '기존 공용 접속' : '로그인'}
        </h1>
        {mode === 'shared' && (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            공용 접속에서는 개인 업무 배정과 부서장 지시 기능을 사용할 수
            없습니다.
          </p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          외부 회원가입은 제공하지 않습니다. 계정은 러너·평화에게 문의해 주세요.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void submit(event)}
        >
          {mode !== 'shared' && (
            <div>
              <Label htmlFor="auth-email">아이디</Label>
              <Input
                id="auth-email"
                type="text"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={busy}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="예: 러너 (초기 비밀번호: 1234567)"
              />
            </div>
          )}
          <div>
            <Label htmlFor="auth-password">
              {mode === 'shared' ? '공용 비밀번호' : '비밀번호'}
            </Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Loader2 className="animate-spin" />}
            로그인
          </Button>
        </form>
        {status}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            aria-expanded={registrationHelpOpen}
            aria-controls="registration-request-help"
            onClick={() => setRegistrationHelpOpen((open) => !open)}
          >
            회원가입 요청
          </Button>
        </div>
        {registrationHelpOpen && (
          <section
            id="registration-request-help"
            aria-label="회원가입 요청 안내"
            className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6"
          >
            <h2 className="font-semibold">회원가입 요청 안내</h2>
            <p>
              이름·부서·희망 아이디를 러너 또는 평화에게 전달해 주세요. 담당자가
              확인한 후 계정을 등록합니다.
            </p>
            <p className="text-slate-600">
              이 화면에서는 요청이 자동 전송되거나 계정이 생성되지 않습니다.
              비밀번호 재설정도 담당자에게 문의해 주세요.
            </p>
          </section>
        )}
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'shared' ? 'login' : 'shared');
            setPassword('');
            setMessage('');
          }}
        >
          {mode === 'shared' ? '로그인으로' : '기존 공용 접속'}
        </Button>
      </AuthCard>
    );
  return (
    <FarmLedgerDashboard
      accountName={member?.displayName || user?.displayName || '사용자'}
      accountEmail={accountIdentifier(user?.email)}
      member={member}
      onSignOut={() => void run(() => signOut(getFirebaseServices().auth))}
    />
  );
}
