import type {
  SampleListItem,
  SampleListQuery,
  SampleListResponse,
} from '@erp/shared';

const previewSampleOrders: SampleListItem[] = [
  {
    moduleLabel: '样品单',
    docNo: 'SP202607080001',
    title: 'Acme 夏季风扇首版样品',
    status: 'pending_sampling',
    secondaryStatus: 'quote_confirmed',
    customerName: 'Acme Trading',
    createdBy: 'Mia',
    ownerName: 'Zoe',
    quoteNo: 'Q202607080001',
    isReplacement: false,
    isCancelled: false,
    createdAt: '2026-07-08T09:00:00.000Z',
    detailHref: '/samples/1',
  },
  {
    moduleLabel: '样品单',
    docNo: 'SP202607080002',
    title: 'Bravo 插座替代样品',
    status: 'sample_sent',
    secondaryStatus: 'replacement_v2',
    customerName: 'Bravo Retail',
    createdBy: 'Noah',
    ownerName: 'Liam',
    quoteNo: 'Q202607080002',
    isReplacement: true,
    isCancelled: false,
    createdAt: '2026-07-07T10:30:00.000Z',
    detailHref: '/samples/2',
  },
  {
    moduleLabel: '样品单',
    docNo: 'SP202607080003',
    title: 'Acme 灯具取消样品',
    status: 'canceled',
    secondaryStatus: 'cancel_recorded',
    customerName: 'Acme Trading',
    createdBy: 'Ivy',
    ownerName: 'Zoe',
    quoteNo: 'Q202607080003',
    isReplacement: false,
    isCancelled: true,
    createdAt: '2026-07-06T14:00:00.000Z',
    detailHref: '/samples/3',
  },
];

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export function getSampleOrderPreviewResponse(
  query: SampleListQuery,
): SampleListResponse {
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
  const ownerName = query.ownerName?.trim().toLowerCase();
  const quoteNo = query.quoteNo?.trim().toLowerCase();
  const isReplacement = normalizeTriStateFilter(query.isReplacement);
  const isCancelled = normalizeTriStateFilter(query.isCancelled);
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;

  const filtered = previewSampleOrders.filter((item) => {
    if (
      keyword &&
      ![
        item.docNo,
        item.title,
        item.customerName,
        item.ownerName,
        item.quoteNo,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    ) {
      return false;
    }

    if (query.docNo && item.docNo !== query.docNo) {
      return false;
    }

    if (query.status && item.status !== query.status) {
      return false;
    }

    if (customerName && !item.customerName.toLowerCase().includes(customerName)) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    if (ownerName && !item.ownerName.toLowerCase().includes(ownerName)) {
      return false;
    }

    if (quoteNo && !item.quoteNo.toLowerCase().includes(quoteNo)) {
      return false;
    }

    if (isReplacement !== 'all') {
      const expected = isReplacement === 'yes';
      if (item.isReplacement !== expected) {
        return false;
      }
    }

    if (isCancelled !== 'all') {
      const expected = isCancelled === 'yes';
      if (item.isCancelled !== expected) {
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
      customerName: query.customerName ?? null,
      createdBy: query.createdBy ?? null,
      ownerName: query.ownerName ?? null,
      quoteNo: query.quoteNo ?? null,
      isReplacement,
      isCancelled,
    },
  };
}
