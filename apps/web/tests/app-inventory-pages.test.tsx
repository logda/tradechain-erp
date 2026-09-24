import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppInventoryPage from '../app/app/inventory/page';

describe('inventory pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the inventory balance page', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/inventory/ledger')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                movementType: 'stock_in_confirmed',
                sourceBizType: 'purchase_order',
                sourceDocNo: 'P202607110100',
                productId: 1,
                sku: 'SKU-LED-001',
                warehouseName: 'Main Warehouse',
                locationName: 'A-01',
                quantityDelta: 40,
                createdAt: '2026-07-14T08:30:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              warehouseId: 1,
              warehouseName: 'Main Warehouse',
              locationId: 11,
              locationName: 'A-01',
              onHandQty: 40,
              availableQty: 40,
                updatedAt: '2026-07-14T08:30:00.000Z',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppInventoryPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/inventory/balances?page=1&pageSize=20',
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
      'http://127.0.0.1:3001/api/inventory/ledger?page=1&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '库存中心' })).toBeInTheDocument();
    expect(screen.getAllByText('SKU-LED-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Main Warehouse').length).toBeGreaterThan(0);
    expect(screen.getByText('stock_in_confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '仓库中心' })).toHaveAttribute(
      'href',
      '/app/warehouses',
    );
  });

  it('renders empty live inventory instead of fallback mock data when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('inventory api down')));

    render(
      <>
        {await AppInventoryPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '库存中心' })).toBeInTheDocument();
    expect(screen.queryByText('SKU-LED-001', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.queryByText('stock_in_confirmed', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });

  it('normalizes missing inventory quantities to zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/inventory/ledger')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1,
                  movementType: 'manual_adjust_increase',
                  sourceBizType: 'purchase_order',
                  sourceDocNo: 'P202607110101',
                  productId: 1,
                  sku: 'SKU-LED-001',
                  warehouseName: 'Main Warehouse',
                  locationName: 'A-01',
                  quantityDelta: null,
                  createdAt: null,
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                warehouseId: 1,
                warehouseName: 'Main Warehouse',
                locationId: 11,
                locationName: 'A-01',
                onHandQty: null,
                availableQty: null,
                updatedAt: null,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>
        {await AppInventoryPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(screen.getAllByText('0', { selector: 'span' })).toHaveLength(3);
    expect(screen.getAllByText('-', { selector: 'td' })).not.toHaveLength(0);
  });

  it('passes independent pagination params to balances and ledger apis', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/inventory/ledger')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 21,
                movementType: 'stock_out_confirmed',
                sourceBizType: 'sales_order',
                sourceDocNo: 'S202607160021',
                productId: 1,
                sku: 'SKU-LED-001',
                warehouseName: 'Main Warehouse',
                locationName: 'A-01',
                quantityDelta: -10,
                createdAt: '2026-07-16T08:30:00.000Z',
              },
            ],
            total: 41,
            page: 3,
            pageSize: 20,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              warehouseId: 1,
              warehouseName: 'Main Warehouse',
              locationId: 11,
              locationName: 'A-01',
              onHandQty: 40,
              availableQty: 30,
              updatedAt: '2026-07-16T08:30:00.000Z',
            },
          ],
          total: 25,
          page: 2,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppInventoryPage({
          searchParams: Promise.resolve({
            balancePage: '2',
            balancePageSize: '20',
            ledgerPage: '3',
            ledgerPageSize: '20',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/inventory/balances?page=2&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3001/api/inventory/ledger?page=3&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
      }),
    );
    expect(screen.getByText('库存余额：第 2 / 2 页，共 25 条')).toBeInTheDocument();
    expect(screen.getByText('库存台账：第 3 / 3 页，共 41 条')).toBeInTheDocument();
  });
});
