import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { UserManagementController } from '../src/user-management/user-management.controller';
import { UserManagementService } from '../src/user-management/user-management.service';

describe('UserManagementController', () => {
  it('normalizes pagination params for the list action', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      pageSize: 5,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [{ provide: UserManagementService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    await controller.list({
      page: '2',
      pageSize: '5',
    });

    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
    });
  });

  it('creates a user account from admin input', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 5,
      username: 'ava',
      status: 'active',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [{ provide: UserManagementService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.create({
      username: 'ava',
      realName: 'Ava',
      password: 'Ava123456',
      roleCode: 'sales',
      createdBy: 'admin',
    });

    expect(create).toHaveBeenCalledWith({
      username: 'ava',
      realName: 'Ava',
      password: 'Ava123456',
      roleCode: 'sales',
      createdBy: 'admin',
    });
    expect(result.status).toBe('active');
  });

  it('deactivates a user account by id', async () => {
    const deactivate = jest.fn().mockResolvedValue({
      id: 5,
      status: 'inactive',
    });
    const activate = jest.fn().mockResolvedValue({
      id: 5,
      status: 'active',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [{ provide: UserManagementService, useValue: { deactivate, activate } }],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.deactivate(5, {
      operatedBy: 'admin',
      reason: '离职停用',
    });

    expect(deactivate).toHaveBeenCalledWith(5, {
      operatedBy: 'admin',
      reason: '离职停用',
    });
    expect(result.status).toBe('inactive');

    await expect(
      controller.activate(5, {
        operatedBy: 'admin',
        reason: '恢复账号',
      }),
    ).resolves.toMatchObject({ status: 'active' });
    expect(activate).toHaveBeenCalledWith(5, {
      operatedBy: 'admin',
      reason: '恢复账号',
    });
  });

  it('lists audit logs from the user management controller', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          bizType: 'user',
          bizId: 5,
          operationType: 'create_user',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [{ provide: UserManagementService, useValue: { listAuditLogs } }],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('lists role permissions from the user management controller', async () => {
    const listRolePermissions = jest.fn().mockResolvedValue({
      items: [
        {
          roleCode: 'sales',
          accessScopes: {
            modules: ['sales'],
            dataScope: 'own_sales',
            actions: ['sales.quote.write', 'sales.order.write'],
          },
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [
        { provide: UserManagementService, useValue: { listRolePermissions } },
      ],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.listRolePermissions();

    expect(listRolePermissions).toHaveBeenCalled();
    expect(result.items[0].roleCode).toBe('sales');
  });

  it('updates role module permissions from admin input', async () => {
    const updateRolePermission = jest.fn().mockResolvedValue({
      roleCode: 'sales',
      accessScopes: {
        modules: ['sales', 'boss_dashboard'],
        dataScope: 'sales_team',
        actions: ['sales.quote.write', 'sales.order.write'],
      },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [
        { provide: UserManagementService, useValue: { updateRolePermission } },
      ],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.updateRolePermission('sales', {
      modules: ['sales', 'boss_dashboard'],
      dataScope: 'sales_team',
      actions: ['sales.quote.write', 'sales.order.write'],
      updatedBy: 'admin',
    });

    expect(updateRolePermission).toHaveBeenCalledWith('sales', {
      modules: ['sales', 'boss_dashboard'],
      dataScope: 'sales_team',
      actions: ['sales.quote.write', 'sales.order.write'],
      updatedBy: 'admin',
    });
    expect(result.accessScopes.modules).toEqual(['sales', 'boss_dashboard']);
    expect(result.accessScopes.actions).toEqual([
      'sales.quote.write',
      'sales.order.write',
    ]);
  });

  it('updates a user account role by id', async () => {
    const updateUserRole = jest.fn().mockResolvedValue({
      id: 3,
      username: 'zoe',
      roleCode: 'sales_manager',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [{ provide: UserManagementService, useValue: { updateUserRole } }],
    }).compile();

    const controller = moduleRef.get(UserManagementController);
    const result = await controller.updateRole(3, {
      roleCode: 'sales_manager',
      operatedBy: 'admin',
    });

    expect(updateUserRole).toHaveBeenCalledWith(3, {
      roleCode: 'sales_manager',
      operatedBy: 'admin',
    });
    expect(result.roleCode).toBe('sales_manager');
  });

  it('uses ParseIntPipe for the user id param', () => {
    const deactivateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      UserManagementController,
      'deactivate',
    ) as Record<string, { pipes: unknown[] }>;
    const activateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      UserManagementController,
      'activate',
    ) as Record<string, { pipes: unknown[] }>;

    expect(deactivateMetadata['5:0']?.pipes).toHaveLength(1);
    expect(deactivateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(activateMetadata['5:0']?.pipes).toHaveLength(1);
    expect(activateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
