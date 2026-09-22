'use server';

import { cookies } from 'next/headers';
import { buildFormalRequestHeaders } from '../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../_lib/formal-request-signature';
import {
  buildMutationPayload,
  type MutationField,
} from '../_lib/mutation-action';
import {
  FORMAL_SESSION_COOKIE,
  resolveFormalActionSession,
} from '../_lib/formal-session';
import { resolveFormalActionSessionFromHeaders } from '../_lib/formal-action-session';
import type { DemoSession } from '../_lib/demo-session';

type MutationActionResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

type FormalMutationMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const FORMAL_MUTATION_NETWORK_ERROR = '网络请求失败，请确认服务已启动';

function resolveMutationEndpoint(endpoint: string) {
  if (!endpoint.startsWith('/')) {
    return endpoint;
  }

  const appBaseUrl =
    process.env.ERP_WEB_BASE_URL ??
    process.env.NEXT_PUBLIC_ERP_WEB_BASE_URL ??
    'http://127.0.0.1:3002';

  return new URL(endpoint, appBaseUrl).toString();
}

async function readApiError(response: { json: () => Promise<unknown> }) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return '操作失败';
}

function getActionSession(formData: FormData) {
  return resolveFormalActionSession({
    formRole: String(formData.get('role') ?? ''),
    formUser: String(formData.get('user') ?? ''),
    formAccess: String(formData.get('access') ?? '') || null,
  });
}

async function resolveSignedActionSession({
  formData,
  requestHeaders,
}: {
  formData?: FormData;
  requestHeaders?: Record<string, string>;
}): Promise<DemoSession> {
  if (requestHeaders) {
    return await resolveFormalActionSessionFromHeaders(requestHeaders);
  }

  let sessionCookie: string | null = null;

  try {
    const cookieStore = await cookies();
    sessionCookie = cookieStore.get(FORMAL_SESSION_COOKIE)?.value ?? null;
  } catch {
    sessionCookie = null;
  }

  if (sessionCookie) {
    return resolveFormalActionSession({
      formRole: String(formData?.get('role') ?? requestHeaders?.['x-erp-role'] ?? ''),
      formUser: String(formData?.get('user') ?? requestHeaders?.['x-erp-user'] ?? ''),
      formAccess: String(formData?.get('access') ?? '') || null,
      sessionCookie,
    });
  }

  return formData ? getActionSession(formData) : resolveFormalActionSession({
    formRole: '',
    formUser: '',
    formAccess: null,
  });
}

function buildFormalApiMutationHeaders(session: DemoSession) {
  return {
    ...buildFormalRequestHeaders(session),
    ...buildSignedFormalRequestHeaders(session),
  };
}

export async function submitFormalJsonMutationAction(
  endpoint: string,
  method: FormalMutationMethod,
  payload: unknown,
  requestHeaders?: Record<string, string>,
): Promise<MutationActionResult> {
  const actionSession = await resolveSignedActionSession({ requestHeaders });
  let response: Response;

  try {
    response = await fetch(resolveMutationEndpoint(endpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalApiMutationHeaders(actionSession),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: FORMAL_MUTATION_NETWORK_ERROR };
  }

  if (!response.ok) {
    return { ok: false, error: await readApiError(response) };
  }

  return {
    ok: true,
    result: await response.json().catch(() => null),
  };
}

export async function submitFormalMutationAction(
  endpoint: string,
  fields: MutationField[],
  formData: FormData,
  requestHeaders?: Record<string, string>,
): Promise<MutationActionResult> {
  const payload = buildMutationPayload(formData, fields);
  const actionSession = await resolveSignedActionSession({
    formData,
    requestHeaders,
  });
  let response: Response;

  try {
    response = await fetch(resolveMutationEndpoint(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFormalApiMutationHeaders(actionSession),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: FORMAL_MUTATION_NETWORK_ERROR };
  }

  if (!response.ok) {
    return { ok: false, error: await readApiError(response) };
  }

  return {
    ok: true,
    result: await response.json().catch(() => null),
  };
}
