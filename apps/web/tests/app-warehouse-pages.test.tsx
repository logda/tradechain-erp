import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppWarehousesPage from '../app/app/warehouses/page';

describe('warehouse pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the warehouse master page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 1,
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            status: 'active',
            locationCount: 2,
            ownerName: 'Leo',
            updatedAt: '2026-07-14T08:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppWarehousesPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/warehouses?page=1&pageSize=20',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '仓库中心' })).toBeInTheDocument();
    expect(screen.getByText('WH-MAIN')).toBeInTheDocument();
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '库存中心' })).toHaveAttribute(
      'href',
      '/app/inventory?role=boss&user=Mia',
    );
  });

  it('renders zeros instead of fallback mock warehouses when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('warehouse api down')));

    render(
      <>
        {await AppWarehousesPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '仓库中心' })).toBeInTheDocument();
    expect(screen.queryByText('WH-MAIN', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.queryByText('Main Warehouse', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getAllByText('0')).not.toHaveLength(0);
  });

  it('normalizes missing warehouse counts to zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 1,
              code: 'WH-ZERO',
              name: 'Zero Warehouse',
              status: 'active',
              locationCount: null,
              ownerName: 'Leo',
              updatedAt: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      }),
    );

    render(
      <>
        {await AppWarehousesPage({ searchParams: Promise.resolve({}) })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '仓库中心' })).toBeInTheDocument();
    expect(screen.getByText('WH-ZERO')).toBeInTheDocument();
    expect(screen.getAllByText('0', { selector: 'td' })).not.toHaveLength(0);
    expect(screen.getAllByText('-', { selector: 'td' })).not.toHaveLength(0);
  });
});
