import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { canViewFormalAuditCenter } from '../app/app/_lib/demo-session';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditLogTable } from '../app/app/_components/audit-log-table';

const profile = {
  role: 'sales',
  user: 'Zoe',
  username: 'zoe',
  accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
};

describe('正式工作台会话入口', () => {
  it('复制有身份参数的链接到无 Cookie 浏览器仍进入登录页', async () => {
    const request = new NextRequest(
      'http://127.0.0.1:3000/app/sales/quotes?role=admin&user=Admin&access=all',
    );
    const response = await middleware(request);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/app/login');
  });

  it('已登录用户篡改 URL 角色后仍由后端当前会话决定身份', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => profile });
    vi.stubGlobal('fetch', fetchMock);
    const request = new NextRequest(
      'http://127.0.0.1:3000/app/sales/quotes?role=admin&user=Admin&keyword=XQ',
      { headers: { cookie: 'erp_formal_session=signed-ticket' } },
    );
    const response = await middleware(request);
    const destination = new URL(response.headers.get('location')!);
    expect(`${destination.pathname}${destination.search}`).toBe('/app/sales/quotes?keyword=XQ');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/session'),
      expect.objectContaining({ headers: { authorization: 'Bearer signed-ticket' } }),
    );
    vi.unstubAllGlobals();
  });

  it('内部重写带入的当前身份继续渲染，不会再次重定向', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => profile }));
    const access = encodeURIComponent(JSON.stringify(profile.accessScopes));
    const request = new NextRequest(
      `http://127.0.0.1:3000/app/sales/quotes?role=sales&user=Zoe&username=zoe&access=${encodeURIComponent(access)}`,
      { headers: { cookie: 'erp_formal_session=signed-ticket' } },
    );
    const response = await middleware(request);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('框架解码内部权限参数后仍识别为当前会话', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => profile }));
    const params = new URLSearchParams({
      role: profile.role, user: profile.user, username: profile.username,
      access: JSON.stringify(profile.accessScopes),
    });
    const request = new NextRequest(`http://127.0.0.1:3000/app?${params}`, {
      headers: { cookie: 'erp_formal_session=signed-ticket' },
    });
    const response = await middleware(request);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    vi.unstubAllGlobals();
  });

  it('工作台内部重写沿用请求协议，避免本地 Host 头使 HTTP 被改成 HTTPS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => profile }));
    const request = new NextRequest('http://127.0.0.1:3000/app/sales/quotes', {
      headers: { cookie: 'erp_formal_session=signed-ticket', host: 'localhost:3000' },
    });
    const response = await middleware(request);
    expect(new URL(response.headers.get('x-middleware-rewrite')!).protocol).toBe('http:');
    vi.unstubAllGlobals();
  });
});

describe('审计查看授权', () => {
  it('只有管理员默认可看，其他角色需单独获得 audit.view', () => {
    expect(canViewFormalAuditCenter({ role: 'admin', user: 'Admin' })).toBe(true);
    expect(canViewFormalAuditCenter({ role: 'boss', user: 'Mia' })).toBe(false);
    expect(canViewFormalAuditCenter({ role: 'sales', user: 'Zoe', accessScopes: {
      modules: ['sales', 'audit'], dataScope: 'own_sales', actions: [],
    } })).toBe(false);
    expect(canViewFormalAuditCenter({ role: 'sales', user: 'Zoe', accessScopes: {
      modules: ['sales'], dataScope: 'own_sales', actions: ['audit.view'],
    } })).toBe(true);
  });

  it('单据审计组件对无授权用户不渲染日志区', () => {
    expect(renderToStaticMarkup(createElement(AuditLogTable, {
      items: [{ id: 1, bizType: 'quote', bizId: 1, operationType: 'approve',
        operatorId: 1, createdAt: '2026-09-24T00:00:00.000Z', beforeData: null, afterData: null }],
      session: { role: 'sales', user: 'Zoe' },
    }))).toBe('');
  });
});
