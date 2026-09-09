// Firebase uses an internal, non-deliverable identifier. Employees never need an email.
const LOGIN_DOMAIN = '@staff.smartfarm-work-manager.invalid';
export function normalizeLoginId(value: string) {
  return value.normalize('NFC').trim().toLowerCase();
}
export function loginEmail(value: string) {
  const id = normalizeLoginId(value);
  if (!/^[a-z0-9_가-힣]{2,10}$/.test(id))
    throw new Error('아이디는 한글·영문·숫자·밑줄로 2~10자 입력해 주세요.');
  return (
    'u' +
    Array.from(new TextEncoder().encode(id), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('') +
    LOGIN_DOMAIN
  );
}
export function loginIdFromEmail(email: string | null | undefined) {
  if (!email?.endsWith(LOGIN_DOMAIN)) return '';
  const hex = email.slice(1, -LOGIN_DOMAIN.length);
  if (!/^u(?:[a-f0-9]{2}){2,30}@/.test(email) || !/^[a-f0-9]+$/.test(hex))
    return '';
  try {
    const id = new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(hex.match(/../g)!.map((byte) => parseInt(byte, 16))),
    );
    return loginEmail(id) === email ? id : '';
  } catch {
    return '';
  }
}
export function accountIdentifier(email: string | null | undefined) {
  const id = loginIdFromEmail(email);
  return id ? `아이디: ${id}` : email || '';
}
