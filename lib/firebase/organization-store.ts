'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  where,
  type Transaction,
} from 'firebase/firestore';
import {
  firebaseWorkspaceId,
  getFirebaseServices,
  requireSignedInUser,
} from './client';
import {
  isDepartmentHeadAssignment,
  isOrganizationAdmin,
  isPersonalMember,
  readMember,
  SHARED_ACCESS_EMAIL,
  type AppMember,
  type Department,
} from '@/lib/organization';

const memberRef = (id: string) =>
  doc(getFirebaseServices().db, 'appMembers', id);
const departmentRef = (id: string) =>
  doc(
    getFirebaseServices().db,
    'workspaces',
    firebaseWorkspaceId,
    'departments',
    id,
  );

async function assertAdmin(tx: Transaction) {
  const uid = requireSignedInUser().uid;
  const snapshot = await tx.get(memberRef(uid));
  if (
    !snapshot.exists() ||
    !isOrganizationAdmin(readMember(uid, snapshot.data()), firebaseWorkspaceId)
  )
    throw new Error('계정 관리 권한이 없습니다.');
  return uid;
}

export async function saveMemberAccess(
  member: AppMember,
  active: boolean,
  departmentId: string,
  jobTitle: AppMember['jobTitle'] = member.jobTitle || '직원',
) {
  if (!['팀장', '직원'].includes(jobTitle))
    throw new Error('직책을 선택해 주세요.');
  await runTransaction(getFirebaseServices().db, async (tx) => {
    const actor = await assertAdmin(tx);
    const snapshot = await tx.get(memberRef(member.id));
    if (!snapshot.exists() || snapshot.data().updatedAt !== member.updatedAt)
      throw new Error('계정 정보가 변경되었습니다. 최신 내용을 확인해 주세요.');
    const latest = readMember(member.id, snapshot.data());
    if (
      latest.workspaceId !== firebaseWorkspaceId ||
      latest.email === SHARED_ACCESS_EMAIL
    )
      throw new Error('이 작업공간의 개인 계정만 관리할 수 있습니다.');
    if (actor === member.id && !active)
      throw new Error('현재 관리자 본인은 사용 중지할 수 없습니다.');
    if (active && !departmentId)
      throw new Error('승인할 계정의 부서를 선택해 주세요.');
    if (departmentId) {
      const dept = await tx.get(departmentRef(departmentId));
      if (!dept.exists()) throw new Error('부서를 찾을 수 없습니다.');
    }
    const oldDepartment =
      latest.departmentId && (!active || latest.departmentId !== departmentId)
        ? await tx.get(departmentRef(latest.departmentId))
        : null;
    const now = Math.max(Date.now(), latest.updatedAt + 1);
    if (oldDepartment?.exists() && oldDepartment.data().headUid === latest.id) {
      tx.update(departmentRef(latest.departmentId), {
        headUid: '',
        updatedAt: now,
      });
    }
    tx.update(memberRef(member.id), {
      active,
      departmentId,
      jobTitle,
      updatedAt: now,
    });
  });
}

/** UI acknowledgement only: Firestore cannot verify an Auth password change. */
export async function acknowledgePasswordChange() {
  const uid = requireSignedInUser().uid;
  await runTransaction(getFirebaseServices().db, async (tx) => {
    const ref = memberRef(uid);
    const current = await tx.get(ref);
    if (!current.exists()) throw new Error('계정 정보를 확인할 수 없습니다.');
    if (current.data().passwordChangeRequired !== true) return;
    tx.update(ref, {
      passwordChangeRequired: false,
      updatedAt: Math.max(
        Date.now(),
        Number(current.data().updatedAt || 0) + 1,
      ),
    });
  });
}

export async function saveDepartment(
  name: string,
  headUid: string,
  existing?: Department,
) {
  if (!name.trim() || name.trim().length > 80)
    throw new Error('부서명을 80자 이내로 입력해 주세요.');
  const id = existing?.id || crypto.randomUUID();
  await runTransaction(getFirebaseServices().db, async (tx) => {
    await assertAdmin(tx);
    const previous = await tx.get(departmentRef(id));
    if (
      existing &&
      (!previous.exists() || previous.data().updatedAt !== existing.updatedAt)
    )
      throw new Error('부서 정보가 변경되었습니다. 다시 확인해 주세요.');
    if (!existing && previous.exists())
      throw new Error('이미 생성된 부서입니다.');
    if (headUid) {
      const head = await tx.get(memberRef(headUid));
      if (!head.exists()) throw new Error('부서장 계정을 찾을 수 없습니다.');
      const member = readMember(headUid, head.data());
      if (
        !isPersonalMember(member, firebaseWorkspaceId) ||
        member.departmentId !== id
      )
        throw new Error('이 부서의 승인된 직원 중 부서장을 선택해 주세요.');
    }
    const now = Math.max(Date.now(), (existing?.updatedAt || 0) + 1);
    tx.set(departmentRef(id), {
      id,
      name: name.trim(),
      headUid,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  });
}

/** All reads occur before callers write their task/history transaction. Rules repeat this validation. */
export async function resolveTaskAssignment(
  tx: Transaction,
  assigneeUid: string,
  createdAt: number,
) {
  const actorUid = requireSignedInUser().uid;
  const actorSnapshot = await tx.get(memberRef(actorUid));
  const targetSnapshot = await tx.get(memberRef(assigneeUid));
  if (!actorSnapshot.exists() || !targetSnapshot.exists())
    throw new Error('승인된 개인 계정을 선택해 주세요.');
  const actor = readMember(actorUid, actorSnapshot.data());
  const target = readMember(assigneeUid, targetSnapshot.data());
  if (
    !isPersonalMember(actor, firebaseWorkspaceId) ||
    !isPersonalMember(target, firebaseWorkspaceId) ||
    !target.departmentId
  )
    throw new Error('부서가 지정된 승인 계정에 배정해 주세요.');
  const snapshot = await tx.get(departmentRef(target.departmentId));
  if (!snapshot.exists()) throw new Error('담당자의 부서가 없습니다.');
  const department = snapshot.data() as Department;
  return {
    assigneeUid,
    assignedByUid: actorUid,
    departmentId: department.id,
    headAssigned: isDepartmentHeadAssignment(actor, target, department),
    assignedAt: createdAt,
    owner: target.displayName,
  };
}

export function useOrganization(member: AppMember | null) {
  const admin = isOrganizationAdmin(member, firebaseWorkspaceId);
  const personal = isPersonalMember(member, firebaseWorkspaceId);
  const key = `${member?.id || ''}:${personal}:${admin}`;
  const [directory, setDirectory] = useState<{
    key: string;
    members: AppMember[];
    departments: Department[];
    error: string;
  }>({ key: '', members: [], departments: [], error: '' });
  useEffect(() => {
    if (!personal) return;
    let alive = true;
    const update = (patch: Partial<typeof directory>) => {
      if (alive)
        setDirectory((previous) => ({
          ...(previous.key === key
            ? previous
            : { key, members: [], departments: [], error: '' }),
          ...patch,
          key,
        }));
    };
    const db = getFirebaseServices().db;
    const constraints = [
      where('workspaceId', '==', firebaseWorkspaceId),
      ...(!admin ? [where('active', '==', true)] : []),
      limit(5000),
    ];
    const fail = () =>
      update({
        error:
          '부서·직원 목록을 불러오지 못했습니다. 잠시 후 다시 로그인해 주세요.',
      });
    const offMembers = onSnapshot(
      query(collection(db, 'appMembers'), ...constraints),
      (snapshot) => {
        update({
          members: snapshot.docs.map((row) => readMember(row.id, row.data())),
          ...(snapshot.size >= 5000
            ? {
                error:
                  '직원 조회 한도에 도달했습니다. 관리자 확인이 필요합니다.',
              }
            : {}),
        });
      },
      fail,
    );
    const offDepartments = onSnapshot(
      query(
        collection(db, 'workspaces', firebaseWorkspaceId, 'departments'),
        limit(5000),
      ),
      (snapshot) =>
        update({
          departments: snapshot.docs.map((row) => row.data() as Department),
        }),
      fail,
    );
    return () => {
      alive = false;
      offMembers();
      offDepartments();
    };
  }, [key, personal, admin]);
  const current =
    personal && directory.key === key
      ? directory
      : { members: [], departments: [], error: '' };
  return { ...current, admin, personal };
}
