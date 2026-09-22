import Link from 'next/link';
import { buildPaginationSearchParams } from '../_lib/formal-pagination';

function buildPageHref(
  pathname: string,
  params: Record<string, string | number | undefined>,
  page: number,
  pageSize: number,
  pageParamName: string,
  pageSizeParamName: string,
) {
  const searchParams = buildPaginationSearchParams({
    ...params,
    [pageParamName]: page,
    [pageSizeParamName]: pageSize,
  });
  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function FormalPagination({
  pathname,
  params,
  page,
  pageSize,
  total,
  summaryLabel,
  pageParamName = 'page',
  pageSizeParamName = 'pageSize',
  pageSizeOptions = [20, 50, 100],
}: {
  pathname: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
  summaryLabel?: string;
  pageParamName?: string;
  pageSizeParamName?: string;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const summaryPrefix = summaryLabel ? `${summaryLabel}：` : '';

  return (
    <nav
      aria-label={summaryLabel ? `${summaryLabel}分页` : '列表分页'}
      className="erp-pagination"
    >
      <span>{`${summaryPrefix}第 ${currentPage} / ${totalPages} 页，共 ${total} 条`}</span>
      <div className="erp-pagination__actions">
        {currentPage > 1 ? (
          <Link
            href={buildPageHref(
              pathname,
              params,
              currentPage - 1,
              pageSize,
              pageParamName,
              pageSizeParamName,
            )}
            className="erp-button erp-button--secondary erp-button--compact"
          >
            上一页
          </Link>
        ) : (
          <span
            className="erp-button erp-button--secondary erp-button--compact erp-pagination__disabled"
            aria-disabled="true"
          >
            上一页
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            href={buildPageHref(
              pathname,
              params,
              currentPage + 1,
              pageSize,
              pageParamName,
              pageSizeParamName,
            )}
            className="erp-button erp-button--secondary erp-button--compact"
          >
            下一页
          </Link>
        ) : (
          <span
            className="erp-button erp-button--secondary erp-button--compact erp-pagination__disabled"
            aria-disabled="true"
          >
            下一页
          </span>
        )}
        <span className="erp-pagination__page-sizes">
          每页
          {pageSizeOptions.map((option) => {
            const isActive = option === pageSize;

            return isActive ? (
              <span
                key={option}
                className="erp-button erp-button--primary erp-button--compact"
              >
                {option}
              </span>
            ) : (
              <Link
                key={option}
                href={buildPageHref(
                  pathname,
                  params,
                  1,
                  option,
                  pageParamName,
                  pageSizeParamName,
                )}
                className="erp-button erp-button--secondary erp-button--compact"
              >
                {option}
              </Link>
            );
          })}
        </span>
      </div>
    </nav>
  );
}
