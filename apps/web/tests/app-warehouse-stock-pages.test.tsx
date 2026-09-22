import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppWarehousesPage from '../app/app/warehouses/page';
import AppStockInPage from '../app/app/stock-in/page';
import AppStockOutPage from '../app/app/stock-out/page';

describe('warehouse and stock formal pages pagination', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes pagination params to warehouses api and renders pagination controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 21,
            code: 'WH-PAGE',
            name: 'Paged Warehouse',
            status: 'active',
            locationCount: 4,
            ownerName: 'Leo',
            updatedAt: '2026-07-16T08:00:00.000Z',
          },
        ],
        total: 21,
        page: 2,
        pageSize: 20,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppWarehousesPage({
          searchParams: Promise.resolve({
            page: '2',
            pageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/warehouses?page=2&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(screen.getByText('第 2 / 2 页，共 21 条')).toBeInTheDocument();
  });

  it('passes pagination params to stock-in api and renders pagination controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 621,
            docNo: 'SI202607160621',
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
            createdAt: '2026-07-16T09:00:00.000Z',
            updatedAt: '2026-07-16T09:15:00.000Z',
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
        total: 24,
        page: 2,
        pageSize: 20,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppStockInPage({
          searchParams: Promise.resolve({
            page: '2',
            pageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/stock-in?page=2&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(screen.getByText('第 2 / 2 页，共 24 条')).toBeInTheDocument();
  });

  it('passes pagination params to stock-out api and renders pagination controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 721,
            docNo: 'SO202607160721',
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
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:15:00.000Z',
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
        total: 39,
        page: 2,
        pageSize: 20,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppStockOutPage({
          searchParams: Promise.resolve({
            page: '2',
            pageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/stock-out?page=2&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(screen.getByText('第 2 / 2 页，共 39 条')).toBeInTheDocument();
  });
});
