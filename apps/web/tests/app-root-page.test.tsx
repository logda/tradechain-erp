import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.unstubAllGlobals();
  });

  it('redirects to the formal login page when there is no session cookie', async () => {
    await expect(RootPage()).rejects.toThrowError('NEXT_REDIRECT:/app/login');
    expect(redirectMock).toHaveBeenCalledWith('/app/login');
  });

  it('redirects to the formal workspace when a session cookie exists', async () => {
    cookieGetMock.mockReturnValue({ value: 'signed-ticket' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      role: 'boss', user: 'Mia', username: 'mia',
      accessScopes: { modules: ['sales'], dataScope: 'all', actions: [] },
    }) }));

    await expect(RootPage()).rejects.toThrowError('NEXT_REDIRECT:/app');
    expect(redirectMock).toHaveBeenCalledWith('/app');
  });
});
