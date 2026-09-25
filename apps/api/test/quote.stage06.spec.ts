import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QuoteService } from '../src/quote/quote.service';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { ProductService } from '../src/product/product.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('需求询价生成报价与产品资料', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-stage06-quote-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    delete process.env.ERP_STORAGE_MODE;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('只向销售展示中选供应商的打样信息，保留需求快照并即时更新产品采购价和装箱资料', async () => {
    const quoteService = new QuoteService();
    const inquiryService = new InquiryService();
    const demand = await quoteService.create({
      documentType: 'demand',
      productSource: 'candidate',
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'website',
      requirements: '历史需求说明',
      items: [{
        createCandidateProduct: {
          sku: 'STAGE06-NEW-FAN',
          nameCn: '测试风扇',
          category: 'electronics',
          unit: 'pcs',
        },
        quantity: 100,
        salePrice: 30,
      }],
    } as any);
    const submittedDemand = await quoteService.submitDraftQuote(demand.id);
    const inquiryId = Number(submittedDemand.linkedInquiryId);
    const itemId = (await inquiryService.getById(inquiryId)).items[0]!.itemId;
    await inquiryService.submitForComparison({ inquiryId, items: [{ itemId, supplierQuotes: [
      { supplierSourceMode: 'manual', supplierName: '中选工厂', purchasePrice: 18,
        samplingInfo: '打样三天', cartonQuantity: 24, outerCartonSizeCm: '50×40×30', outerCartonGrossWeightKg: 12.5 },
      { supplierSourceMode: 'manual', supplierName: '落选工厂', purchasePrice: 19,
        samplingInfo: '落选保密打样方案', cartonQuantity: 30 },
    ] }] });
    const confirmed = await inquiryService.confirmByBoss({ inquiryId, items: [
      { itemId, supplierQuoteCount: 2, confirmedSalePrice: 30, selectedSupplierQuoteIndex: 0 },
    ] }, { role: 'boss', user: 'Mia' });
    const quoteId = Number(confirmed.linkedQuoteId);

    const bossQuote = await quoteService.getDetail(quoteId, { role: 'boss', user: 'Mia' });
    const salesQuote = await quoteService.getDetail(quoteId, { role: 'sales', user: 'Zoe' });
    const product = await new ProductService().findById(Number(bossQuote.items[0]?.productId));
    const quoteList = await quoteService.list({ page: 1, pageSize: 20 });

    expect(quoteList.items.some((item) => item.docNo === demand.quoteNo)).toBe(false);
    expect(bossQuote.sourceDemandSnapshot).toMatchObject({
      id: demand.id, requirements: '历史需求说明', items: [expect.objectContaining({ quantity: 100 })],
    });
    expect(salesQuote.items[0]).toMatchObject({ samplingInfo: '打样三天', cartonQuantity: 24 });
    expect(JSON.stringify(salesQuote)).not.toContain('落选保密打样方案');
    expect(product).toMatchObject({
      defaultPurchasePrice: 18, cartonQuantity: 24, cartonSpec: '50×40×30', cartonWeight: 12.5,
    });

    await quoteService.recordCustomerFeedback(quoteId, {
      currentVersionNo: 1, result: 'accepted',
    }, { role: 'boss', user: 'Mia' });
    const salesOrder = await new SalesOrderService().convertConfirmedQuote({
      quoteOrderId: quoteId,
      quoteVersionNo: 1,
      customerId: bossQuote.customerId,
      sourceQuoteNo: bossQuote.quoteNo,
      createdBy: bossQuote.salesUserId,
      quoteConfirmed: true,
      items: bossQuote.items,
    });
    expect(salesOrder.items?.[0]).toMatchObject({
      cartonQuantity: 24,
      outerCartonSizeCm: '50×40×30',
      outerCartonGrossWeightKg: 12.5,
      packageQuantity: 1,
      unitsPerPackage: 100,
    });
  });

  it('复用已有产品时刷新采购价，后续主数据变化不改写已生成报价', async () => {
    const quotes = new QuoteService();
    const inquiries = new InquiryService();
    const products = new ProductService();
    const oldPrice = (await products.findById(1))?.defaultPurchasePrice;
    const demand = await quotes.create({
      documentType: 'demand', productSource: 'candidate', customerId: 1001,
      salesUserId: 2001, sourceCode: 'website', requirements: '复用已有产品',
      items: [{ createCandidateProduct: {
        sku: 'SKU-LED-001', nameCn: '智能 LED 灯带', category: 'electronics', unit: 'pcs',
      }, quantity: 50, salePrice: 35 }],
    } as any);
    const submitted = await quotes.submitDraftQuote(demand.id);
    const inquiryId = Number(submitted.linkedInquiryId);
    const itemId = (await inquiries.getById(inquiryId)).items[0]!.itemId;
    await inquiries.submitForComparison({ inquiryId, items: [{ itemId, supplierQuotes: [
      { supplierSourceMode: 'manual', supplierName: '工厂甲', purchasePrice: 21, cartonQuantity: 10 },
      { supplierSourceMode: 'manual', supplierName: '工厂乙', purchasePrice: 22 },
    ] }] });
    const result = await inquiries.confirmByBoss({ inquiryId, items: [
      { itemId, supplierQuoteCount: 2, confirmedSalePrice: 35, selectedSupplierQuoteIndex: 0 },
    ] });
    const quote = await quotes.getDetail(Number(result.linkedQuoteId));

    expect(oldPrice).not.toBe(21);
    expect((await products.findById(1))?.defaultPurchasePrice).toBe(21);
    expect((await products.findById(1))?.cartonQuantity).toBe(10);
    expect(quote.items[0]).toMatchObject({ confirmedPurchasePrice: 21, cartonQuantity: 10 });

    await products.applyConfirmedInquiryValues(1, {
      confirmedSalePrice: 50, confirmedPurchasePrice: 99, operator: '后续业务',
    });
    expect((await quotes.getDetail(quote.id)).items[0]?.confirmedPurchasePrice).toBe(21);
  });
});
