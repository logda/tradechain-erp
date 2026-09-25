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

  it('submits a product-library quote for boss price confirmation without inquiry', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      submitMode: 'submit' as const,
      documentType: 'quote',
      productSource: 'existing',
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

    expect(created.status).toBe('pending_boss_price_confirmation');
    expect(created.linkedInquiryId).toBeUndefined();
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toBeUndefined();
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

    expect(submitted.status).toBe('pending_boss_approval');
    expect(submitted.currentProgress).toBe('待老板审批需求单');
    expect(submitted.linkedInquiryId).toBeUndefined();
    expect(submitted.linkedSalesOrderId).toBeUndefined();
    expect(resolveSalesOrderStore().listSalesOrders()).toHaveLength(0);
  });

  it('submits a candidate demand to one linked inquiry and is idempotent', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      documentType: 'demand',
      productSource: 'candidate',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          createCandidateProduct: {
            sku: 'SKU-NEW-IDEMPOTENT',
            nameCn: '幂等询价新品',
            category: 'electronics',
            unit: 'pcs',
          },
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    } as any);

    const submitted = await quoteService.submitDraftQuote(created.id);
    const repeated = await quoteService.submitDraftQuote(created.id);
    const inquiryList = await inquiryService.list({ page: 1, pageSize: 20 });

    expect(submitted.status).toBe('inquiry_in_progress');
    expect(submitted.submitMode).toBe('submit');
    expect(submitted.currentProgress).toBe('采购询价中');
    expect(submitted.linkedInquiryId).toBeGreaterThan(0);
    expect(submitted.linkedInquiryNo).toMatch(/^IQ/);
    expect(repeated.linkedInquiryId).toBe(submitted.linkedInquiryId);
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toMatchObject({
      quoteOrderNo: created.quoteNo,
      quoteOrderId: created.id,
      status: 'pending_inquiry',
    });
  });

  it('approves an existing-product demand without setting a boss sale price', async () => {
    const quoteService = new QuoteService();
    const draft = await quoteService.create({
      documentType: 'demand',
      productSource: 'existing',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'approve existing demand',
      items: [{ productId: 1, quantity: 500, salePrice: 0 }],
    });
    await quoteService.submitDraftQuote(draft.id);

    const approved = await quoteService.approveDemand(draft.id, {
      role: 'boss',
      user: 'Boss',
    });

    expect(approved.status).toBe('boss_approved');
    expect(approved.currentProgress).toBe('需求单审批通过');
    expect(approved.items[0]).not.toHaveProperty('confirmedSalePrice');
  });

  it('confirms direct quote prices and enters customer feedback', async () => {
    const quoteService = new QuoteService();
    const draft = await quoteService.create({
      documentType: 'quote',
      productSource: 'existing',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'boss confirms direct quote',
      items: [{ productId: 1, quantity: 20, salePrice: 15.9 }],
    });
    await quoteService.submitDraftQuote(draft.id);

    const confirmed = await quoteService.confirmQuotePrice(
      draft.id,
      {
        currentVersionNo: 1,
        items: [{ lineNo: 1, confirmedSalePrice: 16.8 }],
      },
      { role: 'boss', user: 'Boss' },
    );

    expect(confirmed.status).toBe('pending_customer_feedback');
    expect(confirmed.currentProgress).toBe('待客户反馈');
    expect(confirmed.items[0]?.confirmedSalePrice).toBe(16.8);
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

    expect(submitted.status).toBe('pending_boss_price_confirmation');
    expect(submitted.requirements).toBe('Submit after saving latest fields');
    expect(
      inquiryList.items.find((item) => item.quoteOrderNo === created.quoteNo),
    ).toBeUndefined();
  });

  it('syncs the linked quote status when inquiry comparison and boss confirmation progress', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();

    const created = await quoteService.create({
      submitMode: 'submit' as const,
      documentType: 'demand',
      productSource: 'candidate',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          createCandidateProduct: {
            sku: 'SKU-INQUIRY-SYNC',
            nameCn: '询价同步新品',
            category: 'electronics',
            unit: 'set',
          },
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
    expect(pendingBoss.status).toBe('inquiry_in_progress');
    expect(pendingBoss.currentProgress).toBe('采购询价中');
    expect(pendingBoss.linkedInquiryStatus).toBe('pending_boss_review');

    const bossConfirmation = await inquiryService.confirmByBoss({
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

    const confirmedDemand = await quoteService.getDetail(created.id);
    expect(confirmedDemand.status).toBe('converted_to_quote');
    expect(confirmedDemand.linkedInquiryStatus).toBe('boss_confirmed');
    const confirmed = await quoteService.getDetail(
      bossConfirmation.linkedQuoteId!,
    );
    expect(confirmed.status).toBe('pending_customer_feedback');
    expect(confirmed.items[0]?.confirmedSalePrice).toBe(18.8);

    const salesView = await quoteService.getDetail(confirmed.id, {
      role: 'sales_manager',
      user: 'Mia',
    });
    const bossView = await quoteService.getDetail(confirmed.id, {
      role: 'boss',
      user: 'Mia',
    });

    expect(salesView.items[0]?.confirmedSalePrice).toBe(18.8);
    expect(salesView.items[0]).not.toHaveProperty('confirmedSupplierName');
    expect(salesView.items[0]).not.toHaveProperty('confirmedPurchasePrice');
    expect(bossView.items[0]).toMatchObject({
      confirmedSupplierName: '深圳快联电子',
      confirmedPurchasePrice: 12.5,
    });
    const salesAudit = JSON.stringify(
      await quoteService.listAuditLogs({ role: 'sales', user: 'Zoe' }),
    );
    const bossAudit = JSON.stringify(
      await quoteService.listAuditLogs({ role: 'boss', user: 'Boss' }),
    );
    expect(salesAudit).not.toContain('深圳快联电子');
    expect(salesAudit).not.toContain('confirmedPurchasePrice');
    expect(salesAudit).not.toContain('confirmedSupplierName');
    expect(salesAudit).toContain('confirmedSalePrice');
    expect(bossAudit).toContain('深圳快联电子');
  });

  it('generates a stable candidate SKU when turning a hand-filled demand into one linked quote', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();
    const demand = await quoteService.create({
      documentType: 'demand',
      productSource: 'candidate',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'new linked quote product',
      items: [
        {
          createCandidateProduct: {
            sku: '',
            nameCn: '关联报价候选产品',
            category: 'electronics',
            unit: 'pcs',
          },
          quantity: 100,
          salePrice: 0,
        },
      ],
    });
    const submitted = await quoteService.submitDraftQuote(demand.id);
    await inquiryService.submitForComparison({
      inquiryId: submitted.linkedInquiryId!,
      items: [
        {
          itemId: 1,
          supplierQuotes: [
            {
              supplierSourceMode: 'manual',
              supplierName: '候选供应商 A',
              purchasePrice: 18.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '候选供应商 B',
              purchasePrice: 19.2,
            },
          ],
        },
      ],
    });

    const confirmed = await inquiryService.confirmByBoss({
      inquiryId: submitted.linkedInquiryId!,
      items: [
        {
          itemId: 1,
          supplierQuoteCount: 2,
          confirmedSalePrice: 28.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });
    const sourceDemand = await quoteService.getDetail(demand.id);
    const linkedQuote = await quoteService.getDetail(confirmed.linkedQuoteId!);

    expect(sourceDemand).toMatchObject({
      status: 'converted_to_quote',
      linkedQuoteId: confirmed.linkedQuoteId,
    });
    expect(linkedQuote).toMatchObject({
      documentType: 'quote',
      productSource: 'existing',
      status: 'pending_customer_feedback',
      sourceDemandId: demand.id,
      currentVersionNo: 1,
    });
    expect(linkedQuote.items[0]?.productId).toBeGreaterThan(0);
    expect(linkedQuote.items[0]?.sku).toBe(`SKU-${demand.quoteNo}-1`);
    expect(resolveSalesOrderStore().listSalesOrders()).toHaveLength(0);

    const repeated = await inquiryService.confirmByBoss({
      inquiryId: submitted.linkedInquiryId!,
      items: [
        {
          itemId: 1,
          supplierQuoteCount: 2,
          confirmedSalePrice: 28.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });
    expect(repeated.linkedQuoteId).toBe(confirmed.linkedQuoteId);
  });

  it('records sales customer feedback and keeps no-follow-up editable', async () => {
    const service = new QuoteService();
    const created = await service.create({
      submitMode: 'submit',
      documentType: 'quote',
      productSource: 'existing',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'customer feedback',
      items: [{ productId: 1, quantity: 100, salePrice: 15.9 }],
    } as any);
    await service.confirmQuotePrice(created.id, {
      currentVersionNo: 1,
      items: [{ lineNo: 1, confirmedSalePrice: 16.8 }],
    });

    const paused = await service.recordCustomerFeedback(
      created.id,
      { currentVersionNo: 1, result: 'no_follow_up', remark: '客户暂缓' },
      { role: 'sales', user: 'Zoe' },
    );
    expect(paused).toMatchObject({
      status: 'customer_no_follow_up',
      customerFeedbackResult: 'no_follow_up',
      customerFeedbackBy: 'Zoe',
    });

    const accepted = await service.recordCustomerFeedback(
      created.id,
      { currentVersionNo: 1, result: 'accepted', remark: '客户接受' },
      { role: 'sales_manager', user: 'Mia' },
    );
    expect(accepted.status).toBe('customer_accepted');
    expect(accepted.customerFeedbackHistory).toHaveLength(2);
    await expect(
      service.recordCustomerFeedback(
        created.id,
        { currentVersionNo: 1, result: 'accepted' },
        { role: 'purchase', user: 'Buyer' },
      ),
    ).rejects.toThrow('只有销售或老板可以记录客户反馈');
  });

  it('reopens one linked inquiry and advances the same quote to V2 after boss repricing', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();
    const created = await quoteService.create({
      submitMode: 'submit',
      documentType: 'quote',
      productSource: 'existing',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'repricing',
      items: [{ productId: 1, quantity: 100, salePrice: 15.9 }],
    } as any);
    await quoteService.confirmQuotePrice(created.id, {
      currentVersionNo: 1,
      items: [{ lineNo: 1, confirmedSalePrice: 16.8 }],
    });

    const first = await quoteService.recordCustomerFeedback(
      created.id,
      { currentVersionNo: 1, result: 'price_issue', remark: '价格偏高' },
      { role: 'sales', user: 'Zoe' },
    );
    const repeated = await quoteService.recordCustomerFeedback(
      created.id,
      { currentVersionNo: 1, result: 'price_issue', remark: '重复点击' },
      { role: 'sales', user: 'Zoe' },
    );
    expect(first).toMatchObject({
      status: 'repricing_in_progress',
      currentVersionNo: 1,
      linkedInquiryVersionNo: 2,
    });
    expect(repeated.linkedInquiryId).toBe(first.linkedInquiryId);

    await inquiryService.submitForComparison({
      inquiryId: first.linkedInquiryId!,
      items: [{
        itemId: 1,
        supplierQuotes: [
          { supplierSourceMode: 'manual', supplierName: '供应商 A', purchasePrice: 8.1 },
          { supplierSourceMode: 'manual', supplierName: '供应商 B', purchasePrice: 8.4 },
        ],
      }],
    });
    const repriced = await inquiryService.confirmByBoss({
      inquiryId: first.linkedInquiryId!,
      items: [{
        itemId: 1,
        supplierQuoteCount: 2,
        confirmedSalePrice: 15.5,
        selectedSupplierQuoteIndex: 0,
      }],
    });
    const refreshed = await quoteService.getDetail(created.id);

    expect(repriced).toMatchObject({
      linkedQuoteId: created.id,
      currentVersionNo: 2,
      status: 'pending_customer_feedback',
    });
    expect(refreshed).toMatchObject({
      id: created.id,
      currentVersionNo: 2,
      status: 'pending_customer_feedback',
    });
    expect(refreshed.versionHistory?.map((entry) => entry.versionNo)).toEqual([1, 2]);
    expect(refreshed.items[0]?.confirmedSalePrice).toBe(15.5);
  });

  it('keeps a candidate product in a demand flow before purchase filing', async () => {
    const service = new QuoteService();

    const result = await service.create({
      documentType: 'demand',
      productSource: 'candidate',
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

    expect(result.items[0].productId).toBeUndefined();
    expect(result.items[0].sku).toBe('SKU-Q-900');
    expect(result.items[0].productName).toBe('报价新品');
    expect(result.items[0].quantity).toBe(50);
    expect(result.items[0].salePrice).toBe(120);
    expect(result).toMatchObject({
      documentType: 'demand',
      productSource: 'candidate',
      status: 'draft',
    });
  });

  it('rejects quote + candidate before writing a quote or product', async () => {
    const quoteService = new QuoteService();
    const productService = new ProductService();
    const beforeQuotes = (await quoteService.list({ page: 1, pageSize: 100 })).total;
    const beforeProducts = (await productService.list({ page: 1, pageSize: 100 })).total;

    await expect(
      quoteService.create({
        documentType: 'quote',
        productSource: 'candidate',
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'invalid direct quote candidate',
        items: [
          {
            createCandidateProduct: {
              sku: 'SKU-INVALID-QUOTE-CANDIDATE',
              nameCn: '报价单手填新品',
              category: 'electronics',
            },
            quantity: 10,
            salePrice: 20,
          },
        ],
      }),
    ).rejects.toThrow('报价单只能选择产品库产品');

    expect((await quoteService.list({ page: 1, pageSize: 100 })).total).toBe(
      beforeQuotes,
    );
    expect((await productService.list({ page: 1, pageSize: 100 })).total).toBe(
      beforeProducts,
    );
  });

  it('derives an existing-product demand price from the matching active tier', async () => {
    const service = new QuoteService();

    const created = await service.create({
      documentType: 'demand',
      productSource: 'existing',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'tier price must come from product master',
      items: [
        {
          productId: 1,
          quantity: 500,
          salePrice: 0.01,
        },
      ],
    });

    expect(created).toMatchObject({
      documentType: 'demand',
      productSource: 'existing',
      status: 'draft',
      items: [
        expect.objectContaining({
          productSource: 'existing',
          productId: 1,
          salePrice: 14.5,
          amount: 7250,
        }),
      ],
    });
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

  it('creates a demand with an unsaved candidate product without inserting product master data', async () => {
    const service = new QuoteService();
    const productService = new ProductService();
    const uniqueSku = 'SKU-Q-NOSAVE-901';

    const before = await productService.list({ keyword: uniqueSku });

    const result = await service.create({
      documentType: 'demand',
      productSource: 'candidate',
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
      productSource: 'candidate',
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
