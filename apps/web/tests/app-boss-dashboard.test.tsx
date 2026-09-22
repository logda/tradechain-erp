import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppBossDashboardPage from '../app/app/dashboard/boss/page';

describe('AppBossDashboardPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal boss dashboard from live summary data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-07-12T08:00:00.000Z',
        workflowAlerts: [
          { key: 'quotes_pending_boss_confirm', label: '待老板确认报价', count: 5 },
          { key: 'shipment_exceptions', label: '发货异常批次', count: 2 },
          { key: 'after_sales_pending_close', label: '售后待闭环', count: 3 },
        ],
        salesOverview: {
          totalOrders: 16,
          pendingApproval: 4,
          inProduction: 6,
          partiallyShipped: 2,
          fullyShipped: 4,
        },
        purchaseOverview: {
          totalOrders: 14,
          pendingApproval: 3,
          purchasing: 5,
          partiallyReceived: 2,
          completed: 4,
        },
        afterSalesOverview: {
          openCases: 7,
          pendingApproval: 2,
          processing: 3,
          financeReviewing: 1,
          closedThisMonth: 9,
        },
        financeOverview: {
          pendingConfirmation: 6,
          confirmedThisMonth: 13,
          prepaidDeducted: 4,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppBossDashboardPage({})}</>);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/dashboard/boss',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '老板看板' })).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === '待老板确认报价：5 条',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === '发货异常批次：2 条',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === '售后待闭环：3 条',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('售后待审批：2 条')).toBeInTheDocument();
    expect(screen.getByText('售后处理中：3 条')).toBeInTheDocument();
    expect(screen.getByText('售后财务复核：1 条')).toBeInTheDocument();
    expect(screen.getByText('售后已闭环：9 条')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看待办明细' })).toHaveAttribute(
      'href',
      '/app/todos',
    );
    expect(screen.getByRole('link', { name: '查看销售单列表' })).toHaveAttribute(
      'href',
      '/app/sales/orders',
    );
    expect(screen.getByRole('link', { name: '查看采购单列表' })).toHaveAttribute(
      'href',
      '/app/purchase-orders',
    );
    expect(screen.getByRole('link', { name: '查看待审批采购' })).toHaveAttribute(
      'href',
      '/app/purchase-orders?approvalStatus=pending_purchase_manager_approval',
    );
    expect(screen.getByRole('link', { name: '查看异常发货批次' })).toHaveAttribute(
      'href',
      '/app/shipment-batches?hasException=yes',
    );
    expect(screen.getByRole('link', { name: '查看售后闭环' })).toHaveAttribute(
      'href',
      '/app/after-sales',
    );
    expect(screen.getByRole('link', { name: '查看财务复核售后' })).toHaveAttribute(
      'href',
      '/app/after-sales?financeReviewStatus=pending',
    );
    expect(screen.getByRole('link', { name: '查看回款与财务' })).toHaveAttribute(
      'href',
      '/app/sales/orders?financeConfirmStatus=pending',
    );
  });

  it('allows formal sessions with the boss_dashboard module to open the boss dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-12T08:00:00.000Z',
          workflowAlerts: [],
          salesOverview: {
            totalOrders: 0,
            pendingApproval: 0,
            inProduction: 0,
            partiallyShipped: 0,
            fullyShipped: 0,
          },
          purchaseOverview: {
            totalOrders: 0,
            pendingApproval: 0,
            purchasing: 0,
            partiallyReceived: 0,
            completed: 0,
          },
          afterSalesOverview: {
            openCases: 0,
            pendingApproval: 0,
            processing: 0,
            financeReviewing: 0,
            closedThisMonth: 0,
          },
          financeOverview: {
            pendingConfirmation: 0,
            confirmedThisMonth: 0,
            prepaidDeducted: 0,
          },
        }),
      }),
    );

    render(
      <>
        {await AppBossDashboardPage({
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['boss_dashboard'],
                dataScope: 'all',
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '老板看板' })).toBeInTheDocument();
    expect(screen.queryByText('无权限访问老板看板')).not.toBeInTheDocument();
  });

  it('falls back to zeros when the dashboard response is missing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: null,
          workflowAlerts: [{ key: 'shipment_exceptions', label: '发货异常批次', count: null }],
          salesOverview: { totalOrders: null },
          purchaseOverview: { totalOrders: null },
          afterSalesOverview: { openCases: null },
          financeOverview: { pendingConfirmation: null },
        }),
      }),
    );

    render(<>{await AppBossDashboardPage({})}</>);

    expect(screen.getAllByText('0')).not.toHaveLength(0);
    expect(
      screen.getByText('发货异常批次：0 条', {
        selector: 'li',
      }),
    ).toBeInTheDocument();
  });
});
