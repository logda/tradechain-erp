import { cookies } from 'next/headers';
import {
  FORMAL_SESSION_COOKIE,
  resolveFormalActionSession,
} from './formal-session';
import type { DemoRole, DemoSession } from './demo-session';
import { loadAuthenticatedSession } from './formal-auth-session';

async function readLiveActionSession() {
  try {
    const cookieStore = await cookies();
    return await loadAuthenticatedSession(cookieStore.get(FORMAL_SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

function readHeaderList(value: string | undefined) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRole(value: string | undefined): DemoRole {
  if (
    value === 'admin' ||
    value === 'boss' ||
    value === 'sales_manager' ||
    value === 'sales' ||
    value === 'purchase_manager' ||
    value === 'purchase'
  ) {
    return value;
  }

  return 'boss';
}

export async function resolveFormalActionSessionFromHeaders(
  requestHeaders: Record<string, string> | undefined,
): Promise<DemoSession> {
  const session = await readLiveActionSession();
  if (session) return session;
  if (process.env.NODE_ENV !== 'test') throw new Error('请先登录');
  const role = normalizeRole(requestHeaders?.['x-erp-role']);
  const user = requestHeaders?.['x-erp-user']?.trim() || 'Mia';
  const modules = readHeaderList(requestHeaders?.['x-erp-modules']);
  const actions = readHeaderList(requestHeaders?.['x-erp-actions']);

  if (!modules.length && !actions.length) {
    return { role, user };
  }

  return {
    role,
    user,
    accessScopes: {
      modules,
      dataScope: 'all',
      ...(actions.length ? { actions } : {}),
    },
  };
}

export async function resolveFormalActionSessionFromForm(formData: FormData) {
  const session = await readLiveActionSession();
  if (session) return session;
  if (process.env.NODE_ENV !== 'test') throw new Error('请先登录');
  try {
    const cookieStore = await cookies();

    return resolveFormalActionSession({
      formRole: String(formData.get('role') ?? ''),
      formUser: String(formData.get('user') ?? ''),
      formAccess: String(formData.get('access') ?? '') || null,
      sessionCookie: cookieStore.get(FORMAL_SESSION_COOKIE)?.value,
    });
  } catch {
    return resolveFormalActionSession({
      formRole: String(formData.get('role') ?? ''),
      formUser: String(formData.get('user') ?? ''),
      formAccess: String(formData.get('access') ?? '') || null,
      sessionCookie: null,
    });
  }
}
