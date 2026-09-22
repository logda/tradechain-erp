export class ListSampleOrdersQueryDto {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerName?: string;
  createdBy?: string;
  ownerName?: string;
  quoteNo?: string;
  isReplacement?: 'all' | 'yes' | 'no';
  isCancelled?: 'all' | 'yes' | 'no';
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
