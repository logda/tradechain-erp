import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppFinancePage from '../app/app/finance/page';

describe('AppFinancePage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the finance hub and quick actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-07-12T08:00:00.000Z',
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

    render(<>{await AppFinancePage({})}</>);

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
    expect(screen.getByRole('heading', { name: '财务中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售回款' })).toHaveAttribute(
      'href',
      '/app/sales/orders?receiptStatus=unpaid',
    );
    expect(screen.getByRole('link', { name: '售后财务复核' })).toHaveAttribute(
      'href',
      '/app/after-sales?financeReviewStatus=pending',
    );
    expect(screen.getByRole('link', { name: '待确认销售单' })).toHaveAttribute(
      'href',
      '/app/sales/orders?financeConfirmStatus=pending',
    );
    expect(screen.getByRole('link', { name: '待财务复核售后' })).toHaveAttribute(
      'href',
      '/app/after-sales?financeReviewStatus=pending',
    );
  });

  it('falls back to zeros when the finance dashboard response is missing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: null,
          salesOverview: { totalOrders: null },
          purchaseOverview: { totalOrders: null },
          afterSalesOverview: { financeReviewing: null },
          financeOverview: {
            pendingConfirmation: null,
            confirmedThisMonth: null,
            prepaidDeducted: null,
          },
        }),
      }),
    );

    render(<>{await AppFinancePage({})}</>);

    expect(screen.getAllByText('0')).toHaveLength(4);
  });
});
