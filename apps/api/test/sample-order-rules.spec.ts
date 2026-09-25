import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SampleOrderService } from '../src/sample-order/sample-order.service';
import { resolveQuoteStore } from '../src/quote/quote.store';

function seedQuote(status = 'boss_confirmed', id = 7) {
  resolveQuoteStore().upsertQuote({
    id,
    quoteNo: `Q20260708${String(id).padStart(4, '0')}`,
    status,
    currentVersionNo: 3,
    customerId: 1001,
    customerName: 'Acme Trading',
    customerCode: 'CUST-ACME',
    customerEntryMode: 'existing',
    salesUserId: 2001,
    salesUserName: 'Zoe',
    sourceCode: 'expo',
    inquiryDate: '2026-07-18',
    destination: '',
    requirements: 'Need sample',
    currentProgress: status === 'boss_confirmed' ? '老板已确认' : '草稿',
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
        imageUrls: [
          'http://127.0.0.1:3001/uploads/formal-quotes/led-source-front.png',
          'http://127.0.0.1:3001/uploads/formal-quotes/led-source-side.png',
        ],
      },
    ],
  });
}

describe('SampleOrderService', () => {
  let runtimeDir: string | undefined;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-sample-rules-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (runtimeDir) {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
    runtimeDir = undefined;
  });

  it('creates a sample order only from a confirmed quote version', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 7);

    const result = await service.create({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
      samplingCost: 1200,
    });

    expect(result.currentStatus).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
    expect(result.sourceQuoteOrderId).toBe(7);
  });

  it('keeps sales and purchase sample fields on the created sample order detail', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 8);

    const result = await service.create({
      quoteOrderId: 8,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need retail box and color sample',
      samplingCost: 1200,
      importantEnglishTitle: 'Smart LED Strip Sample',
      orderCode: 'SO-SAMPLE-008',
      purchaseUnit: '深圳星河工厂',
      salesProductCode: 'SALE-LED-008',
      internalProductCode: 'SUP001-008',
      imageUrls: [
        'http://127.0.0.1:3001/uploads/samples/led-front.png',
        'http://127.0.0.1:3001/uploads/samples/led-side.png',
      ],
      sampleQuantity: 12,
      estimatedCompletionDate: '2026-07-28',
      freightForwarder: 'DHL',
      domesticTrackingNo: 'SF123456789CN',
      domesticCourierFee: 35,
      internationalCourierFee: 120,
      estimatedArrivalDate: '2026-08-03',
    } as any);

    expect(result).toMatchObject({
      importantEnglishTitle: '智能 LED 灯带',
      orderCode: 'SO-SAMPLE-008',
      purchaseUnit: '深圳星河工厂',
      salesProductCode: 'SKU-LED-001',
      internalProductCode: 'SKU-LED-001',
      imageUrls: [
        'http://127.0.0.1:3001/uploads/formal-quotes/led-source-front.png',
        'http://127.0.0.1:3001/uploads/formal-quotes/led-source-side.png',
      ],
      sampleQuantity: 12,
      estimatedCompletionDate: '2026-07-28',
      freightForwarder: 'DHL',
      domesticTrackingNo: 'SF123456789CN',
      domesticCourierFee: 35,
      internationalCourierFee: 120,
      estimatedArrivalDate: '2026-08-03',
    });
  });

  it('summarizes existing sample orders for a source quote without blocking more samples', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 77);

    await service.create({
      quoteOrderId: 77,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
    });
    await service.create({
      quoteOrderId: 77,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need blue packaging sample',
    });

    await service.cancel({
      sampleOrderId: 100,
      currentStatus: 'pending_approval',
      hasProductionStarted: false,
      cancelReason: '客户取消首版样品',
    });

    await expect(
      service.create({
        quoteOrderId: 77,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
        sampleRequirements: 'Need replacement sample',
      }),
    ).resolves.toMatchObject({
      sourceQuoteOrderId: 77,
      currentStatus: 'draft',
    });

    expect(await service.getSourceQuoteSampleSummary(77)).toEqual({
      quoteOrderId: 77,
      totalSampleCount: 3,
      activeSampleCount: 2,
      latestSampleNo: expect.stringMatching(/^SP\d{10}$/),
    });
  });

  it('creates a replacement version and marks the prior version as replaced', async () => {
    const service = new SampleOrderService();

    const result = await service.createVersion({
      sampleOrderId: 9,
      currentStatus: 'sample_sent',
      currentVersionNo: 1,
      createdBy: 2001,
      changeReason: 'Customer requested new color',
      sampleRequirements: 'Need blue variant sample',
    });

    expect(result.currentStatus).toBe('pending_approval');
    expect(result.currentVersionNo).toBe(2);
    expect(result.replacedVersionNo).toBe(1);
  });

  it('rejects creation when the quote version is not confirmed', async () => {
    const service = new SampleOrderService();

    await expect(
      service.create({
        quoteOrderId: 7,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: false,
        sampleRequirements: 'Need sample',
      }),
    ).rejects.toThrow('Only confirmed quote versions can create sample orders');
  });

  it('rejects creating a sample order when the source quote is not actually boss confirmed', async () => {
    const service = new SampleOrderService();
    seedQuote('submitted', 7);

    await expect(
      service.create({
        quoteOrderId: 7,
        quoteVersionNo: 3,
        customerId: 1001,
        createdBy: 2001,
        quoteConfirmed: true,
        sampleRequirements: 'Need sample',
      }),
    ).rejects.toThrow('只有老板已确认的报价单才能创建样品单');
  });

  it('moves an approved sample through sampling, sent, and customer confirmed', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 9);

    const created = await service.create({
      quoteOrderId: 9,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need production sample',
      samplingCost: 1200,
    });
    const submitted = await service.submit({
      sampleOrderId: created.id,
      currentStatus: created.currentStatus,
    });

    const approved = await service.approve({
      sampleOrderId: created.id,
      currentStatus: submitted.currentStatus,
    });
    const started = await service.startSampling({
      sampleOrderId: created.id,
      currentStatus: approved.currentStatus,
    });
    const sent = await service.markSent({
      sampleOrderId: created.id,
      currentStatus: started.currentStatus,
    });
    const confirmed = await service.markCustomerConfirmed({
      sampleOrderId: created.id,
      currentStatus: sent.currentStatus,
    });

    expect(submitted.currentStatus).toBe('pending_approval');
    expect(approved.currentStatus).toBe('pending_sampling');
    expect(started.currentStatus).toBe('sampling');
    expect(sent.currentStatus).toBe('sample_sent');
    expect(confirmed.currentStatus).toBe('customer_confirmed');
  });

  it('keeps draft saving focused on purchase-side execution fields before submission', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 9);

    const created = await service.create({
      quoteOrderId: 9,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need production sample',
      samplingCost: 1200,
    });
    const savedDraft = await service.saveDraft({
      sampleOrderId: created.id,
      currentStatus: created.currentStatus,
      sampleRequirements: 'Need updated sample',
      samplingCost: 1500,
      sampleQuantity: 6,
      purchaseUnit: '宁波智造工厂',
      estimatedCompletionDate: '2026-07-27',
    } as any);
    const draftDetail = await service.getDetail(created.id);
    const submitted = await service.submit({
      sampleOrderId: created.id,
      currentStatus: savedDraft.currentStatus,
    });
    const approved = await service.approve({
      sampleOrderId: created.id,
      currentStatus: submitted.currentStatus,
    });
    const started = await service.startSampling({
      sampleOrderId: created.id,
      currentStatus: approved.currentStatus,
    });
    const sent = await service.markSent({
      sampleOrderId: created.id,
      currentStatus: started.currentStatus,
      freightForwarder: 'DHL',
      domesticTrackingNo: 'SF123456789CN',
      domesticCourierFee: 35,
      internationalCourierFee: 120,
      estimatedArrivalDate: '2026-08-03',
    });
    const detail = await service.getDetail(created.id);

    expect(started.currentStatus).toBe('sampling');
    expect(sent.currentStatus).toBe('sample_sent');
    expect(draftDetail).toMatchObject({
      currentStatus: 'draft',
      sampleRequirements: 'Need updated sample',
      samplingCost: 1500,
      sampleQuantity: 6,
      purchaseUnit: '宁波智造工厂',
      internalProductCode: 'SKU-LED-001',
      estimatedCompletionDate: '2026-07-27',
    });
    expect(detail).toMatchObject({
      currentStatus: 'sample_sent',
      purchaseUnit: '宁波智造工厂',
      internalProductCode: 'SKU-LED-001',
      estimatedCompletionDate: '2026-07-27',
      freightForwarder: 'DHL',
      domesticTrackingNo: 'SF123456789CN',
      domesticCourierFee: 35,
      internationalCourierFee: 120,
      estimatedArrivalDate: '2026-08-03',
    });
  });

  it('persists purchase execution fields when submitting a draft sample directly', async () => {
    const service = new SampleOrderService();
    seedQuote('boss_confirmed', 9);

    const created = await service.create({
      quoteOrderId: 9,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need production sample',
      samplingCost: 1200,
    });

    const submitted = await service.submit({
      sampleOrderId: created.id,
      currentStatus: created.currentStatus,
      sampleRequirements: 'Need updated shell sample',
      samplingCost: 18.5,
      sampleQuantity: 8,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    });
    const detail = await service.getDetail(created.id);

    expect(submitted.currentStatus).toBe('pending_approval');
    expect(detail).toMatchObject({
      currentStatus: 'pending_approval',
      sampleRequirements: 'Need updated shell sample',
      samplingCost: 18.5,
      sampleQuantity: 8,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    });
  });

  it('closes a sent sample order when the customer has no follow-up', async () => {
    const service = new SampleOrderService();

    const result = await service.closeNoFollowup({
      sampleOrderId: 9,
      currentStatus: 'sample_sent',
      closeReason: '客户确认暂无后续',
    });

    expect(result).toEqual({
      id: 9,
      currentStatus: 'closed_no_followup',
      closeReason: '客户确认暂无后续',
    });
  });

  it('rejects cancellation after production has started', async () => {
    const service = new SampleOrderService();

    await expect(
      service.cancel({
        sampleOrderId: 9,
        currentStatus: 'sampling',
        hasProductionStarted: true,
        cancelReason: 'Supplier cannot continue',
      }),
    ).rejects.toThrow('Cannot cancel after sampling has started');
  });
});
