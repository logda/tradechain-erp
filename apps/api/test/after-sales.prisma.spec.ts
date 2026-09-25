import { AfterSalesService } from '../src/after-sales/after-sales.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('AfterSalesService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates after-sales snapshots in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T16:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 501n,
          docNo: 'PENDING-AFTER-SALES-501',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 501n,
          bizType: 'after_sales',
          docNo: 'AS202607110501',
          status: 'pending_submit',
          ownerUserId: 2001n,
          counterpartyId: 21n,
          payload: {
            id: 501,
            afterSalesNo: 'AS202607110501',
            status: 'pending_submit',
            financeReviewStatus: 'pending',
            salesOrderId: 88,
            purchaseOrderId: 21,
            shipmentBatchId: 101,
            type: 'customer_complaint',
            issueDescription: 'Customer reported packaging damage',
            createdBy: 2001,
            createdAt: createdAt.toISOString(),
            customerName: 'Acme Trading',
            supplierName: 'Acme Supply',
            ownerName: 'Zoe',
            receiptCollectionStatus: 'unpaid',
            shipmentBatchNo: 'SH202607110101',
            title: 'Acme Trading 客诉跟进',
            items: [],
          },
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new AfterSalesService(prisma);
    const result = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'after_sales',
        docNo: expect.stringMatching(/^PENDING-AFTER-SALES-/),
        status: 'pending_submit',
        ownerUserId: 2001n,
        counterpartyId: 21n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 501n },
      data: expect.objectContaining({
        docNo: result.afterSalesNo,
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'after_sales',
        bizId: 501n,
        operationType: 'create_after_sales',
        operatorId: 2001n,
      }),
    });
    expect(result).toMatchObject({
      id: 501,
      afterSalesNo: expect.stringMatching(/^AS\d{10}$/),
      status: 'pending_submit',
      financeReviewStatus: 'pending',
    });
  });

  it('lists, reads, and advances after-sales snapshots in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T16:30:00.000Z');
    const payload = {
      id: 502,
      afterSalesNo: 'AS202607110502',
      status: 'pending_submit',
      financeReviewStatus: 'pending',
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
      createdAt: createdAt.toISOString(),
      customerName: 'Acme Trading',
      supplierName: 'Acme Supply',
      ownerName: 'Leo',
      receiptCollectionStatus: 'unpaid',
      shipmentBatchNo: 'SH202607110101',
      title: 'Acme Trading 客诉跟进',
      items: [],
    };
    const documentRecord = {
      id: 502n,
      bizType: 'after_sales',
      docNo: 'AS202607110502',
      status: 'pending_submit',
      ownerUserId: 2002n,
      counterpartyId: 21n,
      payload,
      createdBy: 2002n,
      createdAt,
      updatedAt: createdAt,
    };
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([documentRecord]),
        findUnique: jest.fn().mockResolvedValue(documentRecord),
        update: jest.fn().mockResolvedValue({
          ...documentRecord,
          status: 'closed',
          payload: {
            ...payload,
            status: 'closed',
            financeReviewStatus: 'confirmed',
          },
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new AfterSalesService(prisma);
    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(502);
    const moved = await service.close({
      afterSalesOrderId: 502,
      currentStatus: 'finished',
      financeReviewStatus: 'confirmed',
    });

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'after_sales' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 502n },
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 502n },
      data: expect.objectContaining({
        status: 'closed',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'after_sales',
        bizId: 502n,
        operationType: 'close_after_sales',
      }),
    });
    expect(listed.items.map((item) => item.docNo)).toContain('AS202607110502');
    expect(detail.afterSalesNo).toBe('AS202607110502');
    expect(moved.status).toBe('closed');
  });
});
