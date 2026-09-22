import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppReportsPage from '../app/app/reports/page';

describe('AppReportsPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the reports hub and quick actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-12T08:00:00.000Z',
          currency: 'CNY',
          totalRevenue: 880000,
          totalProcurementCost: 620000,
          totalAfterSalesCost: 18000,
          grossProfit: 242000,
          grossMargin: 0.275,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generatedAt: '2026-07-12T08:00:00.000Z',
          period: '2026-07',
          salesOrdersCreated: 16,
          purchaseOrdersCreated: 14,
          shipmentBatchesCreated: 10,
          afterSalesCreated: 7,
          closedOrders: 6,
          reopenedApprovals: 2,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppReportsPage({})}</>);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/reports/gross-profit',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3001/api/reports/period-summary',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '报表中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '毛利报表' })).toHaveAttribute(
      'href',
      '/app/dashboard/boss',
    );
    expect(screen.getByRole('link', { name: '期间汇总' })).toHaveAttribute(
      'href',
      '/app/dashboard/boss',
    );
    expect(screen.getByRole('link', { name: '进入老板看板' })).toHaveAttribute(
      'href',
      '/app/dashboard/boss',
    );
    expect(screen.getByRole('link', { name: '回款待确认' })).toHaveAttribute(
      'href',
      '/app/sales/orders?financeConfirmStatus=pending',
    );
    expect(screen.getByRole('link', { name: '售后财务复核' })).toHaveAttribute(
      'href',
      '/app/after-sales?financeReviewStatus=pending',
    );
  });

  it('falls back to zeros when the reports response is missing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            generatedAt: null,
            currency: null,
            totalRevenue: null,
            totalProcurementCost: null,
            totalAfterSalesCost: null,
            grossProfit: null,
            grossMargin: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            generatedAt: null,
            period: null,
            salesOrdersCreated: null,
            purchaseOrdersCreated: null,
            shipmentBatchesCreated: null,
            afterSalesCreated: null,
            closedOrders: null,
            reopenedApprovals: null,
          }),
        }),
    );

    render(<>{await AppReportsPage({})}</>);

    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });
});
