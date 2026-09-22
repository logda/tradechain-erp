export type TriStateFilter = 'all' | 'yes' | 'no';
export type SortOrder = 'asc' | 'desc';

export type CommonListQuery<TSortBy extends string = string> = {
  keyword?: string;
  docNo?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: TSortBy;
  sortOrder?: SortOrder;
};

export type ListQueryResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: Record<string, string | number | boolean | null>;
};

export type PaginatedListResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
