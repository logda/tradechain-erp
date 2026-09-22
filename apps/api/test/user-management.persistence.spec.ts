import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UserManagementService } from '../src/user-management/user-management.service';

describe('UserManagementService persistence and audit logs', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-runtime-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists created users across service instances', async () => {
    const firstService = new UserManagementService();
    await firstService.create({
      username: 'ivy',
      realName: 'Ivy',
      password: 'Ivy123456',
      roleCode: 'sales',
      createdBy: 'admin',
    });

    const secondService = new UserManagementService();
    const listed = await secondService.list();

    expect(listed.items.map((item) => item.username)).toContain('ivy');
  });

  it('records login and user lifecycle audit logs', async () => {
    const service = new UserManagementService();

    const created = await service.create({
      username: 'maya',
      realName: 'Maya',
      password: 'Maya123456',
      roleCode: 'purchase',
      createdBy: 'admin',
    });

    await service.authenticate({
      username: 'admin',
      password: 'Admin123456',
    });

    await service.deactivate(created.id, {
      operatedBy: 'admin',
      reason: '离职停用',
    });
    await service.activate(created.id, {
      operatedBy: 'admin',
      reason: '恢复账号',
    });

    const logs = await (service as unknown as {
      listAuditLogs: () => Promise<{ items: Array<{ operationType: string; bizType: string }> }>;
    }).listAuditLogs();

    expect(logs.items.map((item) => item.operationType)).toEqual(
      expect.arrayContaining(['create_user', 'login', 'deactivate_user', 'activate_user']),
    );
    expect(logs.items.map((item) => item.bizType)).toContain('user');
  });
});
