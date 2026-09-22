import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppStockInPage from '../app/app/stock-in/page';
import AppStockOutPage from '../app/app/stock-out/page';

describe('formal stock pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal stock-in list page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 601,
              docNo: 'SI202607140601',
              status: 'confirmed',
              sourceBizType: 'purchase_order',
              sourceBizId: 100,
              sourceDocNo: 'P202607110100',
              warehouseId: 1,
              warehouseName: 'Main Warehouse',
              locationId: 11,
              locationName: 'A-01',
              createdBy: 2002,
              createdByName: 'Leo',
              createdAt: '2026-07-14T09:00:00.000Z',
              updatedAt: '2026-07-14T09:15:00.000Z',
              items: [
                {
                  productId: 1,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  quantity: 40,
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      }),
    );

    render(<>{await AppStockInPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '正式收货单' })).toBeInTheDocument();
    expect(screen.getByText('SI202607140601')).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        element?.textContent?.includes('Main Warehouse / A-01') ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: '查看详情 SI202607140601' }),
    ).toHaveAttribute('href', '/app/stock-in/601');
  });

  it('renders the formal stock-out list page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 701,
              docNo: 'SO202607140701',
              status: 'confirmed',
              sourceBizType: 'sales_order',
              sourceBizId: 88,
              sourceDocNo: 'S202607080088',
              warehouseId: 1,
              warehouseName: 'Main Warehouse',
              locationId: 11,
              locationName: 'A-01',
              createdBy: 2002,
              createdByName: 'Leo',
              createdAt: '2026-07-14T10:00:00.000Z',
              updatedAt: '2026-07-14T10:15:00.000Z',
              items: [
                {
                  productId: 1,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  quantity: 10,
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      }),
    );

    render(<>{await AppStockOutPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '正式出库单' })).toBeInTheDocument();
    expect(screen.getByText('SO202607140701')).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        element?.textContent?.includes('sales_order') ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: '查看详情 SO202607140701' }),
    ).toHaveAttribute('href', '/app/stock-out/701');
  });
});
