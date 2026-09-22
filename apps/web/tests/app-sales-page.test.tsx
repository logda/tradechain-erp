import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppSalesPage from '../app/app/sales/page';

describe('AppSalesPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders sales workbench entry cards with live summary numbers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-07-12T08:00:00.000Z',
        currency: 'CNY',
        totals: {
          salesOrderCount: 16,
          submittedAmount: 880000,
          shippedAmount: 532000,
        },
        afterSalesOverview: {
          openCases: 7,
          pendingApproval: 1,
          processing: 3,
          financeReviewing: 2,
          closedThisMonth: 8,
        },
        shipmentBreakdown: [
          { status: 'not_shipped', count: 4 },
          { status: 'partially_shipped', count: 3 },
          { status: 'fully_shipped', count: 9 },
        ],
        receiptBreakdown: [
          { status: 'unpaid', count: 2 },
          { status: 'deposit_received', count: 4 },
          { status: 'fully_paid', count: 3 },
          { status: 'prepaid_deducted', count: 3 },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppSalesPage({})}</>);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/reports/sales-summary',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );

    expect(
      screen.getByRole('heading', { name: '销售工作台' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '核心模块' })).toBeInTheDocument();
    expect(screen.getByText('销售单总数')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('880,000')).toBeInTheDocument();
    expect(screen.getByText('532,000')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText('已收金额')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '需求/报价模块' })).toHaveAttribute(
      'href',
      '/app/sales/quotes',
    );
    expect(
      screen.getByText('需求单可选择产品库产品或手填新产品；报价单只选择产品库产品，并在老板定价后由销售记录客户反馈。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售单模块' })).toHaveAttribute(
      'href',
      '/app/sales/orders',
    );
    expect(screen.getByRole('link', { name: '发货单模块' })).toHaveAttribute(
      'href',
      '/app/shipment-batches',
    );
    expect(screen.getByRole('link', { name: '样品模块' })).toHaveAttribute(
      'href',
      '/app/sales/samples',
    );
    expect(screen.queryByRole('link', { name: '询价模块' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售待办' })).toHaveAttribute(
      'href',
      '/app/todos',
    );
    expect(screen.getByRole('heading', { name: '辅助模块' })).toBeInTheDocument();
    expect(screen.getByText('售后待闭环')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看有售后销售单' })).toHaveAttribute(
      'href',
      '/app/sales/orders?hasAfterSales=yes',
    );
    expect(screen.getByRole('link', { name: '直接新建销售单' })).toHaveAttribute(
      'href',
      '/app/sales/orders/new',
    );
  });

  it('falls back to zeros when the formal summary response is missing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-12T08:00:00.000Z',
          currency: 'CNY',
          totals: {
            salesOrderCount: null,
            submittedAmount: null,
            shippedAmount: null,
          },
          afterSalesOverview: {
            openCases: null,
          },
        }),
      }),
    );

    render(<>{await AppSalesPage({})}</>);

    expect(screen.getAllByText('0')).toHaveLength(4);
    expect(screen.queryByText('已收金额')).not.toBeInTheDocument();
  });
});
