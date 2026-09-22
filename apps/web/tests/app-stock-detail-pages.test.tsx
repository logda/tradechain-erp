import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('formal stock detail pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal stock-in detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
        }),
      }),
    );

    const { default: AppStockInDetailPage } = await import(
      '../app/app/stock-in/[id]/page'
    );

    render(
      <>
        {await AppStockInDetailPage({
          params: Promise.resolve({ id: '601' }),
          searchParams: Promise.resolve({}),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '正式收货单详情' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式收货单列表' }),
    ).toHaveAttribute('href', '/app/stock-in');
    expect(screen.getByText('收货单 SI202607140601')).toBeInTheDocument();
    expect(screen.getByText('来源单号：P202607110100')).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
  });

  it('renders the formal stock-out detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
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
        }),
      }),
    );

    const { default: AppStockOutDetailPage } = await import(
      '../app/app/stock-out/[id]/page'
    );

    render(
      <>
        {await AppStockOutDetailPage({
          params: Promise.resolve({ id: '701' }),
          searchParams: Promise.resolve({}),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '正式出库单详情' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式出库单列表' }),
    ).toHaveAttribute('href', '/app/stock-out');
    expect(screen.getByText('出库单 SO202607140701')).toBeInTheDocument();
    expect(screen.getByText('来源单号：S202607080088')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
  });
});
