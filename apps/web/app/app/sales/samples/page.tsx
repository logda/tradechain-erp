import Link from 'next/link';
import {
  formatSampleOrderStatus,
  sampleIsCancelledOptions,
  sampleIsReplacementOptions,
  type SampleListResponse,
  sampleOrderStatuses,
} from '@erp/shared';
import { AuditLogTable } from '../../_components/audit-log-table';
import { getSampleOrderPreviewResponse } from '../../../samples/sample-order-preview';
import { AppShell } from '../../_components/app-shell';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalPagination } from '../../_components/formal-pagination';
import { FormalDataTable } from '../../_components/formal-data-table';
import { StatStrip } from '../../_components/stat-strip';
import {
  canViewFormalModule,
  filterPurchaseOrderRows,
  filterSalesOrderRows,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { formatCounterpartyChineseDisplay } from '../../_lib/counterparty-display';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeTriStateFilter(value: string | undefined) {
  if (value === 'yes' || value === 'no') {
    return value;
  }

  return 'all';
}

function toFormalSampleDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/sales/samples/${id}` : '/app/sales/samples';
}

function getSampleApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function formatSampleOrderDate(value: string | undefined | null) {
  if (!value) {
    return '0';
  }

  return value.slice(0, 10);
}

function hasValidSampleListResponse(value: unknown): value is SampleListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as SampleListResponse).items) &&
    typeof (value as SampleListResponse).total === 'number'
  );
}

async function loadSampleList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getSampleApiBaseUrl()}/samples${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSampleListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadSampleAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSampleApiBaseUrl()}/samples/audit-logs`, {
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
  borderRadius: '8px',
  minHeight: '40px',
  padding: '8px 12px',
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

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

const sampleFilterLabels: Record<string, string> = {
  keyword: '关键词',
  docNo: '样品单号',
  status: '状态',
  customerName: '客户',
  ownerName: '负责人',
  quoteNo: '来源报价单号',
  isReplacement: '是否替代',
  isCancelled: '是否取消',
};

export default async function AppSampleOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    customerName: readParam(resolvedSearchParams.customerName),
    ownerName: readParam(resolvedSearchParams.ownerName),
    quoteNo: readParam(resolvedSearchParams.quoteNo),
    isReplacement: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isReplacement),
    ),
    isCancelled: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isCancelled),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const sampleSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    sampleSearchParams.set(key, String(value));
  });

  const canViewSalesSamples = canViewFormalModule(session, 'sales');
  const canViewPurchaseSamples = canViewFormalModule(session, 'purchase');
  const sampleBoardHref = canViewPurchaseSamples && !canViewSalesSamples
    ? '/app/purchase'
    : '/app/sales';

  if (!canViewSalesSamples && !canViewPurchaseSamples) {
    return (
      <AppShell
        title="正式样品单"
        subtitle="当前角色不在销售或采购域内，不能查看样品单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式样品单</h2>
          <p>请切换到销售、销售主管、采购、采购主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadSampleList(sampleSearchParams, session)) ??
    getSampleOrderPreviewResponse(query);
  const auditLogs = await loadSampleAuditLogs(session);
  const visibleItems = canViewPurchaseSamples && !canViewSalesSamples
    ? filterPurchaseOrderRows(result.items, session)
    : filterSalesOrderRows(result.items, session);
  const replacementCount = visibleItems.filter((item) => item.isReplacement).length;
  const cancelledCount = visibleItems.filter((item) => item.isCancelled).length;
  const pendingCount = visibleItems.filter(
    (item) => item.status === 'pending_sampling',
  ).length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['status', query.status],
    ['customerName', query.customerName],
    ['ownerName', query.ownerName],
    ['quoteNo', query.quoteNo],
    ['isReplacement', query.isReplacement !== 'all' ? query.isReplacement : undefined],
    ['isCancelled', query.isCancelled !== 'all' ? query.isCancelled : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    customerName: query.customerName,
    ownerName: query.ownerName,
    quoteNo: query.quoteNo,
    isReplacement: query.isReplacement !== 'all' ? query.isReplacement : undefined,
    isCancelled: query.isCancelled !== 'all' ? query.isCancelled : undefined,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式样品单"
      subtitle="正式样品页承接确认报价版本后的样品申请、替代版本和取消留痕。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <Link href={sampleBoardHref} style={mutedLinkStyle}>
          返回工作台
        </Link>
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '待打样', value: pendingCount },
          { label: '替代版本', value: replacementCount },
          { label: '已取消', value: cancelledCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="按样品单号、客户、负责人、来源报价单号、替代和取消状态筛选。"
      >
        <form method="get" className="erp-filter-form" style={fieldGridStyle}>
          <label style={labelStyle}>
            关键词 Keyword
            <input name="keyword" defaultValue={query.keyword} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            样品单号 Sample No
            <input name="docNo" defaultValue={query.docNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            状态 Status
            <select name="status" defaultValue={query.status ?? ''} style={inputStyle}>
              <option value="">全部</option>
              {sampleOrderStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatSampleOrderStatus(status)}
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
            负责人 Owner
            <input name="ownerName" defaultValue={query.ownerName} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            来源报价单号 Quote No
            <input name="quoteNo" defaultValue={query.quoteNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            是否替代 Replacement
            <select
              name="isReplacement"
              defaultValue={query.isReplacement}
              style={inputStyle}
            >
              {sampleIsReplacementOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            是否取消 Cancelled
            <select
              name="isCancelled"
              defaultValue={query.isCancelled}
              style={inputStyle}
            >
              {sampleIsCancelledOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <button className="erp-button erp-button--primary" type="submit">查询</button>
        </form>

        <div style={chipWrapStyle}>
          {appliedFilters.length === 0 ? (
            <span style={chipStyle}>默认显示全部</span>
          ) : (
            appliedFilters.map(([key, value]) => (
              <span key={key} style={chipStyle}>
                {sampleFilterLabels[key] ?? key}: {value}
              </span>
            ))
          )}
        </div>
      </FilterPanel>

      <FormalDataTable title="查询结果" total={result.total}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeadCellStyle}>样品单号</th>
              <th style={tableHeadCellStyle}>下单日期</th>
              <th style={tableHeadCellStyle}>客户 Customer</th>
              <th style={tableHeadCellStyle}>负责人 Owner</th>
              <th style={tableHeadCellStyle}>样品状态</th>
              <th style={tableHeadCellStyle}>来源报价</th>
              <th style={tableHeadCellStyle}>替代 / 取消</th>
              <th style={tableHeadCellStyle}>操作 Action</th>
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
                <td style={tableCellStyle}>{formatSampleOrderDate(item.createdAt)}</td>
                <td style={tableCellStyle}>
                  {formatCounterpartyChineseDisplay(item.customerName)}
                </td>
                <td style={tableCellStyle}>{item.ownerName}</td>
                <td style={tableCellStyle}>
                  {formatSampleOrderStatus(item.status)}
                </td>
                <td style={tableCellStyle}>{item.quoteNo}</td>
                <td style={tableCellStyle}>
                  {item.isReplacement ? 'yes / 替代版' : 'no / 首版'}
                  <br />
                  {item.isCancelled ? 'yes / 已取消' : 'no / 未取消'}
                </td>
                <td style={tableCellStyle}>
                  <Link
                    className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                    href={toFormalSampleDetailHref(item.detailHref)}
                  >
                    查看详情 {item.docNo}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FormalDataTable>

      <FormalPagination
        pathname="/app/sales/samples"
        params={paginationParams}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        summaryLabel="样品单"
      />

      <AuditLogTable items={auditLogs?.items ?? []} />
    </AppShell>
  );
}
