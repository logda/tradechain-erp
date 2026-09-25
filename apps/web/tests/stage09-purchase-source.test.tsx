import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppPurchaseOrderDetailPage from '../app/app/purchase-orders/[id]/page';

afterEach(() => vi.unstubAllGlobals());

it('shows linked inquiry comparison below purchase information only at manager approval', async () => {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const data = url.endsWith('/purchase-orders/502')
      ? {
        id: 502, purchaseNo: 'C502', status: 'pending_purchase_manager_approval',
        currentVersionNo: 1, sourceSalesOrderId: 901, salesOrderNo: 'S901',
        sourceInquiryId: 801, ownerName: 'Leo', supplierName: 'Factory A', items: [],
      }
      : url.endsWith('/purchase-orders/502/source-inquiry')
        ? {
          inquiryNo: 'IQ801', quoteOrderNo: 'XQ701', customerName: 'Customer',
          comparisonSubmittedBy: 'Leo', items: [{
            lineNo: 1, sku: '', productName: 'Product',
            supplierQuotes: [{ supplierName: 'Factory A', purchasePrice: 9 }],
            confirmedSupplierName: 'Factory A', confirmedPurchasePrice: 9,
          }],
        }
        : { items: [], total: 0 };
    return Promise.resolve({ ok: true, json: async () => data });
  });
  vi.stubGlobal('fetch', fetchMock);
  const access = JSON.stringify({
    modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
  });
  render(<>{await AppPurchaseOrderDetailPage({
    params: Promise.resolve({ id: '502' }),
    searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Manager', access }),
  })}</>);
  expect(screen.getByRole('heading', { name: '来源询价' })).toBeInTheDocument();
  expect(screen.getByText(/IQ801 · 客户 Customer/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/purchase-orders/502/source-inquiry'),
    expect.any(Object),
  );
  cleanup();
  fetchMock.mockClear();
  render(<>{await AppPurchaseOrderDetailPage({
    params: Promise.resolve({ id: '502' }),
    searchParams: Promise.resolve({ role: 'purchase', user: 'Leo', access: JSON.stringify({
      modules: ['purchase'], dataScope: 'own', actions: ['purchase.order.submit'],
    }) }),
  })}</>);
  expect(screen.queryByRole('heading', { name: '来源询价' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/source-inquiry'))).toBe(false);
});
