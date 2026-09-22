// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import { buildLoginPayload, loginAction } from '../app/app/login/actions';
import { shouldTreatAsRedirectError } from '../app/app/login/redirect-error';
import AppLoginPage from '../app/app/login/page';
import { encodeFormalSessionCookie } from '../app/app/_lib/formal-session';

const { redirectMock, routerPushMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest: string }).digest = [
      REDIRECT_ERROR_CODE,
      RedirectType.push,
      href,
      '303',
      '',
    ].join(';');
    throw error;
  }),
  routerPushMock: vi.fn(),
}));

const { cookieGetMock, cookieSetMock, cookieDeleteMock } = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
    set: cookieSetMock,
    delete: cookieDeleteMock,
  })),
}));

describe('app login page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    routerPushMock.mockClear();
    cookieGetMock.mockReset();
    cookieSetMock.mockClear();
    cookieDeleteMock.mockClear();
    vi.unstubAllGlobals();
    cookieGetMock.mockReturnValue(undefined);
  });

  it('renders the login page with username and password inputs', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(<>{await AppLoginPage({})}</>);

    expect(screen.getByRole('heading', { name: 'ERP 登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('用户名 Username')).toBeInTheDocument();
    expect(screen.getByLabelText('密码 Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录系统' })).toBeInTheDocument();
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call[0] ===
          'Warning: Invalid value for prop `%s` on <%s> tag. Either remove it from the element, or pass a string or number value to keep it in the DOM. For details, see https://reactjs.org/link/attribute-behavior %s' &&
        call[1] === 'action' &&
        call[2] === 'form',
      ),
    ).toBe(false);
  });

  it('renders the login error from query params', async () => {
    render(
      <>
        {await AppLoginPage({
          searchParams: Promise.resolve({ error: '账号或密码错误' }),
        })}
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('账号或密码错误');
  });

  it('renders the login error when search params are provided as a promise', async () => {
    render(
      <>
        {await AppLoginPage({
          searchParams: Promise.resolve({ error: '账号或密码错误' }),
        })}
      </>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('账号或密码错误');
  });

  it('redirects to the formal workspace when a valid session cookie exists', async () => {
    cookieGetMock.mockReturnValue({
      value: encodeFormalSessionCookie({
        role: 'sales',
        user: 'Zoe',
        username: 'zoe',
      }),
    });

    await expect(AppLoginPage({})).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/app?role=sales&user=Zoe');
  });

  it('normalizes the login payload', async () => {
    const formData = new FormData();
    formData.set('username', 'admin');
    formData.set('password', 'Admin123456');

    await expect(buildLoginPayload(formData)).resolves.toEqual({
      username: 'admin',
      password: 'Admin123456',
    });
  });

  it('stores the formal session and redirects to the formal workspace', async () => {
    const formData = new FormData();
    formData.set('username', 'admin');
    formData.set('password', 'Admin123456');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          role: 'admin',
          user: 'Admin',
          username: 'admin',
        }),
      }),
    );

    await expect(
      loginAction({ error: null, redirectTo: null }, formData),
    ).resolves.toMatchObject({
      error: null,
      redirectTo: expect.stringContaining('/app?role=admin&user=Admin'),
    });
    expect(cookieSetMock).toHaveBeenCalledWith(
      'erp_formal_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }),
    );
  });

  it('redirects back to the login page with an error when auth fails', async () => {
    const formData = new FormData();
    formData.set('username', 'admin');
    formData.set('password', 'wrong-password');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: '账号或密码错误' }),
      }),
    );

    await expect(
      loginAction({ error: null, redirectTo: null }, formData),
    ).resolves.toEqual({
      error: '账号或密码错误',
      redirectTo: null,
    });
  });

  it('treats raw next redirect digests as redirect errors', () => {
    expect(
      shouldTreatAsRedirectError({
        digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app;303;`,
      }),
    ).toBe(true);
  });
});
