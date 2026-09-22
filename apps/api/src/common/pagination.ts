export type RawPaginationQuery = {
  page?: string | number;
  pageSize?: string | number;
};

export type PaginationQuery = {
  page: number;
  pageSize: number;
};

export function normalizePaginationNumber(
  value: string | number | undefined,
  fallback: number,
) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePaginationQuery<T extends RawPaginationQuery>(
  query: T,
  fallbackPage = 1,
  fallbackPageSize = 20,
): Omit<T, 'page' | 'pageSize'> & PaginationQuery {
  return {
    ...query,
    page: normalizePaginationNumber(query.page, fallbackPage),
    pageSize: normalizePaginationNumber(query.pageSize, fallbackPageSize),
  };
}

export function paginateItems<T>(
  items: T[],
  page: string | number,
  pageSize: string | number,
) {
  const normalizedPage = normalizePaginationNumber(page, 1);
  const normalizedPageSize = normalizePaginationNumber(pageSize, 20);
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: items.slice(start, start + normalizedPageSize),
    total: items.length,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}
