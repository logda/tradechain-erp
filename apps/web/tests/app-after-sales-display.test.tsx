import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AfterSalesDetailPage from '../app/app/after-sales/[id]/page';

vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));

const detail = {
  id: 101, afterSalesNo: 'AS-DISPLAY-101', status: 'pending_submit', financeReviewStatus: 'pending',
  salesOrderId: 88 as number | undefined, purchaseOrderId: 21 as number | undefined,
  shipmentBatchId: 42 as number | undefined, type: 'shipment_damage',
  issueDescription: '外箱破损', rejectionReason: '补充损坏照片',
  items: [{ lineNo: 1, shipmentLineNo: 2, purchaseLineNo: 3, sourceSalesItemId: 4,
    productId: 501, sku: 'LED-001', productName: '灯带', unit: 'pcs', affectedQty: 2, shipmentQty: 10 }],
};
const sourceDetails: Record<string, object> = {
  '/sales-orders/88': { id: 88, salesNo: 'S-ACTUAL-88' },
  '/purchase-orders/21': { id: 21, purchaseNo: 'P-ACTUAL-21' },
  '/shipment-batches/42': { id: 42, batchNo: 'SH-ACTUAL-42' },
};
afterEach(() => vi.unstubAllGlobals());

async function show({ role = 'boss', modules, order = detail, sourceResponse }: {
  role?: string; modules?: string[]; order?: typeof detail;
  sourceResponse?: (path: string) => { ok: boolean; json: () => Promise<unknown> };
} = {}) {
  const fetchMock = vi.fn(async (input: unknown) => {
    const path = new URL(String(input)).pathname.replace('/api', '');
    if (path === '/after-sales/101') return { ok: true, json: async () => order };
    if (path === '/audit-logs') return { ok: true, json: async () => ({ modules: [], items: [] }) };
    return sourceResponse?.(path) ?? { ok: true, json: async () => sourceDetails[path] };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(await AfterSalesDetailPage({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({
    role, user: 'Leo', userId: '2002',
    ...(modules ? { access: JSON.stringify({ modules, dataScope: 'own_purchase', actions: ['after_sales.process'] }) } : {}),
  }) }));
  return fetchMock;
}

describe('售后详情来源展示', () => {
  it('shows actual source numbers in one chain and preserves the issue, product and submit payload', async () => {
    const fetchMock = await show();
    const sources = screen.getByRole('navigation', { name: '单据来源' });
    expect(within(sources).getByRole('link', { name: '销售单 S-ACTUAL-88' })).toHaveAttribute('href', '/app/sales/orders/88');
    expect(within(sources).getByRole('link', { name: '采购单 P-ACTUAL-21' })).toHaveAttribute('href', '/app/purchase-orders/21');
    expect(within(sources).getByRole('link', { name: '发货批次 SH-ACTUAL-42' })).toHaveAttribute('href', '/app/shipment-batches/42');
    for (const path of Object.keys(sourceDetails)) {
      expect(screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.endsWith(path.replace('/sales-orders', '/sales/orders')))).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(path), expect.objectContaining({
        cache: 'no-store', headers: expect.objectContaining({ 'x-erp-role': 'boss', 'x-erp-user-id': '2002' }),
      }));
    }
    expect(screen.getAllByText(/AS-DISPLAY-101/)).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: '链路追溯' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '查看发货追溯' })).not.toBeInTheDocument();
    expect(screen.getByText('外箱破损')).toBeInTheDocument();
    expect(screen.getByText('补充损坏照片')).toBeInTheDocument();
    expect(screen.getByText('灯带')).toBeInTheDocument();
    expect(screen.getByText('当前状态：pending_submit / 待提交')).toBeInTheDocument();
    expect(screen.getByText('财务复核：pending / 待确认')).toBeInTheDocument();
    expect(screen.getByText('关单条件：未满足')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交售后审批' }).closest('form')).toHaveFormValues({ currentStatus: 'pending_submit' });
  });

  it('does not fetch or link a sales source outside a purchase user module permissions', async () => {
    const fetchMock = await show({ role: 'purchase' });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/sales-orders/88'))).toBe(false);
    const sources = screen.getByRole('navigation', { name: '单据来源' });
    expect(within(sources).getByText('销售单 #88（无查看权限）')).toBeInTheDocument();
    expect(within(sources).queryByRole('link', { name: /销售单/ })).not.toBeInTheDocument();
    expect(within(sources).getByRole('link', { name: '采购单 P-ACTUAL-21' })).toBeInTheDocument();
    expect(within(sources).getByRole('link', { name: '发货批次 SH-ACTUAL-42' })).toBeInTheDocument();
  });

  it('respects explicit module scopes when resolving the source chain', async () => {
    const fetchMock = await show({ modules: ['operations'] });
    expect(fetchMock.mock.calls.some(([input]) => /\/(sales-orders|purchase-orders)\//.test(String(input)))).toBe(false);
    const sources = screen.getByRole('navigation', { name: '单据来源' });
    expect(within(sources).queryAllByRole('link')).toHaveLength(1);
    expect(within(sources).getByRole('link', { name: '发货批次 SH-ACTUAL-42' })).toBeInTheDocument();
  });

  it.each([
    ['forbidden', { ok: false, json: async (): Promise<unknown> => ({}) }],
    ['wrong document', { ok: true, json: async (): Promise<unknown> => ({ id: 999, salesNo: 'S-WRONG', purchaseNo: 'P-WRONG', batchNo: 'SH-WRONG' }) }],
    ['blank number', { ok: true, json: async (): Promise<unknown> => ({ id: 88, salesNo: '   ' }) }],
    ['malformed response', { ok: true, json: async (): Promise<unknown> => null }],
  ] as const)('shows a clear fallback instead of inventing source numbers on %s', async (_label, response) => {
    await show({ sourceResponse: () => response });
    const sources = screen.getByRole('navigation', { name: '单据来源' });
    expect(within(sources).getByRole('link', { name: '销售单 单号暂不可用 #88' })).toBeInTheDocument();
    expect(within(sources).getByRole('link', { name: '采购单 单号暂不可用 #21' })).toBeInTheDocument();
    expect(within(sources).getByRole('link', { name: '发货批次 单号暂不可用 #42' })).toBeInTheDocument();
    expect(sources).not.toHaveTextContent('WRONG');
  });

  it('does not fetch unrelated sources when no source is linked', async () => {
    const fetchMock = await show({ order: { ...detail, salesOrderId: undefined, purchaseOrderId: undefined, shipmentBatchId: undefined } });
    expect(fetchMock.mock.calls.some(([input]) => /\/(sales-orders|purchase-orders|shipment-batches)\//.test(String(input)))).toBe(false);
    expect(screen.queryByRole('navigation', { name: '单据来源' })).not.toBeInTheDocument();
  });

  it('preserves finance confirmation and closure gates', async () => {
    await show({ order: { ...detail, status: 'finance_reviewing' } });
    expect(screen.getByRole('button', { name: '财务确认' }).closest('form')).toHaveFormValues({
      currentStatus: 'finance_reviewing', financeReviewStatus: 'pending',
    });
    expect(screen.queryByRole('button', { name: '关闭售后' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '处理完成' })).toBeInTheDocument();
  });
});
