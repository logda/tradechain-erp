import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyProductRequest } from '../app/api/products/_proxy';

describe('产品接口代理会话', () => {
  it('拒绝无登录 Cookie 的浏览器请求', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyProductRequest(new NextRequest('http://localhost:3000/api/products'));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('仅把当前后端会话签成管理员请求', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        role: 'admin', user: 'Admin', username: 'admin',
        accessScopes: { modules: ['admin'], dataScope: 'all', actions: ['audit.view'] },
      }) })
      .mockResolvedValueOnce({ status: 200, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() });
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyProductRequest(new NextRequest('http://localhost:3000/api/products', {
      headers: { cookie: 'erp_formal_session=valid-ticket', 'x-erp-role': 'sales' },
    }));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][1].headers.get('x-erp-role')).toBe('admin');
    expect(fetchMock.mock.calls[1][1].headers.get('x-erp-session-signature')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('forwards the authenticated sales role for read-only product requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        role: 'sales', user: 'Zoe', username: 'zoe',
        accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
      }) })
      .mockResolvedValueOnce({ status: 200, arrayBuffer: async () => new ArrayBuffer(0), headers: new Headers() });
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyProductRequest(new NextRequest('http://localhost:3000/api/products', {
      headers: { cookie: 'erp_formal_session=valid-ticket', 'x-erp-role': 'admin' },
    }));
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][1].headers.get('x-erp-role')).toBe('sales');
    vi.unstubAllGlobals();
  });
});
