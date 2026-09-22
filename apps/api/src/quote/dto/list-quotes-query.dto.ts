export class ListQuotesQueryDto {
  keyword?: string;
  documentType?: 'demand' | 'quote';
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  createdBy?: string;
  sourceType?: string;
  bossConfirmed?: 'all' | 'yes' | 'no';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
