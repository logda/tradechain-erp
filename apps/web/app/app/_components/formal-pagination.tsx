import Link from 'next/link';
import { buildPaginationSearchParams } from '../_lib/formal-pagination';

const wrapStyle = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  color: '#475569',
  fontSize: '13px',
} satisfies React.CSSProperties;

const actionWrapStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const pageSizeWrapStyle = {
  display: 'flex',
  gap: '6px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const actionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '76px',
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '8px 12px',
  color: '#0f172a',
  background: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const pageSizeActionStyle = {
  ...actionStyle,
  minWidth: 'auto',
  padding: '7px 10px',
} satisfies React.CSSProperties;

const activePageSizeActionStyle = {
  ...pageSizeActionStyle,
  border: '1px solid #0f172a',
  color: '#ffffff',
  background: '#0f172a',
} satisfies React.CSSProperties;

const disabledActionStyle = {
  ...actionStyle,
  color: '#94a3b8',
  background: '#f8fafc',
} satisfies React.CSSProperties;

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
      style={wrapStyle}
    >
      <span>{`${summaryPrefix}第 ${currentPage} / ${totalPages} 页，共 ${total} 条`}</span>
      <div style={actionWrapStyle}>
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
            style={actionStyle}
          >
            上一页
          </Link>
        ) : (
          <span style={disabledActionStyle}>上一页</span>
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
            style={actionStyle}
          >
            下一页
          </Link>
        ) : (
          <span style={disabledActionStyle}>下一页</span>
        )}
        <span style={pageSizeWrapStyle}>
          每页
          {pageSizeOptions.map((option) => {
            const isActive = option === pageSize;

            return isActive ? (
              <span key={option} style={activePageSizeActionStyle}>
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
                style={pageSizeActionStyle}
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
