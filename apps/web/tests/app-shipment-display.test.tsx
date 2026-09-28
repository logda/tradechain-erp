import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShipmentPage from '../app/app/shipment-batches/[id]/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(), usePathname: () => '/app/shipment-batches/101',
}));

const shipment = {
  id: 101, batchNo: 'SH2609280101', status: 'forwarder_shipped', receiptSendStatus: 'pending',
  salesOrderId: 88, purchaseOrderId: 21, hasException: true, exceptionReason: '物流延误',
  receiptDocUrl: 'https://files.example.com/receipt-101.pdf', customerName: 'Acme',
  destination: '上海仓', shippingCode: 'SHIP-1', factoryShipDate: '2026-09-28',
  items: [{ lineNo: 1, purchaseLineNo: 2, sourceSalesItemId: 31, productId: 501,
    sku: 'SKU-LED-1', productName: '灯带', unit: 'set', shippedQty: 40, purchaseQty: 500 }],
};

function stubSources(sales: unknown = { id: 88, salesNo: 'S2609280088' }, purchase: unknown = { id: 21, purchaseNo: 'P2609280021' }) {
  const fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/shipment-batches/101')) return { ok: true, json: async () => shipment };
    const source = url.endsWith('/sales-orders/88') ? sales : url.endsWith('/purchase-orders/21') ? purchase : undefined;
    if (source instanceof Error) throw source;
    if (source === null) return { ok: false, status: 503, json: async () => null };
    return { ok: true, json: async () => source ?? { items: [], count: 0, modules: [] } };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function show(modules = ['sales', 'purchase', 'operations']) {
  return ShipmentPage({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({
    role: 'purchase', user: '当前采购员', userId: '77',
    access: JSON.stringify({ modules, dataScope: 'own_purchase', actions: [] }),
  }) });
}

beforeEach(() => { sessionStorage.clear(); history.replaceState({}, '', '/app/shipment-batches/101'); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('发货详情展示与来源', () => {
  it('uses actual source numbers with one link per source and a batch-number tab', async () => {
    const fetch = stubSources();
    await act(async () => { render(await show()); });
    expect(screen.getByRole('link', { name: '销售单 S2609280088' })).toHaveAttribute('href', '/app/sales/orders/88');
    expect(screen.getByRole('link', { name: '采购单 P2609280021' })).toHaveAttribute('href', '/app/purchase-orders/21');
    expect(document.querySelectorAll('a[href="/app/sales/orders/88"]')).toHaveLength(1);
    expect(document.querySelectorAll('a[href="/app/purchase-orders/21"]')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'SH2609280101' })).toHaveAttribute('href', '/app/shipment-batches/101');
    for (const path of ['/sales-orders/88', '/purchase-orders/21']) {
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${path}$`)), expect.objectContaining({
        cache: 'no-store', headers: expect.objectContaining({ 'x-erp-user-id': '77', 'x-erp-data-scope': 'own_purchase' }),
      }));
    }
  });

  it.each([
    { modules: ['sales'], allowed: '/sales-orders/88', denied: '/purchase-orders/21', plain: '采购单 #21' },
    { modules: ['purchase', 'operations'], allowed: '/purchase-orders/21', denied: '/sales-orders/88', plain: '销售单 #88' },
    { modules: ['operations'], allowed: '', denied: '/sales-orders/88', plain: '销售单 #88' },
  ])('does not read sources outside $modules access', async ({ modules, allowed, denied, plain }) => {
    const fetch = stubSources();
    const page = await show(modules);
    const calls = fetch.mock.calls.map(([url]) => String(url));
    expect(calls.some(url => url.endsWith(denied))).toBe(false);
    if (allowed) expect(calls.some(url => url.endsWith(allowed))).toBe(true);
    else expect(calls.some(url => url.endsWith('/purchase-orders/21'))).toBe(false);
    await act(async () => { render(page); });
    expect(screen.getByText(plain)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: plain })).not.toBeInTheDocument();
  });

  it.each([
    { sales: null, purchase: new Error('offline'), reason: 'fetch failure' },
    { sales: { id: 999, salesNo: 'WRONG-SALE' }, purchase: { id: 21, purchaseNo: ' ' }, reason: 'invalid source details' },
  ])('shows an explicit number-unavailable fallback for $reason', async ({ sales, purchase }) => {
    stubSources(sales, purchase);
    await act(async () => { render(await show()); });
    expect(screen.getByRole('link', { name: '销售单 单号暂不可用 #88' })).toHaveAttribute('href', '/app/sales/orders/88');
    expect(screen.getByRole('link', { name: '采购单 单号暂不可用 #21' })).toHaveAttribute('href', '/app/purchase-orders/21');
    expect(screen.queryByText('WRONG-SALE')).not.toBeInTheDocument();
  });

  it('puts shipped items before the folded ledger and retains receipt and exception information once', async () => {
    stubSources();
    await act(async () => { render(await show()); });
    const items = screen.getByRole('heading', { name: '发货明细' });
    const ledger = screen.getByText('发货台账字段').closest('details');
    expect(ledger).not.toBeNull();
    expect(ledger).not.toHaveAttribute('open');
    expect(items.compareDocumentPosition(ledger!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('SKU-LED-1')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText('物流延误')).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: shipment.receiptDocUrl })).toHaveLength(1);
    expect(screen.queryByText(/当前页面已经接通|售后入口会自动携带/)).not.toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: '订单号 Order No' })).not.toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: '批次编号 Batch No' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('发货台账字段'));
    expect(within(ledger!).getByText('SHIP-1')).toBeInTheDocument();
    expect(within(ledger!).getByText('上海仓')).toBeInTheDocument();
    expect(within(ledger!).getByText('Acme')).toBeInTheDocument();
  });
});
