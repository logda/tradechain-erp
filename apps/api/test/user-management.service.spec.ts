import { UserManagementService } from '../src/user-management/user-management.service';

describe('UserManagementService', () => {
  it('lists seeded users including the admin account', async () => {
    const service = new UserManagementService();

    const result = await service.list();

    expect(result.items.map((item: { username: string }) => item.username)).toEqual(
      expect.arrayContaining(['admin', 'mia', 'zoe', 'leo']),
    );
    expect(
      result.items.find((item: { username: string }) => item.username === 'admin'),
    ).toMatchObject({
      roleCode: 'admin',
      status: 'active',
      fullAccess: true,
      accessScopes: {
        modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
        dataScope: 'all',
      },
    });
    expect(
      result.items.find((item: { username: string }) => item.username === 'zoe'),
    ).toMatchObject({
      roleCode: 'sales',
      fullAccess: false,
      accessScopes: {
        modules: ['sales'],
        dataScope: 'own_sales',
      },
    });
  });

  it('lists active purchase users assignable to purchase orders', async () => {
    const service = new UserManagementService();

    await service.create({
      username: 'paul',
      realName: 'Paul',
      password: 'Paul123456',
      roleCode: 'purchase_manager',
      createdBy: 'admin',
    });

    const result = await service.listAssignablePurchaseUsers();

    expect(result.map((item) => item.realName)).toEqual(['Paul', 'Leo']);
    expect(result.map((item) => item.roleCode)).toEqual([
      'purchase_manager',
      'purchase',
    ]);
  });

  it('paginates users after createdAt ordering', async () => {
    const service = new UserManagementService();

    await service.create({
      username: 'amy',
      realName: 'Amy',
      password: 'Amy123456',
      roleCode: 'sales',
      createdBy: 'admin',
    });
    await service.create({
      username: 'ben',
      realName: 'Ben',
      password: 'Ben123456',
      roleCode: 'purchase',
      createdBy: 'admin',
    });

    const result = await service.list({ page: 2, pageSize: 2 });

    expect(result.total).toBe(6);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item: { username: string }) => item.username)).toEqual([
      'zoe',
      'leo',
    ]);
  });

  it('creates a new active user account', async () => {
    const service = new UserManagementService();

    const created = await service.create({
      username: 'ava',
      realName: 'Ava',
      password: 'Ava123456',
      roleCode: 'sales',
      createdBy: 'admin',
    });

    const listed = await service.list();

    expect(created.username).toBe('ava');
    expect(created.status).toBe('active');
    expect(
      listed.items.find((item: { username: string }) => item.username === 'ava'),
    ).toMatchObject({
      realName: 'Ava',
      roleCode: 'sales',
      status: 'active',
      accessScopes: {
        modules: ['sales'],
        dataScope: 'own_sales',
      },
    });
  });

  it('deactivates a user with soft delete semantics', async () => {
    const service = new UserManagementService();

    const created = await service.create({
      username: 'ben',
      realName: 'Ben',
      password: 'Ben123456',
      roleCode: 'purchase',
      createdBy: 'admin',
    });

    await service.deactivate(created.id, {
      operatedBy: 'admin',
      reason: '离职停用',
    });

    const listed = await service.list();

    expect(
      listed.items.find((item: { username: string }) => item.username === 'ben'),
    ).toMatchObject({
      status: 'inactive',
      deactivatedReason: '离职停用',
    });
  });

  it('reactivates a previously inactive user', async () => {
    const service = new UserManagementService();

    const created = await service.create({
      username: 'ben',
      realName: 'Ben',
      password: 'Ben123456',
      roleCode: 'purchase',
      createdBy: 'admin',
    });

    await service.deactivate(created.id, {
      operatedBy: 'admin',
      reason: '离职停用',
    });

    const activated = await service.activate(created.id, {
      operatedBy: 'admin',
      reason: '重新入职',
    });

    expect(activated).toMatchObject({
      username: 'ben',
      status: 'active',
    });
    expect(activated.deactivatedReason).toBeUndefined();
  });

  it('authenticates an active user and returns the formal session identity', async () => {
    const service = new UserManagementService();

    const result = await service.authenticate({
      username: 'admin',
      password: 'Admin123456',
    });

    expect(result).toEqual({
      role: 'admin',
      user: 'Admin',
      username: 'admin',
      accessScopes: {
        modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
        dataScope: 'all',
        actions: [
          'audit.view',
          'admin.user.write',
          'admin.role.write',
          'master_data.write',
          'product.custom_field.write',
          'counterparty.write',
          'sales.quote.write',
          'sales.inquiry.submit',
          'sales.order.write',
          'sales.sample.submit',
          'sales.sample.approve',
          'sales.sample.execute',
          'purchase.order.create',
          'purchase.order.submit',
          'purchase.order.approve',
          'purchase.sample.execute',
          'shipment.update',
          'after_sales.process',
          'boss.confirm',
          'finance.confirm',
        ],
      },
    });
  });

  it('lists configurable role module permissions', async () => {
    const service = new UserManagementService();

    const result = await service.listRolePermissions();
    expect(result.items.find((item) => item.roleCode === 'admin')?.accessScopes.actions)
      .toContain('audit.view');

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roleCode: 'sales',
          accessScopes: {
            modules: ['sales'],
            dataScope: 'own_sales',
            actions: [
              'counterparty.write',
              'sales.quote.write',
              'sales.inquiry.submit',
              'sales.order.write',
              'sales.sample.submit',
              'sales.sample.execute',
            ],
          },
        }),
        expect.objectContaining({
          roleCode: 'purchase_manager',
          accessScopes: {
            modules: ['purchase', 'operations', 'boss_dashboard'],
            dataScope: 'purchase_team',
            actions: [
              'counterparty.write',
              'purchase.order.create',
              'purchase.order.submit',
              'purchase.order.approve',
              'purchase.sample.execute',
              'shipment.update',
              'after_sales.process',
            ],
          },
        }),
      ]),
    );
  });

  it('shows the admin audit grant when runtime permissions were saved before audit.view existed', async () => {
    const service = new UserManagementService();
    const admin = (await service.listRolePermissions()).items.find((item) => item.roleCode === 'admin')!;
    const serviceWithStore = service as unknown as { store: {
      listRolePermissions: () => typeof admin[];
    } };
    const original = serviceWithStore.store.listRolePermissions();
    serviceWithStore.store = {
      listRolePermissions: () => original.map((item) => item.roleCode === 'admin'
        ? { ...item, accessScopes: {
          ...item.accessScopes,
          actions: item.accessScopes.actions.filter((action) => action !== 'audit.view'),
        } }
        : item),
    };
    const result = await service.listRolePermissions();
    expect(result.items.find((item) => item.roleCode === 'admin')?.accessScopes.actions)
      .toContain('audit.view');
  });

  it('rejects updates to fixed admin permissions instead of reporting a false success', async () => {
    const service = new UserManagementService();
    const before = (await service.listRolePermissions()).items.find((item) => item.roleCode === 'admin');

    await expect(service.updateRolePermission('admin', {
      modules: ['sales'],
      dataScope: 'own_sales',
      actions: [],
      updatedBy: 'admin',
    })).rejects.toThrow('管理员权限固定');

    const after = (await service.listRolePermissions()).items.find((item) => item.roleCode === 'admin');
    expect(after).toEqual(before);
  });

  it('updates a role permission and uses it for login/session access scopes', async () => {
    const service = new UserManagementService();

    const updated = await service.updateRolePermission('sales', {
      modules: ['sales', 'boss_dashboard', 'audit'],
      dataScope: 'sales_team',
      updatedBy: 'admin',
    });

    const result = await service.authenticate({
      username: 'zoe',
      password: 'Zoe123456',
    });

    expect(updated).toMatchObject({
      roleCode: 'sales',
      accessScopes: {
        modules: ['sales', 'boss_dashboard', 'audit'],
        dataScope: 'sales_team',
      },
      updatedBy: 'admin',
    });
    expect(result.accessScopes).toEqual({
      modules: ['sales', 'boss_dashboard', 'audit'],
      dataScope: 'sales_team',
      actions: [
        'counterparty.write',
        'sales.quote.write',
        'sales.inquiry.submit',
        'sales.order.write',
        'sales.sample.submit',
        'sales.sample.execute',
      ],
    });
  });
});
