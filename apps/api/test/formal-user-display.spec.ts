import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastValueFrom, of } from 'rxjs';
import type { ExecutionContext } from '@nestjs/common';
import { FormalUserDisplayInterceptor } from '../src/common/formal-user-display.interceptor';
import { UserManagementService } from '../src/user-management/user-management.service';
import { resolveUserManagementStore } from '../src/user-management/user-management.store';
import type { PrismaService } from '../src/storage/prisma.service';

describe('formal user display', () => {
  let dataDir: string;
  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-user-display-'));
    process.env.ERP_DATA_DIR = dataDir;
    delete process.env.ERP_STORAGE_MODE;
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dataDir, { recursive: true, force: true });
  });
  async function display(value: unknown, service = new UserManagementService(), method = 'GET') {
    const interceptor = new FormalUserDisplayInterceptor(service);
    return lastValueFrom(interceptor.intercept({
      switchToHttp: () => ({ getRequest: () => ({ method, headers: { 'x-erp-role': 'admin' } }) }),
    } as unknown as ExecutionContext, { handle: () => of(value) })) as Promise<any>;
  }

  it('shows current usernames and guarded historical aliases without rewriting ownership', async () => {
    const rows = [{ id: 105, salesUserId: 2000, salesUserName: '用户 #2000', createdBy: 3 },
      { id: 106, ownerId: 4, ownerName: 'Leo', createdById: 9000, createdBy: 'Admin' }];
    const result = await display({ items: rows, total: 2 });
    expect(result.items[0].userDisplayNames).toMatchObject({ salesUserName: 'mia', createdBy: 'zoe' });
    expect(result.items[1].userDisplayNames).toMatchObject({ ownerName: 'leo', createdBy: 'admin' });
    expect(result.total).toBe(2);
    expect(rows[0]).toEqual({ id: 105, salesUserId: 2000, salesUserName: '用户 #2000', createdBy: 3 });
    expect(result.items[0].salesUserId).toBe(2000);
    expect(result.items[1].ownerName).toBe('Leo');
  });

  it('uses the real holder of a historical number before its alias', async () => {
    const store = resolveUserManagementStore();
    store.saveUsers([...store.listUsers(), { ...store.listUsers()[1], id: 2000, username: 'new-mia', realName: 'Mia' }]);
    const result = await display({ salesUserId: 2000, salesUserName: 'Mia' });
    expect(result.userDisplayNames.salesUserName).toBe('new-mia');
  });

  it('does not assign unrelated or ambiguous employees to a demo account', async () => {
    const store = resolveUserManagementStore();
    store.saveUsers(store.listUsers().map(user => user.id === 2 ? { ...user, username: 'another-account' } : user));
    expect((await display({ salesUserId: 2000 })).userDisplayNames.salesUserName).toBe('历史账号未关联');
    expect((await display({ ownerId: 7777, ownerName: 'Mia' })).userDisplayNames.ownerName).toBe('历史账号未关联');
    store.saveUsers([...store.listUsers(), { ...store.listUsers()[2], id: 5, username: 'other-sales', realName: 'Zoe' }]);
    expect((await display({ ownerName: 'Zoe' })).userDisplayNames.ownerName).toBe('历史账号未关联');
  });

  it('keeps usernames consistent after a name change or deactivation', async () => {
    const store = resolveUserManagementStore();
    store.saveUsers(store.listUsers().map(user => user.id === 3 ? { ...user, realName: '销售新姓名', status: 'inactive' } : user));
    expect((await display({ ownerId: 3, ownerName: 'Zoe' })).userDisplayNames.ownerName).toBe('zoe');
    expect((await display({ salesUserId: 2001 })).userDisplayNames.salesUserName).toBe('zoe');
  });

  it('reads Prisma account identities without touching runtime account names', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const findMany = jest.fn().mockResolvedValue([
      { id: 2n, username: 'mia', realName: '数据库姓名' }, { id: 7777n, username: 'db-sales', realName: 'DB Sales' },
    ]);
    const service = new UserManagementService({ user: { findMany } } as unknown as PrismaService);
    const result = await display({ items: [{ salesUserId: 2000 }, { ownerId: 7777 }, { ownerId: 3 }] }, service);
    expect(result.items.map((item: any) => item.userDisplayNames)).toEqual([
      expect.objectContaining({ salesUserName: 'mia' }), expect.objectContaining({ ownerName: 'db-sales' }),
      expect.objectContaining({ ownerName: '历史账号未关联' }),
    ]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('separates a user handler from a handling role and keeps task counts', async () => {
    const result = await display({ total: 2, actionTotal: 1, followingTotal: 1, items: [
      { ownerId: 4, ownerName: 'Leo', handlerLabel: 'Leo', relation: 'action', description: 'Leo 补充采购信息' },
      { ownerId: 3, ownerName: 'Zoe', handlerLabel: '销售主管', relation: 'following' },
    ] });
    expect(result.items[0].userDisplayNames).toMatchObject({ ownerName: 'leo', handlerLabel: 'leo', description: 'leo 补充采购信息' });
    expect(result.items[1].userDisplayNames.handlerLabel).toBeUndefined();
    expect(result).toMatchObject({ total: 2, actionTotal: 1, followingTotal: 1 });
  });

  it('adds operator and changed-user labels without changing audit snapshots', async () => {
    const beforeData = { salesUserId: 2001, ownerName: 'Zoe' };
    const afterData = { salesUserId: 4, ownerName: 'Leo' };
    const result = await display({ operatorId: 9000, beforeData, afterData });
    expect(result.userDisplayNames.operatorName).toBe('admin');
    expect(result.userDisplayNamesById).toMatchObject({ 2001: 'zoe', 4: 'leo' });
    expect(result.userDisplayNamesByName).toEqual({ Zoe: 'zoe', Leo: 'leo' });
    expect(result.beforeData).toEqual(beforeData);
    expect(result.afterData).toEqual(afterData);
    expect(beforeData).not.toHaveProperty('userDisplayNames');
    expect((await display({ operatorId: 0 })).userDisplayNames.operatorName).toBe('系统');
  });

  it('uses the handler ID for renamed or same-name employees without mistaking role labels for users', async () => {
    const store = resolveUserManagementStore();
    store.saveUsers([...store.listUsers().map(user => user.id === 3 ? { ...user, realName: '采购主管' } : user),
      { ...store.listUsers()[2], id: 5, username: 'other-sales', realName: '采购主管' }]);
    const result = await display({ items: [
      { ownerId: 3, ownerName: 'Zoe', handlerUserId: 3, handlerLabel: '采购主管' },
      { ownerId: 3, ownerName: 'Zoe', handlerLabel: '采购主管' },
    ] });
    expect(result.items[0].userDisplayNames.handlerLabel).toBe('zoe');
    expect(result.items[1].userDisplayNames.handlerLabel).toBeUndefined();
  });

  it('does not decorate mutation inputs/results or responses without user references', async () => {
    const service = new UserManagementService();
    const load = jest.spyOn(service, 'listOperatorDirectory');
    const value = { ownerId: 3, ownerName: 'Zoe' };
    expect(await display(value, service, 'POST')).toBe(value);
    expect(await display({ total: 0 }, service)).toEqual({ total: 0 });
    expect(load).not.toHaveBeenCalled();
  });

  it('propagates a directory failure instead of misreporting an unlinked user', async () => {
    const service = new UserManagementService();
    jest.spyOn(service, 'listOperatorDirectory').mockRejectedValue(new Error('directory unavailable'));
    await expect(display({ ownerId: 3 }, service)).rejects.toThrow('directory unavailable');
  });
});
