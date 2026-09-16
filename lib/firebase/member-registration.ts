'use client';

import { requireSignedInUser } from './client';

export interface MemberRegistrationInput {
  requestId: string;
  loginId: string;
  displayName: string;
  departmentId: string;
}
export interface MemberRegistrationResult {
  uid: string;
  loginId: string;
  displayName: string;
  initialPassword?: string;
  alreadyCreated: boolean;
}

export async function registerMember(
  input: MemberRegistrationInput,
): Promise<MemberRegistrationResult> {
  const user = requireSignedInUser();
  const token = await user.getIdToken();
  const response = await fetch('/api/admin/members', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.uid) {
    throw new Error(
      typeof data?.message === 'string'
        ? data.message
        : '회원 등록을 완료하지 못했습니다. 같은 내용으로 다시 시도해 주세요.',
    );
  }
  return data;
}
