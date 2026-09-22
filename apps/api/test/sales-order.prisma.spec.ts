import { SalesOrderService } from '../src/sales-order/sales-order.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('SalesOrderService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates direct sales orders in Prisma and returns the final sales number', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T12:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 108n,
          docNo: 'PENDING-SALES-108',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 108n,
          bizType: 'sales_order',
          docNo: 'S202607110108',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: null,
          payload: {
            id: 108,
            salesNo: 'S202607110108',
            status: 'draft',
            currentVersionNo: 1,
            purchaseAggregateStatus: 'not_started',
            shipmentAggregateStatus: 'not_started',
            receiptSendStatus: 'pending',
            afterSalesEndStatus: 'not_started',
            receiptStatus: 'unpaid',
            financeStatus: 'pending',
            createdBy: 2001,
            createdAt: createdAt.toISOString(),
            sourceMode: 'direct',
            customerName: 'Acme Trading',
            title: 'Acme 夏季补货',
            salesUserId: 2001,
            versionHistory: [],
            items: [],
          },
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new SalesOrderService(prisma);
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 夏季补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sales_order',
        docNo: expect.stringMatching(/^PENDING-SALES-/),
        status: 'draft',
        ownerUserId: 2001n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 108n },
      data: expect.objectContaining({
        docNo: 'S202607110108',
        payload: expect.objectContaining({
          salesNo: 'S202607110108',
          customerName: 'Acme Trading',
          title: 'Acme 夏季补货',
        }),
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sales_order',
        bizId: 108n,
        operationType: 'create_sales_order',
        operatorId: 2001n,
      }),
    });
    expect(created).toMatchObject({
      id: 108,
      salesNo: 'S202607110108',
      sourceMode: 'direct',
      customerName: 'Acme Trading',
      title: 'Acme 夏季补货',
    });
  });

  it('creates and submits direct sales orders in Prisma when requested', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T12:05:00.000Z');
    const finalPayload = {
      id: 111,
      salesNo: 'S202607110111',
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started',
      shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      createdBy: 2001,
      createdAt: createdAt.toISOString(),
      sourceMode: 'direct',
      customerName: 'Acme Trading',
      title: 'Acme 直接提交审批',
      salesUserId: 2001,
      versionHistory: [],
      items: [],
    };
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 111n,
          docNo: 'PENDING-SALES-111',
          createdAt,
        }),
        update: jest
          .fn()
          .mockResolvedValueOnce({
            id: 111n,
            bizType: 'sales_order',
            docNo: 'S202607110111',
            status: 'draft',
            ownerUserId: 2001n,
            counterpartyId: null,
            payload: finalPayload,
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          })
          .mockResolvedValueOnce({
            id: 111n,
            bizType: 'sales_order',
            docNo: 'S202607110111',
            status: 'pending_sales_manager_approval',
            ownerUserId: 2001n,
            counterpartyId: null,
            payload: {
              ...finalPayload,
              status: 'pending_sales_manager_approval',
            },
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 111n,
          bizType: 'sales_order',
          docNo: 'S202607110111',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: null,
          payload: finalPayload,
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

    const service = new SalesOrderService(prisma);
    const created = await service.create({
      submitMode: 'submit',
      customerName: 'Acme Trading',
      title: 'Acme 直接提交审批',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(created).toMatchObject({
      id: 111,
      status: 'pending_sales_manager_approval',
    });
    expect(prismaMock.businessDocument.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 111n },
        data: expect.objectContaining({
          status: 'pending_sales_manager_approval',
          payload: expect.objectContaining({
            status: 'pending_sales_manager_approval',
          }),
        }),
      }),
    );
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sales_order',
        bizId: 111n,
        operationType: 'submit_sales_order',
        operatorId: 2001n,
      }),
    });
  });

  it('lists and reads sales order snapshots from Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T12:30:00.000Z');
    const payload = {
      id: 109,
      salesNo: 'S202607110109',
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started',
      shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      createdBy: 2002,
      createdAt: createdAt.toISOString(),
      sourceMode: 'direct',
      customerName: 'Beta Trading',
      title: 'Beta 补货单',
      salesUserId: 2002,
      versionHistory: [],
      items: [],
    };
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 109n,
            bizType: 'sales_order',
            docNo: 'S202607110109',
            status: 'draft',
            ownerUserId: 2002n,
            counterpartyId: null,
            payload,
            createdBy: 2002n,
            createdAt,
            updatedAt: createdAt,
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 109n,
          bizType: 'sales_order',
          docNo: 'S202607110109',
          status: 'draft',
          ownerUserId: 2002n,
          counterpartyId: null,
          payload,
          createdBy: 2002n,
          createdAt,
          updatedAt: createdAt,
        }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new SalesOrderService(prisma);
    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(109);

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'sales_order' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 109n },
    });
    expect(listed.items.map((item) => item.docNo)).toContain('S202607110109');
    expect(detail).toMatchObject({
      id: 109,
      salesNo: 'S202607110109',
      customerName: 'Beta Trading',
      sourceMode: 'direct',
    });
  });

  it('rejects duplicate quote conversion in Prisma storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T13:00:00.000Z');
    const existingSalesPayload = {
      id: 110,
      salesNo: 'S202607110110',
      status: 'draft',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started',
      shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      receiptStatus: 'unpaid',
      financeStatus: 'pending',
      createdBy: 2001,
      createdAt: createdAt.toISOString(),
      versionHistory: [],
      sourceMode: 'from_quote',
      customerId: 1001,
      customerName: 'Acme Trading',
      title: '报价单 77 转销售单',
      salesUserId: 2001,
      sourceQuoteOrderId: 77,
      sourceQuoteVersionNo: 2,
      items: [],
    };
    const prismaMock = {
      businessDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 77n,
          bizType: 'quote',
          docNo: 'Q202607080077',
          status: 'customer_accepted',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: {
            id: 77,
            status: 'customer_accepted',
            currentVersionNo: 2,
          },
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 110n,
            bizType: 'sales_order',
            docNo: 'S202607110110',
            status: 'draft',
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: existingSalesPayload,
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          },
        ]),
        create: jest.fn(),
        update: jest.fn(),
      },
      operationLog: {
        create: jest.fn(),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new SalesOrderService(prisma);

    await expect(
      service.convertConfirmedQuote({
        quoteOrderId: 77,
        quoteVersionNo: 2,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
      }),
    ).rejects.toThrow('A confirmed quote version can only create one sales order');

    expect(prismaMock.businessDocument.create).not.toHaveBeenCalled();
  });

  it('converts an accepted quote and updates linked records in one Prisma transaction', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T14:00:00.000Z');
    const sourceQuote = {
      id: 77n,
      bizType: 'quote',
      docNo: 'Q202607080077',
      status: 'customer_accepted',
      ownerUserId: 2001n,
      counterpartyId: 1001n,
      payload: {
        id: 77,
        quoteNo: 'Q202607080077',
        documentType: 'quote',
        status: 'customer_accepted',
        currentVersionNo: 2,
        items: [],
      },
      createdBy: 2001n,
      createdAt,
      updatedAt: createdAt,
    };
    const txMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(sourceQuote),
        create: jest.fn().mockResolvedValue({ id: 111n, createdAt }),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ ...sourceQuote, ...data, id: where.id }),
        ),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(sourceQuote),
      },
      $transaction: jest.fn(async (callback: (db: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
      ),
    };
    const documentCodeRuleService = {
      generateCustomerOrderNo: jest.fn().mockResolvedValue('CO202607130001'),
    };
    const service = new SalesOrderService(
      prismaMock as unknown as PrismaService,
      documentCodeRuleService as never,
    );

    const converted = await service.convertConfirmedQuote({
      quoteOrderId: 77,
      quoteVersionNo: 2,
      sourceQuoteNo: 'Q202607080077',
      customerId: 1001,
      customerName: 'Acme Trading',
      createdBy: 2001,
      quoteConfirmed: true,
      items: [],
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bizType: 'sales_order' }),
    });
    expect(txMock.businessDocument.update).toHaveBeenCalledTimes(2);
    expect(txMock.operationLog.create).toHaveBeenCalledTimes(2);
    expect(converted).toMatchObject({
      id: 111,
      sourceQuoteOrderId: 77,
      sourceQuoteVersionNo: 2,
    });
  });
});
