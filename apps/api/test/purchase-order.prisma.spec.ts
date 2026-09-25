import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('PurchaseOrderService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates purchase order snapshots from sales order splitting', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T14:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 301n,
          docNo: 'PENDING-PURCHASE-301',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 301n,
          bizType: 'purchase_order',
          docNo: 'P202607110301',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: 3001n,
          payload: {
            id: 301,
            purchaseNo: 'P202607110301',
            sourceSalesOrderId: 88,
            supplierId: 3001,
            supplierName: 'Acme Supply',
            ownerName: 'Leo',
            currentVersionNo: 1,
            status: 'draft',
            itemCount: 1,
            createdBy: 2001,
            createdAt: createdAt.toISOString(),
            salesOrderNo: 'S202607080088',
            currentBatchCount: 0,
            versionHistory: [],
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

    const service = new PurchaseOrderService(prisma);
    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'purchase_order',
        docNo: expect.stringMatching(/^PENDING-PURCHASE-/),
        status: 'draft',
        ownerUserId: 2001n,
        counterpartyId: 3001n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 301n },
      data: expect.objectContaining({
        docNo: 'C202607080088',
        payload: expect.objectContaining({
          purchaseNo: 'C202607080088',
          sourceSalesOrderId: 88,
          supplierId: 3001,
          itemCount: 1,
        }),
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'purchase_order',
        bizId: 301n,
        operationType: 'create_purchase_order',
        operatorId: 2001n,
      }),
    });
    expect(result.purchaseOrders[0]).toMatchObject({
      id: 301,
      purchaseNo: 'C202607080088',
      sourceSalesOrderId: 88,
      supplierId: 3001,
    });
  });

  it('lists, reads, and submits purchase order snapshots in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T14:30:00.000Z');
    const payload = {
      id: 302,
      purchaseNo: 'P202607110302',
      sourceSalesOrderId: 88,
      supplierId: 3002,
      supplierName: 'Bravo Industrial',
      ownerName: 'Leo',
      currentVersionNo: 1,
      status: 'draft',
      itemCount: 1,
      createdBy: 2002,
      createdAt: createdAt.toISOString(),
      salesOrderNo: 'S202607080088',
      currentBatchCount: 0,
      versionHistory: [],
      items: [],
    };
    const documentRecord = {
      id: 302n,
      bizType: 'purchase_order',
      docNo: 'P202607110302',
      status: 'draft',
      ownerUserId: 2002n,
      counterpartyId: 3002n,
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
          status: 'pending_purchase_manager_approval',
          payload: {
            ...payload,
            status: 'pending_purchase_manager_approval',
          },
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new PurchaseOrderService(prisma);
    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(302);
    const submitted = await service.submit({
      purchaseOrderId: 302,
      currentStatus: 'draft',
    });

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'purchase_order' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 302n },
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 302n },
      data: expect.objectContaining({
        status: 'pending_purchase_manager_approval',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'purchase_order',
        bizId: 302n,
        operationType: 'submit_purchase_order',
        operatorId: 2002n,
      }),
    });
    expect(listed.items.map((item) => item.docNo)).toContain('P202607110302');
    expect(detail).toMatchObject({
      id: 302,
      purchaseNo: 'P202607110302',
      supplierId: 3002,
    });
    expect(submitted.status).toBe('pending_purchase_manager_approval');
  });

  it('saves purchase owner edits in Prisma draft-stage snapshots', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T14:45:00.000Z');
    const payload = {
      id: 303,
      purchaseNo: 'P202607110303',
      sourceSalesOrderId: 88,
      supplierId: 3002,
      supplierName: 'Bravo Industrial',
      ownerName: 'Leo',
      currentVersionNo: 1,
      status: 'pending_purchase_claim',
      itemCount: 1,
      createdBy: 2002,
      createdAt: createdAt.toISOString(),
      salesOrderNo: 'S202607080088',
      currentBatchCount: 0,
      versionHistory: [],
      items: [],
    };
    const documentRecord = {
      id: 303n,
      bizType: 'purchase_order',
      docNo: 'P202607110303',
      status: 'pending_purchase_claim',
      ownerUserId: 2002n,
      counterpartyId: 3002n,
      payload,
      createdBy: 2002n,
      createdAt,
      updatedAt: createdAt,
    };
    const prismaMock = {
      businessDocument: {
        findUnique: jest.fn().mockResolvedValue(documentRecord),
        update: jest.fn().mockResolvedValue({
          ...documentRecord,
          payload: {
            ...payload,
            ownerName: 'Leo',
          },
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 3n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new PurchaseOrderService(prisma);
    const result = await service.saveDraft({
      purchaseOrderId: 303,
      currentStatus: 'pending_purchase_claim',
      ownerName: 'Leo',
      session: {
        role: 'purchase',
        user: 'Leo',
      },
    });

    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 303n },
      data: expect.objectContaining({
        status: 'pending_purchase_claim',
        payload: expect.objectContaining({
          ownerName: 'Leo',
          status: 'pending_purchase_claim',
        }),
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'purchase_order',
        bizId: 303n,
        operationType: 'save_purchase_order_draft',
        operatorId: 2002n,
      }),
    });
    expect(result).toMatchObject({
      status: 'pending_purchase_claim',
      ownerName: 'Leo',
    });
  });
});
