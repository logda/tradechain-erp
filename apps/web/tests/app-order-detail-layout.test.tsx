import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesOrderDetailPage from '../app/app/sales/orders/[id]/page';
import PurchaseOrderDetailPage from '../app/app/purchase-orders/[id]/page';

vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));

const access = JSON.stringify({ modules: ['sales', 'purchase', 'operations'], dataScope: 'all', actions: ['sales.order.write', 'purchase.order.approve', 'purchase.order.submit', 'finance.confirm', 'audit.view'] });
const sales = {
  id: 101, salesNo: 'S-M24-101', title: 'Acme 秋季补货', status: 'pending_sales_manager_approval',
  currentVersionNo: 2, purchaseAggregateStatus: 'not_started', shipmentAggregateStatus: 'not_started',
  receiptStatus: 'deposit_received', financeStatus: 'pending', receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started',
  customerName: 'Acme客户', orderingUnit: 'Acme客户', salesUserId: 2001, createdBy: 2001,
  estimatedDeliveryDate: '2026-10-10', shipTo: '上海', rejectionReason: '请核对合同单价',
  sourceQuoteOrderId: 77, sourceQuoteVersionNo: 1, sourceQuoteNo: 'Q77',
  items: [{ lineNo: 1, productId: 5, sku: 'SKU5', productName: '灯带', unit: 'pcs', quantity: 10, salePrice: 10, amount: 100 }],
  versionHistory: [{ versionNo: 1, status: 'draft', createdAt: '2026-09-27T10:00:00.000Z', changeReason: '首次建单' }],
};
const purchase = {
  id: 101, purchaseNo: 'P-M24-101', title: '采购灯带', status: 'pending_purchase_manager_approval',
  currentVersionNo: 2, sourceSalesOrderId: 101, salesOrderNo: 'S-M24-101', supplierId: 30, supplierName: '星河工厂',
  ownerId: 2002, ownerName: 'Leo', currentBatchCount: 0, createdBy: 2002,
  factoryEstimatedDeliveryDate: '2026-10-09', shipTo: '上海仓库', rejectionReason: '请核对供应商交期',
  sourceInquiryId: 12,
  items: [1, 2].map((lineNo) => ({ lineNo, sourceSalesItemId: lineNo, supplierId: 30, productId: lineNo,
    sku: `SKU${lineNo}`, productName: `灯带${lineNo}`, unit: 'pcs', quantity: 10, unitPrice: 5, amount: 50,
    factoryEstimatedDeliveryDate: '2026-10-09', shipTo: '上海仓库', domesticFreight: lineNo * 20 })),
  versionHistory: [{ versionNo: 1, status: 'draft', createdAt: '2026-09-27T10:00:00.000Z', changeReason: '首次建单' }],
};

function stub(detail: typeof sales | typeof purchase, bizType: 'sales_order' | 'purchase_order', auditFailed = false) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/audit-logs')) return { ok: !auditFailed, json: async () => ({ modules: [], items: [
      { id: 1, bizType, bizId: 101, operationType: 'create', operatorId: 2001, operatorName: '经办人',
        beforeData: null, afterData: { status: 'draft' }, createdAt: '2026-09-27T10:00:00.000Z', moduleKey: 'document', moduleLabel: '单据' },
    ] }) };
    if (url.includes('/cost-warning')) return { ok: true, json: async () => ({ productNames: ['灯带'] }) };
    if (url.includes('/source-inquiry')) return { ok: true, json: async () => ({ inquiryNo: 'INQ12', quoteOrderNo: 'Q77', customerName: 'Acme客户', items: [] }) };
    if (url.endsWith('/sales-orders/101') || url.endsWith('/purchase-orders/101')) return { ok: true, json: async () => detail };
    return { ok: true, json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }) };
  }));
}

function before(first: Element, next: Element) {
  expect(first.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}
async function showSales(detail = sales, auditFailed = false) {
  stub(detail, 'sales_order', auditFailed);
  return render(await SalesOrderDetailPage({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'boss', user: 'Mia', access }) }));
}
async function showPurchase(detail = purchase, auditFailed = false) {
  stub(detail, 'purchase_order', auditFailed);
  return render(await PurchaseOrderDetailPage({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'boss', user: 'Mia', access }) }));
}
afterEach(() => vi.unstubAllGlobals());

describe('销售采购详情当前任务布局', () => {
  it('shows one sales summary and puts warnings and approval before line items and history', async () => {
    await showSales();
    const summary = screen.getByRole('article', { name: '销售单摘要' });
    expect(summary).toHaveTextContent('S-M24-101');
    expect(summary).toHaveTextContent('Acme 秋季补货');
    expect(summary).toHaveTextContent('Acme客户');
    expect(summary).toHaveTextContent('订单金额：100');
    expect(summary).toHaveTextContent('pending_sales_manager_approval / 待销售主管审批');
    expect(screen.getAllByText('订单标题：Acme 秋季补货')).toHaveLength(1);
    expect(screen.getAllByText('deposit_received / 已收定金')).toHaveLength(1);
    expect(screen.queryByText('收款：通过')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '售后状态摘要' })).not.toBeInTheDocument();
    const approve = screen.getByRole('button', { name: '审批通过' });
    const items = screen.getByRole('heading', { name: '销售明细' });
    before(screen.getByRole('alert', { name: '销售价低于产品库成本提醒' }), approve);
    before(screen.getByText('请核对合同单价'), approve);
    before(approve, items);
    before(items, screen.getByRole('heading', { name: '订单字段' }));
    before(screen.getByRole('heading', { name: '订单字段' }), screen.getByRole('heading', { name: '进度与跟踪' }));
    const versions = screen.getByText('版本时间线').closest('details');
    expect(versions).not.toHaveAttribute('open');
    before(items, versions!);
    fireEvent.click(screen.getByText('版本时间线'));
    expect(versions).toHaveAttribute('open');
    expect(versions).toHaveTextContent('首次建单');
  });

  it('keeps titles containing the sales number in expandable order history without repeating the number in the summary', async () => {
    await showSales({ ...sales, title: 'S-M24-101 Acme合同完整标题' });
    const summary = screen.getByRole('article', { name: '销售单摘要' });
    expect(summary.textContent?.match(/S-M24-101/g)).toHaveLength(1);
    const title = screen.getByText('S-M24-101 Acme合同完整标题');
    const history = title.closest('details');
    expect(history).not.toHaveAttribute('open');
    fireEvent.click(within(history!).getByText('原始订单标题'));
    expect(title).toBeVisible();
  });

  it('moves purchase approval before items, deduplicates shared delivery fields, and keeps inquiry evidence and per-line freight', async () => {
    await showPurchase();
    const summary = screen.getByRole('article', { name: '采购单摘要' });
    expect(summary).toHaveTextContent('P-M24-101');
    expect(summary).toHaveTextContent('采购灯带');
    expect(summary).toHaveTextContent('星河工厂');
    expect(summary).toHaveTextContent('Leo');
    expect(summary).toHaveTextContent('采购金额：100');
    expect(screen.queryByText('采购负责人：Leo')).not.toBeInTheDocument();
    expect(screen.queryByText('单据编号 Purchase No')).not.toBeInTheDocument();
    const approve = screen.getByRole('button', { name: '通过采购审批' });
    const items = screen.getByRole('heading', { name: '采购明细' });
    before(screen.getByText('请核对供应商交期'), approve);
    before(approve, items);
    expect(screen.queryByRole('columnheader', { name: '供应商 Supplier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '工厂预计交货时间 Factory ETA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '发货至 Ship To' })).not.toBeInTheDocument();
    expect(screen.getAllByText('2026-10-09')).toHaveLength(1);
    expect(screen.getAllByText('上海仓库')).toHaveLength(1);
    const table = items.closest('article')!;
    expect(within(table).getByText('20')).toBeInTheDocument();
    expect(within(table).getByText('40')).toBeInTheDocument();
    const evidence = screen.getByRole('heading', { name: '来源询价' });
    expect(evidence.closest('details')).toBeNull();
    expect(evidence.closest('article')).toHaveTextContent('INQ12');
    before(items, evidence);
    const versions = screen.getByText('版本时间线').closest('details');
    expect(versions).not.toHaveAttribute('open');
    before(items, versions!);
  });

  it('keeps differing line suppliers, dates and addresses in the purchase table', async () => {
    await showPurchase({ ...purchase, items: purchase.items.map((item, index) => index === 0 ? item : { ...item, supplierId: 31, factoryEstimatedDeliveryDate: '2026-10-12', shipTo: '宁波仓库' }) });
    const table = screen.getByRole('heading', { name: '采购明细' }).closest('article')!;
    expect(within(table).getByRole('columnheader', { name: '供应商 Supplier' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '工厂预计交货时间 Factory ETA' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '发货至 Ship To' })).toBeInTheDocument();
    expect(within(table).getByText('31')).toBeInTheDocument();
    expect(within(table).getByText('2026-10-12')).toBeInTheDocument();
    expect(within(table).getByText('宁波仓库')).toBeInTheDocument();
  });

  it.each(['', '   ', 'invalid-date', '2026-02-30'])('keeps invalid shared line fields %j visible without erasing header delivery information', async (lineDate) => {
    await showPurchase({ ...purchase, items: purchase.items.map(item => ({
      ...item, factoryEstimatedDeliveryDate: lineDate, shipTo: '   ',
    })) });
    const table = screen.getByRole('heading', { name: '采购明细' }).closest('article')!;
    expect(within(table).getByRole('columnheader', { name: '工厂预计交货时间 Factory ETA' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: '发货至 Ship To' })).toBeInTheDocument();
    const delivery = screen.getByRole('heading', { name: '交付信息' }).closest('article')!;
    expect(delivery).toHaveTextContent('2026-10-09');
    expect(delivery).toHaveTextContent('上海仓库');
    if (lineDate.trim()) expect(within(table).getAllByText(lineDate)).toHaveLength(2);
  });

  it('keeps supplier rows when the header supplier ID is unavailable', async () => {
    await showPurchase({ ...purchase, supplierId: 0 });
    const table = screen.getByRole('heading', { name: '采购明细' }).closest('article')!;
    expect(within(table).getByRole('columnheader', { name: '供应商 Supplier' })).toBeInTheDocument();
    expect(within(table).getAllByText('30')).toHaveLength(2);
  });

  it.each(['sales', 'purchase'] as const)('formats the %s snapshot amount sum without recalculating line prices', async (kind) => {
    if (kind === 'sales') {
      await showSales({ ...sales, items: [0.1, 0.2].map((amount, index) => ({
        ...sales.items[0], lineNo: index + 1, quantity: 100, salePrice: 999, amount,
      })) });
    } else {
      await showPurchase({ ...purchase, items: purchase.items.map((item, index) => ({
        ...item, quantity: 100, unitPrice: 999, amount: index === 0 ? 0.1 : 0.2,
      })) });
    }
    const summary = screen.getByRole('article', { name: kind === 'sales' ? '销售单摘要' : '采购单摘要' });
    expect(summary).toHaveTextContent(kind === 'sales' ? '订单金额：0.3' : '采购金额：0.3');
    expect(summary).not.toHaveTextContent('0.30000000000000004');
    const table = screen.getByRole('heading', { name: kind === 'sales' ? '销售明细' : '采购明细' }).closest('article')!;
    expect(within(table).getByText('0.1')).toBeInTheDocument();
    expect(within(table).getByText('0.2')).toBeInTheDocument();
  });

  it.each(['sales', 'purchase'] as const)('folds %s logs by default but keeps failed log loading visible', async (kind) => {
    const show = kind === 'sales' ? showSales : showPurchase;
    const view = await show();
    const toggle = screen.getByText('审计日志', { selector: 'summary' });
    expect(toggle.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(toggle);
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeVisible();
    view.unmount();
    if (kind === 'sales') await showSales(sales, true);
    else await showPurchase(purchase, true);
    const error = screen.getByRole('alert', { name: '' });
    expect(error).toHaveTextContent('审计日志暂不可用');
    expect(error.closest('details')).toBeNull();
  });
});
