import { RequestError } from './core.mjs';

// Keep the transport independent of Admin credentials so all guards can be
// exercised with synthetic requests, without opening a port or creating users.
export function createMemberHandler({
  origin,
  register,
  now = Date.now,
  logError = (value) => console.error(value),
}) {
  let windowStart = null;
  let requestCount = 0;
  function limit() {
    const timestamp = now();
    if (windowStart === null || timestamp - windowStart >= 60000) {
      windowStart = timestamp;
      requestCount = 0;
    }
    if (++requestCount > 30)
      throw new RequestError(
        429,
        '등록 요청이 많습니다. 1분 후 다시 시도해 주세요.',
      );
  }
  return async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === 'GET' && req.url === '/_health') {
        reply(200, { ready: true });
        return;
      }
      if (req.method !== 'POST' || req.url !== '/api/admin/members')
        throw new RequestError(404, '지원하지 않는 요청입니다.');
      if (req.headers.origin !== origin)
        throw new RequestError(403, '팜로그 화면에서 등록해 주세요.');
      if (req.headers['content-type']?.split(';')[0] !== 'application/json')
        throw new RequestError(415, '회원 등록 내용을 확인해 주세요.');
      limit();
      const token = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(
        req.headers.authorization || '',
      )?.[1];
      if (!token) throw new RequestError(401, '로그인이 필요합니다.');
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192)
          throw new RequestError(413, '등록 내용이 너무 큽니다.');
        chunks.push(chunk);
      }
      let input;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new RequestError(400, '등록 내용을 확인해 주세요.');
      }
      reply(200, await register(token, input));
    } catch (error) {
      const known = error instanceof RequestError;
      if (!known)
        logError(
          JSON.stringify({
            event: 'member-registration-error',
            code: [
              'auth/email-already-exists',
              'auth/uid-already-exists',
            ].includes(error?.code)
              ? 'account-conflict'
              : 'upstream-error',
          }),
        );
      reply(known ? error.status : 503, {
        message: known
          ? error.message
          : '등록 완료 여부를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.',
      });
    }
  };
}
