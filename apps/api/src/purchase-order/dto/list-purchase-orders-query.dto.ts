export class ListPurchaseOrdersQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  supplierName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  salesOrderNo?: string;
  isResubmitted?: 'all' | 'yes' | 'no';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
