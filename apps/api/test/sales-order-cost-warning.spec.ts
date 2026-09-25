import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FORMAL_ACTIONS_KEY, FORMAL_ROLES_KEY } from '../src/auth/formal-role.decorator';
import { ProductService } from '../src/product/product.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import type { SalesOrderService } from '../src/sales-order/sales-order.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('sales order approval cost warning', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-sales-cost-warning-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('reads the current runtime product cost by SKU when a manual line has no product id', async () => {
    const products = new ProductService();
    await products.create({
      sku: 'SKU-COST-CHECK', salesCode: 'SALE-COST-CHECK', productStage: 'formal', nameCn: '风扇', nameEn: '',
      category: 'electronics', unit: '个/pc', currency: 'USD',
      defaultSalePrice: 30, defaultPurchasePrice: 18,
      ownerName: 'Zoe', createdBy: 'Admin',
    });

    expect(await products.getCurrentPurchasePriceForSalesLine({
      productId: 0, sku: 'SKU-COST-CHECK',
    })).toBe(18);
  });

  it('reads the current Prisma product cost without using runtime data', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const product = {
      findUnique: jest.fn().mockResolvedValue({
        id: 8n, sku: 'SKU-PRISMA-COST', nameCn: '灯具', nameEn: '',
        category: 'electronics', unit: '个/pc', currency: 'USD',
        defaultSalePrice: 30, defaultPurchasePrice: 22,
        ownerName: 'Zoe', status: 'active', createdBy: 'Admin',
        createdAt: new Date(), salePriceTiers: [],
      }),
    };
    const products = new ProductService({ product } as unknown as PrismaService);

    expect(await products.getCurrentPurchasePriceForSalesLine({
      productId: 8, sku: 'SKU-PRISMA-COST',
    })).toBe(22);
    expect(product.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 8n },
    }));
  });

  it('returns only below-cost product names at the approval node', async () => {
    const getDetail = jest.fn().mockResolvedValue({
      id: 12, status: 'pending_sales_manager_approval',
      items: [
        { productId: 1, sku: 'SKU-FAN', productName: '风扇', salePrice: 10 },
        { productId: 2, sku: 'SKU-LAMP', productName: '台灯', salePrice: 20 },
        { productId: 3, sku: 'SKU-NO-COST', productName: '无采购价产品', salePrice: 1 },
      ],
    });
    const getCurrentPurchasePriceForSalesLine = jest.fn()
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(0);
    const controller = new SalesOrderController(
      { getDetail } as unknown as SalesOrderService,
      undefined,
      { getCurrentPurchasePriceForSalesLine } as unknown as ProductService,
    );

    const result = await controller.getCostWarning(12, 'sales_manager', 'Mia');
    expect(result).toEqual({
      productNames: ['风扇'],
    });
    expect(JSON.stringify(result))
      .not.toMatch(/purchasePrice|15/);
    expect(Reflect.getMetadata(FORMAL_ROLES_KEY, controller.getCostWarning))
      .toEqual(['admin', 'boss', 'sales_manager']);
    expect(Reflect.getMetadata(FORMAL_ACTIONS_KEY, controller.getCostWarning))
      .toEqual(['sales.order.write']);
  });

  it('does not compare product costs outside the approval node', async () => {
    const getCurrentPurchasePriceForSalesLine = jest.fn();
    const controller = new SalesOrderController(
      { getDetail: jest.fn().mockResolvedValue({ id: 12, status: 'draft', items: [] }) } as unknown as SalesOrderService,
      undefined,
      { getCurrentPurchasePriceForSalesLine } as unknown as ProductService,
    );

    expect(await controller.getCostWarning(12, 'sales_manager', 'Mia'))
      .toEqual({ productNames: [] });
    expect(getCurrentPurchasePriceForSalesLine).not.toHaveBeenCalled();
  });

  it('rechecks the latest product cost each time the approval page requests a warning', async () => {
    const getCurrentPurchasePriceForSalesLine = jest.fn()
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5);
    const controller = new SalesOrderController(
      { getDetail: jest.fn().mockResolvedValue({
        id: 12, status: 'pending_sales_manager_approval',
        items: [{ productId: 1, sku: 'SKU-FAN', productName: '风扇', salePrice: 10 }],
      }) } as unknown as SalesOrderService,
      undefined,
      { getCurrentPurchasePriceForSalesLine } as unknown as ProductService,
    );

    expect(await controller.getCostWarning(12, 'sales_manager', 'Mia'))
      .toEqual({ productNames: ['风扇'] });
    expect(await controller.getCostWarning(12, 'sales_manager', 'Mia'))
      .toEqual({ productNames: [] });
  });
});
