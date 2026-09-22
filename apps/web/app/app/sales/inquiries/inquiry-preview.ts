type InquiryStatus = 'pending_inquiry' | 'pending_boss_review' | 'boss_confirmed';
type InquirySupplierQuote = {
  supplierSourceMode: 'counterparty' | 'manual';
  supplierId?: number;
  supplierCode?: string;
  supplierName: string;
  purchasePrice: number;
  productId?: number;
  productSku?: string;
  productStatus?: 'active' | 'inactive' | 'deleted';
};

export type InquiryPreviewItem = {
  id: number;
  inquiryNo: string;
  status: InquiryStatus;
  quoteOrderId: number;
  quoteOrderNo: string;
  quoteVersionNo: number;
  customerName: string;
  customerFullName?: string | null;
  createdBy: string;
  supplierCount: number;
  comparisonSummary: string;
  createdAt: string;
  detailHref: string;
  items: Array<{
    itemId: number;
    lineNo: number;
    sku: string;
    productName: string;
    requiredSupplierCount: number;
    supplierQuotes: InquirySupplierQuote[];
    confirmedSalePrice: number;
  }>;
};

const inquiryListData: InquiryPreviewItem[] = [
  {
    id: 1,
    inquiryNo: 'IQ202607080001',
    status: 'pending_inquiry',
    quoteOrderId: 1,
    quoteOrderNo: 'Q202607080001',
    quoteVersionNo: 1,
    customerName: 'Acme Trading',
    createdBy: 'Zoe',
    supplierCount: 2,
    comparisonSummary: '已收齐 2 家供应商报价，等待提交比价。',
    createdAt: '2026-07-08T11:20:00.000Z',
    detailHref: '/app/sales/inquiries/1',
    items: [
      {
        itemId: 10,
        lineNo: 1,
        sku: 'SKU-FAN-001',
        productName: '便携风扇',
        requiredSupplierCount: 2,
        supplierQuotes: [
          {
            supplierSourceMode: 'counterparty',
            supplierId: 2,
            supplierCode: 'SUP-BRAVO',
            supplierName: 'Bravo Industrial',
            purchasePrice: 18.6,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '深圳快联电子',
            purchasePrice: 19.2,
          },
        ],
        confirmedSalePrice: 28.8,
      },
    ],
  },
  {
    id: 2,
    inquiryNo: 'IQ202607080002',
    status: 'pending_boss_review',
    quoteOrderId: 2,
    quoteOrderNo: 'Q202607080002',
    quoteVersionNo: 2,
    customerName: 'Bravo Retail',
    createdBy: 'Leo',
    supplierCount: 3,
    comparisonSummary: '比价已提交，等待老板确认最终售价。',
    createdAt: '2026-07-07T13:10:00.000Z',
    detailHref: '/app/sales/inquiries/2',
    items: [
      {
        itemId: 11,
        lineNo: 1,
        sku: 'SKU-PLUG-001',
        productName: '多孔插座',
        requiredSupplierCount: 2,
        supplierQuotes: [
          {
            supplierSourceMode: 'counterparty',
            supplierId: 2,
            supplierCode: 'SUP-BRAVO',
            supplierName: 'Bravo Industrial',
            purchasePrice: 19.6,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '东莞优联工厂',
            purchasePrice: 20.1,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '宁波海星电子',
            purchasePrice: 20.4,
          },
        ],
        confirmedSalePrice: 19.6,
      },
    ],
  },
  {
    id: 3,
    inquiryNo: 'IQ202607080003',
    status: 'boss_confirmed',
    quoteOrderId: 3,
    quoteOrderNo: 'Q202607080003',
    quoteVersionNo: 3,
    customerName: 'Acme Trading',
    createdBy: 'Zoe',
    supplierCount: 4,
    comparisonSummary: '老板已确认售价，可以回写报价版本并进入销售单转化。',
    createdAt: '2026-07-06T15:45:00.000Z',
    detailHref: '/app/sales/inquiries/3',
    items: [
      {
        itemId: 12,
        lineNo: 1,
        sku: 'SKU-LIGHT-002',
        productName: '室内灯具',
        requiredSupplierCount: 2,
        supplierQuotes: [
          {
            supplierSourceMode: 'counterparty',
            supplierId: 2,
            supplierCode: 'SUP-BRAVO',
            supplierName: 'Bravo Industrial',
            purchasePrice: 54.1,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '中山光谱工厂',
            purchasePrice: 55.2,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '江门亮点电子',
            purchasePrice: 55.8,
          },
          {
            supplierSourceMode: 'manual',
            supplierName: '佛山新辉照明',
            purchasePrice: 56.0,
          },
        ],
        confirmedSalePrice: 56.2,
      },
    ],
  },
];

type InquiryListQuery = {
  keyword?: string;
  docNo?: string;
  status?: InquiryStatus | 'all';
  customerName?: string;
  createdBy?: string;
  page?: number;
  pageSize?: number;
};

function normalizeStatus(value: string | undefined) {
  if (
    value === 'pending_inquiry' ||
    value === 'pending_boss_review' ||
    value === 'boss_confirmed'
  ) {
    return value;
  }

  return 'all';
}

export function getInquiryPreviewResponse(query: InquiryListQuery) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const keyword = query.keyword?.trim().toLowerCase();
  const customerName = query.customerName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const status = normalizeStatus(query.status);

  const filtered = inquiryListData.filter((item) => {
    if (
      keyword &&
      ![
        item.inquiryNo,
        item.quoteOrderNo,
        item.customerName,
        item.comparisonSummary,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }

    if (query.docNo && item.inquiryNo !== query.docNo) {
      return false;
    }

    if (status !== 'all' && item.status !== status) {
      return false;
    }

    if (customerName && !item.customerName.toLowerCase().includes(customerName)) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    appliedFilters: {
      keyword: query.keyword ?? null,
      docNo: query.docNo ?? null,
      status,
      customerName: query.customerName ?? null,
      createdBy: query.createdBy ?? null,
    },
  };
}

export function getInquiryPreviewById(id: string) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  return inquiryListData.find((item) => item.id === numericId) ?? null;
}
