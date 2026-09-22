import type { AfterSalesType } from '@erp/shared';

export class ListAfterSalesQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  supplierName?: string;
  createdBy?: string;
  ownerName?: string;
  type?: AfterSalesType;
  financeReviewStatus?: string;
  receiptCollectionStatus?: string;
  shipmentBatchNo?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
