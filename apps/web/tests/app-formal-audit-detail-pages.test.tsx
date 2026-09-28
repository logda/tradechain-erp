import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogTable } from '../app/app/_components/audit-log-table';

function stubDetailAndAudit(detail: unknown, auditOperation = 'create', failed = false) {
  const bizType = ({
    create_sales_order: 'sales_order', create_purchase_order: 'purchase_order',
    create_shipment_batch: 'shipment_batch', create_after_sales: 'after_sales',
  } as Record<string, string>)[auditOperation] ?? 'demo';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            modules: [{ key: 'document', label: '单据', count: failed ? 0 : 3, failed }],
            items: failed ? [] : [
              {
                id: 1,
                bizType,
                bizId: 101,
                operationType: auditOperation,
                operatorId: 2001,
                operatorName: '新员工',
                beforeData: { status: 'draft' },
                afterData: { status: 'confirmed' },
                createdAt: '2026-07-11T10:00:00.000Z',
                moduleKey: 'document', moduleLabel: '单据',
              },
              { id: 2, bizType, bizId: 105, operationType: 'reject', operatorId: 2002,
                beforeData: null, afterData: { status: 'rejected' }, createdAt: '2026-07-11T11:00:00.000Z', moduleKey: 'document', moduleLabel: '单据' },
              { id: 3, bizType: 'other_module', bizId: 101, operationType: 'reject', operatorId: 2002,
                beforeData: null, afterData: { status: 'rejected' }, createdAt: '2026-07-11T12:00:00.000Z', moduleKey: 'document', moduleLabel: '单据' },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => detail,
      });
    }),
  );
}

const auditAccess = encodeURIComponent(JSON.stringify({ modules: ['sales', 'purchase', 'operations'], dataScope: 'all', actions: ['audit.view'] }));

function expectScopedAudit(bizType: string) {
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/audit-logs?bizType=${bizType}&bizId=101`), expect.anything());
  expect(screen.queryByText('审批驳回 / reject')).not.toBeInTheDocument();
  expect(screen.getByText('新员工 #2001')).toBeInTheDocument();
  const toggle = screen.getByText('展开字段变更');
  expect(toggle.closest('details')).not.toHaveAttribute('open');
  fireEvent.click(toggle);
  expect(toggle.closest('details')).toHaveAttribute('open');
  expect(toggle.closest('details')).toHaveTextContent('草稿');
  expect(toggle.closest('details')).toHaveTextContent('已确认');
}

describe('formal detail audit sections', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders quote detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        quoteNo: 'Q202607080101',
        status: 'draft',
        currentVersionNo: 1,
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Need 500 units',
        items: [],
      },
      'create_quote',
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'sales_manager', user: 'Mia', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '需求和报价详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建报价单 / create_quote')).toBeInTheDocument();
  });

  it('renders sales order detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        salesNo: 'S202607080001',
        status: 'draft',
        currentVersionNo: 1,
        purchaseAggregateStatus: 'purchasing',
        shipmentAggregateStatus: 'arrived',
        sourceQuoteOrderId: 88,
        sourceQuoteVersionNo: 4,
        receiptSendStatus: 'sent',
        afterSalesEndStatus: 'closed',
        receiptStatus: 'fully_paid',
        financeStatus: 'confirmed',
        createdBy: 2001,
        salesUserId: 2001,
        items: [],
      },
      'create_sales_order',
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'boss', user: 'Mia', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '销售单详情' })).toBeInTheDocument();
    const auditToggle = screen.getByText('审计日志', { selector: 'summary' });
    expect(auditToggle.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(auditToggle);
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeVisible();
    expect(screen.getByText('创建销售单 / create_sales_order')).toBeInTheDocument();
    expectScopedAudit('sales_order');
  });

  it('renders purchase order detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        purchaseNo: 'P202607110101',
        status: 'draft',
        currentVersionNo: 1,
        sourceSalesOrderId: 88,
        salesOrderNo: 'S202607080001',
        supplierName: 'Acme Supply',
        ownerName: 'Leo',
        createdBy: 2002,
        createdAt: '2026-07-11T10:30:00.000Z',
        currentBatchCount: 0,
        versionHistory: [],
        items: [],
      },
      'create_purchase_order',
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '采购单详情' })).toBeInTheDocument();
    const auditToggle = screen.getByText('审计日志', { selector: 'summary' });
    expect(auditToggle.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(auditToggle);
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeVisible();
    expect(screen.getByText('创建采购单 / create_purchase_order')).toBeInTheDocument();
    expectScopedAudit('purchase_order');
  });

  it('renders after-sales detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        afterSalesNo: 'AS202607110101',
        status: 'pending_submit',
        financeReviewStatus: 'pending',
        salesOrderId: 88,
        purchaseOrderId: 21,
        shipmentBatchId: 1,
        type: 'refund',
        issueDescription: '退款处理',
        items: [],
      },
      'create_after_sales',
    );

    const { default: AppAfterSalesDetailPage } = await import(
      '../app/app/after-sales/[id]/page'
    );

    render(
      <>
        {await AppAfterSalesDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '售后单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建售后单 / create_after_sales')).toBeInTheDocument();
    expectScopedAudit('after_sales');
  });

  it('renders shipment batch detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        batchNo: 'SH202607110101',
        status: 'shipped',
        receiptSendStatus: 'pending',
        salesOrderId: 88,
        purchaseOrderId: 21,
        receiptDocUrl: 'https://files.example.com/receipt-001.pdf',
        receiptSentBy: 2002,
        hasException: false,
        items: [],
      },
      'create_shipment_batch',
    );

    const { default: AppShipmentBatchDetailPage } = await import(
      '../app/app/shipment-batches/[id]/page'
    );

    render(
      <>
        {await AppShipmentBatchDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '发货批次详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建发货批次 / create_shipment_batch')).toBeInTheDocument();
    expect(screen.getByText('Leo #2002')).toBeInTheDocument();
    expectScopedAudit('shipment_batch');
  });

  it('renders inquiry detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 1,
        inquiryNo: 'IQ202607080001',
        status: 'draft',
        quoteOrderId: 1,
        quoteOrderNo: 'Q202607080001',
        quoteVersionNo: 1,
        customerName: 'Acme Trading',
        createdBy: 'Zoe',
        supplierCount: 2,
        comparisonSummary: '已收齐报价，等待提交比价。',
        createdAt: '2026-07-11T11:00:00.000Z',
        detailHref: '/app/sales/inquiries/1',
        items: [],
      },
      'create_quote_inquiry',
    );

    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '1' }),
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Mia', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '询价详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建询价单 / create_quote_inquiry')).toBeInTheDocument();
  });

  it('renders sample order detail audit logs', async () => {
    stubDetailAndAudit(
      {
        id: 101,
        sampleNo: 'SP202607110101',
        currentVersionNo: 1,
        currentStatus: 'pending_approval',
        sourceQuoteOrderId: 88,
        sourceQuoteVersionNo: 2,
        sampleRequirements: '首版样品要求',
        samplingCost: 1200,
      },
      'create_sample_order',
    );

    const { default: AppFormalSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppFormalSampleOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({ role: 'sales_manager', user: 'Mia', access: auditAccess }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '样品单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建样品单 / create_sample_order')).toBeInTheDocument();
  });

  it('keeps document access separate from audit access', async () => {
    stubDetailAndAudit({
      id: 101, afterSalesNo: 'AS202607110101', status: 'pending_submit', financeReviewStatus: 'pending',
      salesOrderId: 88, purchaseOrderId: 21, shipmentBatchId: 1, type: 'refund', issueDescription: '退款处理', items: [],
    }, 'create_after_sales');
    const { default: Page } = await import('../app/app/after-sales/[id]/page');
    const access = encodeURIComponent(JSON.stringify({ modules: ['operations'], dataScope: 'all', actions: [] }));
    render(await Page({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo', access }) }));
    expect(screen.getByRole('heading', { name: '售后单详情' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/audit-logs'))).toBe(false);
  });

  it.each([
    { load: () => import('../app/app/sales/orders/[id]/page'), operation: 'create_sales_order', detail: {
      id: 101, salesNo: 'S101', status: 'draft', currentVersionNo: 1, purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'arrived', receiptSendStatus: 'sent', afterSalesEndStatus: 'closed',
      receiptStatus: 'fully_paid', financeStatus: 'confirmed', createdBy: 2001, salesUserId: 2001, items: [],
    } },
    { load: () => import('../app/app/purchase-orders/[id]/page'), operation: 'create_purchase_order', detail: {
      id: 101, purchaseNo: 'P101', status: 'draft', currentVersionNo: 1, sourceSalesOrderId: 88, salesOrderNo: 'S88',
      supplierName: '供应商', ownerName: 'Leo', createdBy: 2002, createdAt: '2026-07-11T10:30:00.000Z',
      currentBatchCount: 0, versionHistory: [], items: [],
    } },
    { load: () => import('../app/app/shipment-batches/[id]/page'), operation: 'create_shipment_batch', detail: {
      id: 101, batchNo: 'SH101', status: 'shipped', receiptSendStatus: 'pending', salesOrderId: 88,
      purchaseOrderId: 21, hasException: false, items: [],
    } },
    { load: () => import('../app/app/after-sales/[id]/page'), operation: 'create_after_sales', detail: {
      id: 101, afterSalesNo: 'AS101', status: 'pending_submit', financeReviewStatus: 'pending', salesOrderId: 88,
      purchaseOrderId: 21, shipmentBatchId: 1, type: 'refund', issueDescription: '退款处理', items: [],
    } },
  ])('$operation distinguishes audit failure from an empty business history', async ({ load, operation, detail }) => {
    stubDetailAndAudit(detail, operation, true);
    const { default: Page } = await load();
    render(await Page({ params: Promise.resolve({ id: '101' }), searchParams: Promise.resolve({ role: 'boss', user: 'Mia', access: auditAccess }) }));
    expect(screen.getByRole('alert')).toHaveTextContent('审计日志暂不可用');
    expect(screen.queryByText('暂无审计记录')).not.toBeInTheDocument();
  });

  it('shows recent actions first and keeps each detailed change expandable', () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1, bizType: 'sales_order', bizId: 101, operationType: `action-${index + 1}`, operatorId: 7001,
      operatorName: '新员工', createdAt: `2026-09-${String(index + 1).padStart(2, '0')}T01:00:00.000Z`,
      beforeData: { quantity: index }, afterData: { quantity: index + 1 },
    }));
    render(<AuditLogTable items={items} session={{ role: 'admin', user: 'Admin' }} collapseChanges />);
    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.queryByText('action-1')).not.toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('action-10');
    expect(screen.getAllByText('展开字段变更')).toHaveLength(8);
  });

  it('expanded document changes show nested values and changes beyond the fifth field', () => {
    render(<AuditLogTable session={{ role: 'admin', user: 'Admin' }} collapseChanges items={[{
      id: 1, bizType: 'sales_order', bizId: 101, operationType: 'update_sales_order',
      operatorId: 7001, operatorName: '新员工', createdAt: '2026-09-28T01:00:00.000Z',
      beforeData: { title: '旧标题', customerName: '旧客户', currency: 'USD', remark: '旧备注', salesUserId: 7001, status: 'draft', items: [{ salePrice: 10 }] },
      afterData: { title: '新标题', customerName: '新客户', currency: 'CNY', remark: '新备注', salesUserId: 7002, status: 'pending_sales_manager_approval', items: [{ salePrice: 25 }] },
    }]} />);
    const changes = screen.getByText('展开字段变更').parentElement!;
    expect(changes).toHaveTextContent('销售单价');
    expect(changes).toHaveTextContent('10→25');
    expect(changes).toHaveTextContent('待销售主管审批');
    expect(changes).not.toHaveTextContent('1 项→1 项');
  });
});
