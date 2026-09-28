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
      return { ok: true, json: async () => ({ items: [
        { id: '1', domain: 'sales', ownerName: 'Zoe', lifecycleStatus: 'open' },
        { id: '2', domain: 'sales', ownerName: 'Mia', lifecycleStatus: 'open' },
      ], closedTotal: 1, total: 2 }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = new NextRequest('http://localhost:3000/api/formal-todos/count', {
      headers: { cookie: 'erp_formal_session=token' },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=sales&user=Zoe',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
