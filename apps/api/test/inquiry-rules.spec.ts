import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { InquiryController } from '../src/inquiry/inquiry.controller';
import type { InquiryListItem } from '../src/inquiry/inquiry-list.data';
import { InquiryService } from '../src/inquiry/inquiry.service';

describe('InquiryService', () => {
  it('rejects boss submission when any item has fewer than two suppliers', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 1,
        items: [
          {
            itemId: 10,
            supplierQuotes: [
              {
                supplierSourceMode: 'manual',
                supplierName: '深圳快联电子',
                purchasePrice: 12.5,
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow('每个询价明细至少需要 2 条供应商报价');
  });

  it('confirms inquiry after all items are priced', async () => {
    const service = new InquiryService();

    const result = await service.confirmByBoss({
      inquiryId: 2,
      items: [
        {
          itemId: 11,
          supplierQuoteCount: 3,
          confirmedSalePrice: 15.8,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });

    expect(result.status).toBe('boss_confirmed');
  });

  it('rejects comparison submission for an unknown inquiry item', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 1,
        items: [
          {
            itemId: 9999,
            supplierQuotes: [
              {
                supplierSourceMode: 'manual',
                supplierName: '深圳快联电子',
                purchasePrice: 12.5,
              },
              {
                supplierSourceMode: 'manual',
                supplierName: '东莞优联工厂',
                purchasePrice: 11.8,
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow('询价明细不存在或已失效');
  });

  it('rejects boss confirmation for an unknown inquiry item', async () => {
    const service = new InquiryService();

    await expect(
      service.confirmByBoss({
        inquiryId: 2,
        items: [
          { itemId: 9999, supplierQuoteCount: 2, confirmedSalePrice: 15.8 },
        ],
      }),
    ).rejects.toThrow('询价明细不存在或已失效');
  });

  it('rejects comparison submission when existing inquiry lines are omitted', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 1,
        items: [],
      }),
    ).rejects.toThrow('询价单至少需要 1 行明细');
  });

  it('rejects boss confirmation when existing inquiry lines are omitted', async () => {
    const service = new InquiryService();

    await expect(
      service.confirmByBoss({
        inquiryId: 2,
        items: [],
      }),
    ).rejects.toThrow('询价单至少需要 1 行明细');
  });

  it('rejects boss confirmation when the server-side supplier quotes are incomplete', async () => {
    const service = new InquiryService();
    const unsafeInquiry: InquiryListItem = {
      id: 90,
      inquiryNo: 'IQ-UNSAFE-090',
      status: 'pending_boss_review',
      quoteOrderId: 90,
      quoteOrderNo: 'Q-UNSAFE-090',
      quoteVersionNo: 1,
      customerName: '测试客户',
      createdBy: 'Leo',
      supplierCount: 0,
      comparisonSummary: '异常数据：没有供应商报价却进入老板确认。',
      createdAt: '2026-07-28T09:00:00.000Z',
      detailHref: '/app/sales/inquiries/90',
      items: [
        {
          itemId: 9001,
          lineNo: 1,
          sku: 'SKU-UNSAFE-001',
          productName: '异常询价商品',
          requiredSupplierCount: 2,
          supplierQuotes: [],
          confirmedSalePrice: 0,
        },
      ],
    };

    (
      service as unknown as {
        store: { upsertInquiry: (record: InquiryListItem) => void };
      }
    ).store.upsertInquiry(unsafeInquiry);

    await expect(
      service.confirmByBoss({
        inquiryId: 90,
        items: [
          {
            itemId: 9001,
            supplierQuoteCount: 2,
            confirmedSalePrice: 18.8,
          },
        ],
      }),
    ).rejects.toThrow('Boss confirmation requires complete item pricing');
  });

  it('rejects submitting comparison after boss has confirmed the inquiry', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 3,
        items: [
          {
            itemId: 12,
            supplierQuotes: [
              {
                supplierSourceMode: 'manual',
                supplierName: '中山光谱工厂',
                purchasePrice: 54.1,
              },
              {
                supplierSourceMode: 'manual',
                supplierName: '江门亮点电子',
                purchasePrice: 55.2,
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow('只有待询价状态的询价单才能提交比价');
  });

  it('rejects boss confirmation before purchasing submits comparison', async () => {
    const service = new InquiryService();

    await expect(
      service.confirmByBoss({
        inquiryId: 1,
        items: [
          { itemId: 10, supplierQuoteCount: 2, confirmedSalePrice: 28.8 },
        ],
      }),
    ).rejects.toThrow('只有待老板确认状态的询价单才能老板确认');
  });

  it('rejects malformed comparison payloads without an items array', async () => {
    const service = new InquiryService();

    await expect(
      service.submitForComparison({
        inquiryId: 1,
        items: undefined as never,
      }),
    ).rejects.toThrow('Inquiry items must be an array');
  });

  it('rejects malformed boss confirmation payloads without an items array', async () => {
    const service = new InquiryService();

    await expect(
      service.confirmByBoss({
        inquiryId: 1,
        items: undefined as never,
      }),
    ).rejects.toThrow('Inquiry items must be an array');
  });

  it('uses ParseIntPipe for both inquiry id params', () => {
    const submitMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      InquiryController,
      'submitForComparison',
    ) as Record<string, { pipes: unknown[] }>;
    const confirmMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      InquiryController,
      'bossConfirm',
    ) as Record<string, { pipes: unknown[] }>;

    expect(submitMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(confirmMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
