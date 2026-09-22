import { ReportService } from '../src/report/report.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('ReportService prisma aggregation', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('aggregates sales and profit reports from Prisma business documents', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockImplementation(({ where }: { where: { bizType: string } }) => {
          switch (where.bizType) {
            case 'sales_order':
              return Promise.resolve([
                {
                  payload: {
                    status: 'closed',
                    financeStatus: 'confirmed',
                    receiptStatus: 'prepaid_deducted',
                    shipmentAggregateStatus: 'arrived',
                    versionHistory: [{ versionNo: 1 }, { versionNo: 2 }],
                    items: [
                      { amount: 200, quantity: 10, salePrice: 20 },
                    ],
                  },
                },
                {
                  payload: {
                    status: 'draft',
                    financeStatus: 'pending',
                    receiptStatus: 'unpaid',
                    shipmentAggregateStatus: 'to_forwarder',
                    versionHistory: [{ versionNo: 1 }],
                    items: [
                      { amount: 150, quantity: 5, salePrice: 30 },
                    ],
                  },
                },
              ]);
            case 'purchase_order':
              return Promise.resolve([
                {
                  payload: {
                    status: 'purchasing',
                    items: [{ amount: 120, quantity: 10, unitPrice: 12 }],
                  },
                },
              ]);
            case 'shipment_batch':
              return Promise.resolve([
                { payload: { status: 'arrived' } },
                { payload: { status: 'to_forwarder' } },
              ]);
            case 'after_sales':
              return Promise.resolve([
                { payload: { status: 'closed' } },
                { payload: { status: 'processing' } },
              ]);
            default:
              return Promise.resolve([]);
          }
        }),
      },
    } as unknown as PrismaService;

    const service = new ReportService(prismaMock);
    const salesSummary = await service.getSalesSummary();
    const grossProfit = await service.getGrossProfitSummary();
    const periodSummary = await service.getPeriodSummary();

    expect(salesSummary.totals).toMatchObject({
      salesOrderCount: 2,
      submittedAmount: 350,
      shippedAmount: 200,
    });
    expect(salesSummary.totals).not.toHaveProperty('receivedAmount');
    expect(salesSummary.shipmentBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'fully_shipped', count: 1 }),
        expect.objectContaining({ status: 'partially_shipped', count: 1 }),
      ]),
    );
    expect(salesSummary.afterSalesOverview).toMatchObject({
      openCases: 1,
      pendingApproval: 0,
      processing: 1,
      financeReviewing: 0,
      closedThisMonth: 1,
    });
    expect(grossProfit.totalRevenue).toBe(350);
    expect(grossProfit.totalProcurementCost).toBe(120);
    expect(grossProfit.totalAfterSalesCost).toBe(0);
    expect(grossProfit.grossProfit).toBe(230);
    expect(periodSummary.salesOrdersCreated).toBe(2);
    expect(periodSummary.purchaseOrdersCreated).toBe(1);
    expect(periodSummary.shipmentBatchesCreated).toBe(2);
    expect(periodSummary.afterSalesCreated).toBe(2);
    expect(periodSummary.closedOrders).toBe(1);
    expect(periodSummary.reopenedApprovals).toBe(1);
  });
});
