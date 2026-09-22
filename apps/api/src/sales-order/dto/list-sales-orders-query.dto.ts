export class ListSalesOrdersQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  approvalStatus?: string;
  fulfillmentStatus?: string;
  receiptStatus?: string;
  financeConfirmStatus?: string;
  hasAfterSales?: 'all' | 'yes' | 'no';
  sourceMode?: 'all' | 'direct' | 'from_demand' | 'from_quote' | 'from_quote_with_inquiry';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
