import type {
  AfterSalesListItem,
  AfterSalesListQuery,
  AfterSalesListResponse,
} from '@erp/shared';

const previewAfterSalesOrders: AfterSalesListItem[] = [
  {
    moduleLabel: '售后单',
    docNo: 'AS202607080001',
    title: 'Acme 风扇批量退款',
    status: 'processing',
    secondaryStatus: 'refund',
    createdAt: '2026-07-08T11:00:00.000Z',
    detailHref: '/after-sales/1',
    customerName: 'Acme Trading',
    supplierName: 'Acme Supply',
    createdBy: 'Mia',
    ownerName: 'Zoe',
    type: 'refund',
    financeReviewStatus: 'confirmed',
    receiptCollectionStatus: 'fully_paid',
    shipmentBatchNo: 'SB202607080001',
  },
  {
    moduleLabel: '售后单',
    docNo: 'AS202607080002',
    title: 'Bravo 插座客诉补发',
    status: 'pending_approval',
    secondaryStatus: 'customer_complaint',
    createdAt: '2026-07-07T16:00:00.000Z',
    detailHref: '/after-sales/2',
    customerName: 'Bravo Retail',
    supplierName: 'Bravo Industrial',
    createdBy: 'Mia',
    ownerName: 'Leo',
    type: 'customer_complaint',
    financeReviewStatus: 'pending',
    receiptCollectionStatus: 'deposit_received',
    shipmentBatchNo: 'SB202607080002',
  },
  {
    moduleLabel: '售后单',
    docNo: 'AS202607080003',
    title: 'Acme 灯具返工处理',
    status: 'processing',
    secondaryStatus: 'rework',
    createdAt: '2026-07-06T14:30:00.000Z',
    detailHref: '/after-sales/3',
    customerName: 'Acme Trading',
    supplierName: 'Acme Supply',
    createdBy: 'Ivy',
    ownerName: 'Zoe',
    type: 'rework',
    financeReviewStatus: 'pending',
    receiptCollectionStatus: 'unpaid',
    shipmentBatchNo: 'SB202607080003',
  },
];

function normalizeAfterSalesType(value: string | undefined) {
  if (
    value === 'customer_complaint' ||
    value === 'return' ||
    value === 'refund' ||
    value === 'rework'
  ) {
    return value;
  }

  return undefined;
}

export function getAfterSalesPreviewResponse(
  query: AfterSalesListQuery,
): AfterSalesListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const sortBy =
    query.sortBy === 'docNo' || query.sortBy === 'customerName'
      ? query.sortBy
      : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const keyword = query.keyword?.trim().toLowerCase();
  const customerName = query.customerName?.trim().toLowerCase();
  const supplierName = query.supplierName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const ownerName = query.ownerName?.trim().toLowerCase();
  const shipmentBatchNo = query.shipmentBatchNo?.trim().toLowerCase();
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
  const type = normalizeAfterSalesType(query.type);

  const filtered = previewAfterSalesOrders.filter((item) => {
    if (
      keyword &&
      ![
        item.docNo,
        item.title,
        item.customerName,
        item.supplierName,
        item.shipmentBatchNo ?? '',
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

    if (supplierName && !item.supplierName.toLowerCase().includes(supplierName)) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    if (ownerName && !item.ownerName.toLowerCase().includes(ownerName)) {
      return false;
    }

    if (type && item.type !== type) {
      return false;
    }

    if (
      query.financeReviewStatus &&
      item.financeReviewStatus !== query.financeReviewStatus
    ) {
      return false;
    }

    if (
      query.receiptCollectionStatus &&
      item.receiptCollectionStatus !== query.receiptCollectionStatus
    ) {
      return false;
    }

    if (
      shipmentBatchNo &&
      !(item.shipmentBatchNo ?? '').toLowerCase().includes(shipmentBatchNo)
    ) {
      return false;
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
      supplierName: query.supplierName ?? null,
      createdBy: query.createdBy ?? null,
      ownerName: query.ownerName ?? null,
      type: type ?? null,
      financeReviewStatus: query.financeReviewStatus ?? null,
      receiptCollectionStatus: query.receiptCollectionStatus ?? null,
      shipmentBatchNo: query.shipmentBatchNo ?? null,
    },
  };
}
