import { QuoteService } from '../src/quote/quote.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('QuoteService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates quote business documents in Prisma with a full payload snapshot', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T11:00:00.000Z');
    const prismaMock = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1n,
          sku: 'SKU-LED-001',
          salesCode: 'SALE-LED-001',
          purchaseCode: 'PUR-LED-001',
          purchaseCodeMode: 'manual',
          productStage: 'formal',
          pricingMode: 'fixed',
          brand: '',
          factoryName: '',
          model: '',
          spec: '',
          singleWeight: null,
          cartonSpec: '',
          cartonQuantity: null,
          cartonWeight: null,
          defaultSupplierCode: '',
          nameCn: '智能 LED 灯带',
          nameEn: 'Smart LED Strip',
          category: 'electronics',
          unit: 'set',
          currency: 'USD',
          defaultSalePrice: 15.9,
          defaultPurchasePrice: 8.5,
          salePriceTiers: [],
          ownerName: 'Zoe',
          status: 'active',
          createdAt,
          createdBy: 'system',
        }),
      },
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 101n,
          docNo: 'PENDING-QUOTE',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 101n,
          bizType: 'quote',
          docNo: 'BJ202607080101',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: {
            id: 101,
            quoteNo: 'BJ202607080101',
            status: 'draft',
            currentVersionNo: 1,
            customerId: 1001,
            salesUserId: 2001,
            sourceCode: 'expo',
            requirements: 'Need 800 units',
            createdAt: createdAt.toISOString(),
            items: [
              {
                lineNo: 1,
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                unit: 'set',
                quantity: 800,
                salePrice: 15.9,
                amount: 12720,
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

    const service = new QuoteService(prisma);
    const result = await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 800 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 800,
          salePrice: 15.9,
        },
      ],
    });

    const quoteNoPattern = /^BJ\d{6}\d{4}$/;
    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'quote',
        docNo: expect.stringMatching(/^PENDING-QUOTE-/),
        status: 'draft',
        ownerUserId: 2001n,
        counterpartyId: 1001n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 101n },
      data: expect.objectContaining({
        docNo: expect.stringMatching(quoteNoPattern),
        payload: expect.objectContaining({
          quoteNo: expect.stringMatching(quoteNoPattern),
          requirements: 'Need 800 units',
          items: expect.arrayContaining([
            expect.objectContaining({
              sku: 'SKU-LED-001',
              amount: 12720,
            }),
          ]),
        }),
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'quote',
        bizId: 101n,
        operationType: 'create_quote',
        operatorId: 2001n,
      }),
    });
    expect(result).toMatchObject({
      id: 101,
      quoteNo: expect.stringMatching(quoteNoPattern),
      requirements: 'Need 800 units',
    });
  });

  it('reads quote list and details from Prisma business documents', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T11:30:00.000Z');
    const payload = {
      id: 102,
      quoteNo: 'BJ202607080102',
      status: 'draft',
      currentVersionNo: 1,
      customerId: 1002,
      salesUserId: 2002,
      sourceCode: 'website',
      requirements: 'Need 1200 units',
      createdAt: createdAt.toISOString(),
      items: [],
    };
    const documentRecord = {
      id: 102n,
      bizType: 'quote',
      docNo: 'BJ202607080102',
      status: 'draft',
      ownerUserId: 2002n,
      counterpartyId: 1002n,
      payload,
      createdBy: 2002n,
      createdAt,
      updatedAt: createdAt,
    };
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([documentRecord]),
        findUnique: jest.fn().mockResolvedValue(documentRecord),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new QuoteService(prisma);
    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(102);

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'quote' },
      orderBy: { createdAt: 'desc' },
    });
    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 102n },
    });
    expect(listed.items.map((item) => item.docNo)).toContain('BJ202607080102');
    expect(detail).toMatchObject({
      id: 102,
      quoteNo: 'BJ202607080102',
      productSource: 'existing',
      sourceCode: 'website',
      requirements: 'Need 1200 units',
    });
  });

  const buildPrismaProduct = (productStage: string) => ({
    id: 999n,
    sku: 'SKU-DB-999',
    salesCode: 'SALE-DB-999',
    purchaseCode: 'PUR-DB-999',
    purchaseCodeMode: 'manual',
    productStage,
    pricingMode: 'fixed',
    brand: 'DbBrand',
    factoryName: '',
    model: 'DB-999',
    spec: '',
    singleWeight: null,
    cartonSpec: '',
    cartonQuantity: null,
    cartonWeight: null,
    defaultSupplierCode: '',
    nameCn: '数据库正式产品',
    nameEn: 'DB Formal Product',
    category: 'electronics',
    unit: 'pcs',
    currency: 'USD',
    defaultSalePrice: 10,
    defaultPurchasePrice: 5,
    salePriceTiers: [],
    ownerName: 'Zoe',
    status: 'active',
    createdAt: new Date('2026-07-11T09:00:00.000Z'),
    createdBy: 'system',
  });

  const demandDto = {
    documentType: 'demand' as const,
    customerId: 1001,
    salesUserId: 2001,
    sourceCode: 'expo',
    requirements: 'Need 800 units',
    items: [
      {
        productId: 999,
        sku: 'SKU-DB-999',
        productName: '数据库正式产品',
        unit: 'pcs',
        quantity: 800,
        salePrice: 10,
      },
    ],
  };

  it('validates demand items against the Prisma product, not the runtime store', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T12:00:00.000Z');
    const prismaMock = {
      product: {
        findUnique: jest.fn().mockResolvedValue(buildPrismaProduct('formal')),
      },
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 201n,
          docNo: 'PENDING-DEMAND',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 201n,
          bizType: 'quote',
          docNo: 'PENDING-DEMAND',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: { id: 201, quoteNo: 'PENDING-DEMAND', status: 'draft' },
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

    const service = new QuoteService(prisma);
    // productId 999 does not exist in the runtime seed store; success proves
    // the demand check read the product from Prisma.
    await expect(service.create(demandDto)).resolves.toBeDefined();
    expect(prismaMock.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 999n } }),
    );
  });

  it('rejects a demand item whose Prisma product is not a formal product', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prismaMock = {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue(buildPrismaProduct('quote_candidate')),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new QuoteService(prisma);
    await expect(service.create(demandDto)).rejects.toThrow(/正式产品/);
    expect(prismaMock.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 999n } }),
    );
  });

  it('rejects quote + candidate before Prisma writes', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prismaMock = {
      product: {
        create: jest.fn(),
      },
      businessDocument: {
        create: jest.fn(),
      },
      operationLog: {
        create: jest.fn(),
      },
    };
    const service = new QuoteService(prismaMock as unknown as PrismaService);

    await expect(
      service.create({
        documentType: 'quote',
        productSource: 'candidate',
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'invalid quote candidate',
        items: [
          {
            createCandidateProduct: {
              sku: 'SKU-PRISMA-INVALID',
              nameCn: '数据库非法报价新品',
              category: 'electronics',
            },
            quantity: 20,
            salePrice: 9.9,
          },
        ],
      }),
    ).rejects.toThrow('报价单只能选择产品库产品');

    expect(prismaMock.product.create).not.toHaveBeenCalled();
    expect(prismaMock.businessDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.operationLog.create).not.toHaveBeenCalled();
  });

  it('persists customer feedback transitions through the Prisma path', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-09-22T10:00:00.000Z');
    const documentRecord = {
      id: 301n,
      bizType: 'quote',
      docNo: 'BJ-2026-09-22-0301',
      status: 'pending_customer_feedback',
      ownerUserId: 2001n,
      counterpartyId: 1001n,
      payload: {
        id: 301,
        quoteNo: 'BJ-2026-09-22-0301',
        documentType: 'quote',
        productSource: 'existing',
        status: 'pending_customer_feedback',
        currentVersionNo: 1,
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'feedback persistence',
        createdAt: createdAt.toISOString(),
        items: [],
      },
      createdBy: 2001n,
      createdAt,
      updatedAt: createdAt,
    };
    const prismaMock: {
      businessDocument: {
        findUnique: jest.Mock;
        update: jest.Mock;
      };
      operationLog: { create: jest.Mock };
      $transaction?: jest.Mock;
    } = {
      businessDocument: {
        findUnique: jest.fn().mockResolvedValue(documentRecord),
        update: jest.fn().mockResolvedValue(documentRecord),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    prismaMock.$transaction = jest.fn(
      async (callback: (db: unknown) => Promise<unknown>): Promise<unknown> =>
        callback(prismaMock),
    );
    const service = new QuoteService(prismaMock as unknown as PrismaService);

    const result = await service.recordCustomerFeedback(
      301,
      { currentVersionNo: 1, result: 'no_follow_up', remark: '暂缓' },
      { role: 'sales', user: 'Zoe' },
    );

    expect(result.status).toBe('customer_no_follow_up');
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 301n },
      data: expect.objectContaining({
        status: 'customer_no_follow_up',
        payload: expect.objectContaining({
          customerFeedbackResult: 'no_follow_up',
          customerFeedbackBy: 'Zoe',
        }),
      }),
    });
  });
});
