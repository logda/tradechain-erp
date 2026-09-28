import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PurchaseOrderDetailPage from '../app/app/purchase-orders/[id]/page';
import AfterSalesDetailPage from '../app/app/after-sales/[id]/page';
import ShipmentBatchDetailPage from '../app/app/shipment-batches/[id]/page';

const purchase = {
  id: 101, purchaseNo: 'C2609280101', status: 'pending_purchase_manager_approval',
  currentVersionNo: 1, sourceSalesOrderId: 88, salesOrderNo: 'S2609280088',
  currentBatchCount: 0, supplierName: '供应商', ownerName: '采购员', items: [], versionHistory: [],
};
const afterSales = {
  id: 101, afterSalesNo: 'AS2609280101', status: 'pending_approval', financeReviewStatus: 'pending',
  salesOrderId: 88, purchaseOrderId: 21, shipmentBatchId: 100,
  type: 'refund', issueDescription: '申请退款', items: [],
};
const shipment = {
  id: 101, batchNo: 'SH2609280101', status: 'shipped', receiptSendStatus: 'pending',
  salesOrderId: 88, purchaseOrderId: 21, hasException: false, items: [],
};
const cases = [
  { name: 'purchase rejection', Page: PurchaseOrderDetailPage, detail: purchase, path: '/purchase-orders/101', action: '/reject', button: '驳回采购审批', input: 'rejectionReason', label: '驳回修改要求', stored: 'rejectionReason' },
  { name: 'after-sales rejection', Page: AfterSalesDetailPage, detail: afterSales, path: '/after-sales/101', action: '/reject', button: '驳回重提', input: 'rejectionReason', label: '驳回修改要求', stored: 'rejectionReason' },
  { name: 'shipment exception', Page: ShipmentBatchDetailPage, detail: shipment, path: '/shipment-batches/101', action: '/mark-exception', button: '标记异常', input: 'reason', label: '异常原因', stored: 'exceptionReason' },
] as const;

afterEach(() => vi.unstubAllGlobals());

function stubDetail(path: string, detail: unknown) {
  const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') return { ok: true, json: async () => ({ id: 101, status: 'draft' }) };
    return {
      ok: true,
      json: async () => String(input).endsWith(path) ? detail : { items: [], total: 0, page: 1, pageSize: 20, count: 0, modules: [] },
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe.each(cases)('$name reason form', ({ Page, detail, path, action, button, input, label, stored }) => {
  it('requires a visible, initially empty reason and sends the actual user input', async () => {
    const fetchMock = stubDetail(path, detail);
    render(await Page({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'admin', user: 'Admin' }) }));
    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    const reasonInput = screen.getByRole('textbox', { name: new RegExp(`^${label}`) });
    expect(reasonInput).toBeRequired();
    expect(reasonInput).toHaveValue('');
    fireEvent.change(reasonInput, { target: { value: '物流延误，请补充预计到货时间' } });
    fireEvent.submit(screen.getByRole('button', { name: button }).closest('form')!);
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith(`${path}${action}`) && init?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ [input]: '物流延误，请补充预计到货时间' });
    });
  });

  it('shows persisted instructions/reason to readers without audit access', async () => {
    stubDetail(path, { ...detail, [stored]: '请补充退款明细后再提交', hasException: true });
    const access = encodeURIComponent(JSON.stringify({ modules: ['purchase', 'operations'], dataScope: 'all', actions: [] }));
    render(await Page({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'purchase', user: 'Leo', access }) }));
    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByText('请补充退款明细后再提交')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: button })).not.toBeInTheDocument();
  });
});
