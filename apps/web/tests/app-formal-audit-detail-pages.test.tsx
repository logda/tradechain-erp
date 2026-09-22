import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function stubDetailAndAudit(detail: unknown, auditOperation = 'create') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'demo',
                bizId: 101,
                operationType: auditOperation,
                operatorId: 2001,
                beforeData: { status: 'draft' },
                afterData: { status: 'confirmed' },
                createdAt: '2026-07-11T10:00:00.000Z',
              },
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
          searchParams: Promise.resolve({ role: 'sales_manager', user: 'Mia' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式需求和报价详情' })).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'boss', user: 'Mia' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式销售单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建销售单 / create_sales_order')).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式采购单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建采购单 / create_purchase_order')).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式售后单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建售后单 / create_after_sales')).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Leo' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式发货批次详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建发货批次 / create_shipment_batch')).toBeInTheDocument();
    expect(screen.getByText('Leo #2002')).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'purchase_manager', user: 'Mia' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式询价详情' })).toBeInTheDocument();
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
          searchParams: Promise.resolve({ role: 'sales_manager', user: 'Mia' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式样品单详情' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('创建样品单 / create_sample_order')).toBeInTheDocument();
  });
});
