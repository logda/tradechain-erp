import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAdminUserForm } from '../app/app/admin/users/create-admin-user-form';
import AppAdminUsersPage from '../app/app/admin/users/page';
import { RolePermissionEditor } from '../app/app/admin/users/role-permissions-editor';
import { UpdateUserRoleForm } from '../app/app/admin/users/update-user-role-form';
import { formatAuditCreatedAt } from '../app/app/_lib/audit-log';

describe('admin users page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the admin user management page with create and deactivate actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                username: 'admin',
                realName: '系统管理员',
                roleCode: 'admin',
                status: 'active',
                fullAccess: true,
                accessScopes: {
                  modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
                  dataScope: 'all',
                },
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
              {
                id: 2,
                username: 'zoe',
                realName: 'Zoe',
                roleCode: 'sales',
                status: 'active',
                fullAccess: false,
                accessScopes: {
                  modules: ['sales'],
                  dataScope: 'own_sales',
                },
                createdAt: '2026-07-11T09:10:00.000Z',
                createdBy: 'admin',
              },
            ],
            total: 2,
            page: 1,
            pageSize: 20,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'user',
                bizId: 2,
                operationType: 'deactivate_user',
                operatorId: 1,
                beforeData: { status: 'active' },
                afterData: { status: 'inactive' },
                createdAt: '2026-07-11T10:00:00.000Z',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                roleCode: 'sales',
                accessScopes: {
                  modules: ['sales'],
                  dataScope: 'own_sales',
                },
                updatedBy: 'system',
                updatedAt: '2026-07-11T09:00:00.000Z',
              },
            ],
          }),
        }),
    );

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '用户管理' })).toBeInTheDocument();
    expect(screen.getByText('系统管理员')).toBeInTheDocument();
    expect(screen.getByText('Zoe')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '角色权限配置' })).toBeInTheDocument();
    expect(screen.getByText('停用账号 / deactivate_user')).toBeInTheDocument();
    expect(
      screen.getByText('销售、采购、运营、老板看板、用户管理'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('仅本人销售单/报价').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '新增用户' })).toBeInTheDocument();
    expect(screen.getByLabelText('变更角色 Role Change')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存角色' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注销用户' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users?page=1&pageSize=20',
      {
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-modules': expect.any(String),
          'x-erp-actions': expect.stringContaining('admin.user.write'),
          'x-erp-session-signature': expect.any(String),
        }),
      },
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users/audit-logs',
      {
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-modules': expect.any(String),
          'x-erp-actions': expect.stringContaining('admin.user.write'),
          'x-erp-session-signature': expect.any(String),
        }),
      },
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users/role-permissions',
      {
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-modules': expect.any(String),
          'x-erp-actions': expect.stringContaining('admin.user.write'),
          'x-erp-session-signature': expect.any(String),
        }),
      },
    );
  });

  it('passes pagination params to the admin users api and renders pagination controls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 21,
              username: 'page-user',
              realName: 'Page User',
              roleCode: 'sales',
              status: 'active',
              fullAccess: false,
              accessScopes: {
                modules: ['sales'],
                dataScope: 'own_sales',
              },
              createdAt: '2026-07-11T09:10:00.000Z',
              createdBy: 'admin',
            },
          ],
          total: 22,
          page: 2,
          pageSize: 20,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            page: '2',
            pageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/admin/users?page=2&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(screen.getByText('第 2 / 2 页，共 22 条')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '上一页' })).toHaveAttribute(
      'href',
      expect.stringContaining('page=1'),
    );
  });

  it('renders an activate action for inactive users', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 5,
              username: 'cora',
              realName: 'Cora',
              roleCode: 'purchase',
              status: 'inactive',
              fullAccess: false,
              accessScopes: {
                modules: ['purchase'],
                dataScope: 'own_purchase',
              },
              deactivatedReason: '离职停用',
              createdAt: '2026-07-11T09:10:00.000Z',
              createdBy: 'admin',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            status: 'inactive',
          }),
        })}
      </>,
    );

    expect(screen.getByText('Cora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '启用用户' })).toBeInTheDocument();
    expect(screen.queryByText('不可操作')).not.toBeInTheDocument();
  });

  it('shows a success message after creating a user account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 5,
          username: 'cora',
          realName: 'Cora',
          roleCode: 'purchase',
          status: 'active',
        }),
      }),
    );

    render(
      <CreateAdminUserForm
        endpoint="http://127.0.0.1:3001/api/admin/users"
        createdBy="Admin"
        actorRole="admin"
        actorUser="Admin"
      />,
    );

    fireEvent.change(screen.getByLabelText('用户名 Username'), {
      target: { value: 'cora' },
    });
    fireEvent.change(screen.getByLabelText('姓名 Real Name'), {
      target: { value: 'Cora' },
    });
    fireEvent.change(screen.getByLabelText('初始密码 Password'), {
      target: { value: 'Cora123456' },
    });
    fireEvent.change(screen.getByLabelText('角色 Role'), {
      target: { value: 'purchase' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增用户' }));

    await waitFor(() => {
      expect(screen.getByText('新增成功，请刷新或继续在当前页查看最新用户。')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({
          username: 'cora',
          realName: 'Cora',
          password: 'Cora123456',
          roleCode: 'purchase',
          createdBy: 'Admin',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-actions': expect.stringContaining('admin.user.write'),
        }),
      }),
    );
  });

  it('inserts the created user into the current list without manual refresh', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/admin/users?page=1&pageSize=20')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                username: 'admin',
                realName: '系统管理员',
                roleCode: 'admin',
                status: 'active',
                fullAccess: true,
                accessScopes: {
                  modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
                  dataScope: 'all',
                  actions: ['admin.user.write', 'admin.role.write', 'master_data.write'],
                },
                createdAt: '2026-07-11T09:00:00.000Z',
                createdBy: 'system',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }

      if (url.includes('/admin/users/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.includes('/admin/users/role-permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.endsWith('/admin/users') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 8,
            username: 'cora',
            realName: 'Cora',
            roleCode: 'purchase',
            status: 'active',
            fullAccess: false,
            accessScopes: {
              modules: ['purchase', 'operations'],
              dataScope: 'own_purchase',
              actions: [
                'purchase.order.create',
                'purchase.order.submit',
                'shipment.update',
                'after_sales.process',
              ],
            },
            createdAt: '2026-07-18T08:00:00.000Z',
            createdBy: 'Admin',
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    fireEvent.change(screen.getByLabelText('用户名 Username'), {
      target: { value: 'cora' },
    });
    fireEvent.change(screen.getByLabelText('姓名 Real Name'), {
      target: { value: 'Cora' },
    });
    fireEvent.change(screen.getByLabelText('初始密码 Password'), {
      target: { value: 'Cora123456' },
    });
    fireEvent.change(screen.getByLabelText('角色 Role'), {
      target: { value: 'purchase' },
    });
    fireEvent.click(screen.getByRole('button', { name: '新增用户' }));

    await waitFor(() => {
      expect(screen.getByText('cora')).toBeInTheDocument();
      expect(screen.getByText('Cora')).toBeInTheDocument();
      expect(screen.getByText('新增成功，已同步到当前列表。')).toBeInTheDocument();
    });
    expect(screen.queryByText('新增成功，请刷新或继续在当前页查看最新用户。')).not.toBeInTheDocument();
    expect(screen.getByText('第 1 / 1 页，共 2 条')).toBeInTheDocument();
  });

  it('updates the current row locally after role changes and activation toggles', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/admin/users?page=1&pageSize=20')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 2,
                username: 'zoe',
                realName: 'Zoe',
                roleCode: 'sales',
                status: 'active',
                fullAccess: false,
                accessScopes: {
                  modules: ['sales'],
                  dataScope: 'own_sales',
                  actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write'],
                },
                createdAt: '2026-07-11T09:10:00.000Z',
                createdBy: 'admin',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }

      if (url.includes('/admin/users/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.includes('/admin/users/role-permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.endsWith('/admin/users/2/role') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 2,
            username: 'zoe',
            realName: 'Zoe',
            roleCode: 'sales_manager',
            status: 'active',
            fullAccess: false,
            accessScopes: {
              modules: ['sales', 'boss_dashboard'],
              dataScope: 'sales_team',
              actions: [
                'sales.quote.write',
                'sales.inquiry.submit',
                'sales.order.write',
                'sales.sample.submit',
                'sales.sample.approve',
                'sales.sample.execute',
              ],
            },
            createdAt: '2026-07-11T09:10:00.000Z',
            createdBy: 'admin',
          }),
        });
      }

      if (url.endsWith('/admin/users/2/deactivate') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 2,
            username: 'zoe',
            realName: 'Zoe',
            roleCode: 'sales_manager',
            status: 'inactive',
            fullAccess: false,
            accessScopes: {
              modules: ['sales', 'boss_dashboard'],
              dataScope: 'sales_team',
              actions: [
                'sales.quote.write',
                'sales.inquiry.submit',
                'sales.order.write',
                'sales.sample.submit',
                'sales.sample.approve',
                'sales.sample.execute',
              ],
            },
            createdAt: '2026-07-11T09:10:00.000Z',
            createdBy: 'admin',
            deactivatedReason: '管理员停用',
          }),
        });
      }

      if (url.endsWith('/admin/users/2/activate') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 2,
            username: 'zoe',
            realName: 'Zoe',
            roleCode: 'sales_manager',
            status: 'active',
            fullAccess: false,
            accessScopes: {
              modules: ['sales', 'boss_dashboard'],
              dataScope: 'sales_team',
              actions: [
                'sales.quote.write',
                'sales.inquiry.submit',
                'sales.order.write',
                'sales.sample.submit',
                'sales.sample.approve',
                'sales.sample.execute',
              ],
            },
            createdAt: '2026-07-11T09:10:00.000Z',
            createdBy: 'admin',
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    fireEvent.change(screen.getByLabelText('变更角色 Role Change'), {
      target: { value: 'sales_manager' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));

    await waitFor(() => {
      expect(screen.getByText('sales_manager')).toBeInTheDocument();
      expect(screen.getByText('角色已更新，当前列表已同步。')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '注销用户' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '启用用户' })).toBeInTheDocument();
      expect(screen.getByText('管理员停用')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '启用用户' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '注销用户' })).toBeInTheDocument();
    });
    expect(screen.queryByText('管理员停用')).not.toBeInTheDocument();
  });

  it('refreshes the audit log locally after deactivating a user', async () => {
    let auditFetchCount = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/admin/users?page=1&pageSize=20')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 2,
                username: 'zoe',
                realName: 'Zoe',
                roleCode: 'sales',
                status: 'active',
                fullAccess: false,
                accessScopes: {
                  modules: ['sales'],
                  dataScope: 'own_sales',
                  actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write'],
                },
                createdAt: '2026-07-11T09:10:00.000Z',
                createdBy: 'admin',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }

      if (url.includes('/admin/users/audit-logs')) {
        auditFetchCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items:
              auditFetchCount === 1
                ? []
                : [
                    {
                      id: 18,
                      bizType: 'user',
                      bizId: 2,
                      operationType: 'deactivate_user',
                      operatorId: 1,
                      beforeData: { status: 'active' },
                      afterData: { status: 'inactive', deactivatedReason: '管理员停用' },
                      createdAt: '2026-07-18T11:45:00.000Z',
                    },
                  ],
          }),
        });
      }

      if (url.includes('/admin/users/role-permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.endsWith('/admin/users/2/deactivate') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 2,
            username: 'zoe',
            realName: 'Zoe',
            roleCode: 'sales',
            status: 'inactive',
            fullAccess: false,
            accessScopes: {
              modules: ['sales'],
              dataScope: 'own_sales',
              actions: ['sales.quote.write', 'sales.inquiry.submit', 'sales.order.write'],
            },
            createdAt: '2026-07-11T09:10:00.000Z',
            createdBy: 'admin',
            deactivatedReason: '管理员停用',
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByText('暂无审计记录')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '注销用户' }));

    await waitFor(() => {
      expect(screen.getByText('停用账号 / deactivate_user')).toBeInTheDocument();
      expect(screen.getByText('账号 #2')).toBeInTheDocument();
      expect(screen.getByText(formatAuditCreatedAt('2026-07-18T11:45:00.000Z'))).toBeInTheDocument();
    });
  });

  it('submits a role change for an existing user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 3,
          username: 'zoe',
          roleCode: 'sales_manager',
        }),
      }),
    );

    render(
      <UpdateUserRoleForm
        endpoint="http://127.0.0.1:3001/api/admin/users/3/role"
        currentRoleCode="sales"
        actorRole="admin"
        actorUser="Admin"
      />,
    );

    fireEvent.change(screen.getByLabelText('变更角色 Role Change'), {
      target: { value: 'sales_manager' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));

    await waitFor(() => {
      expect(screen.getByText('角色已更新')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users/3/role',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        body: JSON.stringify({
          roleCode: 'sales_manager',
          operatedBy: 'Admin',
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-actions': expect.stringContaining('admin.user.write'),
        }),
      }),
    );
  });

  it('submits role permission updates with the current dynamic action scopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          roleCode: 'sales',
          accessScopes: {
            modules: ['sales'],
            dataScope: 'own_sales',
            actions: ['sales.quote.write'],
          },
          updatedBy: 'Admin',
          updatedAt: '2026-07-18T11:30:00.000Z',
        }),
      }),
    );

    render(
      <RolePermissionEditor
        endpoint="http://127.0.0.1:3001/api/admin/users/role-permissions/sales"
        roleCode="sales"
        roleLabel="销售"
        modules={['sales']}
        dataScope="own_sales"
        actions={['sales.quote.write']}
        updatedBy="system"
        updatedAt="2026-07-11T09:00:00.000Z"
        actorRole="admin"
        actorUser="Admin"
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['admin.role.write'],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '保存权限' }));

    await waitFor(() => {
      expect(screen.getByText('销售 权限已更新')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users/role-permissions/sales',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
          'x-erp-actions': 'admin.role.write',
        }),
      }),
    );
    expect(screen.getByText('最近更新：Admin / 2026-07-18T11:30:00.000Z')).toBeInTheDocument();
  });

  it('lets admins grant audit.view as an explicit action permission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          roleCode: 'boss',
          accessScopes: {
            modules: [],
            dataScope: 'all',
            actions: ['audit.view'],
          },
        }),
      }),
    );

    render(
      <RolePermissionEditor
        endpoint="http://127.0.0.1:3001/api/admin/users/role-permissions/boss"
        roleCode="boss"
        roleLabel="老板"
        modules={[]}
        dataScope="all"
        actions={[]}
        updatedBy="system"
        updatedAt="2026-07-11T09:00:00.000Z"
        actorRole="admin"
        actorUser="Admin"
        actorAccessScopes={{
          modules: ['admin'],
          dataScope: 'all',
          actions: ['admin.role.write'],
        }}
      />,
    );

    const auditPermission = screen.getByLabelText('审计查看');
    expect(auditPermission).not.toBeChecked();
    fireEvent.click(auditPermission);

    fireEvent.click(screen.getByRole('button', { name: '保存权限' }));

    await waitFor(() => {
      expect(screen.getByText('老板 权限已更新')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/admin/users/role-permissions/boss',
      expect.objectContaining({
        body: JSON.stringify({
          modules: [],
          dataScope: 'all',
          actions: ['audit.view'],
          updatedBy: 'Admin',
        }),
      }),
    );
  });
});
