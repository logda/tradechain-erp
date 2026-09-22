import { InquiryRuntimeStore } from './inquiry.store';
import type { InquiryListItem } from './inquiry-list.data';

function createInquiry(overrides: Partial<InquiryListItem> = {}): InquiryListItem {
  return {
    id: 1,
    inquiryNo: 'IQ-TEST-001',
    status: 'pending_inquiry',
    quoteOrderId: 1,
    quoteOrderNo: 'Q-TEST-001',
    quoteVersionNo: 1,
    customerName: '测试客户',
    createdBy: 'Zoe',
    supplierCount: 0,
    comparisonSummary: '测试历史询价数据兼容',
    createdAt: '2026-07-28T00:00:00.000Z',
    detailHref: '/app/sales/inquiries/1',
    items: [
      {
        itemId: 1,
        lineNo: 1,
        sku: 'SKU-TEST-001',
        productName: '测试商品',
        requiredSupplierCount: 2,
        supplierQuotes: [],
        confirmedSalePrice: 0,
      },
    ],
    ...overrides,
  };
}

describe('InquiryRuntimeStore', () => {
  it('normalizes missing item arrays when cloning legacy inquiries', () => {
    const store = new InquiryRuntimeStore();
    store.upsertInquiry(createInquiry({ items: undefined as unknown as InquiryListItem['items'] }));

    expect(store.listInquiries()[0].items).toEqual([]);
  });

  it('normalizes missing supplier quotes when cloning legacy inquiry items', () => {
    const store = new InquiryRuntimeStore();
    store.upsertInquiry(
      createInquiry({
        items: [
          {
            itemId: 1,
            lineNo: 1,
            sku: 'SKU-TEST-001',
            productName: '测试商品',
            requiredSupplierCount: 2,
            supplierQuotes: undefined as unknown as InquiryListItem['items'][number]['supplierQuotes'],
            confirmedSalePrice: 0,
          },
        ],
      }),
    );

    expect(store.listInquiries()[0].items[0].supplierQuotes).toEqual([]);
  });
});
