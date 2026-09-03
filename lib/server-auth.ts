import { OAuth2Client, type LoginTicket } from 'google-auth-library';

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type AuthenticationResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: 401 | 403 | 500; error: string };

const IAP_ISSUER = 'https://cloud.google.com/iap';
const IAP_KEY_CACHE_MS = 5 * 60 * 1000;
const oauth2Client = new OAuth2Client();
type PublicKeys = Record<string, string>;
let publicKeyCache: { keys: PublicKeys; expiresAt: number } | undefined;
let publicKeyRequest: Promise<PublicKeys> | undefined;

async function getIapPublicKeys() {
  if (publicKeyCache && publicKeyCache.expiresAt > Date.now()) {
    return publicKeyCache.keys;
  }
  publicKeyRequest ??= oauth2Client.getIapPublicKeys().then(({ pubkeys }) => {
    publicKeyCache = {
      keys: pubkeys,
      expiresAt: Date.now() + IAP_KEY_CACHE_MS,
    };
    return pubkeys;
  });
  try {
    return await publicKeyRequest;
  } finally {
    publicKeyRequest = undefined;
  }
}

async function verifyIapToken(token: string, audience: string) {
  const pubkeys = await getIapPublicKeys();
  return oauth2Client.verifySignedJwtWithCertsAsync(
    token,
    pubkeys,
    audience,
    [IAP_ISSUER],
  ) as Promise<LoginTicket>;
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticationResult> {
  const assertion = request.headers.get('x-goog-iap-jwt-assertion');

  if (!assertion && process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      user: {
        id: 'local-development-user',
        email: 'local@farmlog.dev',
      },
    };
  }

  if (!assertion) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요합니다.',
    };
  }

  const audience = process.env.IAP_AUDIENCE?.trim();
  if (!audience) {
    console.error('IAP_AUDIENCE is not configured');
    return {
      ok: false,
      status: 500,
      error: '로그인 보안 설정을 확인할 수 없습니다.',
    };
  }

  let ticket: LoginTicket;
  try {
    ticket = await verifyIapToken(assertion, audience);
  } catch (error) {
    console.warn(
      'IAP JWT validation failed',
      error instanceof Error ? error.message : 'unknown error',
    );
    return {
      ok: false,
      status: 401,
      error: '로그인 정보를 확인할 수 없습니다.',
    };
  }

  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase() || '';
  const id = payload?.sub?.trim() || '';
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim()
    .replace(/^@/, '')
    .toLowerCase();

  if (!id || !email || !email.includes('@')) {
    return {
      ok: false,
      status: 401,
      error: '로그인 정보를 확인할 수 없습니다.',
    };
  }

  if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
    return {
      ok: false,
      status: 403,
      error: '허용된 회사 계정으로 로그인해 주세요.',
    };
  }

  return { ok: true, user: { id, email } };
}

export function authenticationResponse(result: AuthenticationResult) {
  if (result.ok) return null;
  return Response.json(
    { error: result.error },
    { status: result.status, headers: { 'Cache-Control': 'no-store' } },
  );
}
