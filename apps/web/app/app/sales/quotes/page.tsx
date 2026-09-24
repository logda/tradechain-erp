import Link from 'next/link';
import {
  quoteBossConfirmedOptions,
  type QuoteDocumentType,
  type QuoteListItem,
  type QuoteListResponse,
  QUOTE_STATUSES,
} from '@erp/shared';
import { ConvertQuoteForm } from '../../../quotes/[id]/convert-quote-form';
import { getQuotePreviewResponse } from '../../../quotes/quote-preview';
import { AppShell } from '../../_components/app-shell';
import { AuditLogTable } from '../../_components/audit-log-table';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalDataTable } from '../../_components/formal-data-table';
import { FormalPagination } from '../../_components/formal-pagination';
import { StatStrip } from '../../_components/stat-strip';
import {
  canViewFormalModule,
  filterQuoteRows,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';
import {
  canUseFormalQuoteActions,
  canUseFormalSalesOrderActions,
} from '../../_lib/formal-access';
import { formatCounterpartyBilingualDisplay } from '../../_lib/counterparty-display';
import { loadQuoteSourceOptions } from '../../_lib/quote-source-options';
import { formatQuoteStatus, isKnownQuoteStatus } from '../../_lib/quote-status';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQuoteSourceType(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeQuoteDocumentType(value: string | undefined): QuoteDocumentType | undefined {
  return value === 'demand' || value === 'quote' ? value : undefined;
}

function normalizeTriStateFilter(value: string | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function toFormalQuoteDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/sales/quotes/${id}` : '/app/sales/quotes';
}

function formatCounterpartyListDisplayName(
  customerName: string | undefined,
  customerFullName?: string | null,
) {
  return formatCounterpartyBilingualDisplay(customerName, {
    fullName: customerFullName,
  });
}

function toQuoteDocumentTypeLabel(documentType: QuoteDocumentType | undefined) {
  return documentType === 'demand' ? '需求单 / Demand' : '报价单 / Quote';
}

function getQuoteApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function canConvertQuoteListItemToSales(item: QuoteListItem) {
  if (item.linkedSalesOrderId) {
    return false;
  }

  return (
    (item.documentType === 'demand' && item.status === 'boss_approved') ||
    (item.documentType === 'quote' && item.status === 'customer_accepted')
  );
}

function buildFormalReadHeaders(session: { role: string; user: string }) {
  return {
    ...buildFormalRequestHeaders(session),
    ...buildSignedFormalRequestHeaders(session),
  };
}

function hasValidQuoteListResponse(value: unknown): value is QuoteListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as QuoteListResponse).items) &&
    typeof (value as QuoteListResponse).total === 'number'
  );
}

async function loadQuoteList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getQuoteApiBaseUrl()}/quotes${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalReadHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidQuoteListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadQuoteAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getQuoteApiBaseUrl()}/quotes/audit-logs`, {
      cache: 'no-store',
      headers: buildFormalReadHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const buttonLinkStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#ffffff',
  background: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const mutedLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const chipWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const chipStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '999px',
  padding: '6px 10px',
  fontSize: '13px',
  background: '#f8fafc',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
} satisfies React.CSSProperties;

const tableHeadCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  padding: '12px 10px',
} satisfies React.CSSProperties;

const tableCellStyle = {
  padding: '14px 10px',
  borderBottom: '1px solid #eef2f7',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
} satisfies React.CSSProperties;

const lineDisplayStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  height: '30px',
  whiteSpace: 'nowrap',
} satisfies React.CSSProperties;

const lineNumberStyle = {
  flex: '0 0 22px',
  color: '#64748b',
  fontSize: '12px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const rowLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #d8e1ea',
  borderRadius: '10px',
  padding: '7px 12px',
  background: '#ffffff',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

const actionStackStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: '136px',
} satisfies React.CSSProperties;

const quoteFilterLabels: Record<string, string> = {
  keyword: '关键词',
  documentType: '单据类型',
  docNo: '单号',
  status: '状态',
  customerName: '客户',
  createdBy: '创建人 / 销售',
  sourceType: '来源类型',
  bossConfirmed: '老板环节完成',
};

export default async function AppQuoteListPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canCreateQuote = canUseFormalQuoteActions(session);
  const canConvertToSalesOrder = canUseFormalSalesOrderActions(session);
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    documentType: normalizeQuoteDocumentType(readParam(resolvedSearchParams.documentType)),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    customerName: readParam(resolvedSearchParams.customerName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    sourceType: normalizeQuoteSourceType(readParam(resolvedSearchParams.sourceType)),
    bossConfirmed: normalizeTriStateFilter(
      readParam(resolvedSearchParams.bossConfirmed),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const quoteSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    quoteSearchParams.set(key, String(value));
  });

  if (!canViewFormalModule(session, 'sales')) {
    return (
      <AppShell
        title="正式需求和报价"
        subtitle="当前角色不在销售域内，不能查看需求和报价。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式需求和报价</h2>
          <p>请切换到销售、销售主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadQuoteList(quoteSearchParams, session)) ?? getQuotePreviewResponse(query);
  const auditLogs = (await loadQuoteAuditLogs(session))?.items ?? [];
  const sourceOptions = await loadQuoteSourceOptions(session);
  const formatQuoteSourceType = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return '-';
    }

    const matchedOption = sourceOptions.find((option) => option.code === normalized);
    return matchedOption ? `${matchedOption.label} / ${matchedOption.code}` : normalized;
  };
  const visibleItems = filterQuoteRows(result.items, session);
  const confirmedCount = visibleItems.filter((item) => item.bossConfirmed).length;
  const pendingCount = visibleItems.filter((item) => !item.bossConfirmed).length;
  const revisedCount = visibleItems.filter((item) => item.status === 'revised').length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['documentType', query.documentType ? toQuoteDocumentTypeLabel(query.documentType) : undefined],
    ['docNo', query.docNo],
    ['status', query.status ? formatQuoteStatus(query.status) : undefined],
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
    ['sourceType', query.sourceType ? formatQuoteSourceType(query.sourceType) : undefined],
    ['bossConfirmed', query.bossConfirmed !== 'all' ? query.bossConfirmed : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    documentType: query.documentType,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    customerName: query.customerName,
    createdBy: query.createdBy,
    sourceType: query.sourceType,
    bossConfirmed: query.bossConfirmed !== 'all' ? query.bossConfirmed : undefined,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式需求和报价"
      subtitle="复用当前单据数据口径，以正式工作台样式承载筛选、摘要与列表。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <Link href="/app/sales" style={mutedLinkStyle}>
          返回工作台
        </Link>
        {canCreateQuote ? (
          <Link
            href="/app/sales/quotes/new"
            style={buttonLinkStyle}
          >
            新建需求/报价
          </Link>
        ) : null}
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '老板环节完成', value: confirmedCount },
          { label: '老板环节待处理', value: pendingCount },
          { label: '修订中', value: revisedCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="按单据类型、单号、客户、来源类型、销售和老板环节是否完成筛选。"
      >
        <form method="get" className="erp-filter-form erp-form-grid">
          <label className="erp-form-field">
            关键词 Keyword
            <input className="erp-control" name="keyword" defaultValue={query.keyword} />
          </label>
          <label className="erp-form-field">
            单号 Doc No
            <input className="erp-control" name="docNo" defaultValue={query.docNo} />
          </label>
          <label className="erp-form-field">
            单据类型 Document Type
            <select
              name="documentType"
              defaultValue={query.documentType ?? ''}
              className="erp-control"
            >
              <option value="">全部</option>
              <option value="demand">需求单 / Demand</option>
              <option value="quote">报价单 / Quote</option>
            </select>
          </label>
          <label className="erp-form-field">
            状态 Status
            <select className="erp-control" name="status" defaultValue={query.status ?? ''}>
              <option value="">全部</option>
              {QUOTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatQuoteStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-form-field">
            来源类型 Source Type
            <select
              name="sourceType"
              defaultValue={query.sourceType ?? ''}
              className="erp-control"
            >
              <option value="">全部</option>
              {sourceOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label} / {option.code}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-form-field">
            老板环节完成 Boss Step Completed
            <select
              name="bossConfirmed"
              defaultValue={query.bossConfirmed}
              className="erp-control"
            >
              {quoteBossConfirmedOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-form-field">
            客户 Customer
            <input
              name="customerName"
              defaultValue={query.customerName}
              className="erp-control"
            />
          </label>
          <label className="erp-form-field">
            创建人 / 销售 Created By
            <input className="erp-control" name="createdBy" defaultValue={query.createdBy} />
          </label>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <div className="erp-filter-actions">
            <button className="erp-button erp-button--primary" type="submit">查询</button>
          </div>
        </form>

        <div style={chipWrapStyle}>
          {appliedFilters.length === 0 ? (
            <span style={chipStyle}>默认显示全部</span>
          ) : (
            appliedFilters.map(([key, value]) => (
              <span key={key} style={chipStyle}>
                {quoteFilterLabels[key] ?? key}: {value}
              </span>
            ))
          )}
        </div>
      </FilterPanel>

      <FormalDataTable title="查询结果" total={result.total}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeadCellStyle}>单号</th>
              <th style={tableHeadCellStyle}>类型 Type</th>
              <th style={tableHeadCellStyle}>状态 Status</th>
              <th style={tableHeadCellStyle}>客户 Customer</th>
              <th style={tableHeadCellStyle}>产品 Product</th>
              <th style={tableHeadCellStyle}>数量 Qty</th>
              <th style={tableHeadCellStyle}>创建人 Created By</th>
              <th style={{ ...tableHeadCellStyle, minWidth: '148px' }}>操作 Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.detailHref}>
                <td style={tableCellStyle}>
                  <strong>{item.docNo}</strong>
                </td>
                <td style={tableCellStyle}>
                  {toQuoteDocumentTypeLabel(item.documentType)}
                </td>
                <td style={tableCellStyle}>
                  {formatQuoteStatus(item.status)}
                  {isKnownQuoteStatus(item.secondaryStatus) ? (
                    <>
                      <br />
                      {formatQuoteStatus(item.secondaryStatus)}
                    </>
                  ) : null}
                </td>
                <td style={tableCellStyle}>
                  {formatCounterpartyListDisplayName(
                    item.customerName,
                    item.customerFullName,
                  )}
                </td>
                <td style={tableCellStyle}>
                  {item.items?.length ? item.items.map((line, index) => (
                    <div
                      key={line.lineNo}
                      style={{ ...lineDisplayStyle, width: 'clamp(160px, 22vw, 280px)', borderTop: index ? '1px solid #e2e8f0' : undefined }}
                    >
                      <span style={lineNumberStyle}>{`${line.lineNo}. `}</span>
                      <Link
                        href={toFormalQuoteDetailHref(item.detailHref)}
                        title={line.productName}
                        style={{
                          display: 'block',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'inherit',
                          textDecoration: 'none',
                        }}
                      >
                        {line.productName || '-'}
                      </Link>
                    </div>
                  )) : '-'}
                </td>
                <td style={tableCellStyle}>
                  {item.items?.length ? item.items.map((line, index) => (
                    <div key={line.lineNo} style={{ ...lineDisplayStyle, borderTop: index ? '1px solid #e2e8f0' : undefined }}>
                      <span style={lineNumberStyle}>{`${line.lineNo}. `}</span>
                      <span>{line.quantity}{line.unit ? ` ${line.unit}` : ''}</span>
                    </div>
                  )) : '-'}
                </td>
                <td style={tableCellStyle}>{item.createdBy}</td>
                <td style={tableCellStyle}>
                  <div style={actionStackStyle}>
                    <Link
                      href={toFormalQuoteDetailHref(item.detailHref)}
                      className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                    >
                      查看详情
                    </Link>
                    {item.linkedSalesOrderId ? (
                      <Link
                        href={`/app/sales/orders/${item.linkedSalesOrderId}`}
                        style={rowLinkStyle}
                      >
                        查看销售单
                      </Link>
                    ) : null}
                    {canConvertToSalesOrder && canConvertQuoteListItemToSales(item) ? (
                      <ConvertQuoteForm
                        quoteId={
                          item.quoteId ??
                          Number(toFormalQuoteDetailHref(item.detailHref).split('/').at(-1))
                        }
                        quoteNo={item.docNo}
                        quoteVersionNo={item.currentVersionNo ?? undefined}
                        customerId={item.customerId ?? undefined}
                        customerName={item.customerName}
                        customerFullName={item.customerFullName}
                        customerCode={item.customerCode}
                        createdBy={undefined}
                        role={session.role}
                        user={session.user}
                        access={readParam(resolvedSearchParams.access)}
                        variant="compact"
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <FormalPagination
          pathname="/app/sales/quotes"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="需求和报价"
        />
      </FormalDataTable>

      <AuditLogTable session={session} items={auditLogs} />
    </AppShell>
  );
}
