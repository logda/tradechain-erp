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

const quoteStatusLabels: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  quoted: '已报价',
  revised: '已修订',
  sample_requested: '已申请打样',
  ordered: '已转订单',
  closed: '已关闭',
  boss_pending: '待老板确认',
  pending_boss_confirm: '待老板确认',
  pending_boss_confirmation: '待老板确认',
  boss_confirmed: '老板已确认',
  revision_pending: '待修订',
};

function toQuoteStatusLabel(status: string | undefined) {
  const normalized = status?.trim();
  if (!normalized) {
    return '-';
  }

  const label = quoteStatusLabels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
}

function toQuoteSecondaryStatusLabel(status: string | undefined) {
  const normalized = status?.trim();
  if (!normalized || !quoteStatusLabels[normalized]) {
    return null;
  }

  return toQuoteStatusLabel(normalized);
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
    (item.documentType === 'demand' && item.status === 'submitted') ||
    (item.documentType === 'quote' && item.status === 'boss_confirmed')
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

const fieldGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#fff',
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
  bossConfirmed: '老板确认',
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
    ['status', query.status ? toQuoteStatusLabel(query.status) : undefined],
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
          { label: '已确认', value: confirmedCount },
          { label: '待确认', value: pendingCount },
          { label: '修订中', value: revisedCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="按单据类型、单号、客户、来源类型、销售和老板确认状态筛选。"
      >
        <form method="get" style={fieldGridStyle}>
          <label style={labelStyle}>
            关键词 Keyword
            <input name="keyword" defaultValue={query.keyword} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            单号 Doc No
            <input name="docNo" defaultValue={query.docNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            单据类型 Document Type
            <select
              name="documentType"
              defaultValue={query.documentType ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              <option value="demand">需求单 / Demand</option>
              <option value="quote">报价单 / Quote</option>
            </select>
          </label>
          <label style={labelStyle}>
            状态 Status
            <select name="status" defaultValue={query.status ?? ''} style={inputStyle}>
              <option value="">全部</option>
              {QUOTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {toQuoteStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            来源类型 Source Type
            <select
              name="sourceType"
              defaultValue={query.sourceType ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {sourceOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label} / {option.code}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            老板确认 Boss Confirmed
            <select
              name="bossConfirmed"
              defaultValue={query.bossConfirmed}
              style={inputStyle}
            >
              {quoteBossConfirmedOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            客户 Customer
            <input
              name="customerName"
              defaultValue={query.customerName}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            创建人 / 销售 Created By
            <input name="createdBy" defaultValue={query.createdBy} style={inputStyle} />
          </label>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <button type="submit">查询</button>
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
              <th style={tableHeadCellStyle}>客户 Customer</th>
              <th style={tableHeadCellStyle}>状态 Status</th>
              <th style={tableHeadCellStyle}>来源 Source</th>
              <th style={tableHeadCellStyle}>创建人 Created By</th>
              <th style={{ ...tableHeadCellStyle, minWidth: '148px' }}>操作 Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.detailHref}>
                <td style={tableCellStyle}>
                  <strong>{item.docNo}</strong>
                  <br />
                  {item.title}
                </td>
                <td style={tableCellStyle}>
                  {toQuoteDocumentTypeLabel(item.documentType)}
                </td>
                <td style={tableCellStyle}>
                  {formatCounterpartyListDisplayName(
                    item.customerName,
                    item.customerFullName,
                  )}
                </td>
                <td style={tableCellStyle}>
                  {toQuoteStatusLabel(item.status)}
                  {toQuoteSecondaryStatusLabel(item.secondaryStatus) ? (
                    <>
                      <br />
                      {toQuoteSecondaryStatusLabel(item.secondaryStatus)}
                    </>
                  ) : null}
                </td>
                <td style={tableCellStyle}>{formatQuoteSourceType(item.sourceType)}</td>
                <td style={tableCellStyle}>{item.createdBy}</td>
                <td style={tableCellStyle}>
                  <div style={actionStackStyle}>
                    <Link
                      href={toFormalQuoteDetailHref(item.detailHref)}
                      style={rowLinkStyle}
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

      <AuditLogTable items={auditLogs} />
    </AppShell>
  );
}
