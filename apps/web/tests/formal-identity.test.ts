import { describe, expect, it, vi, afterEach } from 'vitest';
import { canViewFormalQuoteDetail, resolveFormalUserId } from '../app/app/_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../app/app/_lib/formal-api-request-headers';
import { buildSignedFormalRequestHeaders } from '../app/app/_lib/formal-request-signature';
import { resolveDemoSession } from '../app/app/_lib/demo-session';
import { loadSalesUserOptions, resolveDefaultSalesUserId } from '../app/app/_lib/sales-user-options';

describe('stable formal identity', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('allows a Chinese display name in HTTP headers without losing signed identity', () => {
    const headers = buildFormalApiRequestHeaders({ role: 'sales', user: '张三', userId: 57, username: 'zhangsan', accessScopes: { modules: ['sales'], actions: [], dataScope: 'own_sales' } });
    expect(() => new Headers(headers)).not.toThrow();
    expect(decodeURIComponent(headers['x-erp-user'])).toBe('张三');
    expect(JSON.parse(Buffer.from(headers['x-erp-session'], 'base64url').toString())).toMatchObject({ user: '张三', userId: 57 });
  });
  it('uses the real employee ID after a rename', () => {
    const session = { role: 'sales' as const, user: 'Renamed employee', userId: 57 };
    expect(canViewFormalQuoteDetail(session, { salesUserId: 57 })).toBe(true);
    expect(canViewFormalQuoteDetail(session, { salesUserId: 2000 })).toBe(false);
  });
  it('rejects an unknown display name instead of silently assigning Mia', () => {
    expect(() => resolveFormalUserId('New employee')).toThrow();
  });
  it('propagates real identity and data scope in the signed request', () => {
    const headers = buildSignedFormalRequestHeaders({ role: 'sales', user: 'Amy', userId: 57, username: 'amy', accessScopes: { modules: ['sales'], actions: [], dataScope: 'own_sales' } } as any);
    expect(JSON.parse(Buffer.from(headers['x-erp-session'], 'base64url').toString())).toMatchObject({ userId: 57, dataScope: 'own_sales' });
    expect(resolveDemoSession({ role: 'sales', user: 'Amy', userId: '57' })).toMatchObject({ userId: 57 });
  });
  it('selects the authenticated employee by ID even when metadata contains an old name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ salesUsers: [{ id: 57, username: 'amy', realName: 'Old name', roleCode: 'sales', status: 'active' }, { id: 58, username: 'other', realName: 'Renamed employee', roleCode: 'sales', status: 'active' }] }) })));
    const session = { role: 'sales' as const, user: 'Renamed employee', userId: 57 };
    const options = await loadSalesUserOptions(session);
    expect(options.map(option => option.id)).toEqual([57]);
    expect(resolveDefaultSalesUserId(session, options)).toBe(57);
  });
  it('retains the existing disabled or historical owner only for editing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ salesUsers: [{ id: 5, username: 'active', realName: 'Current employee', roleCode: 'sales', status: 'active' }, { id: 6, username: 'former', realName: 'Former employee', roleCode: 'sales', status: 'inactive' }] }) })));
    const session = { role: 'admin' as const, user: 'Admin', userId: 1 };
    expect((await loadSalesUserOptions(session)).map(item => item.id)).toEqual([5]);
    expect((await loadSalesUserOptions(session, { id: 6, name: 'Former employee' })).map(item => item.id)).toEqual([5, 6]);
    expect((await loadSalesUserOptions(session, { id: 2001, name: 'Historic employee' })).map(item => item.id)).toEqual([5, 2001]);
  });

  it('does not invent an assignable owner when metadata fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await loadSalesUserOptions({ role: 'sales', user: 'New employee', userId: 57 } as any)).toEqual([]);
  });
});
