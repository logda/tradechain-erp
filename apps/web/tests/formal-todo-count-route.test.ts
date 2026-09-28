import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/formal-todos/count/route';

describe('formal todo count route', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires an authenticated session', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/formal-todos/count'));
    expect(response.status).toBe(401);
  });

  it('trusts the API scoped open-todo count from the live API', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/session')) return { ok: true, json: async () => ({
        role: 'sales', user: 'Zoe', userId: 1, username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
      }) };
      return { ok: true, json: async () => ({ count: 2 }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = new NextRequest('http://localhost:3000/api/formal-todos/count', {
      headers: { cookie: 'erp_formal_session=token' },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal/count',
      expect.objectContaining({ cache: 'no-store', headers: expect.objectContaining({ 'x-erp-user-id': '1' }) }),
    );
  });

  it.each([null, {}, { count: -1 }, { count: 1.5 }, { count: '0' }])('does not turn an invalid count into zero: %j', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({
      ok: true, json: async () => url.endsWith('/auth/session') ? {
        role: 'sales', user: 'Zoe', userId: 1, username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
      } : result,
    })));
    const response = await GET(new NextRequest('http://localhost:3000/api/formal-todos/count', {
      headers: { cookie: 'erp_formal_session=token' },
    }));
    expect(response.status).toBe(503);
  });

  it('returns a genuine zero and preserves failures as unavailable', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.endsWith('/auth/session') ? {
      ok: true, json: async () => ({ role: 'sales', user: 'Zoe', userId: 1, username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] } }),
    } : { ok: true, json: async () => ({ count: 0 }) });
    vi.stubGlobal('fetch', fetchMock);
    const request = new NextRequest('http://localhost:3000/api/formal-todos/count', {
      headers: { cookie: 'erp_formal_session=token' },
    });
    expect(await (await GET(request)).json()).toEqual({ count: 0 });
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.endsWith('/auth/session')) throw new Error('读取失败');
      return { ok: true, json: async () => ({ role: 'sales', user: 'Zoe', userId: 1, username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] } }) };
    });
    expect((await GET(request)).status).toBe(503);
  });
});
