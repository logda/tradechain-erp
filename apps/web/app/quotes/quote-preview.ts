import type { QuoteListItem, QuoteListQuery, QuoteListResponse } from '@erp/shared';

const previewQuotes: QuoteListItem[] = [
  {
    moduleLabel: '报价单',
    docNo: 'Q202607080001',
    title: 'Acme 夏季风扇报价',
    status: 'quoted',
    secondaryStatus: 'boss_confirmed',
    documentType: 'quote',
    customerName: 'Acme Trading',
    createdBy: 'Zoe',
    sourceType: 'expo',
    bossConfirmed: true,
    createdAt: '2026-07-08T09:00:00.000Z',
    detailHref: '/quotes/1',
  },
  {
    moduleLabel: '报价单',
    docNo: 'Q202607080002',
    title: 'Bravo 插座首单报价',
    status: 'quoted',
    secondaryStatus: 'pending_boss_confirmation',
    documentType: 'quote',
    customerName: 'Bravo Retail',
    createdBy: 'Leo',
    sourceType: 'website',
    bossConfirmed: false,
    createdAt: '2026-07-07T10:30:00.000Z',
    detailHref: '/quotes/2',
  },
  {
    moduleLabel: '需求单',
    docNo: 'XQ202607080003',
    title: 'Acme 秋季灯具需求单',
    status: 'revised',
    secondaryStatus: 'revision_pending',
    documentType: 'demand',
    customerName: 'Acme Trading',
    createdBy: 'Zoe',
    sourceType: 'referral',
    bossConfirmed: false,
    createdAt: '2026-07-06T14:00:00.000Z',
    detailHref: '/quotes/3',
  },
];

function normalizeQuoteSourceType(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export function getQuotePreviewResponse(query: QuoteListQuery): QuoteListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const sortBy =
    query.sortBy === 'docNo' || query.sortBy === 'customerName'
      ? query.sortBy
      : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const keyword = query.keyword?.trim().toLowerCase();
  const customerName = query.customerName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const documentType =
    query.documentType === 'demand' || query.documentType === 'quote'
      ? query.documentType
      : undefined;
  const sourceType = normalizeQuoteSourceType(query.sourceType);
  const bossConfirmed = normalizeTriStateFilter(query.bossConfirmed);
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

  const filtered = previewQuotes.filter((item) => {
    if (
      keyword &&
      ![item.docNo, item.title, item.customerName].join(' ').toLowerCase().includes(keyword)
    ) {
      return false;
    }

    if (query.docNo && item.docNo !== query.docNo) {
      return false;
    }

    if (query.status && item.status !== query.status) {
      return false;
    }

    if (documentType && (item.documentType ?? 'quote') !== documentType) {
      return false;
    }

    if (customerName && !item.customerName.toLowerCase().includes(customerName)) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    if (sourceType && item.sourceType !== sourceType) {
      return false;
    }

    if (bossConfirmed !== 'all') {
      const expected = bossConfirmed === 'yes';
      if (item.bossConfirmed !== expected) {
        return false;
      }
    }

    if (dateFrom && item.createdAt < dateFrom) {
      return false;
    }

    if (dateTo && item.createdAt > dateTo) {
      return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((left, right) => {
    const leftValue =
      sortBy === 'customerName' ? left.customerName : left[sortBy];
    const rightValue =
      sortBy === 'customerName' ? right.customerName : right[sortBy];

    if (leftValue === rightValue) {
      return 0;
    }

    const result = leftValue > rightValue ? 1 : -1;
    return sortOrder === 'asc' ? result : result * -1;
  });

  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    appliedFilters: {
      keyword: query.keyword ?? null,
      docNo: query.docNo ?? null,
      status: query.status ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      documentType: documentType ?? null,
      customerName: query.customerName ?? null,
      createdBy: query.createdBy ?? null,
      sourceType: sourceType ?? null,
      bossConfirmed,
    },
  };
}
