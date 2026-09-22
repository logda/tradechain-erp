import type {
  PurchaseOrderListItem,
  PurchaseOrderListQuery,
  PurchaseOrderListResponse,
} from '@erp/shared';

const previewPurchaseOrders: PurchaseOrderListItem[] = [
  {
    moduleLabel: '采购单',
    docNo: 'P202607080001',
    title: 'Acme 风扇供应拆单',
    status: 'purchasing',
    secondaryStatus: 'partial_forwarder_shipped',
    supplierName: 'Acme Supply',
    ownerName: 'Zoe',
    createdAt: '2026-07-08T10:00:00.000Z',
    detailHref: '/purchase-orders/1',
    createdBy: 'Mia',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_forwarder_shipped',
    salesOrderNo: 'S202607080001',
    isResubmitted: true,
  },
  {
    moduleLabel: '采购单',
    docNo: 'P202607080002',
    title: 'Bravo 插座首单采购',
    status: 'pending_purchase_manager_approval',
    secondaryStatus: 'pending_purchase_manager_approval',
    supplierName: 'Bravo Industrial',
    ownerName: 'Leo',
    createdAt: '2026-07-07T11:30:00.000Z',
    detailHref: '/purchase-orders/2',
    createdBy: 'Mia',
    approvalStatus: 'pending_purchase_manager_approval',
    fulfillmentStatus: 'pending_purchase_manager_approval',
    salesOrderNo: 'S202607080002',
    isResubmitted: false,
  },
  {
    moduleLabel: '采购单',
    docNo: 'P202607080003',
    title: 'Acme 灯具追加采购',
    status: 'purchasing',
    secondaryStatus: 'partial_shipped',
    supplierName: 'Acme Supply',
    ownerName: 'Zoe',
    createdAt: '2026-07-06T15:20:00.000Z',
    detailHref: '/purchase-orders/3',
    createdBy: 'Ivy',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_shipped',
    salesOrderNo: 'S202607080003',
    isResubmitted: false,
  },
];

function normalizeTriStateFilter(value: 'all' | 'yes' | 'no' | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

export function getPurchaseOrderPreviewResponse(
  query: PurchaseOrderListQuery,
): PurchaseOrderListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const keyword = query.keyword?.trim().toLowerCase();
  const supplierName = query.supplierName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const ownerName = query.ownerName?.trim().toLowerCase();
  const salesOrderNo = query.salesOrderNo?.trim().toLowerCase();
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
  const isResubmitted = normalizeTriStateFilter(query.isResubmitted);

  const filtered = previewPurchaseOrders.filter((item) => {
    if (
      keyword &&
      ![
        item.docNo,
        item.title,
        item.supplierName ?? '',
        item.ownerName ?? '',
        item.salesOrderNo,
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

    if (
      query.status &&
      item.approvalStatus !== query.status &&
      item.fulfillmentStatus !== query.status
    ) {
      return false;
    }

    if (
      supplierName &&
      !(item.supplierName ?? '').toLowerCase().includes(supplierName)
    ) {
      return false;
    }

    if (createdBy && !item.createdBy.toLowerCase().includes(createdBy)) {
      return false;
    }

    if (ownerName && !(item.ownerName ?? '').toLowerCase().includes(ownerName)) {
      return false;
    }

    if (query.approvalStatus && item.approvalStatus !== query.approvalStatus) {
      return false;
    }

    if (
      query.fulfillmentStatus &&
      item.fulfillmentStatus !== query.fulfillmentStatus
    ) {
      return false;
    }

    if (salesOrderNo && !item.salesOrderNo.toLowerCase().includes(salesOrderNo)) {
      return false;
    }

    if (isResubmitted !== 'all') {
      const expected = isResubmitted === 'yes';
      if (item.isResubmitted !== expected) {
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

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
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
      createdBy: query.createdBy ?? null,
      ownerName: query.ownerName ?? null,
      approvalStatus: query.approvalStatus ?? null,
      fulfillmentStatus: query.fulfillmentStatus ?? null,
      salesOrderNo: query.salesOrderNo ?? null,
      isResubmitted,
    },
  };
}
