export class ListShipmentBatchesQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  supplierName?: string;
  salesOrderNo?: string;
  purchaseOrderNo?: string;
  receiptSendStatus?: string;
  hasException?: 'all' | 'yes' | 'no';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
