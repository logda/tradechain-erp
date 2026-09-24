import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UserManagementService } from '../src/user-management/user-management.service';
import { AuthController } from '../src/auth/auth.controller';

describe('当前登录会话', () => {
  const previousDataDir = process.env.ERP_DATA_DIR;
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-auth-session-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = previousDataDir;
    delete process.env.ERP_STORAGE_MODE;
  });

  it('刷新时读取新授权，停用账号后不再返回身份', async () => {
    const service = new UserManagementService();
    expect((await service.getCurrentSession('admin'))?.accessScopes.actions).toContain('audit.view');
    expect((await service.getCurrentSession('zoe'))?.accessScopes.actions).not.toContain('audit.view');

    const salesRole = (await service.listRolePermissions()).items.find(
      (item: { roleCode: string }) => item.roleCode === 'sales',
    )!;
    await service.updateRolePermission('sales', {
      ...salesRole.accessScopes,
      actions: [...salesRole.accessScopes.actions, 'audit.view'],
      updatedBy: 'admin',
    });
    expect((await service.getCurrentSession('zoe'))?.accessScopes.actions).toContain('audit.view');

    const zoe = (await service.list()).items.find((item: { username: string }) => item.username === 'zoe')!;
    await service.deactivate(zoe.id, { operatedBy: 'admin', reason: '停用' });
    expect(await service.getCurrentSession('zoe')).toBeNull();
  });

  it('登录签发会话，校验接口拒绝无效票据', async () => {
    const auth = new AuthController(new UserManagementService());
    const login = await auth.login({ username: 'zoe', password: 'Zoe123456' });
    expect(login).toMatchObject({ role: 'sales', user: 'Zoe', username: 'zoe' });
    expect((await auth.session(`Bearer ${login.token}`)).username).toBe('zoe');
    await expect(auth.session('Bearer invalid')).rejects.toThrow();
  });
});
