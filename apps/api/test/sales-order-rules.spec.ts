import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { resolveQuoteStore } from '../src/quote/quote.store';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import { ProductService } from '../src/product/product.service';

function seedQuote(status = 'customer_accepted', id = 7, currentVersionNo = 3) {
  resolveQuoteStore().upsertQuote({
    id,
    quoteNo: `Q20260708${String(id).padStart(4, '0')}`,
    documentType: 'quote',
    status,
    currentVersionNo,
    customerId: 1001,
    customerName: 'Acme Trading',
    customerCode: 'CUST-ACME',
    customerEntryMode: 'existing',
    salesUserId: 2001,
    salesUserName: 'Zoe',
    sourceCode: 'expo',
    inquiryDate: '2026-07-18',
    destination: '',
    requirements: 'Need 500 units',
    currentProgress: status === 'customer_accepted' ? '客户已接受' : '草稿',
    submitMode: status === 'draft' ? 'draft' : 'submit',
    createdAt: '2026-07-11T09:00:00.000Z',
    items: [
      {
        lineNo: 1,
        productId: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 500,
        salePrice: 15.9,
        amount: 7950,
      },
    ],
  });
}

function seedSubmittedDemandQuote(id = 88, currentVersionNo = 1) {
  resolveQuoteStore().upsertQuote({
    id,
    quoteNo: `XQ20260708${String(id).padStart(4, '0')}`,
    documentType: 'demand',
    status: 'boss_approved',
    currentVersionNo,
    customerId: 1001,
    customerName: 'Acme Trading',
    customerCode: 'CUST-ACME',
    customerEntryMode: 'existing',
    salesUserId: 2001,
    salesUserName: 'Zoe',
    sourceCode: 'expo',
    inquiryDate: '2026-07-18',
    destination: '',
    requirements: 'Need 500 units',
    currentProgress: '已提交',
    submitMode: 'submit',
    createdAt: '2026-07-11T09:00:00.000Z',
    items: [
      {
        lineNo: 1,
        productId: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 500,
        salePrice: 15.9,
        amount: 7950,
      },
    ],
  });
}

describe('SalesOrderService', () => {
  let runtimeDir: string | undefined;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-sales-rules-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (runtimeDir) {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
    runtimeDir = undefined;
  });

  it('creates one direct sales order draft for manual sales entry', async () => {
    const service = new SalesOrderService();

    const result = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
      storeName: '02 Libuys',
      orderDate: '2026-05-30',
      estimatedDeliveryDate: '2026-06-08',
      shipTo: 'SH Boninoe',
      salesOrderRemark: '单个销售单可能会有多个工厂的产品',
      salesOrderAttachments: [
        {
          key: 'sales-order-attachments/2026/07/24/sales-image.png',
          fileName: 'sales-image.png',
          mimeType: 'image/png',
          size: 11,
          url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-image.png',
        },
        {
          key: 'sales-order-attachments/2026/07/24/sales-spec.pdf',
          fileName: 'sales-spec.pdf',
          mimeType: 'application/pdf',
          size: 10,
          url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-spec.pdf',
        },
      ],
    });

    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
    expect(result.sourceMode).toBe('direct');
    expect(result.customerName).toBe('Acme Trading');
    expect(result.customerOrderNo).toBe(result.salesNo);
    expect(result.orderingUnit).toBe('Acme Trading');
    expect(result.storeName).toBe('02 Libuys');
    expect(result.orderDate).toBe('2026-05-30');
    expect(result.estimatedDeliveryDate).toBe('2026-06-08');
    expect(result.shipTo).toBe('SH Boninoe');
    expect(result.salesOrderRemark).toBe('单个销售单可能会有多个工厂的产品');
    expect(result.salesOrderAttachments).toEqual([
      {
        key: 'sales-order-attachments/2026/07/24/sales-image.png',
        fileName: 'sales-image.png',
        mimeType: 'image/png',
        size: 11,
        url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-image.png',
      },
      {
        key: 'sales-order-attachments/2026/07/24/sales-spec.pdf',
        fileName: 'sales-spec.pdf',
        mimeType: 'application/pdf',
        size: 10,
        url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-spec.pdf',
      },
    ]);
  });

  it('defaults an omitted direct sales line unit to 个/pc', async () => {
    const service = new SalesOrderService();
    const result = await service.create({
      customerName: '单位默认值测试客户',
      title: '单位默认值测试',
      salesUserId: 2001,
      createdBy: 2001,
      items: [{ sku: 'SKU-UNIT-DEFAULT', productName: '手填产品', quantity: 2, salePrice: 3 }],
    });

    expect(result.items?.[0].unit).toBe('个/pc');
  });

  it('maps formal sales user ids to the correct sales order owner name', async () => {
    const service = new SalesOrderService();

    const result = await service.create({
      customerName: '测试客户正式 ID',
      title: '正式用户 ID 映射测试',
      salesUserId: 3,
      createdBy: 3,
    });
    const list = await service.list({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.salesUserId).toBe(3);
    expect(result.createdBy).toBe(3);
    expect(list.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          docNo: result.salesNo,
          ownerName: 'Zoe',
          createdBy: 'Zoe',
        }),
      ]),
    );
  });

  it('creates and submits a direct sales order when requested', async () => {
    const service = new SalesOrderService();

    const result = await service.create({
      submitMode: 'submit',
      customerName: 'Acme Trading',
      title: 'Acme 直接提交审批',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const detail = await service.getDetail(result.id);
    const auditLogs = await service.listAuditLogs();

    expect(result.status).toBe('pending_sales_manager_approval');
    expect(detail.status).toBe('pending_sales_manager_approval');
    expect(auditLogs.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bizType: 'sales_order',
          bizId: result.id,
          operationType: 'create_sales_order',
          operatorId: 2001,
        }),
        expect.objectContaining({
          bizType: 'sales_order',
          bizId: result.id,
          operationType: 'submit_sales_order',
          operatorId: 2001,
        }),
      ]),
    );
  });

  it('updates an existing sales order draft and keeps it as draft', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 原草稿',
      salesUserId: 2001,
      createdBy: 2001,
    });

    const updated = await service.updateDraft(created.id, {
      submitMode: 'draft',
      customerEntryMode: 'existing',
      customerId: 1,
      customerName: 'Acme Trading',
      customerCode: 'CUST-ACME',
      title: 'Acme 草稿继续保存',
      salesUserId: 2001,
      createdBy: 2001,
      storeName: '02 Libuys',
      orderDate: '2026-05-30',
      estimatedDeliveryDate: '2026-06-08',
      shipTo: 'SH Boninoe',
      salesOrderRemark: '草稿继续补资料',
      items: [
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 2,
          unitsPerPackage: 100,
          totalQuantity: 200,
          quantity: 200,
          unit: 'set',
          salePrice: 15.9,
          amount: 3180,
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-old.png',
          ],
        },
      ],
    });
    const detail = await service.getDetail(created.id);
    const auditLogs = await service.listAuditLogs();

    expect(updated).toMatchObject({
      id: created.id,
      status: 'draft',
      customerOrderNo: created.customerOrderNo,
      title: 'Acme 草稿继续保存',
      storeName: '02 Libuys',
    });
    expect(detail).toMatchObject({
      id: created.id,
      status: 'draft',
      customerOrderNo: created.customerOrderNo,
      title: 'Acme 草稿继续保存',
      salesOrderRemark: '草稿继续补资料',
    });
    expect(detail.items).toEqual([
      expect.objectContaining({
        sku: 'SKU-LED-001',
        totalQuantity: 200,
        factoryPicUrls: [
          'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-old.png',
        ],
      }),
    ]);
    expect(auditLogs.items).toContainEqual(
      expect.objectContaining({
        bizType: 'sales_order',
        bizId: created.id,
        operationType: 'update_sales_order_draft',
        operatorId: 2001,
      }),
    );
  });

  it('lets sales replace the default customer PO number when submitting a draft', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: '客户 PO 调整',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(created.customerOrderNo).toBe(created.salesNo);
    const submitted = await service.updateDraft(created.id, {
      submitMode: 'submit',
      customerOrderNo: 'CUSTOMER-PO-2026',
      customerName: 'Acme Trading',
      title: '客户 PO 调整',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(submitted.customerOrderNo).toBe('CUSTOMER-PO-2026');
    expect((await service.getDetail(created.id)).customerOrderNo).toBe('CUSTOMER-PO-2026');
  });

  it('preserves existing line items when draft autosave sends a partial payload', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 自动保存原草稿',
      salesUserId: 2001,
      createdBy: 2001,
      items: [
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 2,
          unitsPerPackage: 10,
          totalQuantity: 20,
          quantity: 2,
          unit: 'set',
          salePrice: 15.9,
          amount: 318,
          factoryPicUrls: ['http://127.0.0.1:3001/uploads/factory-a.png'],
        },
      ],
    });

    await service.updateDraft(created.id, {
      title: 'Acme 自动保存只改标题',
      salesOrderRemark: '只传局部字段时不能清空销售明细',
      createdBy: 2001,
    } as any);

    const detail = await service.getDetail(created.id);
    expect(detail.title).toBe('Acme 自动保存只改标题');
    expect(detail.salesOrderRemark).toBe('只传局部字段时不能清空销售明细');
    expect(detail.customerName).toBe('Acme Trading');
    expect(detail.customerOrderNo).toBe(created.customerOrderNo);
    expect(detail.items).toEqual([
      expect.objectContaining({
        sku: 'SKU-LED-001',
        totalQuantity: 20,
        factoryPicUrls: ['http://127.0.0.1:3001/uploads/factory-a.png'],
      }),
    ]);
  });

  it('creates a direct sales order from a selected customer counterparty', async () => {
    const service = new SalesOrderService();

    const result = await service.create({
      customerEntryMode: 'existing',
      customerId: 1,
      customerName: 'Should Be Replaced',
      title: 'Acme 客户主数据订单',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(result.customerId).toBe(1);
    expect(result.customerName).toBe('Acme Trading');
    expect(result.customerCode).toBe('CUST-ACME');
    expect(result.customerEntryMode).toBe('existing');
    expect(result.orderingUnit).toBe('Acme Trading');
  });

  it('rejects selecting a supplier-only counterparty as direct sales ordering unit', async () => {
    const service = new SalesOrderService();

    await expect(
      service.create({
        customerEntryMode: 'existing',
        customerId: 2,
        customerName: 'Bravo Industrial',
        title: '供应商错误订单',
        salesUserId: 2001,
        createdBy: 2001,
      }),
    ).rejects.toThrow('销售单订货单位只能选择客户类往来单位');
  });

  it('saves a manual direct sales ordering unit into customer counterparties when requested', async () => {
    const service = new SalesOrderService();
    const counterpartyService = new CounterpartyService();
    const before = await counterpartyService.list({ keyword: 'CUST-NORTHWIND-SO' });

    const result = await service.create({
      customerEntryMode: 'manual',
      customerName: 'Northwind Labs SO',
      customerCode: 'cust-northwind-so',
      saveManualCustomerToCounterparty: true,
      title: 'Northwind 手填订货单位订单',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const after = await counterpartyService.list({ keyword: 'CUST-NORTHWIND-SO' });

    expect(before.items).toEqual([]);
    expect(result.customerId).toBeGreaterThan(0);
    expect(result.customerName).toBe('Northwind Labs SO');
    expect(result.customerCode).toBe('CUST-NORTHWIND-SO');
    expect(result.customerEntryMode).toBe('manual');
    expect(after.items).toEqual([
      expect.objectContaining({
        id: result.customerId,
        type: 'customer',
        code: 'CUST-NORTHWIND-SO',
        name: 'Northwind Labs SO',
      }),
    ]);
  });

  it('reuses a synced manual ordering unit when a draft is saved again', async () => {
    const service = new SalesOrderService();
    const counterpartyService = new CounterpartyService();

    const created = await service.create({
      customerEntryMode: 'manual',
      customerName: 'Autosave Customer SO',
      customerCode: 'cust-autosave-so',
      saveManualCustomerToCounterparty: true,
      title: '自动保存手填客户草稿',
      salesUserId: 2001,
      createdBy: 2001,
    });

    const updated = await service.updateDraft(created.id, {
      submitMode: 'draft',
      customerEntryMode: 'manual',
      customerName: 'Autosave Customer SO',
      customerCode: 'cust-autosave-so',
      saveManualCustomerToCounterparty: true,
      title: '自动保存手填客户草稿继续保存',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const after = await counterpartyService.list({
      keyword: 'CUST-AUTOSAVE-SO',
      pageSize: 10,
    });

    expect(updated.customerId).toBe(created.customerId);
    expect(updated).toMatchObject({
      customerId: created.customerId,
      customerName: 'Autosave Customer SO',
    });
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({
      id: created.customerId,
      type: 'customer',
      code: 'CUST-AUTOSAVE-SO',
      name: 'Autosave Customer SO',
    });
  });

  it('converts one confirmed quote version into one draft sales order', async () => {
    const service = new SalesOrderService();
    seedQuote('customer_accepted', 7);

    const result = await service.convertConfirmedQuote({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
    });

    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
    expect(result.sourceQuoteOrderId).toBe(7);
    expect(result.sourceDocumentType).toBe('quote');
    expect(result.sourceQuoteNo).toBeUndefined();
    expect(result.id).not.toBe(7);
    expect(result.salesNo).toMatch(/^S\d{6}\d{4}$/);
    expect(result.salesNo).not.toBe('S202607080001');
  });

  it('converts one boss-approved demand document into a draft sales order and marks the demand ordered', async () => {
    const service = new SalesOrderService();
    seedSubmittedDemandQuote(88, 1);

    const result = await service.convertConfirmedQuote({
      quoteOrderId: 88,
      quoteVersionNo: 1,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceQuoteNo: 'XQ202607080088',
      createdBy: 2001,
      quoteConfirmed: true,
    });
    const sourceDemand = resolveQuoteStore().getQuote(88);

    expect(result.status).toBe('draft');
    expect(result.sourceQuoteOrderId).toBe(88);
    expect(result.sourceDocumentType).toBe('demand');
    expect(result.sourceQuoteNo).toBe('XQ202607080088');
    await expect(
      service.list({ docNo: result.salesNo, page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          docNo: result.salesNo,
          sourceSummary: 'DEMAND / 需求转单',
        }),
      ],
    });
    expect(sourceDemand).toMatchObject({
      status: 'ordered',
      currentProgress: '已转销售单',
      linkedSalesOrderId: result.id,
      linkedSalesOrderNo: result.salesNo,
    });
  });

  it('rejects converting the same confirmed quote version twice', async () => {
    const service = new SalesOrderService();
    seedQuote('customer_accepted', 70);

    await service.convertConfirmedQuote({
      quoteOrderId: 70,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
    });

    await expect(
      service.convertConfirmedQuote({
        quoteOrderId: 70,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
      }),
    ).rejects.toThrow('A confirmed quote version can only create one sales order');
  });

  it('carries quote line items into converted sales order detail', async () => {
    const service = new SalesOrderService();
    seedQuote('customer_accepted', 77, 2);

    const converted = await service.convertConfirmedQuote({
      quoteOrderId: 77,
      quoteVersionNo: 2,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceQuoteNo: 'Q202607080077',
      sourceCode: '02 Libuys',
      inquiryDate: '2026-05-30',
      destination: 'SH Boninoe',
      requirements: '单个销售单可能会有多个工厂的产品',
      createdBy: 2001,
      quoteConfirmed: true,
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
        },
      ],
    });

    const detail = await service.getDetail(converted.id);

    expect(converted.items).toEqual([
      expect.objectContaining({
        lineNo: 1,
        sourceQuoteLineNo: 1,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        quantity: 500,
        packageQuantity: 1,
        unitsPerPackage: 500,
        totalQuantity: 500,
        salePrice: 15.9,
        amount: 7950,
        factoryPicUrls: [
          'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
        ],
      }),
    ]);
    expect(converted.customerName).toBe('Acme Trading');
    expect(converted.sourceDocumentType).toBe('quote');
    expect(converted.sourceQuoteNo).toBe('Q202607080077');
    expect(converted.customerOrderNo).toBe(converted.salesNo);
    expect(converted.customerOrderNo).not.toBe('Q202607080077');
    expect(converted.storeName).toBe('02 Libuys');
    expect(converted.orderDate).toBe('2026-05-30');
    expect(converted.shipTo).toBe('SH Boninoe');
    expect(converted.salesOrderRemark).toBe('单个销售单可能会有多个工厂的产品');
    expect(converted.salesOrderAttachments).toEqual([]);
    expect(detail.items).toEqual(converted.items);
  });

  it('accepts factoryPicUrls when converting quote items into sales order lines', async () => {
    const service = new SalesOrderService();
    seedQuote('customer_accepted', 78, 2);

    const converted = await service.convertConfirmedQuote({
      quoteOrderId: 78,
      quoteVersionNo: 2,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 20,
          salePrice: 15.9,
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/factory-pic.png',
          ],
        } as any,
      ],
    });

    expect(converted.items).toEqual([
      expect.objectContaining({
        sku: 'SKU-LED-001',
        factoryPicUrls: [
          'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/factory-pic.png',
        ],
      }),
    ]);
  });

  it('hides sales order detail from another sales user', async () => {
    const service = new SalesOrderService();

    await expect(
      service.getDetail(1, { role: 'sales', user: 'Leo' }),
    ).rejects.toThrow('销售单不存在');
    await expect(
      service.getDetail(1, { role: 'sales_manager', user: 'Mia' }),
    ).resolves.toMatchObject({ salesNo: 'S202607080001' });
  });

  it('treats null existingSalesOrderId as absent but rejects a real existing sales order id', async () => {
    const service = new SalesOrderService();
    seedQuote('customer_accepted', 7);

    const result = await service.convertConfirmedQuote({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      existingSalesOrderId: null,
    });

    await expect(
      service.convertConfirmedQuote({
        quoteOrderId: 7,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
        existingSalesOrderId: 11,
      }),
    ).rejects.toThrow(
      'A confirmed quote version can only create one sales order',
    );

    expect(result.status).toBe('draft');
    expect(result.sourceQuoteOrderId).toBe(7);
  });

  it('rejects converting a quote that is not actually boss confirmed', async () => {
    const service = new SalesOrderService();
    seedQuote('submitted', 7);

    await expect(
      service.convertConfirmedQuote({
        quoteOrderId: 7,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
      }),
    ).rejects.toThrow('当前单据状态不可转销售单');
  });

  it('generates a sales code and formalizes a quote candidate after accepted conversion', async () => {
    const productService = new ProductService();
    const candidate = await productService.create({
      sku: 'SKU-AUTO-SALES-CODE-001',
      salesCode: '',
      productStage: 'quote_candidate',
      pricingMode: 'fixed',
      nameCn: '自动销售编码候选品',
      nameEn: '',
      category: 'electronics',
      unit: 'pcs',
      currency: 'USD',
      defaultSalePrice: 20,
      defaultPurchasePrice: 10,
      ownerName: 'Zoe',
      createdBy: 'Boss',
    });
    seedQuote('customer_accepted', 79, 1);
    const quoteStore = resolveQuoteStore();
    const quote = quoteStore.getQuote(79)!;
    quoteStore.upsertQuote({
      ...quote,
      items: [{
        ...quote.items[0],
        productId: candidate.id,
        sku: candidate.sku,
        productName: candidate.nameCn,
      }],
    });

    await new SalesOrderService().convertConfirmedQuote({
      quoteOrderId: 79,
      quoteVersionNo: 1,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      items: [{
        lineNo: 1,
        productId: candidate.id,
        sku: candidate.sku,
        productName: candidate.nameCn,
        unit: candidate.unit,
        quantity: 10,
        salePrice: 20,
      }],
    });

    await expect(productService.findById(candidate.id)).resolves.toMatchObject({
      productStage: 'formal',
      salesCode: expect.stringMatching(/^SALE-ELEC-\d{4}-\d{2}-\d{3}$/),
    });
  });

  it('submits a draft sales order into pending sales manager approval', async () => {
    const service = new SalesOrderService();

    const result = await service.submit({
      salesOrderId: 9,
      currentStatus: 'draft',
    });

    expect(result.status).toBe('pending_sales_manager_approval');
  });

  it('approves a pending sales order into purchasing', async () => {
    const service = new SalesOrderService();

    const result = await service.approve({
      salesOrderId: 9,
      currentStatus: 'pending_sales_manager_approval',
    });

    expect(result.status).toBe('purchasing');
  });

  it('rejects a pending sales order into a rejected editable state', async () => {
    const service = new SalesOrderService();

    const result = await service.reject({
      salesOrderId: 9,
      currentStatus: 'pending_sales_manager_approval',
    });

    expect(result.status).toBe('rejected');
  });

  it('allows rejected sales orders to be edited and submitted again', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 原草稿',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.reject({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });

    const updated = await service.updateDraft(created.id, {
      submitMode: 'draft',
      customerName: 'Acme Trading',
      title: 'Acme 驳回后修改',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const resubmitted = await service.updateDraft(created.id, {
      submitMode: 'submit',
      customerName: 'Acme Trading',
      title: 'Acme 驳回后再次提交',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(updated.status).toBe('rejected');
    expect(updated.title).toBe('Acme 驳回后修改');
    expect(resubmitted.status).toBe('pending_sales_manager_approval');
  });

  it('rejects invalid approval transitions', async () => {
    const service = new SalesOrderService();

    await expect(
      service.approve({
        salesOrderId: 9,
        currentStatus: 'draft',
      }),
    ).rejects.toThrow('Only pending sales manager approval orders can be approved');
  });

  it('returns sales detail in a semantically consistent post-approval placeholder state', async () => {
    const service = new SalesOrderService();

    const result = await service.getDetail(9);

    expect(result.status).toBe('purchasing');
    expect(result.purchaseAggregateStatus).toBe('purchasing');
    expect(result.shipmentAggregateStatus).toBe('purchasing');
    expect(result.receiptSendStatus).toBe('pending');
    expect(result.afterSalesEndStatus).toBe('not_started');
    expect(result.receiptStatus).toBe('unpaid');
    expect(result.financeStatus).toBe('pending');
  });

  it('rejects resubmission after shipment has started', async () => {
    const service = new SalesOrderService();

    await expect(
      service.resubmit({
        salesOrderId: 9,
        currentStatus: 'purchasing',
        changeReason: 'Customer changed packaging',
        hasShipmentBatches: true,
      }),
    ).rejects.toThrow('Cannot resubmit after shipment has started');
  });

  it('records a version timeline after sales order resubmission', async () => {
    const service = new SalesOrderService();

    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });
    const resubmitted = await service.resubmit({
      salesOrderId: created.id,
      currentStatus: 'purchasing',
      changeReason: '客户要求调整包装',
      hasShipmentBatches: false,
    });

    const detail = await service.getDetail(created.id);

    expect(resubmitted.nextVersionNo).toBe(2);
    expect(detail.currentVersionNo).toBe(2);
    expect(detail.versionHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          versionNo: 1,
          status: 'draft',
        }),
        expect.objectContaining({
          versionNo: 1,
          status: 'pending_sales_manager_approval',
        }),
        expect.objectContaining({
          versionNo: 2,
          status: 'pending_sales_manager_approval',
          changeReason: '客户要求调整包装',
        }),
      ]),
    );
  });

  it('cancels an unshipped approved sales order and returns auto-voided purchase orders', async () => {
    const service = new SalesOrderService();

    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });

    const result = await service.cancel({
      salesOrderId: created.id,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [3001, 3002],
      cancelReason: '客户取消订单',
    });

    const detail = await service.getDetail(created.id);

    expect(result.status).toBe('void');
    expect(result.autoVoidedPurchaseOrderIds).toEqual([3001, 3002]);
    expect(result.cancelReason).toBe('客户取消订单');
    expect(detail.autoVoidedPurchaseOrderIds).toEqual([3001, 3002]);
  });

  it('records sales cancellation reason in the version timeline', async () => {
    const service = new SalesOrderService();

    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });
    await service.cancel({
      salesOrderId: created.id,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [3001],
      cancelReason: '客户取消订单，未发货采购单同步作废',
    });

    const detail = await service.getDetail(created.id);

    expect(detail.status).toBe('void');
    expect(detail.versionHistory).toContainEqual(
      expect.objectContaining({
        versionNo: 1,
        status: 'void',
        changeReason: '客户取消订单，未发货采购单同步作废',
      }),
    );
  });

  it('rejects cancellation when unshipped purchase order ids are missing', async () => {
    const service = new SalesOrderService();

    await expect(
      service.cancel({
        salesOrderId: 9,
        currentStatus: 'purchasing',
        hasShipmentBatches: false,
        cancelReason: '客户取消订单',
        unshippedPurchaseOrderIds: undefined as never,
      }),
    ).rejects.toThrow('Unshipped purchase order ids are required');
  });

  it('updates sales receipt status using the confirmed receipt collection contract', async () => {
    const service = new SalesOrderService();

    const result = await service.updateReceiptStatus({
      salesOrderId: 9,
      receiptStatus: 'fully_paid',
    });

    expect(result.receiptStatus).toBe('fully_paid');
  });

  it('persists receipt and finance state back to created sales order detail', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await service.updateReceiptStatus({
      salesOrderId: created.id,
      receiptStatus: 'fully_paid',
    });
    await service.confirmFinance({
      salesOrderId: created.id,
      receiptStatus: 'fully_paid',
      financeStatus: 'confirmed',
    });

    const detail = await service.getDetail(created.id);
    expect(detail.receiptStatus).toBe('fully_paid');
    expect(detail.financeStatus).toBe('confirmed');
  });

  it('confirms finance only after receipt status is no longer unpaid', async () => {
    const service = new SalesOrderService();

    await expect(
      service.confirmFinance({
        salesOrderId: 9,
        receiptStatus: 'unpaid',
        financeStatus: 'pending',
      }),
    ).rejects.toThrow(
      'Cannot confirm finance before receipt status reaches a paid state',
    );
  });

  it('allows close validation once shipment reaches forwarder handoff', async () => {
    const service = new SalesOrderService();

    const result = await service.getCloseValidation({
      salesOrderId: 9,
      shipmentAggregateStatus: 'to_forwarder',
      receiptSendStatus: 'pending',
      afterSalesEndStatus: 'not_started',
      financeStatus: 'pending',
      receiptStatus: 'unpaid',
    });

    expect(result.canClose).toBe(true);
    expect(result.checks).toMatchObject({
      shipmentDone: true,
      receiptSent: false,
      afterSalesDone: false,
      financeConfirmed: false,
      receiptPaid: false,
    });
  });

  it('syncs operational aggregate statuses from downstream modules and records audit logs', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });
    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });

    const result = await service.syncOperationalAggregates({
      salesOrderId: created.id,
      purchaseAggregateStatus: 'approved',
      shipmentAggregateStatus: 'forwarder_shipped',
      receiptSendStatus: 'sent',
      afterSalesEndStatus: 'closed',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    const detail = await service.getDetail(created.id);
    const auditLogs = await service.listAuditLogs();

    expect(result).toMatchObject({
      id: created.id,
      status: 'closed',
      purchaseAggregateStatus: 'approved',
      shipmentAggregateStatus: 'forwarder_shipped',
      receiptSendStatus: 'sent',
      afterSalesEndStatus: 'closed',
    });
    expect(detail.status).toBe('closed');
    expect(detail.purchaseAggregateStatus).toBe('approved');
    expect(detail.shipmentAggregateStatus).toBe('forwarder_shipped');
    expect(detail.receiptSendStatus).toBe('sent');
    expect(detail.afterSalesEndStatus).toBe('closed');
    expect(auditLogs.items).toContainEqual(
      expect.objectContaining({
        bizType: 'sales_order',
        bizId: created.id,
        operationType: 'sync_sales_order_operational_aggregates',
        operatorId: 2002,
      }),
    );
  });

  it('shows legacy purchasing sales orders as closed once shipment reached forwarder handoff', async () => {
    const service = new SalesOrderService();
    const created = await service.create({
      customerName: 'Acme Trading',
      title: 'Acme 存量交货代订单',
      salesUserId: 2001,
      createdBy: 2001,
    });
    await service.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      salesOrderId: created.id,
      currentStatus: 'pending_sales_manager_approval',
    });

    const serviceStore = (
      service as unknown as {
        store: {
          getSalesOrder: (id: number) => typeof created | undefined;
          upsertSalesOrder: (record: typeof created) => void;
        };
      }
    ).store;
    const stored = serviceStore.getSalesOrder(created.id)!;
    serviceStore.upsertSalesOrder({
      ...stored,
      status: 'purchasing',
      shipmentAggregateStatus: 'to_forwarder',
    });

    const detail = await service.getDetail(created.id);
    const list = await service.list({
      docNo: created.salesNo,
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(detail.status).toBe('closed');
    expect(list.items[0]).toMatchObject({
      docNo: created.salesNo,
      status: 'closed',
      approvalStatus: 'closed',
      fulfillmentStatus: 'to_forwarder',
    });
  });

  it('marks a sales order as having after-sales once the linked after-sales order is finance-confirmed', async () => {
    const salesOrderService = new SalesOrderService();
    const afterSalesService = new AfterSalesService();
    (afterSalesService as unknown as { salesOrderService?: SalesOrderService }).salesOrderService =
      salesOrderService;

    const salesOrder = await salesOrderService.create({
      customerName: 'Acme Trading',
      title: 'Acme 售后标记测试',
      salesUserId: 2001,
      createdBy: 2001,
    });

    const afterSales = await afterSalesService.create({
      salesOrderId: salesOrder.id,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
    });

    await afterSalesService.submit({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'pending_submit',
    });
    await afterSalesService.approve({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'pending_approval',
    });
    await afterSalesService.startProcessing({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'processing',
    });
    await afterSalesService.confirmFinance({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });

    const result = await salesOrderService.list({
      hasAfterSales: 'yes',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          docNo: salesOrder.salesNo,
          hasAfterSales: true,
        }),
      ]),
    );

    await afterSalesService.finish({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'finance_reviewing',
    });
    await afterSalesService.close({
      afterSalesOrderId: afterSales.id,
      currentStatus: 'finished',
      financeReviewStatus: 'confirmed',
    });

    const detail = await salesOrderService.getDetail(salesOrder.id);
    expect(detail.afterSalesEndStatus).toBe('closed');
  });
});
