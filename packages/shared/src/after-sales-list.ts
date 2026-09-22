import type { CommonListQuery, ListQueryResponse } from './list-query.js';

export const afterSalesListSortFields = [
  'createdAt',
  'docNo',
  'customerName',
] as const;

export const afterSalesTypeOptions = [
  'customer_complaint',
  'return',
  'refund',
  'rework',
] as const;

export type AfterSalesListSortField = (typeof afterSalesListSortFields)[number];
export type AfterSalesType = (typeof afterSalesTypeOptions)[number];

export type AfterSalesListQuery = Omit<CommonListQuery, 'sortBy'> & {
  customerName?: string;
  supplierName?: string;
  createdBy?: string;
  ownerName?: string;
  type?: AfterSalesType;
  financeReviewStatus?: string;
  receiptCollectionStatus?: string;
  shipmentBatchNo?: string;
  sortBy?: AfterSalesListSortField;
};

export type AfterSalesListItem = {
  moduleLabel: string;
  docNo: string;
  title: string;
  status: string;
  secondaryStatus?: string;
  createdAt: string;
  detailHref: string;
  customerName: string;
  supplierName: string;
  createdBy: string;
  ownerName: string;
  type: AfterSalesType;
  financeReviewStatus: string;
  receiptCollectionStatus: string;
  shipmentBatchNo?: string;
};

export type AfterSalesListResponse = ListQueryResponse<AfterSalesListItem>;
