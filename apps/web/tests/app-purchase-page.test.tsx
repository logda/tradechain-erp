import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppPurchasePage from '../app/app/purchase/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('AppPurchasePage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], total: 0, count: 0, closedTotal: 0 }) })));
  afterEach(() => vi.unstubAllGlobals());

  it('renders purchase workbench cards and quick actions', async () => {
    render(<>{await AppPurchasePage({})}</>);

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(
      screen.getByRole('heading', { name: '采购工作台' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('采购待办').length).toBeGreaterThan(0);
    expect(screen.getAllByText('发货待办').length).toBeGreaterThan(0);
    expect(screen.getAllByText('售后待办').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '采购单模块' })).toHaveAttribute(
      'href',
      '/app/purchase-orders',
    );
    expect(screen.getByRole('link', { name: '询价单模块' })).toHaveAttribute(
      'href',
      '/app/sales/inquiries',
    );
    expect(
      screen
        .getByRole('link', { name: '询价单模块' })
        .compareDocumentPosition(screen.getByRole('link', { name: '采购单模块' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: '发货单模块' })).toHaveAttribute(
      'href',
      '/app/shipment-batches',
    );
    expect(screen.getByRole('link', { name: '售后协同' })).toHaveAttribute(
      'href',
      '/app/after-sales',
    );
    expect(
      screen.getAllByRole('link', { name: '仓库中心' }).some((link) =>
        link.getAttribute('href') === '/app/warehouses',
      ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: '新建采购单' })).toHaveAttribute(
      'href',
      '/app/purchase-orders/new',
    );
    expect(screen.getByRole('link', { name: '待审批采购单' })).toHaveAttribute(
      'href',
      '/app/purchase-orders?approvalStatus=pending_purchase_manager_approval',
    );
    expect(screen.getByRole('link', { name: '待询价单' })).toHaveAttribute(
      'href',
      '/app/sales/inquiries?status=pending_inquiry',
    );
  });

  it('blocks sales-only users from the purchase workbench', async () => {
    render(
      <>
        {await AppPurchasePage({
          searchParams: Promise.resolve({ role: 'sales', user: 'Zoe' }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(
      screen.getByRole('heading', { name: '采购工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByText('无权限访问采购工作台')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '采购单模块' }),
    ).not.toBeInTheDocument();
  });

  it('hides write buttons for module-only purchase access', async () => {
    render(
      <>
        {await AppPurchasePage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['purchase', 'operations'],
                dataScope: 'purchase_team',
              }),
            ),
          }),
        })}
      </>,
    );

    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(
      screen.getByRole('heading', { name: '采购工作台' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '新建采购单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '创建发货批次' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '仓库中心' }).find(link => !link.closest('aside'))!).toHaveAttribute(
      'href',
      '/app/warehouses',
    );
    expect(screen.getByRole('link', { name: '待审批采购单' })).toHaveAttribute(
      'href',
      '/app/purchase-orders?approvalStatus=pending_purchase_manager_approval',
    );
    expect(screen.getByRole('link', { name: '待询价单' })).toHaveAttribute(
      'href',
      '/app/sales/inquiries?status=pending_inquiry',
    );
  });
});
