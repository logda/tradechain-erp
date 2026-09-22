import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';
import type { SalesDocumentSourceMode } from './sales-document-source-mode.js';

export const salesOrderListSortFields = [
  'createdAt',
  'docNo',
  'customerName',
] as const;

export const salesOrderHasAfterSalesOptions = ['all', 'yes', 'no'] as const;

export type SalesOrderListSortField = (typeof salesOrderListSortFields)[number];

export type SalesOrderListQuery = CommonListQuery<SalesOrderListSortField> & {
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  receiptStatus?: string;
  financeConfirmStatus?: string;
  hasAfterSales?: TriStateFilter;
  sourceMode?: SalesDocumentSourceMode;
};

export type SalesOrderListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  counterpartyName?: string;
  counterpartyFullName?: string;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  ownerName?: string;
  createdAt: string;
  detailHref: string;
  createdBy: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  receiptStatus: string;
  financeConfirmStatus: string;
  hasAfterSales: boolean;
  sourceSummary: string;
};

export type SalesOrderListResponse = ListQueryResponse<SalesOrderListItem>;
