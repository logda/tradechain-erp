import type {
  ShipmentBatchListItem,
  ShipmentBatchListQuery,
  ShipmentBatchListResponse,
} from '@erp/shared';

const previewShipmentBatches: ShipmentBatchListItem[] = [
  {
    moduleLabel: '发货批次',
    docNo: 'SH202607080001',
    title: 'Acme 风扇首批异常发货',
    status: 'shipped',
    secondaryStatus: 'exception',
    supplierName: 'Acme Supply',
    salesOrderNo: 'S202607080001',
    purchaseOrderNo: 'P202607080001',
    receiptSendStatus: 'sent',
    hasException: true,
    createdAt: '2026-07-08T12:00:00.000Z',
    detailHref: '/shipment-batches/1',
  },
  {
    moduleLabel: '发货批次',
    docNo: 'SH202607080002',
    title: 'Bravo 插座正常发货',
    status: 'forwarder_shipped',
    secondaryStatus: 'to_forwarder',
    supplierName: 'Bravo Industrial',
    salesOrderNo: 'S202607080002',
    purchaseOrderNo: 'P202607080002',
    receiptSendStatus: 'pending',
    hasException: false,
    createdAt: '2026-07-07T15:30:00.000Z',
    detailHref: '/shipment-batches/2',
  },
  {
    moduleLabel: '发货批次',
    docNo: 'SH202607080003',
    title: 'Acme 灯具到港批次',
    status: 'shipped',
    secondaryStatus: 'arrived',
    supplierName: 'Acme Supply',
    salesOrderNo: 'S202607080003',
    purchaseOrderNo: 'P202607080003',
    receiptSendStatus: 'pending',
    hasException: false,
    createdAt: '2026-07-06T09:15:00.000Z',
    detailHref: '/shipment-batches/3',
  },
];

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export function getShipmentBatchPreviewResponse(
  query: ShipmentBatchListQuery,
): ShipmentBatchListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const sortBy =
    query.sortBy === 'docNo' || query.sortBy === 'supplierName'
      ? query.sortBy
      : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const keyword = query.keyword?.trim().toLowerCase();
  const supplierName = query.supplierName?.trim().toLowerCase();
  const salesOrderNo = query.salesOrderNo?.trim().toLowerCase();
  const purchaseOrderNo = query.purchaseOrderNo?.trim().toLowerCase();
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
  const hasException = normalizeTriStateFilter(query.hasException);

  const filtered = previewShipmentBatches.filter((item) => {
    if (
      keyword &&
      ![
        item.docNo,
        item.title,
        item.supplierName,
        item.salesOrderNo,
        item.purchaseOrderNo,
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

    if (supplierName && !item.supplierName.toLowerCase().includes(supplierName)) {
      return false;
    }

    if (salesOrderNo && !item.salesOrderNo.toLowerCase().includes(salesOrderNo)) {
      return false;
    }

    if (
      purchaseOrderNo &&
      !item.purchaseOrderNo.toLowerCase().includes(purchaseOrderNo)
    ) {
      return false;
    }

    if (
      query.receiptSendStatus &&
      item.receiptSendStatus !== query.receiptSendStatus
    ) {
      return false;
    }

    if (hasException !== 'all') {
      const expected = hasException === 'yes';
      if (item.hasException !== expected) {
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
      sortBy === 'supplierName' ? left.supplierName : left[sortBy];
    const rightValue =
      sortBy === 'supplierName' ? right.supplierName : right[sortBy];

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
      supplierName: query.supplierName ?? null,
      salesOrderNo: query.salesOrderNo ?? null,
      purchaseOrderNo: query.purchaseOrderNo ?? null,
      receiptSendStatus: query.receiptSendStatus ?? null,
      hasException,
    },
  };
}
