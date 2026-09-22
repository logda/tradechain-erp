export type FormalPaginationResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function normalizePageNumber(value: string | number | undefined, fallback: number) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): FormalPaginationResult<T> {
  const normalizedPage = normalizePageNumber(page, 1);
  const normalizedPageSize = normalizePageNumber(pageSize, 20);
  const start = (normalizedPage - 1) * normalizedPageSize;

  return {
    items: items.slice(start, start + normalizedPageSize),
    total: items.length,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

export function buildPaginationSearchParams(
  params: Record<string, string | number | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams;
}
