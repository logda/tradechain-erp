import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { AuditLogTable } from '../../_components/audit-log-table';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalDataTable } from '../../_components/formal-data-table';
import { FormalPagination } from '../../_components/formal-pagination';
import { StatStrip } from '../../_components/stat-strip';
import {
  canViewFormalModule,
  resolveDemoSession,
  type DemoSession,
} from '../../_lib/demo-session';
import { formatCounterpartyBilingualDisplay } from '../../_lib/counterparty-display';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { getInquiryPreviewResponse } from './inquiry-preview';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type InquiryStatusFilter =
  | 'pending_inquiry'
  | 'pending_boss_review'
  | 'boss_confirmed'
  | 'all';

type InquiryListResponse = {
  items: Array<{
    id: number;
    inquiryNo: string;
    status: InquiryStatusFilter;
    quoteOrderId: number;
    quoteOrderNo: string;
    quoteVersionNo: number;
    customerName: string;
    customerFullName?: string | null;
    createdBy: string;
    supplierCount: number;
    comparisonSummary: string;
    createdAt: string;
    detailHref: string;
    items: Array<unknown>;
  }>;
  page: number;
  pageSize: number;
  total: number;
  appliedFilters: {
    keyword: string | null;
    docNo: string | null;
    quoteNo: string | null;
    status: InquiryStatusFilter;
    customerName: string | null;
    createdBy: string | null;
  };
};

function normalizeInquiryStatus(value: string | undefined): InquiryStatusFilter | undefined {
  if (
    value === 'pending_inquiry' ||
    value === 'pending_boss_review' ||
    value === 'boss_confirmed' ||
    value === 'all'
  ) {
    return value;
  }

  return undefined;
}

function getInquiryApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidInquiryListResponse(value: unknown): value is InquiryListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as InquiryListResponse).items) &&
    typeof (value as InquiryListResponse).total === 'number'
  );
}

function canViewFormalInquiryModule(session: DemoSession) {
  return canViewFormalModule(session, 'purchase');
}

async function loadInquiryList(searchParams: URLSearchParams, session: DemoSession) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getInquiryApiBaseUrl()}/quote-inquiries${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidInquiryListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadInquiryAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getInquiryApiBaseUrl()}/quote-inquiries/audit-logs`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
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

const actionLinkStyle = {
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

const rowLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

const inquiryFilterLabels: Record<string, string> = {
  keyword: '关键词',
  docNo: '询价单号',
  quoteNo: '来源报价单号',
  status: '状态',
  customerName: '客户',
  createdBy: '创建人',
};

function toStatusLabel(value: string) {
  if (value === 'pending_inquiry') return 'pending_inquiry / 待询价';
  if (value === 'pending_boss_review') return 'pending_boss_review / 待老板确认';
  if (value === 'boss_confirmed') return 'boss_confirmed / 老板已确认';
  return value;
}

function formatCounterpartyListDisplayName(
  customerName: string | undefined,
  customerFullName?: string | null,
) {
  return formatCounterpartyBilingualDisplay(customerName, {
    fullName: customerFullName,
  });
}

export default async function AppFormalInquiryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    quoteNo: readParam(resolvedSearchParams.quoteNo),
    status: normalizeInquiryStatus(readParam(resolvedSearchParams.status)),
    customerName: readParam(resolvedSearchParams.customerName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const inquirySearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    inquirySearchParams.set(key, String(value));
  });

  if (!canViewFormalInquiryModule(session)) {
    return (
      <AppShell
        title="正式询价单"
        subtitle="当前角色不在采购域内，不能查看询价单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式询价单</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadInquiryList(inquirySearchParams, session)) ??
    getInquiryPreviewResponse(query);
  const auditLogs = await loadInquiryAuditLogs(session);
  const pendingInquiryCount = result.items.filter(
    (item) => item.status === 'pending_inquiry',
  ).length;
  const pendingBossReviewCount = result.items.filter(
    (item) => item.status === 'pending_boss_review',
  ).length;
  const confirmedCount = result.items.filter((item) => item.status === 'boss_confirmed').length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['quoteNo', query.quoteNo],
    ['status', query.status],
    ['customerName', query.customerName],
    ['createdBy', query.createdBy],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    quoteNo: query.quoteNo,
    status: query.status,
    customerName: query.customerName,
    createdBy: query.createdBy,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式询价单"
      subtitle="询价单承接供应商比价和老板确认，是报价和销售转单的中间环节。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <Link href="/app/sales" style={mutedLinkStyle}>
          返回销售中心
        </Link>
        <Link href="/app/sales/quotes" style={actionLinkStyle}>
          进入需求/报价模块
        </Link>
      </div>

      <StatStrip
        items={[
          { label: '全部', value: result.total },
          { label: '待询价', value: pendingInquiryCount },
          { label: '待老板确认', value: pendingBossReviewCount },
          { label: '老板已确认', value: confirmedCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="按询价单号、来源报价单号、状态、客户和创建人筛选。"
      >
        <form method="get" style={fieldGridStyle}>
          <label style={labelStyle}>
            关键词 Keyword
            <input name="keyword" defaultValue={query.keyword} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            询价单号 Inquiry No
            <input name="docNo" defaultValue={query.docNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            来源报价单号 Quote No
            <input name="quoteNo" defaultValue={query.quoteNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            状态 Status
            <select name="status" defaultValue={query.status ?? ''} style={inputStyle}>
              <option value="">全部</option>
              <option value="pending_inquiry">待询价</option>
              <option value="pending_boss_review">待老板确认</option>
              <option value="boss_confirmed">老板已确认</option>
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
            创建人 Created By
            <input name="createdBy" defaultValue={query.createdBy} style={inputStyle} />
          </label>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit">查询</button>
            <Link href="/app/sales/inquiries">重置</Link>
          </div>
        </form>
      </FilterPanel>

      {appliedFilters.length > 0 ? (
        <section>
          <h2>当前筛选</h2>
          <div style={chipWrapStyle}>
            {appliedFilters.map(([key, value]) => (
              <span key={key} style={chipStyle}>
                {inquiryFilterLabels[key] ?? key}: {value}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <FormalDataTable title="查询结果" total={result.total}>
        {result.items.length === 0 ? (
          <p>暂无符合条件的询价单</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeadCellStyle}>询价单</th>
                <th style={tableHeadCellStyle}>来源报价</th>
                <th style={tableHeadCellStyle}>客户</th>
                <th style={tableHeadCellStyle}>状态</th>
                <th style={tableHeadCellStyle}>供应商数</th>
                <th style={tableHeadCellStyle}>创建人</th>
                <th style={tableHeadCellStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td style={tableCellStyle}>
                    <div>{item.inquiryNo}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      {item.comparisonSummary}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div>{item.quoteOrderNo}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>
                      V{item.quoteVersionNo}
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    {formatCounterpartyListDisplayName(
                      item.customerName,
                      item.customerFullName,
                    )}
                  </td>
                  <td style={tableCellStyle}>{toStatusLabel(item.status)}</td>
                  <td style={tableCellStyle}>{item.supplierCount}</td>
                  <td style={tableCellStyle}>{item.createdBy}</td>
                  <td style={tableCellStyle}>
                    <Link href={item.detailHref} style={rowLinkStyle}>
                      查看详情 {item.inquiryNo}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <FormalPagination
          pathname="/app/sales/inquiries"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="询价单"
        />
      </FormalDataTable>

      <AuditLogTable items={auditLogs?.items ?? []} />
    </AppShell>
  );
}
