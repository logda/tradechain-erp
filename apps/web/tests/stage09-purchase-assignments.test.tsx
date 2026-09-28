import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseAssignmentsPage from '../app/app/purchase-orders/assignments/page';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('stage 09 purchase assignment page', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows pending sales and purchaser choices to a purchase manager', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: async () => String(input).includes('owner-options')
          ? [{ id: 2002, realName: 'Leo', status: 'active' }]
          : [{ id: 901, salesNo: 'S2609250901', title: 'New order', customerName: 'Customer' }],
      }),
    ));
    const access = JSON.stringify({
      modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
    });
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'purchase_manager', user: 'Manager', access,
    }) })}</>);
    expect(screen.getByText('S2609250901')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '指定并生成采购单' })).toBeInTheDocument();
  });

  it('does not load pending assignments for sales managers', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'sales_manager', user: 'Sales Manager',
    }) })}</>);
    expect(screen.getByText('当前角色无权分配采购负责人。')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a sourced purchaser fixed if purchase creation needs a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => Promise.resolve({
      ok: true,
      json: async () => String(input).includes('owner-options')
        ? [
          { id: 2002, realName: 'Leo', status: 'active' },
          { id: 2003, realName: 'Nina', status: 'active' },
        ]
        : [{ id: 901, salesNo: 'S2609250901', title: 'New order', customerName: 'Customer', purchaseOwnerName: 'Leo' }],
    })));
    const access = JSON.stringify({
      modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'],
    });
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve({
      role: 'purchase_manager', user: 'Manager', access,
    }) })}</>);
    expect(screen.getByRole('option', { name: 'Leo' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Nina' })).not.toBeInTheDocument();
  });

  const managerParams = {
    role: 'purchase_manager', user: 'Manager', userId: '2010',
    access: JSON.stringify({ modules: ['purchase'], dataScope: 'purchase_team', actions: ['purchase.order.approve'] }),
  };
  const order = {
    id: 901, salesNo: 'S901', title: 'Order A', customerName: 'Customer A', salesUserId: 2001, salesUserName: 'Sales A',
    customerOrderNo: 'PO-A', orderingUnit: 'Branch A', storeName: 'Online',
    orderDate: '2026-09-28', estimatedDeliveryDate: '2026-10-10', shipTo: 'Shanghai', salesOrderRemark: 'Use blue cartons',
    salesOrderAttachments: [{ fileName: 'spec.pdf', url: '/files/spec.pdf' }],
    items: [{ lineNo: 1, sku: 'FAN-A', productName: 'Fan A', quantity: 12, packageQuantity: 2, unitsPerPackage: 6, totalQuantity: 12, unit: '个' }],
  };
  const inquiry = {
    id: 801, inquiryNo: 'IQ801', status: 'boss_confirmed', quoteOrderNo: 'BJ701', quoteVersionNo: 2,
    customerName: 'Customer A', createdBy: 'Sales A', comparisonSubmittedBy: 'Leo', comparisonSummary: 'Factory A selected',
    items: [{ lineNo: 1, sku: 'FAN-A', productName: 'Fan A', confirmedSupplierName: 'Factory A', confirmedPurchasePrice: 0,
      supplierQuotes: [{ supplierName: 'Factory A', purchasePrice: 0, bulkLeadTimeDays: '7', remark: 'Including packaging' }] }],
  };
  function mockData(assignments: unknown, inquiryResponse: unknown = inquiry, inquiryOk = true) {
    const fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
      ok: String(input).includes('/quote-inquiries/') ? inquiryOk : true,
      json: async () => String(input).includes('owner-options') ? [{ id: 2002, realName: 'Leo', status: 'active' }]
        : String(input).includes('/quote-inquiries/') ? inquiryResponse : assignments,
    }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('shows usernames for owners and inquiry users while submitting the original owner ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({ ok: true,
      json: async () => String(input).includes('owner-options')
        ? [{ id: 4, username: 'leo', realName: '采购姓名', status: 'active' }]
        : String(input).includes('/quote-inquiries/')
        ? { ...inquiry, userDisplayNames: { createdBy: 'zoe', comparisonSubmittedBy: 'leo' } }
        : [{ ...order, sourceInquiryId: 801, salesUserName: '用户 #2000', userDisplayNames: { salesUserName: 'mia' } }],
    })));
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    expect(screen.getByText('mia')).toBeInTheDocument();
    expect(screen.getByText(/创建人：zoe · 比价提交人：leo/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'leo' })).toHaveValue('4');
    expect(screen.queryByText('用户 #2000')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '采购姓名' })).not.toBeInTheDocument();
  });

  it('shows order, delivery and product context before assignment without requesting a forbidden sales detail', async () => {
    const fetch = mockData([order]);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    for (const text of ['PO-A', 'Branch A', 'Online', '2026-09-28', '2026-10-10', 'Shanghai', 'Use blue cartons', 'Sales A']) {
      expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    }
    const products = screen.getByRole('table', { name: '销售单产品明细' });
    expect(within(products).getByText('FAN-A')).toBeInTheDocument();
    expect(within(products).getByText('Fan A')).toBeInTheDocument();
    expect(within(products).getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'spec.pdf' })).toHaveAttribute('href', '/files/spec.pdf');
    expect(screen.queryByRole('link', { name: '查看销售单' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shows the actual linked inquiry and supplier comparison using the same purchase session', async () => {
    const fetch = mockData([{ ...order, sourceInquiryId: 801 }]);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    expect(screen.getByRole('link', { name: '查看询价单 IQ801' })).toHaveAttribute('href', '/app/sales/inquiries/801');
    expect(screen.getByText(/老板已确认/)).toBeInTheDocument();
    expect(screen.getByText('Factory A selected')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: '来源询价供应商报价' });
    expect(within(table).getByText('Factory A：0')).toBeInTheDocument();
    expect(within(table).getByText('交期：7 天')).toBeInTheDocument();
    expect(within(table).getByText('Including packaging')).toBeInTheDocument();
    expect(within(table).getByText('Factory A / 0')).toBeInTheDocument();
    const request = fetch.mock.calls.find(([input]) => String(input).includes('/quote-inquiries/801'));
    expect(request?.[1].headers).toMatchObject({ 'x-erp-role': 'purchase_manager', 'x-erp-data-scope': 'purchase_team', 'x-erp-user-id': '2010' });
  });

  it.each([
    ['permission failure', inquiry, false],
    ['wrong inquiry', { ...inquiry, id: 802, inquiryNo: 'IQ802' }, true],
    ['invalid inquiry', {}, true],
  ])('shows a retry instead of a missing-inquiry empty state on %s', async (_, response, ok) => {
    mockData([{ ...order, sourceInquiryId: 801 }], response, ok as boolean);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    expect(screen.getByRole('alert')).toHaveTextContent('来源询价暂不可用');
    expect(screen.getByRole('button', { name: '重试来源询价' })).toBeInTheDocument();
    expect(screen.queryByText('未记录关联询价单')).not.toBeInTheDocument();
    expect(screen.queryByText('IQ802')).not.toBeInTheDocument();
    expect(screen.getByText('Fan A')).toBeInTheDocument();
  });

  it('keeps inquiry information with its own order', async () => {
    mockData([{ ...order, sourceInquiryId: 801 }, { ...order, id: 902, salesNo: 'S902', customerName: 'Customer B' }]);
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    const secondOrder = screen.getByRole('heading', { name: 'S902' }).closest('article')!;
    expect(within(secondOrder).queryByRole('link', { name: '查看询价单 IQ801' })).not.toBeInTheDocument();
    expect(within(secondOrder).getByText('未记录关联询价单')).toBeInTheDocument();
  });

  it('shows a retry for malformed pending data rather than claiming there are no orders', async () => {
    mockData({ error: 'unavailable' });
    render(<>{await PurchaseAssignmentsPage({ searchParams: Promise.resolve(managerParams) })}</>);
    expect(screen.getByRole('button', { name: '重试待分配数据' })).toBeInTheDocument();
    expect(screen.queryByText('当前没有待分配的销售单。')).not.toBeInTheDocument();
  });
});
