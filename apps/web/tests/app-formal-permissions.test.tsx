import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import AppAdminUsersPage from '../app/app/admin/users/page';
import AppPurchaseOrdersPage from '../app/app/purchase-orders/page';
import AppSalesOrdersPage from '../app/app/sales/orders/page';

describe('formal permissions', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows only the sales user own sales orders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('preview fallback')));

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

    expect(screen.getByText('无权限访问正式采购单')).toBeInTheDocument();
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

    expect(screen.getByText('角色 Role: 管理员')).toBeInTheDocument();
    expect(screen.getByText('用户 User: Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '采购中心' })).toHaveAttribute(
      'href',
      '/app/purchase?role=admin&user=Admin',
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

    expect(screen.getByText('无权限访问用户管理')).toBeInTheDocument();
  });

  it('hides sales order create buttons when dynamic action permission is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('preview fallback')));

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

    expect(screen.getByText('角色 Role: 销售')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '从报价转入' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '新建销售单' }),
    ).not.toBeInTheDocument();
  });
});
