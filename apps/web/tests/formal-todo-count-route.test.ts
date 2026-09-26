import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../app/api/formal-todos/count/route';

describe('formal todo count route', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires an authenticated session', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/formal-todos/count'));
    expect(response.status).toBe(401);
  });

  it('counts visible open todos from the live API', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/session')) return { ok: true, json: async () => ({
        role: 'sales', user: 'Zoe', username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
      }) };
      return { ok: true, json: async () => ({ items: [
        { id: '1', domain: 'sales', ownerName: 'Zoe', lifecycleStatus: 'open' },
        { id: '2', domain: 'sales', ownerName: 'Mia', lifecycleStatus: 'open' },
        { id: '3', domain: 'sales', ownerName: 'Zoe', lifecycleStatus: 'auto_closed' },
      ], closedTotal: 1, total: 3 }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const request = new NextRequest('http://localhost:3000/api/formal-todos/count', {
      headers: { cookie: 'erp_formal_session=token' },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=sales&user=Zoe',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
