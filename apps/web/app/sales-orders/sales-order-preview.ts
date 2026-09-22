import {
  normalizeSalesDocumentSourceMode,
  resolveSalesDocumentSourceMode,
  SalesOrderListItem,
  SalesOrderListQuery,
  SalesOrderListResponse,
} from '@erp/shared';

const previewSalesOrders: SalesOrderListItem[] = [
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080001',
    title: 'Acme 夏季风扇补货',
    status: 'purchasing',
    secondaryStatus: 'partial_forwarder_shipped',
    counterpartyName: 'Acme Trading',
    customerOrderNo: 'PO-ACME-20260708',
    storeName: '02 Libuys',
    orderDate: '2026-07-08',
    estimatedDeliveryDate: '2026-08-08',
    ownerName: 'Zoe',
    createdAt: '2026-07-08T09:00:00.000Z',
    detailHref: '/sales-orders/1',
    createdBy: 'Mia',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_forwarder_shipped',
    receiptStatus: 'fully_paid',
    financeConfirmStatus: 'confirmed',
    hasAfterSales: true,
    sourceSummary: '报价 Q202607080001 / 询价 IQ202607080002',
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080002',
    title: 'Bravo 插座首单',
    status: 'pending_sales_manager_approval',
    secondaryStatus: 'pending_sales_manager_approval',
    counterpartyName: 'Bravo Retail',
    customerOrderNo: 'PO-BRAVO-001',
    storeName: 'Bravo Main',
    orderDate: '2026-07-07',
    estimatedDeliveryDate: '2026-08-15',
    ownerName: 'Leo',
    createdAt: '2026-07-07T08:30:00.000Z',
    detailHref: '/sales-orders/2',
    createdBy: 'Mia',
    approvalStatus: 'pending_sales_manager_approval',
    fulfillmentStatus: 'pending_sales_manager_approval',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
    sourceSummary: 'DIRECT / 直建',
  },
  {
    moduleLabel: '销售订单',
    docNo: 'S202607080003',
    title: 'Acme 秋季灯具追单',
    status: 'purchasing',
    secondaryStatus: 'partial_shipped',
    counterpartyName: 'Acme Trading',
    customerOrderNo: 'PO-ACME-20260706',
    storeName: '03 Airport',
    orderDate: '2026-07-06',
    estimatedDeliveryDate: '2026-08-20',
    ownerName: 'Zoe',
    createdAt: '2026-07-06T13:15:00.000Z',
    detailHref: '/sales-orders/3',
    createdBy: 'Ivy',
    approvalStatus: 'purchasing',
    fulfillmentStatus: 'partial_shipped',
    receiptStatus: 'deposit_received',
    financeConfirmStatus: 'pending',
    hasAfterSales: false,
    sourceSummary: '报价 Q202607080003',
  },
];

export function getSalesOrderPreviewResponse(
  query: SalesOrderListQuery,
): SalesOrderListResponse {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const keyword = query.keyword?.trim().toLowerCase();
  const customerName = query.customerName?.trim().toLowerCase();
  const createdBy = query.createdBy?.trim().toLowerCase();
  const ownerName = query.ownerName?.trim().toLowerCase();
  const dateFrom = query.dateFrom ? `${query.dateFrom}T00:00:00.000Z` : null;
  const dateTo = query.dateTo ? `${query.dateTo}T23:59:59.999Z` : null;
  const sourceMode = normalizeSalesDocumentSourceMode(query.sourceMode);

  const filtered = previewSalesOrders.filter((item) => {
    if (
      keyword &&
      ![item.docNo, item.title, item.counterpartyName ?? '', item.ownerName ?? '']
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
      customerName &&
      !(item.counterpartyName ?? '').toLowerCase().includes(customerName)
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

    if (query.receiptStatus && item.receiptStatus !== query.receiptStatus) {
      return false;
    }

    if (
      query.financeConfirmStatus &&
      item.financeConfirmStatus !== query.financeConfirmStatus
    ) {
      return false;
    }

    if (query.hasAfterSales && query.hasAfterSales !== 'all') {
      const expected = query.hasAfterSales === 'yes';
      if (item.hasAfterSales !== expected) {
        return false;
      }
    }

    if (
      sourceMode !== 'all' &&
      resolveSalesDocumentSourceMode(item.sourceSummary) !== sourceMode
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
      customerName: query.customerName ?? null,
      createdBy: query.createdBy ?? null,
      ownerName: query.ownerName ?? null,
      approvalStatus: query.approvalStatus ?? null,
      fulfillmentStatus: query.fulfillmentStatus ?? null,
      receiptStatus: query.receiptStatus ?? null,
      financeConfirmStatus: query.financeConfirmStatus ?? null,
      hasAfterSales: query.hasAfterSales ?? 'all',
      sourceMode,
    },
  };
}
