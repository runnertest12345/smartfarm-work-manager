'use client';

import { type SubmitEvent, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Check,
  Copy,
  KeyRound,
  Leaf,
  Loader2,
  LockKeyhole,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  firebaseConfigurationReady,
  getFirebaseServices,
  missingFirebaseConfig,
} from '@/lib/firebase/client';

import { FarmLedgerDashboard } from './farm-ledger-dashboard';

type AccessState =
  | 'checking'
  | 'signed_out'
  | 'checking_member'
  | 'denied'
  | 'allowed';

const SHARED_ACCESS_EMAIL =
  'team-access@smartfarm-work-manager.firebaseapp.com';

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-5 py-12 text-[#203027]">
      <section className="w-full max-w-md rounded-3xl border border-[#d9e5da] bg-white p-7 shadow-[0_24px_70px_rgba(28,71,52,0.12)] sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#2f7b59] text-white">
            <Leaf className="size-5" />
          </div>
          <div>
            <p className="font-bold">팜로그</p>
            <p className="text-xs text-[#748178]">Smart farm ledger</p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export function FirebaseAuthGate() {
  const [accessState, setAccessState] = useState<AccessState>(
    firebaseConfigurationReady ? 'checking' : 'signed_out',
  );
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState<'password' | 'google' | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!firebaseConfigurationReady) return;
    const { auth, db } = getFirebaseServices();
    let unsubscribeMember = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeMember();
      unsubscribeMember = () => {};
      setUser(nextUser);
      setMessage('');

      if (!nextUser) {
        setAccessState('signed_out');
        return;
      }

      setAccessState('checking_member');
      unsubscribeMember = onSnapshot(
        doc(db, 'appMembers', nextUser.uid),
        (snapshot) => {
          const member = snapshot.data() as { active?: boolean } | undefined;
          setAccessState(member?.active === true ? 'allowed' : 'denied');
        },
        (error) => {
          console.error('Failed to verify Firebase membership', error);
          setMessage(
            '사용자 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          );
          setAccessState('denied');
        },
      );
    });

    return () => {
      unsubscribeMember();
      unsubscribeAuth();
    };
  }, []);

  async function handleGoogleSignIn() {
    setSigningIn('google');
    setMessage('');
    try {
      const { auth } = getFirebaseServices();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // The app is hosted outside Firebase Hosting. Popup sign-in avoids the
      // third-party storage restrictions that can break cross-site redirects.
      await signInWithPopup(auth, provider);
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage('Google 로그인에 실패했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setSigningIn(null);
    }
  }

  async function handlePasswordSignIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setMessage('공용 비밀번호를 입력해 주세요.');
      return;
    }

    setSigningIn('password');
    setMessage('');
    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(auth, SHARED_ACCESS_EMAIL, password);
      setPassword('');
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String(error.code)
          : '';

      if (code === 'auth/too-many-requests') {
        setMessage(
          '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        );
      } else if (code === 'auth/network-request-failed') {
        setMessage('네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
      } else {
        setMessage('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
      }
    } finally {
      setSigningIn(null);
    }
  }

  async function handleSignOut() {
    await signOut(getFirebaseServices().auth);
  }

  async function copyUid() {
    if (!user) return;
    await navigator.clipboard.writeText(user.uid);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!firebaseConfigurationReady) {
    return (
      <AuthCard>
        <LockKeyhole className="size-7 text-[#2f7b59]" />
        <h1 className="mt-4 text-xl font-bold">Firebase 연결이 필요합니다</h1>
        <p className="mt-2 text-sm leading-6 text-[#6f7d73]">
          무료 운영 구조로 전환된 상태입니다. Firebase 콘솔에서 웹 앱을 등록한
          뒤 아래 공개 설정값을 <code>.env.local</code>에 입력해 주세요.
        </p>
        <div className="mt-5 rounded-2xl bg-[#f4f7f2] p-4 text-xs leading-6 text-[#526159]">
          {missingFirebaseConfig.map((name) => (
            <p key={name}>{name}</p>
          ))}
        </div>
      </AuthCard>
    );
  }

  if (accessState === 'checking' || accessState === 'checking_member') {
    return (
      <AuthCard>
        <div className="py-8 text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-[#2f7b59]" />
          <p className="mt-4 text-sm text-[#6f7d73]">
            접근 권한을 확인하고 있습니다.
          </p>
        </div>
      </AuthCard>
    );
  }

  if (accessState === 'signed_out') {
    return (
      <AuthCard>
        <LockKeyhole className="size-7 text-[#2f7b59]" />
        <h1 className="mt-4 text-xl font-bold">관리대장 접속</h1>
        <p className="mt-2 text-sm leading-6 text-[#6f7d73]">
          농가·사업·구독 정보는 승인된 사용자만 열 수 있습니다.
        </p>

        <form
          className="mt-6"
          onSubmit={(event) => void handlePasswordSignIn(event)}
        >
          <Label htmlFor="shared-access-password">공용 비밀번호</Label>
          <Input
            id="shared-access-password"
            type="password"
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setMessage('');
            }}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
            spellCheck={false}
            required
            disabled={signingIn !== null}
            aria-describedby={message ? 'sign-in-message' : undefined}
            aria-invalid={Boolean(message)}
            className="mt-2 h-11 rounded-xl border-[#cdd9cf] px-3"
            placeholder="비밀번호 입력"
          />
          {message && (
            <p
              id="sign-in-message"
              role="alert"
              aria-live="polite"
              className="mt-3 text-sm text-[#b65e3a]"
            >
              {message}
            </p>
          )}
          <Button
            type="submit"
            disabled={signingIn !== null || !password}
            className="mt-4 h-11 w-full rounded-xl bg-[#2f7b59] hover:bg-[#286b4d]"
          >
            {signingIn === 'password' ? (
              <Loader2 className="animate-spin" />
            ) : (
              <KeyRound />
            )}
            {signingIn === 'password' ? '접속 중...' : '비밀번호로 접속'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-[#e3e9e4]" />
          <span className="text-xs text-[#89958c]">관리자</span>
          <span className="h-px flex-1 bg-[#e3e9e4]" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void handleGoogleSignIn()}
          disabled={signingIn !== null}
          className="h-11 w-full rounded-xl border-[#cdd9cf]"
        >
          {signingIn === 'google' ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LockKeyhole />
          )}
          {signingIn === 'google' ? '로그인 중...' : '관리자 Google 로그인'}
        </Button>
        <p className="mt-4 text-xs leading-5 text-[#7b877f]">
          공용 비밀번호로 접속하면 변경 이력은 동일한 공용 사용자로
          기록됩니다.
        </p>
      </AuthCard>
    );
  }

  if (accessState === 'denied' && user) {
    return (
      <AuthCard>
        <LockKeyhole className="size-7 text-[#b65e3a]" />
        <h1 className="mt-4 text-xl font-bold">관리자 승인이 필요합니다</h1>
        <p className="mt-2 text-sm leading-6 text-[#6f7d73]">
          로그인은 완료됐지만 아직 관리대장 접근 권한이 없습니다. Firebase
          콘솔의
          <code className="mx-1">appMembers</code> 컬렉션에 아래 UID 문서를
          만들고
          <code className="mx-1">active: true</code>를 설정해 주세요.
        </p>
        <button
          type="button"
          onClick={() => void copyUid()}
          className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-[#f4f7f2] p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-[#748178]">
              사용자 UID
            </span>
            <span className="mt-1 block truncate font-mono text-xs">
              {user.uid}
            </span>
          </span>
          {copied ? (
            <Check className="size-4 text-[#2f7b59]" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
        {message && <p className="mt-4 text-sm text-[#b65e3a]">{message}</p>}
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleSignOut()}
          className="mt-5 w-full"
        >
          다른 계정으로 로그인
        </Button>
      </AuthCard>
    );
  }

  return (
    <FarmLedgerDashboard
      accountName={user?.displayName || '사용자'}
      accountEmail={user?.email || ''}
      onSignOut={() => void handleSignOut()}
    />
  );
}
