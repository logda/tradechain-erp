import { BossDashboardService } from '../src/dashboard/dashboard.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('BossDashboardService prisma aggregation', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('aggregates boss dashboard from Prisma business documents', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockImplementation(({ where }: { where: { bizType: string } }) => {
          switch (where.bizType) {
            case 'quote':
              return Promise.resolve([
                { payload: { status: 'draft' } },
              ]);
            case 'sales_order':
              return Promise.resolve([
                {
                  payload: {
                    status: 'pending_sales_manager_approval',
                    financeStatus: 'pending',
                    receiptStatus: 'unpaid',
                  },
                },
                {
                  payload: {
                    status: 'purchasing',
                    financeStatus: 'confirmed',
                    receiptStatus: 'prepaid_deducted',
                  },
                },
              ]);
            case 'purchase_order':
              return Promise.resolve([
                { payload: { status: 'pending_purchase_manager_approval', stockInStatus: 'partial_received' } },
                { payload: { status: 'purchasing', stockInStatus: 'completed' } },
              ]);
            case 'shipment_batch':
              return Promise.resolve([
                { payload: { status: 'forwarder_shipped', hasException: false } },
                { payload: { status: 'arrived', hasException: true } },
              ]);
            case 'after_sales':
              return Promise.resolve([
                { payload: { status: 'processing' } },
                { payload: { status: 'closed' } },
              ]);
            default:
              return Promise.resolve([]);
          }
        }),
      },
    } as unknown as PrismaService;

    const service = new BossDashboardService(prismaMock);
    const result = await service.getSummary();

    expect(result.workflowAlerts).toEqual([
      expect.objectContaining({ key: 'quotes_pending_boss_confirm', count: 1 }),
      expect.objectContaining({ key: 'shipment_exceptions', count: 1 }),
      expect.objectContaining({ key: 'after_sales_pending_close', count: 1 }),
    ]);
    expect(result.salesOverview).toMatchObject({
      totalOrders: 2,
      pendingApproval: 1,
      inProduction: 1,
      partiallyShipped: 1,
      fullyShipped: 1,
    });
    expect(result.purchaseOverview).toMatchObject({
      totalOrders: 2,
      pendingApproval: 1,
      purchasing: 1,
      partiallyReceived: 1,
      completed: 1,
    });
    expect(result.afterSalesOverview).toMatchObject({
      openCases: 1,
      pendingApproval: 0,
      processing: 1,
      financeReviewing: 0,
      closedThisMonth: 1,
    });
    expect(result.financeOverview).toMatchObject({
      pendingConfirmation: 1,
      confirmedThisMonth: 1,
      prepaidDeducted: 1,
    });
  });
});
