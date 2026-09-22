import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFormalSessionCookie } from '../app/app/_lib/formal-session';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

const { cookieGetMock } = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
  })),
}));

import RootPage from '../app/page';

describe('root page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookieGetMock.mockReset();
    cookieGetMock.mockReturnValue(undefined);
  });

  it('redirects to the formal login page when there is no session cookie', async () => {
    await expect(RootPage()).rejects.toThrowError('NEXT_REDIRECT:/app/login');
    expect(redirectMock).toHaveBeenCalledWith('/app/login');
  });

  it('redirects to the formal workspace when a session cookie exists', async () => {
    cookieGetMock.mockReturnValue({
      value: encodeFormalSessionCookie({
        role: 'boss',
        user: 'Mia',
        username: 'mia',
      }),
    });

    await expect(RootPage()).rejects.toThrowError('NEXT_REDIRECT:/app?role=boss&user=Mia');
    expect(redirectMock).toHaveBeenCalledWith('/app?role=boss&user=Mia');
  });
});
