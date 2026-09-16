import { createHash, createHmac, randomUUID } from 'node:crypto';
import { loginEmail, normalizeLoginId } from '../../lib/login-identity.ts';

export const REGISTRARS = Object.freeze({
  'staff-bootstrap-3c039722dfe5ab50da57d128': loginEmail('러너'),
  'staff-bootstrap-cbbc0b0b0bce4dfea455a415': loginEmail('평화'),
});
export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const deny = () => {
  throw new RequestError(
    403,
    '러너·평화의 승인된 계정으로 로그인하고 첫 비밀번호 변경을 완료해 주세요.',
  );
};
export function validateInput(input) {
  const keys = ['requestId', 'loginId', 'displayName', 'departmentId'];
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k)) ||
    keys.some((k) => typeof input[k] !== 'string')
  )
    throw new RequestError(400, '회원 등록 내용을 확인해 주세요.');
  if (!/^[a-f0-9-]{36}$/.test(input.requestId))
    throw new RequestError(400, '요청 식별자가 올바르지 않습니다.');
  let email;
  try {
    email = loginEmail(input.loginId);
  } catch {
    throw new RequestError(
      400,
      '아이디는 한글·영문·숫자·밑줄로 2~10자 입력해 주세요.',
    );
  }
  const displayName = input.displayName.normalize('NFC').trim();
  if (
    !displayName ||
    displayName.length > 40 ||
    // Control characters are intentionally rejected in user-supplied names.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(displayName)
  )
    throw new RequestError(400, '이름을 40자 이내로 입력해 주세요.');
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.departmentId))
    throw new RequestError(400, '부서를 선택해 주세요.');
  return {
    ...input,
    loginId: normalizeLoginId(input.loginId),
    email,
    displayName,
  };
}
export function assertRegistrar(decoded, member, workspace) {
  if (
    !decoded ||
    !REGISTRARS[decoded.uid] ||
    decoded.firebase?.sign_in_provider !== 'password' ||
    decoded.email !== REGISTRARS[decoded.uid] ||
    !member ||
    member.email !== decoded.email ||
    member.active !== true ||
    member.workspaceId !== workspace ||
    member.passwordChangeRequired !== false
  )
    deny();
}
export function temporaryPassword(secret, uid) {
  return (
    'aA1!' +
    createHmac('sha256', secret).update(uid).digest('base64url').slice(0, 20)
  );
}

export function createRegistrar({
  auth,
  store,
  journal,
  workspace,
  passwordSecret,
  now = Date.now,
}) {
  const inFlight = new Set();
  return async function register(token, input) {
    let decoded;
    try {
      decoded = await auth.verifyIdToken(token, true);
    } catch {
      throw new RequestError(401, '로그인 상태를 다시 확인해 주세요.');
    }
    if (!REGISTRARS[decoded.uid]) deny();
    assertRegistrar(decoded, await store.member(token, decoded.uid), workspace);
    const data = validateInput(input);
    const dept = await store.department(token, data.departmentId);
    if (!dept || dept.id !== data.departmentId)
      throw new RequestError(400, '선택한 부서를 찾을 수 없습니다.');
    if (inFlight.has(data.email))
      throw new RequestError(
        409,
        '같은 아이디를 등록 중입니다. 잠시 후 같은 내용으로 다시 시도해 주세요.',
      );
    inFlight.add(data.email);
    try {
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            decoded.uid,
            data.email,
            data.displayName,
            data.departmentId,
            workspace,
          ]),
        )
        .digest('hex');
      const job = journal.reserve({
        requestId: data.requestId,
        email: data.email,
        fingerprint,
        actorUid: decoded.uid,
        uid: `staff-member-${randomUUID()}`,
        createdAt: now(),
      });
      let user;
      try {
        user = await auth.getUser(job.uid);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }
      if (user && user.email !== data.email)
        throw new RequestError(
          409,
          '기존 계정과 충돌합니다. 관리자 확인이 필요합니다.',
        );
      if (!user) {
        let existing;
        try {
          existing = await auth.getUserByEmail(data.email);
        } catch (e) {
          if (e.code !== 'auth/user-not-found') throw e;
        }
        if (existing)
          throw new RequestError(
            409,
            '이미 사용 중인 아이디입니다. 기존 계정은 변경하지 않았습니다.',
          );
        user = await auth.createUser({
          uid: job.uid,
          email: data.email,
          displayName: data.displayName,
          emailVerified: false,
          disabled: false,
          password: temporaryPassword(passwordSecret, job.uid),
        });
      }
      let member = await store.member(token, job.uid);
      const alreadyCreated = Boolean(member);
      if (
        member &&
        (member.registrationRequestId !== job.requestId ||
          member.createdByUid !== job.actorUid ||
          member.email !== data.email)
      )
        throw new RequestError(
          409,
          '기존 직원 정보와 충돌합니다. 관리자 확인이 필요합니다.',
        );
      if (!member) {
        assertRegistrar(
          decoded,
          await store.member(token, decoded.uid),
          workspace,
        );
        member = {
          email: data.email,
          displayName: data.displayName,
          active: true,
          admin: false,
          workspaceId: workspace,
          departmentId: data.departmentId,
          requestedDepartment: '',
          jobTitle: '직원',
          passwordChangeRequired: true,
          createdAt: job.createdAt,
          updatedAt: job.createdAt,
          createdByUid: decoded.uid,
          registrationRequestId: job.requestId,
        };
        await store.createMember(token, job.uid, member);
      }
      journal.complete(job.uid);
      return {
        uid: job.uid,
        loginId: data.loginId,
        displayName: member.displayName,
        alreadyCreated,
        ...(!user.disabled &&
        !user.metadata?.lastSignInTime &&
        member.passwordChangeRequired === true
          ? { initialPassword: temporaryPassword(passwordSecret, job.uid) }
          : {}),
      };
    } finally {
      inFlight.delete(data.email);
    }
  };
}
