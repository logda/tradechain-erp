import { createHmac } from 'node:crypto';
import {
  resolveFormalAccessGrants,
  type FormalRequestSession,
} from './formal-request-headers';

const DEV_ONLY_SESSION_SECRET = 'dev-only-insecure-formal-session-secret';

function getFormalSessionSecret() {
  const configured = process.env.ERP_FORMAL_SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '生产环境必须配置 ERP_FORMAL_SESSION_SECRET，且 api 与 web 两侧取值必须一致',
    );
  }

  return DEV_ONLY_SESSION_SECRET;
}

export function buildSignedFormalRequestHeaders(session: FormalRequestSession) {
  const { modules, actions } = resolveFormalAccessGrants(session);
  const payload = Buffer.from(
    JSON.stringify({
      role: session.role,
      user: session.user,
      username: session.username,
      modules,
      actions,
      exp: Math.floor(Date.now() / 1000) + 300,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', getFormalSessionSecret())
    .update(payload)
    .digest('base64url');

  return {
    'x-erp-session': payload,
    'x-erp-session-signature': signature,
  };
}
