import type {
  CommonListQuery,
  ListQueryResponse,
  TriStateFilter,
} from './list-query.js';

export const purchaseOrderListSortFields = [
  'createdAt',
  'docNo',
  'supplierName',
] as const;

export const purchaseOrderIsResubmittedOptions = ['all', 'yes', 'no'] as const;

export type PurchaseOrderListSortField =
  (typeof purchaseOrderListSortFields)[number];

export type PurchaseOrderListQuery = Omit<CommonListQuery, 'sortBy'> & {
  supplierName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  salesOrderNo?: string;
  isResubmitted?: TriStateFilter;
  sortBy?: PurchaseOrderListSortField;
};

export type PurchaseOrderListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  supplierName?: string;
  ownerName?: string;
  factoryEstimatedDeliveryDate?: string;
  createdAt: string;
  detailHref: string;
  createdBy: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  salesOrderNo: string;
  isResubmitted: boolean;
};

export type PurchaseOrderListResponse = ListQueryResponse<PurchaseOrderListItem>;
