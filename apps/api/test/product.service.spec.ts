import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductService } from '../src/product/product.service';

describe('ProductService', () => {
  it('lists seeded active products and filters by keyword', async () => {
    const service = new ProductService();

    const result = await service.list({
      keyword: 'LED',
      status: 'active',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sku: 'SKU-LED-001',
      nameCn: '智能 LED 灯带',
      nameEn: 'Smart LED Strip',
      status: 'active',
    });
  });

  it('lists legacy runtime products that do not yet have extended product fields', async () => {
    const originalDataDir = process.env.ERP_DATA_DIR;
    const dataDir = mkdtempSync(join(tmpdir(), 'erp-product-legacy-'));
    writeFileSync(
      join(dataDir, 'product-runtime.json'),
      JSON.stringify({
        products: [
          {
            id: 1,
            sku: 'SKU-LEGACY-001',
            nameCn: '旧版商品',
            nameEn: 'Legacy Product',
            category: 'electronics',
            unit: 'pcs',
            currency: 'USD',
            defaultSalePrice: 10,
            defaultPurchasePrice: 6,
            ownerName: 'Zoe',
            status: 'active',
            createdAt: '2026-07-11T09:00:00.000Z',
            createdBy: 'system',
          },
        ],
        nextId: 2,
      }),
      'utf8',
    );
    process.env.ERP_DATA_DIR = dataDir;

    try {
      const service = new ProductService();
      const result = await service.list({ keyword: '旧版' });

      expect(result.items[0]).toMatchObject({
        sku: 'SKU-LEGACY-001',
        salesCode: '',
        purchaseCode: '',
        productStage: 'formal',
        pricingMode: 'fixed',
        salePriceTiers: [],
      });
    } finally {
      if (originalDataDir === undefined) {
        delete process.env.ERP_DATA_DIR;
      } else {
        process.env.ERP_DATA_DIR = originalDataDir;
      }
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('resolves purchase supplier from product default supplier code', async () => {
    const service = new ProductService();

    await expect(
      service.resolvePurchaseSupplierForLine({
        productId: 501,
        sku: 'SKU-LED-001',
      }),
    ).resolves.toMatchObject({
      productId: 1,
      sku: 'SKU-LED-001',
      purchaseCode: 'PUR-LED-001',
      defaultPurchasePrice: 8.5,
      supplierId: 4,
      supplierCode: 'SUP-LIGHT',
      supplierName: 'Light Source Manufacturing',
      purchaseOwnerName: 'Leo',
    });
  });

  it('filters products by product stage and pricing mode', async () => {
    const service = new ProductService();

    const result = await service.list({
      productStage: 'formal',
      pricingMode: 'tiered',
    });

    expect(result.items.map((item) => item.sku)).toEqual(['SKU-LED-001']);
  });

  it('paginates filtered products after sorting', async () => {
    const service = new ProductService();

    await service.create({
      sku: 'SKU-AAA-000',
      salesCode: 'SALE-AAA-000',
      nameCn: '分页商品 A',
      nameEn: 'Paged Product A',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 10,
      defaultPurchasePrice: 6,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });
    await service.create({
      sku: 'SKU-ZZZ-999',
      salesCode: 'SALE-ZZZ-999',
      nameCn: '分页商品 Z',
      nameEn: 'Paged Product Z',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 20,
      defaultPurchasePrice: 12,
      ownerName: 'Leo',
      createdBy: 'Admin',
    });

    const result = await service.list({
      category: 'electronics',
      page: '2',
      pageSize: '2',
    });

    expect(result.total).toBe(4);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.sku)).toEqual(['SKU-LED-001', 'SKU-ZZZ-999']);
  });

  it('creates a new product sku with prices and audit fields', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-CAM-009',
      salesCode: 'SALE-CAM-009',
      nameCn: '户外摄像头',
      nameEn: 'Outdoor Camera',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 39.9,
      defaultPurchasePrice: 21.5,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    expect(created).toMatchObject({
      id: expect.any(Number),
      sku: 'SKU-CAM-009',
      nameCn: '户外摄像头',
      nameEn: 'Outdoor Camera',
      status: 'active',
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    const listed = await service.list({ category: 'electronics' });
    expect(listed.items.map((item) => item.sku)).toContain('SKU-CAM-009');
  });

  it('creates a quote candidate product with relaxed validation', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-Q-001',
      nameCn: '报价灯带',
      nameEn: '',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 12.5,
      defaultPurchasePrice: 7.5,
      ownerName: 'Zoe',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      createdBy: 'Zoe',
    });

    expect(created).toMatchObject({
      sku: 'SKU-Q-001',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      salesCode: '',
      status: 'active',
    });
  });

  it('generates the sales code when a manually created product selects automatic mode', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-AUTO-SALES-001',
      salesCode: '',
      salesCodeMode: 'generated',
      purchaseCodeMode: 'manual',
      productStage: 'formal',
      pricingMode: 'fixed',
      nameCn: '自动销售编码产品',
      nameEn: 'Automatic Sales Code Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 28.8,
      defaultPurchasePrice: 18.6,
      ownerName: 'Admin',
      createdBy: 'Admin',
    } as any);

    expect(created.salesCode).toMatch(/^SALE-ELEC-\d{4}-\d{2}-\d{3}$/);
  });

  it('creates one active quote candidate and reuses it by normalized SKU', async () => {
    const service = new ProductService();
    const input = {
      sku: ' sku-flow-candidate-001 ',
      nameCn: '流程候选产品',
      category: 'electronics',
      unit: 'pcs',
      confirmedSalePrice: 28.8,
      confirmedPurchasePrice: 18.6,
      supplierCode: 'SUP-BRAVO',
      operator: 'Boss',
    };

    const first = await service.findOrCreateQuoteCandidate(input);
    const second = await service.findOrCreateQuoteCandidate(input);
    const listed = await service.list({ keyword: 'SKU-FLOW-CANDIDATE-001' });

    expect(first).toMatchObject({
      sku: 'SKU-FLOW-CANDIDATE-001',
      productStage: 'quote_candidate',
      status: 'active',
      defaultSalePrice: 28.8,
      defaultPurchasePrice: 18.6,
    });
    expect(second.id).toBe(first.id);
    expect(listed.items).toHaveLength(1);
  });

  it('returns and updates the product code rule', async () => {
    const service = new ProductService();

    await expect(service.getCodeRule()).resolves.toMatchObject({
      strategy: 'composed_segments',
      serialLength: 3,
      serialScope: 'per_supplier_total',
    });

    await expect(
      service.updateCodeRule({
        strategy: 'composed_segments',
        serialLength: 4,
        serialScope: 'per_supplier_month',
        segments: [
          { key: 'prefix', enabled: true, order: 1, value: 'PD' },
          { key: 'supplier_code', enabled: true, order: 2 },
          { key: 'category_code', enabled: true, order: 3 },
          { key: 'year', enabled: true, order: 4 },
          { key: 'month', enabled: true, order: 5 },
          { key: 'serial', enabled: true, order: 6 },
        ],
        updatedBy: 'Admin',
      } as any),
    ).resolves.toMatchObject({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      updatedBy: 'Admin',
    });

    await expect(service.getCodeRule()).resolves.toMatchObject({
      serialLength: 4,
    });
  });

  it('keeps purchase and sales code rules independent', async () => {
    const service = new ProductService();
    const before = await service.getCodeRules();

    await service.updateCodeRuleByKind('sales', {
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'global_year',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'SAL' },
        { key: 'category_code', enabled: true, order: 2 },
        { key: 'year', enabled: true, order: 3 },
        { key: 'serial', enabled: true, order: 4 },
      ],
      updatedBy: 'Admin',
    });

    const after = await service.getCodeRules();
    expect(after.purchase).toEqual(before.purchase);
    expect(after.sales).toMatchObject({
      serialLength: 4,
      serialScope: 'global_year',
      updatedBy: 'Admin',
    });
    await expect(service.generateSalesCodeByRule('electronics')).resolves.toMatch(
      /^SAL-ELEC-\d{4}-\d{4}$/,
    );
    await expect(
      service.updateCodeRuleByKind('sales', {
        strategy: 'composed_segments',
        serialLength: 3,
        serialScope: 'global_total',
        segments: [
          { key: 'supplier_code', enabled: true, order: 1 },
          { key: 'serial', enabled: true, order: 2 },
        ],
        updatedBy: 'Admin',
      }),
    ).resolves.toMatchObject({ serialLength: 3 });
    await expect(service.generateSalesCodeByRule('electronics', 'SUP-LIGHT')).resolves.toMatch(/^SUP-LIGHT-\d{3}$/);
    await expect(service.generateSalesCodeByRule('electronics')).rejects.toThrow('供应商编码');
  });

  it('generates purchase code from supplier code and sequence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T00:00:00.000Z'));
    const service = new ProductService();

    await service.updateCodeRule({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'PD' },
        { key: 'supplier_code', enabled: true, order: 2 },
        { key: 'category_code', enabled: true, order: 3 },
        { key: 'year', enabled: true, order: 4 },
        { key: 'month', enabled: true, order: 5 },
        { key: 'serial', enabled: true, order: 6 },
      ],
      updatedBy: 'Admin',
    } as any);

    const first = await service.create({
      sku: 'SKU-SUP-101',
      salesCode: 'SALE-SUP-101',
      purchaseCodeMode: 'generated',
      productStage: 'formal',
      nameCn: '供应商序列商品一',
      nameEn: 'Supplier Sequence Product One',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 15,
      defaultPurchasePrice: 8,
      ownerName: 'Leo',
      defaultSupplierCode: 'SUP-BRAVO',
      createdBy: 'Admin',
    });

    const second = await service.create({
      sku: 'SKU-SUP-102',
      salesCode: 'SALE-SUP-102',
      purchaseCodeMode: 'generated',
      productStage: 'formal',
      nameCn: '供应商序列商品二',
      nameEn: 'Supplier Sequence Product Two',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 18,
      defaultPurchasePrice: 10,
      ownerName: 'Leo',
      defaultSupplierCode: 'SUP-BRAVO',
      createdBy: 'Admin',
    });

    expect(first.purchaseCode).toBe('PD-SUP-BRAVO-ELEC-2026-07-0001');
    expect(second.purchaseCode).toBe('PD-SUP-BRAVO-ELEC-2026-07-0002');
    jest.useRealTimers();
  });

  it('rejects generated purchase code with a clear unit code message', async () => {
    const service = new ProductService();

    await service.updateCodeRule({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'PD' },
        { key: 'supplier_code', enabled: true, order: 2 },
        { key: 'category_code', enabled: true, order: 3 },
        { key: 'year', enabled: true, order: 4 },
        { key: 'month', enabled: true, order: 5 },
        { key: 'serial', enabled: true, order: 6 },
      ],
      updatedBy: 'Admin',
    } as any);

    await expect(
      service.create({
        sku: 'SKU-GEN-NO-UNIT',
        salesCode: 'SALE-GEN-NO-UNIT',
        purchaseCodeMode: 'generated',
        factorySourceMode: 'manual',
        productStage: 'formal',
        nameCn: '缺少单位编码商品',
        nameEn: '',
        category: 'electronics',
        unit: '10',
        currency: 'USD',
        defaultSalePrice: 0,
        defaultPurchasePrice: 0,
        ownerName: 'Admin',
        createdBy: 'Admin',
      }),
    ).rejects.toThrow(
      '自动生成采购编码需要单位编码。请选择供应商自动带出，或切换为手工填写采购编码。',
    );
  });

  it('resets monthly serial numbers in a new month', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-17T08:00:00.000Z'));
    const service = new ProductService();

    await service.updateCodeRule({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'per_supplier_month',
      segments: [
        { key: 'prefix', enabled: true, order: 1, value: 'PD' },
        { key: 'supplier_code', enabled: true, order: 2 },
        { key: 'category_code', enabled: true, order: 3 },
        { key: 'year', enabled: true, order: 4 },
        { key: 'month', enabled: true, order: 5 },
        { key: 'serial', enabled: true, order: 6 },
      ],
      updatedBy: 'Admin',
    } as any);

    const julyProduct = await service.create({
      sku: 'SKU-MONTH-001',
      salesCode: 'SALE-MONTH-001',
      purchaseCodeMode: 'generated',
      productStage: 'formal',
      nameCn: '七月商品',
      nameEn: 'July Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 15,
      defaultPurchasePrice: 8,
      ownerName: 'Leo',
      defaultSupplierCode: 'SUP-BRAVO',
      createdBy: 'Admin',
    });

    jest.setSystemTime(new Date('2026-08-02T08:00:00.000Z'));

    const augustProduct = await service.create({
      sku: 'SKU-MONTH-002',
      salesCode: 'SALE-MONTH-002',
      purchaseCodeMode: 'generated',
      productStage: 'formal',
      nameCn: '八月商品',
      nameEn: 'August Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 18,
      defaultPurchasePrice: 10,
      ownerName: 'Leo',
      defaultSupplierCode: 'SUP-BRAVO',
      createdBy: 'Admin',
    });

    expect(julyProduct.purchaseCode).toBe('PD-SUP-BRAVO-ELEC-2026-07-0001');
    expect(augustProduct.purchaseCode).toBe('PD-SUP-BRAVO-ELEC-2026-08-0001');

    jest.useRealTimers();
  });

  it('rejects generated purchase code when rule requires category but category is missing', async () => {
    const service = new ProductService();

    await service.updateCodeRule({
      strategy: 'composed_segments',
      serialLength: 4,
      serialScope: 'global_total',
      segments: [
        { key: 'category_code', enabled: true, order: 1 },
        { key: 'serial', enabled: true, order: 2 },
      ],
      updatedBy: 'Admin',
    } as any);

    await expect(
      service.create({
        sku: 'SKU-SUP-201',
        salesCode: 'SALE-SUP-201',
        purchaseCodeMode: 'generated',
        productStage: 'formal',
        nameCn: '分类缺失商品',
        nameEn: 'Missing Category Product',
        category: '' as any,
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 20,
        defaultPurchasePrice: 10,
        ownerName: 'Leo',
        createdBy: 'Admin',
      }),
    ).rejects.toThrow('商品分类不合法');
  });

  it('rejects formal products without sales code', async () => {
    const service = new ProductService();

    await expect(
      service.create({
        sku: 'SKU-F-001',
        nameCn: '正式灯带',
        nameEn: '',
        category: 'electronics',
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 15,
        defaultPurchasePrice: 8,
        ownerName: 'Zoe',
        productStage: 'formal',
        pricingMode: 'fixed',
        createdBy: 'Zoe',
      }),
    ).rejects.toThrow('销售编码不能为空');
  });

  it('rejects default supplier code that is not a supplier', async () => {
    const service = new ProductService();

    await expect(
      service.create({
        sku: 'SKU-SUP-001',
        salesCode: 'SALE-SUP-001',
        nameCn: '供应商校验商品',
        nameEn: '',
        category: 'electronics',
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 15,
        defaultPurchasePrice: 8,
        ownerName: 'Zoe',
        productStage: 'formal',
        pricingMode: 'fixed',
        defaultSupplierCode: 'CUST-ACME',
        createdBy: 'Zoe',
      }),
    ).rejects.toThrow('默认供应商编码必须关联供应商');
  });

  it('allows manual factory mode with handwritten unit code', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-MANUAL-001',
      salesCode: 'SALE-MANUAL-001',
      factorySourceMode: 'manual',
      factoryName: '宁波自填工厂',
      defaultSupplierCode: 'FACTORY-001',
      nameCn: '手写工厂商品',
      nameEn: 'Manual Factory Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 25,
      defaultPurchasePrice: 15,
      ownerName: 'Leo',
      productStage: 'formal',
      pricingMode: 'fixed',
      createdBy: 'Admin',
    });

    expect(created).toMatchObject({
      factoryName: '宁波自填工厂',
      defaultSupplierCode: 'FACTORY-001',
    });
  });

  it('resolves supplier linked factory mode from selected supplier', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-SUP-LINK-001',
      salesCode: 'SALE-SUP-LINK-001',
      factorySourceMode: 'supplier',
      factoryName: '会被供应商覆盖',
      defaultSupplierCode: 'SUP-BRAVO',
      nameCn: '供应商联动商品',
      nameEn: 'Supplier Linked Product',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 30,
      defaultPurchasePrice: 18,
      ownerName: 'Leo',
      productStage: 'formal',
      pricingMode: 'fixed',
      createdBy: 'Admin',
    });

    expect(created).toMatchObject({
      factoryName: 'Bravo Industrial',
      defaultSupplierCode: 'SUP-BRAVO',
    });
  });

  it('rejects duplicate skus', async () => {
    const service = new ProductService();

    await expect(
      service.create({
        sku: 'SKU-LED-001',
        nameCn: '重复灯带',
        nameEn: 'Duplicate LED',
        category: 'electronics',
        unit: 'pcs',
        currency: 'USD',
        defaultSalePrice: 10,
        defaultPurchasePrice: 5,
        ownerName: 'Zoe',
        createdBy: 'Admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates editable product fields and keeps creation audit fields', async () => {
    const service = new ProductService();

    const updated = await service.update(1, {
      nameCn: '智能 LED 灯带升级版',
      nameEn: 'Smart LED Strip Pro',
      defaultSalePrice: 18.8,
      updatedBy: 'Admin',
    });

    expect(updated).toMatchObject({
      id: 1,
      nameCn: '智能 LED 灯带升级版',
      nameEn: 'Smart LED Strip Pro',
      defaultSalePrice: 18.8,
      createdBy: 'system',
      updatedBy: 'Admin',
    });
  });

  it('replaces tiered sale prices when updating a tiered product', async () => {
    const service = new ProductService();

    const updated = await service.update(1, {
      pricingMode: 'tiered',
      salePriceTiers: [
        { id: 1, minQuantity: 10, salePrice: 16.8, currency: 'USD', status: 'active' },
        { id: 2, minQuantity: 500, salePrice: 13.2, currency: 'USD', status: 'active' },
      ],
      updatedBy: 'Admin',
    });

    expect(updated.pricingMode).toBe('tiered');
    expect(updated.salePriceTiers).toEqual([
      expect.objectContaining({
        id: 1,
        minQuantity: 10,
        salePrice: 16.8,
        currency: 'USD',
        status: 'active',
      }),
      expect.objectContaining({
        id: 2,
        minQuantity: 500,
        salePrice: 13.2,
        currency: 'USD',
        status: 'active',
      }),
    ]);
  });

  it('deactivates a product with soft delete semantics', async () => {
    const service = new ProductService();

    const deactivated = await service.deactivate(2, {
      operatedBy: 'Admin',
      reason: '停产',
    });

    expect(deactivated).toMatchObject({
      id: 2,
      status: 'inactive',
      deactivatedBy: 'Admin',
      deactivatedReason: '停产',
    });

    const inactive = await service.list({ status: 'inactive' });
    expect(inactive.items.map((item) => item.id)).toContain(2);
  });

  it('reactivates a previously inactive product', async () => {
    const service = new ProductService();

    await service.deactivate(2, {
      operatedBy: 'Admin',
      reason: '停产',
    });

    const activated = await service.activate(2, {
      operatedBy: 'Admin',
      reason: '恢复销售',
    });

    expect(activated).toMatchObject({
      id: 2,
      status: 'active',
    });
    expect(activated.deactivatedBy).toBeUndefined();
    expect(activated.deactivatedReason).toBeUndefined();
  });

  it('deletes a product with soft delete status and blocks later activation', async () => {
    const service = new ProductService();

    const deleted = await service.deleteProduct(2, {
      operatedBy: 'Admin',
      reason: '重复建档',
    });

    expect(deleted).toMatchObject({
      id: 2,
      status: 'deleted',
      deactivatedBy: 'Admin',
      deactivatedReason: '重复建档',
    });

    const deletedList = await service.list({ status: 'deleted' });
    expect(deletedList.items.map((item) => item.id)).toContain(2);

    await expect(
      service.activate(2, {
        operatedBy: 'Admin',
        reason: '误删恢复',
      }),
    ).rejects.toThrow('已删除商品不可启用');
  });

  it('hides deleted products from the default list while keeping them queryable by deleted status', async () => {
    const service = new ProductService();

    await service.deleteProduct(2, {
      operatedBy: 'Admin',
      reason: '重复建档',
    });

    const defaultList = await service.list({});
    const deletedList = await service.list({ status: 'deleted' });

    expect(defaultList.items.map((item) => item.id)).not.toContain(2);
    expect(deletedList.items.map((item) => item.id)).toContain(2);
  });

  it('converts a quote candidate product into a formal product', async () => {
    const service = new ProductService();

    const created = await service.create({
      sku: 'SKU-CONV-001',
      salesCode: 'SALE-CONV-001',
      nameCn: '待转正式商品',
      nameEn: '',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 25,
      defaultPurchasePrice: 15,
      ownerName: 'Zoe',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      createdBy: 'Zoe',
    });

    const converted = await service.convertToFormal(created.id, {
      operatedBy: 'Admin',
    });

    expect(converted).toMatchObject({
      id: created.id,
      productStage: 'formal',
      salesCode: 'SALE-CONV-001',
      updatedBy: 'Admin',
    });
  });

  it('throws not found when updating a missing product', async () => {
    const service = new ProductService();

    await expect(
      service.update(999, {
        nameCn: '不存在',
        updatedBy: 'Admin',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records and lists product audit logs', async () => {
    const service = new ProductService();

    await service.create({
      sku: 'SKU-CAM-010',
      salesCode: 'SALE-CAM-010',
      nameCn: '巡检摄像头',
      nameEn: 'Inspection Camera',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 45.5,
      defaultPurchasePrice: 25.2,
      ownerName: 'Zoe',
      createdBy: 'Admin',
    });

    const result = await service.listAuditLogs();

    expect(result.items[0]).toMatchObject({
      bizType: 'product',
      operationType: 'create_product',
    });
  });
});
