import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('ShipmentBatchService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates shipment batches in Prisma with traceable line items', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T15:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 401n,
          docNo: 'PENDING-SHIPMENT-401',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 401n,
          bizType: 'shipment_batch',
          docNo: 'SH202607110401',
          status: 'shipped',
          ownerUserId: 2001n,
          counterpartyId: 21n,
          payload: {
            id: 401,
            batchNo: 'SH202607110401',
            status: 'shipped',
            receiptSendStatus: 'pending',
            shippedQty: 40,
            accumulatedQty: 40,
            remainingQty: 60,
            shippedAt: createdAt.toISOString(),
            createdBy: 2001,
            salesOrderId: 88,
            purchaseOrderId: 21,
            purchaseOrderCurrentStatus: 'purchasing',
            currentBatchCount: 0,
            salesOrderLocked: true,
            supplierName: 'Acme Supply',
            salesOrderNo: 'S202607080088',
            purchaseOrderNo: 'P202607110021',
            title: 'Acme Supply 首批发货',
            createdAt: createdAt.toISOString(),
            hasException: false,
            items: [
              {
                lineNo: 1,
                purchaseLineNo: 1,
                sourceSalesItemId: 1,
                productId: 501,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                unit: 'set',
                shippedQty: 40,
                purchaseQty: 500,
              },
            ],
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

    const service = new ShipmentBatchService(prisma);
    const result = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-13T15:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'shipment_batch',
        docNo: expect.stringMatching(/^PENDING-SHIPMENT-/),
        status: 'shipped',
        ownerUserId: 2001n,
        counterpartyId: 21n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 401n },
      data: expect.objectContaining({
        docNo: 'SH202607110401',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'shipment_batch',
        bizId: 401n,
        operationType: 'create_shipment_batch',
        operatorId: 2001n,
      }),
    });
    expect(result).toMatchObject({
      id: 401,
        batchNo: 'SH202607110401',
      status: 'shipped',
      salesOrderLocked: true,
    });
  });

  it('reads and updates shipment batch snapshots in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T15:30:00.000Z');
    const payload = {
      id: 402,
      batchNo: 'SH20260711402',
      status: 'shipped',
      receiptSendStatus: 'pending',
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: createdAt.toISOString(),
      createdBy: 2002,
      salesOrderId: 88,
      purchaseOrderId: 21,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
      salesOrderLocked: true,
      supplierName: 'Acme Supply',
      salesOrderNo: 'S202607080088',
      purchaseOrderNo: 'P202607110021',
      title: 'Acme Supply 首批发货',
      createdAt: createdAt.toISOString(),
      hasException: false,
      items: [],
    };
    const documentRecord = {
      id: 402n,
      bizType: 'shipment_batch',
      docNo: 'SH20260711402',
      status: 'shipped',
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
          status: 'forwarder_shipped',
          payload: {
            ...payload,
            status: 'forwarder_shipped',
          },
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new ShipmentBatchService(prisma);
    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(402);
    const moved = await service.markForwarderShipped({
      shipmentBatchId: 402,
      currentStatus: 'to_forwarder',
    });

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'shipment_batch' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 402n },
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 402n },
      data: expect.objectContaining({
        status: 'forwarder_shipped',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'shipment_batch',
        bizId: 402n,
        operationType: 'mark_shipment_forwarder_shipped',
      }),
    });
    expect(listed.items.map((item) => item.docNo)).toContain('SH20260711402');
    expect(detail.batchNo).toBe('SH20260711402');
    expect(moved.status).toBe('forwarder_shipped');
  });
});
