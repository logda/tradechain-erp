import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppReportsPage from '../app/app/reports/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const gross = {
  generatedAt: '2026-09-28T08:00:00.000Z', currency: null,
  totalRevenue: null, totalProcurementCost: null, totalAfterSalesCost: null,
  grossProfit: null, grossMargin: null, amountDifference: null,
  calculationStatus: 'incomplete', missingCosts: ['after_sales', 'freight'], unknownCurrencyCount: 1,
  sourceDocuments: [{ id: 101, bizType: 'sales_order', docNo: 'S-101', status: 'purchasing', amount: 120, currency: null, href: '/app/sales/orders/101' }],
};
const period = {
  generatedAt: '2026-09-28T08:00:00.000Z', period: '2026-08', timeZone: 'Asia/Shanghai',
  periodBasis: 'created_business_documents', salesOrdersCreated: 1, purchaseOrdersCreated: 0,
  shipmentBatchesCreated: 0, afterSalesCreated: 0, closedOrders: 0, reopenedApprovals: 2,
  reopenedApprovalEvents: [{ salesOrderId: 101, docNo: 'S-101', href: '/app/sales/orders/101', createdAt: '2026-08-12T01:00:00.000Z' }, { salesOrderId: 101, docNo: 'S-101', href: '/app/sales/orders/101', createdAt: '2026-08-13T01:00:00.000Z' }],
  undatedCounts: { sales_order: 0, purchase_order: 1, shipment_batch: 0, after_sales: 0 },
  sourceDocuments: [{ id: 101, bizType: 'sales_order', docNo: 'S-101', status: 'purchasing', href: '/app/sales/orders/101' }],
};
function reports(grossValue: unknown = gross, periodValue: unknown = period) {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => grossValue })
    .mockResolvedValueOnce({ ok: true, json: async () => periodValue });
  vi.stubGlobal('fetch', fetch); return fetch;
}
async function mount(params: Record<string, string> = { period: '2026-08' }) {
  render(<>{await AppReportsPage({ searchParams: Promise.resolve(params) })}</>);
  await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
}
beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('报表来源、期间与未完整成本', () => {
  it('requests the selected month with signed identity and links to real sources', async () => {
    const fetch = reports();
    await mount({ period: '2026-08', access: encodeURIComponent(JSON.stringify({ modules: ['boss_dashboard'], dataScope: 'own_sales' })) });
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:3001/api/reports/period-summary?period=2026-08',
      expect.objectContaining({ cache: 'no-store', headers: expect.objectContaining({ 'x-erp-role': 'boss', 'x-erp-user': 'Mia' }) }));
    expect(screen.getByLabelText('创建月份（口径待确认）')).toHaveValue('2026-08');
    expect(screen.getAllByText(/数据范围：我的销售/)).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'S-101' }).every(link => link.getAttribute('href') === '/app/sales/orders/101')).toBe(true);
    expect(screen.queryByRole('link', { name: '毛利报表' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '期间汇总' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售单明细' })).toHaveAttribute('href', '/app/sales/orders');
    expect(screen.getByRole('link', { name: '采购单明细' })).toHaveAttribute('href', '/app/purchase-orders');
    expect(screen.getByRole('link', { name: '发货单明细' })).toHaveAttribute('href', '/app/shipment-batches');
    expect(screen.getByRole('link', { name: '回款待确认' })).toHaveAttribute('href', '/app/sales/orders?financeConfirmStatus=pending');
    expect(screen.getByRole('link', { name: '经营看板' })).toHaveAttribute('href', '/app/dashboard/boss');
    expect(screen.getByText(/1 张单据缺少可靠创建时间/)).toBeInTheDocument();
  });
  it('shows missing costs and unknown currencies without pretending gross profit is zero', async () => {
    reports(); await mount();
    expect(screen.getByText(/售后成本、运费等费用未计入/)).toBeInTheDocument();
    expect(screen.getByText(/1 张单据未登记币种/)).toBeInTheDocument();
    expect(screen.getAllByText('待确认').length).toBeGreaterThan(0);
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.getByText('销售重提次数')).toBeInTheDocument();
    expect(screen.getByText(/按重提事件发生时间统计/)).toBeInTheDocument();
    expect(screen.getByText('核对销售重提记录（2 次）')).toBeInTheDocument();
  });
  it('treats malformed or failed reports as errors, without a false empty state or update time', async () => {
    reports({}, {}); await mount();
    expect(screen.getByText(/毛利统计暂不可用/)).toBeInTheDocument();
    expect(screen.getByText(/期间统计暂不可用/)).toBeInTheDocument();
    expect(screen.queryByText(/暂无期间单据/)).not.toBeInTheDocument();
    expect(screen.queryByText(/数据更新时间/)).not.toBeInTheDocument();
  });
  it('keeps a real empty month and the API update time distinct from failure', async () => {
    reports(gross, { ...period, salesOrdersCreated: 0, reopenedApprovals: 0, sourceDocuments: [], reopenedApprovalEvents: [], undatedCounts: {} });
    await mount();
    expect(screen.getByText('暂无期间单据')).toBeInTheDocument();
    expect(screen.queryByText(/期间统计暂不可用/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('time[datetime="2026-09-28T08:00:00.000Z"]').length).toBe(2);
  });
  it('preserves source calculation precision instead of rounding each document before the total', async () => {
    reports({ ...gross, currency: 'USD', unknownCurrencyCount: 0, totalRevenue: 0.01,
      sourceDocuments: [{ id: 101, bizType: 'sales_order', docNo: 'S-PRECISION', status: 'purchasing', href: '/app/sales/orders/101', amount: 0.0004, currency: 'USD' }] });
    await mount();
    expect(screen.getByRole('cell', { name: '0.0004' })).toBeInTheDocument();
    expect(screen.getByText(/来源保留快照计算精度，汇总累计后保留 2 位/)).toBeInTheDocument();
  });
  it('does not fetch reports for a role without report access', async () => {
    const fetch = reports(); await mount({ role: 'sales', user: 'Alice' });
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/reports/'))).toBe(false);
    expect(screen.getByRole('heading', { name: '无权限访问报表中心' })).toBeInTheDocument();
  });
});
