import { UserManagementService } from '../src/user-management/user-management.service';
import { hashPassword } from '../src/user-management/user-management.store';
import type { PrismaService } from '../src/storage/prisma.service';

describe('UserManagementService prisma storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('authenticates users from Prisma and writes login audit logs', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          username: 'admin',
          realName: '系统管理员',
          passwordHash: hashPassword('Admin123456'),
          roleCode: 'admin',
          status: 'active',
          fullAccess: true,
          createdAt: new Date('2026-07-11T09:00:00.000Z'),
          updatedAt: new Date('2026-07-11T09:00:00.000Z'),
          createdBy: 'system',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    } as unknown as PrismaService;

    const service = new UserManagementService(prisma);
    const result = await service.authenticate({
      username: 'admin',
      password: 'Admin123456',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'admin' },
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'user',
        bizId: 1n,
        operationType: 'login',
        operatorId: 1n,
      }),
    });
    expect(result).toMatchObject({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
    });
  });

  it('deactivates and reactivates users through Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-11T09:00:00.000Z');
    const inactiveRecord = {
      id: 5n,
      username: 'ben',
      realName: 'Ben',
      passwordHash: hashPassword('Ben123456'),
      roleCode: 'purchase',
      status: 'inactive',
      fullAccess: false,
      createdAt,
      createdBy: 'admin',
      deactivatedAt: createdAt,
      deactivatedBy: 'admin',
      deactivatedReason: '离职停用',
    };
    const activeRecord = {
      ...inactiveRecord,
      status: 'active',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    };
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(inactiveRecord)
          .mockResolvedValueOnce({
            id: 1n,
            username: 'admin',
            realName: '系统管理员',
            passwordHash: hashPassword('Admin123456'),
            roleCode: 'admin',
            status: 'active',
            fullAccess: true,
            createdAt,
            updatedAt: createdAt,
            createdBy: 'system',
            deactivatedAt: null,
            deactivatedBy: null,
            deactivatedReason: null,
          }),
        update: jest.fn().mockResolvedValue(activeRecord),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    } as unknown as PrismaService;

    const service = new UserManagementService(prisma);
    const result = await service.activate(5, {
      operatedBy: 'admin',
      reason: '恢复账号',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 5n },
      data: expect.objectContaining({
        status: 'active',
        deactivatedAt: null,
        deactivatedBy: null,
        deactivatedReason: null,
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'user',
        bizId: 5n,
        operationType: 'activate_user',
      }),
    });
    expect(result).toMatchObject({
      id: 5,
      username: 'ben',
      status: 'active',
    });
  });
});
