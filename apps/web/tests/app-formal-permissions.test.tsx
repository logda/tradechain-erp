import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import AppAdminUsersPage from '../app/app/admin/users/page';
import AppPurchaseOrdersPage from '../app/app/purchase-orders/page';
import AppSalesOrdersPage from '../app/app/sales/orders/page';
import { getSalesOrderPreviewResponse } from '../app/sales-orders/sales-order-preview';

describe('formal permissions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, page: 1, pageSize: 20, count: 0 }) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only the sales user own sales orders', async () => {
    const fixture = getSalesOrderPreviewResponse({});
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true, json: async () => String(input).includes('/sales-orders?') ? fixture : { items: [], count: 0 },
    })));

    render(
      <>
        {await AppSalesOrdersPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('角色 Role: 销售')).toBeInTheDocument();
    expect(screen.getByText('用户 User: Zoe')).toBeInTheDocument();
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.getByText('S202607080003')).toBeInTheDocument();
    expect(screen.queryByText('S202607080002')).not.toBeInTheDocument();
  });

  it('blocks sales users from opening purchase orders', async () => {
    render(
      <>
        {await AppPurchaseOrdersPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('无权限访问采购单')).toBeInTheDocument();
  });

  it('allows admin users to access full business modules', async () => {
    render(
      <>
        {await AppPurchaseOrdersPage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('角色 Role: 管理员')).toBeInTheDocument();
    expect(screen.getByText('用户 User: Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '采购中心' })).toHaveAttribute(
      'href',
      '/app/purchase',
    );
  });

  it('blocks non-admin users from opening user management', async () => {
    render(
      <>
        {await AppAdminUsersPage({
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('无权限访问用户管理')).toBeInTheDocument();
  });

  it('hides sales order create buttons when dynamic action permission is missing', async () => {
    const fixture = getSalesOrderPreviewResponse({});
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true, json: async () => String(input).includes('/sales-orders?') ? fixture : { items: [], count: 0 },
    })));

    render(
      <>
        {await AppSalesOrdersPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'own_sales',
              }),
            ),
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('角色 Role: 销售')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '从报价转入' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '新建销售单' }),
    ).not.toBeInTheDocument();
  });
});
