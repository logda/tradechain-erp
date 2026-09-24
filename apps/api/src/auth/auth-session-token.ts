import { createHmac, timingSafeEqual } from 'node:crypto';

const DEV_ONLY_SESSION_SECRET = 'dev-only-insecure-formal-session-secret';
const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

function getSecret() {
  const configured = process.env.ERP_FORMAL_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 ERP_FORMAL_SESSION_SECRET');
  }
  return DEV_ONLY_SESSION_SECRET;
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function issueAuthSessionToken(username: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, exp: now + SESSION_TTL_MS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readAuthSessionToken(token: string, now = Date.now()): string | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };
    return typeof parsed.sub === 'string' && parsed.sub.trim() &&
      typeof parsed.exp === 'number' && parsed.exp > now
      ? parsed.sub
      : null;
  } catch {
    return null;
  }
}
