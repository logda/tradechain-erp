import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QuoteService } from '../src/quote/quote.service';
import { ProductService } from '../src/product/product.service';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';

describe('QuoteService runtime audit logs', () => {
  let runtimeDir: string | undefined;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-quote-link-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (runtimeDir) {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
    runtimeDir = undefined;
  });

  it('records and lists quote audit logs in runtime mode', async () => {
    const service = new QuoteService();

    await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    });

    const result = await service.listAuditLogs();

    expect(result.items[0]).toMatchObject({
      bizType: 'quote',
      operationType: 'create_quote',
    });
  });

  it('creates a linked inquiry when the quote is submitted', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      submitMode: 'submit' as const,
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/led.png'],
        },
      ],
    } as any);

    const inquiryList = await inquiryService.list({ page: 1, pageSize: 20 });

    expect(created.status).toBe('submitted');
    expect(created.linkedInquiryId).toBeGreaterThan(0);
    expect(created.linkedInquiryNo).toMatch(/^IQ/);
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toMatchObject({
      quoteOrderNo: created.quoteNo,
      quoteOrderId: created.id,
      status: 'pending_inquiry',
      items: [
        expect.objectContaining({
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/led.png',
          ],
        }),
      ],
    });
  });

  it('submits a demand document without directly creating a sales order', async () => {
    const quoteService = new QuoteService();

    const submitted = await quoteService.create({
      submitMode: 'submit' as const,
      documentType: 'demand' as const,
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need product-library item',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    expect(submitted.status).toBe('submitted');
    expect(submitted.currentProgress).toBe('已提交');
    expect(submitted.linkedInquiryId).toBeUndefined();
    expect(submitted.linkedSalesOrderId).toBeUndefined();
    expect(resolveSalesOrderStore().listSalesOrders()).toHaveLength(0);
  });

  it('submits an existing draft quote and creates a linked inquiry', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    const submitted = await quoteService.submitDraftQuote(created.id);
    const inquiryList = await inquiryService.list({ page: 1, pageSize: 20 });

    expect(submitted.status).toBe('submitted');
    expect(submitted.submitMode).toBe('submit');
    expect(submitted.currentProgress).toBe('待询价');
    expect(submitted.linkedInquiryId).toBeGreaterThan(0);
    expect(submitted.linkedInquiryNo).toMatch(/^IQ/);
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toMatchObject({
      quoteOrderNo: created.quoteNo,
      quoteOrderId: created.id,
      status: 'pending_inquiry',
    });
  });

  it('updates an existing draft quote before submitting it', async () => {
    const quoteService = new QuoteService();

    const created = await quoteService.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    const saved = await quoteService.updateDraft(created.id, {
      customerId: 1001,
      salesUserId: 2002,
      sourceCode: 'online',
      inquiryDate: '2026-07-20',
      destination: 'Berlin',
      requirements: 'Updated draft requirements',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 200,
          targetPrice: 12.5,
          salePrice: 16.8,
          imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/existing.png'],
        },
      ],
    } as any);

    expect(saved).toMatchObject({
      id: created.id,
      status: 'draft',
      salesUserId: 2002,
      sourceCode: 'online',
      inquiryDate: '2026-07-20',
      destination: 'Berlin',
      requirements: 'Updated draft requirements',
      items: [
        expect.objectContaining({
          quantity: 200,
          targetPrice: 12.5,
          salePrice: 16.8,
          amount: 3360,
          imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/existing.png'],
        }),
      ],
    });

    const logs = await quoteService.listAuditLogs();
    expect(logs.items.map((item) => item.operationType)).toContain(
      'update_quote_draft',
    );
  });

  it('saves and submits a draft quote in one operation', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    const submitted = await quoteService.updateDraft(created.id, {
      submitMode: 'submit' as const,
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Submit after saving latest fields',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 300,
          salePrice: 18.8,
        },
      ],
    } as any);
    const inquiryList = await inquiryService.list({ page: 1, pageSize: 20 });

    expect(submitted.status).toBe('submitted');
    expect(submitted.requirements).toBe('Submit after saving latest fields');
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toMatchObject({
      quoteOrderId: created.id,
      status: 'pending_inquiry',
    });
  });

  it('syncs the linked quote status when inquiry comparison and boss confirmation progress', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      submitMode: 'submit' as const,
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    await inquiryService.submitForComparison({
      inquiryId: created.linkedInquiryId!,
      items: [
        {
          itemId: 1,
          supplierQuotes: [
            {
              supplierSourceMode: 'manual',
              supplierName: '深圳快联电子',
              purchasePrice: 12.5,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '东莞优联工厂',
              purchasePrice: 12.8,
            },
          ],
        },
      ],
    });

    const pendingBoss = await quoteService.getDetail(created.id);
    expect(pendingBoss.status).toBe('pending_boss_confirm');
    expect(pendingBoss.currentProgress).toBe('待老板确认');
    expect(pendingBoss.linkedInquiryStatus).toBe('pending_boss_review');

    await inquiryService.confirmByBoss({
      inquiryId: created.linkedInquiryId!,
      items: [
        {
          itemId: 1,
          supplierQuoteCount: 2,
          confirmedSalePrice: 18.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });

    const confirmed = await quoteService.getDetail(created.id);
    expect(confirmed.status).toBe('boss_confirmed');
    expect(confirmed.currentProgress).toBe('老板已确认');
    expect(confirmed.linkedInquiryStatus).toBe('boss_confirmed');
    expect(confirmed.items[0]?.confirmedSalePrice).toBe(18.8);
  });

  it('keeps a candidate product in the quote flow before purchase filing', async () => {
    const service = new QuoteService();

    const result = await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'new candidate',
      items: [
        {
          createCandidateProduct: {
            sku: 'SKU-Q-900',
            nameCn: '报价新品',
            category: 'electronics',
          },
          quantity: 50,
          salePrice: 120,
        },
      ],
    });

    expect(result.items[0].productId).toBe(0);
    expect(result.items[0].sku).toBe('SKU-Q-900');
    expect(result.items[0].productName).toBe('报价新品');
    expect(result.items[0].quantity).toBe(50);
    expect(result.items[0].salePrice).toBe(120);
  });

  it('rejects selecting a supplier-only counterparty as quote customer', async () => {
    const service = new QuoteService();

    await expect(
      service.create({
        customerEntryMode: 'existing',
        customerId: 2,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Need 120 units',
        items: [
          {
            productId: 1,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 120,
            salePrice: 18.8,
          },
        ],
      } as any),
    ).rejects.toThrow('报价单客户只能选择客户类往来单位');
  });

  it('creates a quote with an unsaved candidate product without inserting product master data', async () => {
    const service = new QuoteService();
    const productService = new ProductService();
    const uniqueSku = 'SKU-Q-NOSAVE-901';

    const before = await productService.list({ keyword: uniqueSku });

    const result = await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'candidate without product master save',
      items: [
        {
          createCandidateProduct: {
            sku: uniqueSku,
            nameCn: '未入主数据候选品',
            category: 'electronics',
            saveToProductMaster: false,
          },
          quantity: 20,
          targetPrice: 19.8,
          salePrice: 25.6,
        },
      ],
    } as any);

    const after = await productService.list({ keyword: uniqueSku });

    expect(before.items.map((item) => item.sku)).not.toContain(uniqueSku);
    expect(result.items[0]).toMatchObject({
      productId: 0,
      sku: uniqueSku,
      productName: '未入主数据候选品',
      quantity: 20,
      targetPrice: 19.8,
      salePrice: 25.6,
    });
    expect(after.items.map((item) => item.sku)).not.toContain(uniqueSku);
  });

  it('creates a quote with inquiry fields and saves a manual customer into counterparties when requested', async () => {
    const service = new QuoteService();

    const result = await service.create({
      customerEntryMode: 'manual',
      customerName: 'Northwind Labs',
      customerCode: 'CUST-NORTHWIND',
      saveManualCustomerToCounterparty: true,
      salesUserId: 2001,
      sourceCode: 'tiktok',
      inquiryDate: '2026-07-18',
      destination: 'Berlin',
      requirements: 'Need 300 units for testing',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 300,
          targetPrice: 11.5,
          salePrice: 13.2,
          imageUrls: ['https://img.example.com/customer-a.png'],
        },
      ],
    } as any);

    expect(result.customerId).toBeGreaterThan(0);
    expect(result.customerName).toBe('Northwind Labs');
    expect(result.customerCode).toBe('CUST-NORTHWIND');
    expect(result.inquiryDate).toBe('2026-07-18');
    expect(result.destination).toBe('Berlin');
    expect(result.currentProgress).toBe('草稿');
    expect(result.items[0]).toMatchObject({
      targetPrice: 11.5,
      salePrice: 13.2,
      imageUrls: ['https://img.example.com/customer-a.png'],
    });
  });

  it('reuses a synced manual customer when a quote draft is saved again', async () => {
    const quoteService = new QuoteService();
    const counterpartyService = new CounterpartyService();

    const created = await quoteService.create({
      customerEntryMode: 'manual',
      customerName: 'Autosave Quote Customer',
      customerCode: 'CUST-AUTOSAVE-QUOTE',
      saveManualCustomerToCounterparty: true,
      salesUserId: 2001,
      sourceCode: 'tiktok',
      inquiryDate: '2026-07-18',
      destination: 'Berlin',
      requirements: 'Need 120 units for autosave regression',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 120,
          targetPrice: 11.5,
          salePrice: 13.2,
        },
      ],
    } as any);

    const updated = await quoteService.updateDraft(created.id, {
      submitMode: 'draft',
      customerEntryMode: 'manual',
      customerName: 'Autosave Quote Customer',
      customerCode: 'CUST-AUTOSAVE-QUOTE',
      saveManualCustomerToCounterparty: true,
      salesUserId: 2001,
      sourceCode: 'tiktok',
      inquiryDate: '2026-07-18',
      destination: 'Berlin',
      requirements: 'Need 120 units for autosave regression',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 120,
          targetPrice: 11.5,
          salePrice: 13.2,
        },
      ],
    } as any);
    const after = await counterpartyService.list({
      keyword: 'CUST-AUTOSAVE-QUOTE',
      pageSize: 10,
    });

    expect(updated.customerId).toBe(created.customerId);
    expect(updated.customerCode).toBe('CUST-AUTOSAVE-QUOTE');
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({
      id: created.customerId,
      type: 'customer',
      code: 'CUST-AUTOSAVE-QUOTE',
      name: 'Autosave Quote Customer',
    });
  });
});
