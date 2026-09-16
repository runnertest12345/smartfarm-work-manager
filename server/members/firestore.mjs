import { RequestError } from './core.mjs';
const encode = (data) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === 'boolean'
        ? { booleanValue: v }
        : typeof v === 'number'
          ? { integerValue: String(v) }
          : { stringValue: v },
    ]),
  );
const decode = (doc) =>
  Object.fromEntries(
    Object.entries(doc.fields || {}).map(([k, v]) => [
      k,
      v.stringValue ?? v.booleanValue ?? Number(v.integerValue),
    ]),
  );

// Caller Firebase ID tokens enforce Security Rules; this service has no Firestore IAM grant.
export function firestoreStore(project, workspace, request = fetch) {
  const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  async function send(token, path, options = {}) {
    const response = await request(root + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (
      response.status === 404 &&
      (!options.method || options.method === 'GET')
    )
      return null;
    if (!response.ok)
      throw new RequestError(
        response.status === 401 || response.status === 403 ? 403 : 503,
        response.status === 401 || response.status === 403
          ? '계정 권한이 변경되었거나 로그인 시간이 만료되었습니다. 다시 로그인해 주세요.'
          : '회원 정보 저장을 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.',
      );
    return response.json();
  }
  return {
    async member(token, uid) {
      const doc = await send(token, `/appMembers/${encodeURIComponent(uid)}`);
      return doc ? decode(doc) : null;
    },
    async department(token, id) {
      const doc = await send(
        token,
        `/workspaces/${workspace}/departments/${encodeURIComponent(id)}`,
      );
      return doc ? decode(doc) : null;
    },
    async createMember(token, uid, member) {
      // exists=false never overwrites a pre-existing membership, including response-loss retries.
      await send(token, ':commit', {
        method: 'POST',
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: `projects/${project}/databases/(default)/documents/appMembers/${uid}`,
                fields: encode(member),
              },
              currentDocument: { exists: false },
            },
          ],
        }),
      });
    },
  };
}
