export const SHARED_ACCESS_EMAIL =
  'team-access@smartfarm-work-manager.firebaseapp.com';

export interface AppMember {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  admin: boolean;
  workspaceId: string;
  departmentId: string;
  requestedDepartment: string;
  jobTitle: '팀장' | '직원';
  passwordChangeRequired: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Department {
  id: string;
  name: string;
  headUid: string;
  createdAt: number;
  updatedAt: number;
}

export function readMember(
  id: string,
  data: Record<string, unknown>,
): AppMember {
  return {
    id,
    email: typeof data.email === 'string' ? data.email : '',
    displayName:
      typeof data.displayName === 'string' ? data.displayName : '기존 사용자',
    active: data.active === true,
    admin: data.admin === true,
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : '',
    departmentId:
      typeof data.departmentId === 'string' ? data.departmentId : '',
    requestedDepartment:
      typeof data.requestedDepartment === 'string'
        ? data.requestedDepartment
        : '',
    jobTitle: data.jobTitle === '팀장' ? '팀장' : '직원',
    passwordChangeRequired: data.passwordChangeRequired === true,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  };
}

export function isPersonalMember(
  member?: AppMember | null,
  workspaceId?: string,
) {
  return Boolean(
    member?.active &&
    member.email &&
    member.email !== SHARED_ACCESS_EMAIL &&
    member.workspaceId &&
    (!workspaceId || member.workspaceId === workspaceId),
  );
}

export function isOrganizationAdmin(
  member?: AppMember | null,
  workspaceId?: string,
) {
  return isPersonalMember(member, workspaceId) && member?.admin === true;
}

// Creation authority is separate from organization-wide editing authority.
export const MEMBER_REGISTRAR_IDS = [
  'staff-bootstrap-3c039722dfe5ab50da57d128',
  'staff-bootstrap-cbbc0b0b0bce4dfea455a415',
] as const;

export function canRegisterMembers(
  member?: AppMember | null,
  workspaceId?: string,
) {
  return (
    isPersonalMember(member, workspaceId) &&
    member?.passwordChangeRequired === false &&
    MEMBER_REGISTRAR_IDS.some((id) => id === member?.id)
  );
}

/** Capture the relationship when the assignment is made, not a later promotion. */
export function isDepartmentHeadAssignment(
  actor: AppMember,
  assignee: AppMember,
  department: Department,
) {
  return (
    isPersonalMember(actor, assignee.workspaceId) &&
    isPersonalMember(assignee) &&
    actor.id !== assignee.id &&
    department.headUid === actor.id &&
    actor.departmentId === department.id &&
    assignee.departmentId === department.id
  );
}
