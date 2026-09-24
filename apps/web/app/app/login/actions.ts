'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  FORMAL_SESSION_COOKIE,
} from '../_lib/formal-session';

export type LoginFormState = {
  error: string | null;
  redirectTo: string | null;
};

const initialError = '登录失败';

function getAuthApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

async function readApiError(response: {
  json: () => Promise<unknown>;
}) {
  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return initialError;
}

function hasValidLoginResult(
  value: unknown,
): value is {
  role: string;
  user: string;
  username: string;
  token: string;
  accessScopes?: { modules: string[]; dataScope: string; actions?: string[] };
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { role?: unknown }).role === 'string' &&
    typeof (value as { user?: unknown }).user === 'string' &&
    typeof (value as { username?: unknown }).username === 'string' &&
    typeof (value as { token?: unknown }).token === 'string' &&
    (
      (value as { accessScopes?: unknown }).accessScopes === undefined ||
      (
        typeof (value as { accessScopes?: { modules?: unknown; dataScope?: unknown } })
          .accessScopes === 'object' &&
        (value as { accessScopes?: { modules?: unknown; dataScope?: unknown } })
          .accessScopes !== null &&
        Array.isArray(
          (value as { accessScopes: { modules: unknown[] } }).accessScopes.modules,
        ) &&
        typeof (value as { accessScopes: { dataScope: unknown } }).accessScopes
          .dataScope === 'string' &&
        (
          (value as { accessScopes: { actions?: unknown } }).accessScopes.actions === undefined ||
          Array.isArray(
            (value as { accessScopes: { actions?: unknown } }).accessScopes.actions,
          )
        )
      )
    )
  );
}

export async function buildLoginPayload(formData: FormData) {
  return {
    username: String(formData.get('username') ?? '').trim(),
    password: String(formData.get('password') ?? '').trim(),
  };
}

export async function loginAction(
  stateOrFormData: LoginFormState | FormData,
  maybeFormData?: FormData,
): Promise<LoginFormState> {
  const formData =
    maybeFormData instanceof FormData
      ? maybeFormData
      : stateOrFormData instanceof FormData
        ? stateOrFormData
        : null;

  if (formData === null) {
    return {
      error: initialError,
      redirectTo: null,
    };
  }

  try {
    const payload = await buildLoginPayload(formData);
    const response = await fetch(`${getAuthApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        error: await readApiError(response),
        redirectTo: null,
      };
    }

    const result = (await response.json()) as unknown;
    if (!hasValidLoginResult(result)) {
      return {
        error: initialError,
        redirectTo: null,
      };
    }

    const cookieStore = await cookies();
    cookieStore.set(
      FORMAL_SESSION_COOKIE,
      result.token,
      {
        httpOnly: true,
        maxAge: 60 * 60 * 8,
        path: '/',
        sameSite: 'lax',
      },
    );

    return {
      error: null,
      redirectTo: '/app',
    };
  } catch (error) {
    void error;
    return {
      error: initialError,
      redirectTo: null,
    };
  }
}

export async function loginAndRedirectAction(formData: FormData) {
  const result = await loginAction(formData);

  if (result.redirectTo) {
    redirect(result.redirectTo);
  }

  const searchParams = new URLSearchParams({
    error: result.error ?? initialError,
  });
  const payload = await buildLoginPayload(formData);
  if (payload.username) {
    searchParams.set('username', payload.username);
  }

  redirect(`/app/login?${searchParams.toString()}`);
}
