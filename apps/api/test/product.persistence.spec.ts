import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductService } from '../src/product/product.service';

describe('ProductService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-product-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists created products across service instances', async () => {
    const firstService = new ProductService();
    await firstService.create({
      sku: 'SKU-CAM-108',
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

    const secondService = new ProductService();
    const listed = await secondService.list({ ownerName: 'Zoe' });

    expect(listed.items.map((item) => item.sku)).toContain('SKU-CAM-108');
    expect(listed.items.find((item) => item.sku === 'SKU-CAM-108')).toMatchObject({
      salesCode: 'SALE-CAM-108',
      purchaseCode: 'PUR-CAM-108',
      productStage: 'formal',
      pricingMode: 'tiered',
      defaultSupplierCode: 'SUP-LIGHT',
    });
    expect(
      listed.items.find((item) => item.sku === 'SKU-CAM-108')?.salePriceTiers,
    ).toEqual([
      expect.objectContaining({ minQuantity: 1, salePrice: 88.8 }),
      expect.objectContaining({ minQuantity: 100, salePrice: 82.5 }),
    ]);
  });

  it('persists product reactivation and audit history across service instances', async () => {
    const firstService = new ProductService();
    const created = await firstService.create({
      sku: 'SKU-RE-201',
      nameCn: '可恢复商品',
      nameEn: 'Recoverable Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 22,
      defaultPurchasePrice: 12,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    await firstService.deactivate(created.id, {
      operatedBy: 'Admin',
      reason: '临时停用',
    });
    await firstService.activate(created.id, {
      operatedBy: 'Admin',
      reason: '恢复销售',
    });

    const secondService = new ProductService();
    const listed = await secondService.list({ ownerName: 'Zoe' });
    const logs = await secondService.listAuditLogs();

    expect(listed.items.find((item) => item.id === created.id)).toMatchObject({
      status: 'active',
    });
    expect(logs.items.map((item) => item.operationType)).toEqual(
      expect.arrayContaining(['deactivate_product', 'activate_product']),
    );
  });
});
