import { StockInService } from '../src/stock-in/stock-in.service';

describe('StockInService prisma storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates confirmed inbound documents and ledger entries', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 601n,
          docNo: 'PENDING-STOCK-IN-601',
          createdAt: new Date('2026-07-14T09:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({ id: 601n }),
      },
      operationLog: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      inventoryBalance: { upsert: jest.fn().mockResolvedValue({ id: 1n }) },
      inventoryLedger: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    const service = new StockInService(prismaMock as any, {} as any);
    await service.create({
      sourceBizType: 'purchase_order',
      sourceBizId: 100,
      sourceDocNo: 'P202607110100',
      sourceCurrentStatus: 'purchasing',
      warehouseId: 1,
      locationId: 11,
      createdBy: 2002,
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          quantity: 40,
        },
      ],
    });

    expect(prismaMock.businessDocument.create).toHaveBeenCalled();
  });

  it('rejects purchase-order stock-in creation before purchase approval is completed', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        create: jest.fn(),
      },
    };

    const service = new StockInService(prismaMock as any, {} as any);

    await expect(
      service.create({
        sourceBizType: 'purchase_order',
        sourceBizId: 100,
        sourceDocNo: 'P202607110100',
        sourceCurrentStatus: 'draft',
        warehouseId: 1,
        locationId: 11,
        createdBy: 2002,
        items: [{ productId: 1, quantity: 40 }],
      }),
    ).rejects.toThrow('Only purchasing purchase orders can create stock-in orders');
    expect(prismaMock.businessDocument.create).not.toHaveBeenCalled();
  });

  it('lists, reads, and confirms stock-in documents from Prisma storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 601n,
            bizType: 'stock_in',
            docNo: 'SI202607140601',
            status: 'draft',
            createdAt: new Date('2026-07-14T09:00:00.000Z'),
            updatedAt: new Date('2026-07-14T09:10:00.000Z'),
            payload: {
              sourceBizType: 'purchase_order',
              sourceBizId: 100,
              sourceDocNo: 'P202607110100',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [
                {
                  productId: 1,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  quantity: 40,
                },
              ],
            },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 601n,
          bizType: 'stock_in',
          docNo: 'SI202607140601',
          status: 'draft',
          createdAt: new Date('2026-07-14T09:00:00.000Z'),
          updatedAt: new Date('2026-07-14T09:10:00.000Z'),
          payload: {
            sourceBizType: 'purchase_order',
            sourceBizId: 100,
            sourceDocNo: 'P202607110100',
            warehouseId: 1,
            locationId: 11,
            createdBy: 2002,
            items: [
              {
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                quantity: 40,
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: 601n,
          bizType: 'stock_in',
          docNo: 'SI202607140601',
          status: 'confirmed',
          createdAt: new Date('2026-07-14T09:00:00.000Z'),
          updatedAt: new Date('2026-07-14T09:15:00.000Z'),
          payload: {
            sourceBizType: 'purchase_order',
            sourceBizId: 100,
            sourceDocNo: 'P202607110100',
            warehouseId: 1,
            locationId: 11,
            createdBy: 2002,
            items: [
              {
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                quantity: 40,
              },
            ],
          },
        }),
      },
    };
    const inventoryService = {
      postInbound: jest.fn().mockResolvedValue(undefined),
    };

    const service = new StockInService(prismaMock as any, inventoryService as any);

    await expect(service.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ docNo: 'SI202607140601' })],
    });
    await expect(service.detail(601)).resolves.toMatchObject({
      docNo: 'SI202607140601',
      sourceDocNo: 'P202607110100',
    });
    await expect(service.confirm(601)).resolves.toMatchObject({
      status: 'confirmed',
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalled();
    expect(inventoryService.postInbound).toHaveBeenCalled();
  });

  it('paginates stock-in documents from Prisma storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 601n,
            bizType: 'stock_in',
            docNo: 'SI202607140601',
            status: 'draft',
            createdAt: new Date('2026-07-14T09:00:00.000Z'),
            updatedAt: new Date('2026-07-14T09:10:00.000Z'),
            payload: {
              sourceBizType: 'purchase_order',
              sourceBizId: 100,
              sourceDocNo: 'P202607110100',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, sku: 'SKU-LED-001', productName: '智能 LED 灯带', quantity: 40 }],
            },
          },
          {
            id: 602n,
            bizType: 'stock_in',
            docNo: 'SI202607140602',
            status: 'draft',
            createdAt: new Date('2026-07-14T09:01:00.000Z'),
            updatedAt: new Date('2026-07-14T09:11:00.000Z'),
            payload: {
              sourceBizType: 'purchase_order',
              sourceBizId: 101,
              sourceDocNo: 'P202607110101',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, sku: 'SKU-LED-001', productName: '智能 LED 灯带', quantity: 20 }],
            },
          },
          {
            id: 603n,
            bizType: 'stock_in',
            docNo: 'SI202607140603',
            status: 'draft',
            createdAt: new Date('2026-07-14T09:02:00.000Z'),
            updatedAt: new Date('2026-07-14T09:12:00.000Z'),
            payload: {
              sourceBizType: 'purchase_order',
              sourceBizId: 102,
              sourceDocNo: 'P202607110102',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, sku: 'SKU-LED-001', productName: '智能 LED 灯带', quantity: 10 }],
            },
          },
        ]),
      },
    };

    const service = new StockInService(prismaMock as any, {} as any);
    const result = await service.list({ page: 2, pageSize: 2 });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.docNo)).toEqual(['SI202607140603']);
  });
});
