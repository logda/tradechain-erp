import { ProductService } from '../src/product/product.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('ProductService prisma storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates products in Prisma and writes audit logs', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T09:30:00.000Z');
    const prisma = {
      counterparty: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2n,
          code: 'SUP-LIGHT',
          type: 'supplier',
        }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 8n,
          sku: 'SKU-CAM-108',
          salesCode: 'SALE-CAM-108',
          purchaseCode: 'PUR-CAM-108',
          purchaseCodeMode: 'manual',
          productStage: 'formal',
          pricingMode: 'tiered',
          brand: 'OpenAI Vision',
          factoryName: 'Shenzhen Vision Factory',
          spec: '4K / HDMI',
          singleWeight: { toNumber: () => 1.25 },
          cartonSpec: '10 pcs / carton',
          cartonQuantity: 10,
          cartonWeight: { toNumber: () => 13.4 },
          defaultSupplierCode: 'SUP-LIGHT',
          nameCn: '会议摄像头',
          nameEn: 'Conference Camera',
          category: 'electronics',
          unit: 'pcs',
          currency: 'USD',
          defaultSalePrice: { toNumber: () => 88.8 },
          defaultPurchasePrice: { toNumber: () => 60 },
          ownerName: 'Zoe',
          status: 'active',
          createdBy: 'Admin',
          createdAt,
          updatedBy: null,
          updatedAt: createdAt,
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
          salePriceTiers: [
            {
              id: 101n,
              minQuantity: 1,
              salePrice: { toNumber: () => 88.8 },
              currency: 'USD',
              status: 'active',
              createdBy: 'Admin',
              createdAt,
              updatedBy: null,
              updatedAt: createdAt,
            },
            {
              id: 102n,
              minQuantity: 100,
              salePrice: { toNumber: () => 82.5 },
              currency: 'USD',
              status: 'active',
              createdBy: 'Admin',
              createdAt,
              updatedBy: null,
              updatedAt: createdAt,
            },
          ],
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    } as unknown as PrismaService;

    const service = new ProductService(prisma);
    const result = await service.create({
      sku: ' sku-cam-108 ',
      salesCode: 'SALE-CAM-108',
      purchaseCode: 'PUR-CAM-108',
      purchaseCodeMode: 'manual',
      productStage: 'formal',
      pricingMode: 'tiered',
      brand: 'OpenAI Vision',
      factoryName: 'Shenzhen Vision Factory',
      spec: '4K / HDMI',
      singleWeight: 1.25,
      cartonSpec: '10 pcs / carton',
      cartonQuantity: 10,
      cartonWeight: 13.4,
      defaultSupplierCode: 'SUP-LIGHT',
      salePriceTiers: [
        { minQuantity: 1, salePrice: 88.8, currency: 'USD' },
        { minQuantity: 100, salePrice: 82.5, currency: 'USD' },
      ],
      nameCn: '会议摄像头',
      nameEn: 'Conference Camera',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 88.8,
      defaultPurchasePrice: 60,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { sku: 'SKU-CAM-108' },
    });
    expect(prisma.counterparty.findUnique).toHaveBeenCalledWith({
      where: { code: 'SUP-LIGHT' },
    });
    expect(prisma.product.create).toHaveBeenCalledWith({
      include: { salePriceTiers: { orderBy: { minQuantity: 'asc' } } },
      data: expect.objectContaining({
        sku: 'SKU-CAM-108',
        salesCode: 'SALE-CAM-108',
        purchaseCode: 'PUR-CAM-108',
        purchaseCodeMode: 'manual',
        productStage: 'formal',
        pricingMode: 'tiered',
        brand: 'OpenAI Vision',
        factoryName: 'Shenzhen Vision Factory',
        spec: '4K / HDMI',
        defaultSupplierCode: 'SUP-LIGHT',
        nameCn: '会议摄像头',
        nameEn: 'Conference Camera',
        category: 'electronics',
        ownerName: 'Zoe',
        status: 'active',
        createdBy: 'Admin',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'product',
        bizId: 8n,
        operationType: 'create_product',
        operatorId: 0n,
      }),
    });
    expect(result).toMatchObject({
      id: 8,
      sku: 'SKU-CAM-108',
      salesCode: 'SALE-CAM-108',
      purchaseCode: 'PUR-CAM-108',
      purchaseCodeMode: 'manual',
      productStage: 'formal',
      pricingMode: 'tiered',
      defaultSupplierCode: 'SUP-LIGHT',
      defaultSalePrice: 88.8,
      defaultPurchasePrice: 60,
      createdAt: '2026-07-13T09:30:00.000Z',
    });
    expect(result.salePriceTiers).toEqual([
      expect.objectContaining({
        minQuantity: 1,
        salePrice: 88.8,
      }),
      expect.objectContaining({
        minQuantity: 100,
        salePrice: 82.5,
      }),
    ]);
  });

  it('generates the configured sales code during Prisma product creation', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-09-22T09:30:00.000Z');
    const product = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 18n,
        ...data,
        salesCode: data.salesCode,
        purchaseCode: data.purchaseCode,
        brand: null,
        factoryName: null,
        model: null,
        spec: null,
        singleWeight: null,
        cartonSpec: null,
        cartonQuantity: null,
        cartonWeight: null,
        defaultSupplierCode: null,
        defaultSalePrice: { toNumber: () => 28.8 },
        defaultPurchasePrice: { toNumber: () => 18.6 },
        createdAt,
        updatedAt: createdAt,
        updatedBy: null,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivatedReason: null,
        salePriceTiers: [],
      })),
    };
    const prisma = {
      product,
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    } as unknown as PrismaService;

    const created = await new ProductService(prisma).create({
      sku: 'SKU-PRISMA-AUTO-SALES-001',
      salesCode: '',
      salesCodeMode: 'generated',
      purchaseCodeMode: 'manual',
      productStage: 'formal',
      pricingMode: 'fixed',
      nameCn: '数据库自动销售编码产品',
      nameEn: 'Prisma Automatic Sales Code Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 28.8,
      defaultPurchasePrice: 18.6,
      ownerName: 'Admin',
      createdBy: 'Admin',
    });

    expect(created.salesCode).toMatch(/^SALE-ELEC-\d{4}-\d{2}-\d{3}$/);
    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesCode: expect.stringMatching(/^SALE-ELEC-\d{4}-\d{2}-\d{3}$/),
        }),
      }),
    );
  });

  it('translates Prisma sales code uniqueness errors into business validation messages', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue({
          code: 'P2002',
          meta: { target: ['salesCode'] },
        }),
      },
      operationLog: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    const service = new ProductService(prisma);

    await expect(
      service.create({
        sku: 'SALE-DUP-001',
        salesCode: 'SALE-DUP-001',
        purchaseCodeMode: 'manual',
        productStage: 'formal',
        pricingMode: 'fixed',
        nameCn: '重复销售编码商品',
        nameEn: 'Duplicate Sales Code Product',
        category: 'electronics',
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 35,
        defaultPurchasePrice: 18,
        ownerName: 'Admin',
        createdBy: 'Admin',
      }),
    ).rejects.toMatchObject({
      message: '销售编码已存在',
    });
  });

  it('lists, updates, deactivates, and reactivates products through Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T09:30:00.000Z');
    const updatedAt = new Date('2026-07-13T10:30:00.000Z');
    const activeRecord = {
      id: 11n,
      sku: 'SKU-SENSOR-001',
      nameCn: '温湿度传感器',
      nameEn: 'Temp Humidity Sensor',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: { toNumber: () => 18.5 },
      defaultPurchasePrice: { toNumber: () => 9.2 },
      pricingMode: 'fixed',
      salePriceTiers: [],
      ownerName: 'Zoe',
      status: 'active',
      createdBy: 'Admin',
      createdAt,
      updatedBy: null,
      updatedAt: createdAt,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    };
    const updatedRecord = {
      ...activeRecord,
      nameCn: '温湿度传感器 Pro',
      defaultSalePrice: { toNumber: () => 22.8 },
      pricingMode: 'tiered',
      salePriceTiers: [
        {
          id: 201n,
          minQuantity: 50,
          salePrice: { toNumber: () => 21.5 },
          currency: 'USD',
          status: 'active',
          createdBy: 'Admin',
          createdAt,
          updatedBy: null,
          updatedAt,
        },
      ],
      updatedBy: 'Admin',
      updatedAt,
    };
    const deactivatedRecord = {
      ...updatedRecord,
      status: 'inactive',
      deactivatedAt: updatedAt,
      deactivatedBy: 'Admin',
      deactivatedReason: '停产',
    };
    const activatedRecord = {
      ...deactivatedRecord,
      status: 'active',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    };
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([activeRecord]),
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(activeRecord)
          .mockResolvedValueOnce(updatedRecord)
          .mockResolvedValueOnce(deactivatedRecord),
        update: jest
          .fn()
          .mockResolvedValueOnce(updatedRecord)
          .mockResolvedValueOnce(deactivatedRecord)
          .mockResolvedValueOnce(activatedRecord),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    } as unknown as PrismaService;

    const service = new ProductService(prisma);
    const listed = await service.list({
      keyword: 'sensor',
      category: 'electronics',
      status: 'active',
    });
    const updated = await service.update(11, {
      nameCn: '温湿度传感器 Pro',
      defaultSalePrice: 22.8,
      pricingMode: 'tiered',
      salePriceTiers: [
        { id: 1, minQuantity: 50, salePrice: 21.5, currency: 'USD', status: 'active' },
      ],
      updatedBy: 'Admin',
    });
    const deactivated = await service.deactivate(11, {
      operatedBy: 'Admin',
      reason: '停产',
    });
    const activated = await service.activate(11, {
      operatedBy: 'Admin',
      reason: '恢复销售',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      include: { salePriceTiers: { orderBy: { minQuantity: 'asc' } } },
      orderBy: { sku: 'asc' },
    });
    expect(listed.items).toHaveLength(1);
    expect(prisma.product.update).toHaveBeenNthCalledWith(1, {
      include: { salePriceTiers: { orderBy: { minQuantity: 'asc' } } },
      where: { id: 11n },
      data: expect.objectContaining({
        nameCn: '温湿度传感器 Pro',
        defaultSalePrice: 22.8,
        pricingMode: 'tiered',
        salePriceTiers: {
          deleteMany: {},
          create: [
            expect.objectContaining({
              minQuantity: 50,
              salePrice: 21.5,
              currency: 'USD',
              status: 'active',
            }),
          ],
        },
        updatedBy: 'Admin',
      }),
    });
    expect(prisma.product.update).toHaveBeenNthCalledWith(2, {
      include: { salePriceTiers: { orderBy: { minQuantity: 'asc' } } },
      where: { id: 11n },
      data: expect.objectContaining({
        status: 'inactive',
        deactivatedBy: 'Admin',
        deactivatedReason: '停产',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'product',
        bizId: 11n,
        operationType: 'update_product',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'product',
        bizId: 11n,
        operationType: 'deactivate_product',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'product',
        bizId: 11n,
        operationType: 'activate_product',
      }),
    });
    expect(updated).toMatchObject({
      id: 11,
      nameCn: '温湿度传感器 Pro',
      defaultSalePrice: 22.8,
      pricingMode: 'tiered',
      updatedBy: 'Admin',
    });
    expect(updated.salePriceTiers).toEqual([
      expect.objectContaining({
        minQuantity: 50,
        salePrice: 21.5,
      }),
    ]);
    expect(deactivated).toMatchObject({
      id: 11,
      status: 'inactive',
      deactivatedBy: 'Admin',
      deactivatedReason: '停产',
    });
    expect(activated).toMatchObject({
      id: 11,
      status: 'active',
    });
  });
});
