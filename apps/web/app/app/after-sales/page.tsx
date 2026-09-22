import Link from 'next/link';
import {
  afterSalesStatuses,
  afterSalesTypeOptions,
  financeConfirmStatuses,
  receiptCollectionStatuses,
  type AfterSalesListResponse,
} from '@erp/shared';
import { getAfterSalesPreviewResponse } from '../../after-sales/after-sales-preview';
import { AppShell } from '../_components/app-shell';
import { AuditLogTable } from '../_components/audit-log-table';
import { FilterPanel } from '../_components/filter-panel';
import { FormalDataTable } from '../_components/formal-data-table';
import { FormalPagination } from '../_components/formal-pagination';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalModule,
  filterOperationsRows,
  resolveDemoSession,
} from '../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../_lib/audit-log';
import { formatCounterpartyChineseDisplay } from '../_lib/counterparty-display';
import { canUseFormalAfterSalesProcessActions } from '../_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeAfterSalesType(value: string | undefined) {
  if (
    value === 'customer_complaint' ||
    value === 'return' ||
    value === 'refund' ||
    value === 'rework'
  ) {
    return value;
  }

  return undefined;
}

function toFormalAfterSalesDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/after-sales/${id}` : '/app/after-sales';
}

function getAfterSalesApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidAfterSalesListResponse(
  value: unknown,
): value is AfterSalesListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as AfterSalesListResponse).items) &&
    typeof (value as AfterSalesListResponse).total === 'number'
  );
}

async function loadAfterSalesList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getAfterSalesApiBaseUrl()}/after-sales${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAfterSalesListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadAfterSalesAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getAfterSalesApiBaseUrl()}/after-sales/audit-logs`, {
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

const primaryLinkStyle = {
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#0f172a',
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

export default async function AppAfterSalesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canProcessAfterSales = canUseFormalAfterSalesProcessActions(session);
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    customerName: readParam(resolvedSearchParams.customerName),
    supplierName: readParam(resolvedSearchParams.supplierName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    type: normalizeAfterSalesType(readParam(resolvedSearchParams.type)),
    financeReviewStatus: readParam(resolvedSearchParams.financeReviewStatus),
    receiptCollectionStatus: readParam(
      resolvedSearchParams.receiptCollectionStatus,
    ),
    shipmentBatchNo: readParam(resolvedSearchParams.shipmentBatchNo),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const afterSalesSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    afterSalesSearchParams.set(key, String(value));
  });

  if (!canViewFormalModule(session, 'operations')) {
    return (
      <AppShell
        title="正式售后单"
        subtitle="当前角色不在采购履约域内，不能查看售后单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式售后单</h2>
          <p>请切换到采购、采购主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadAfterSalesList(afterSalesSearchParams, session)) ??
    getAfterSalesPreviewResponse(query);
  const auditLogs = (await loadAfterSalesAuditLogs(session))?.items ?? [];
  const visibleItems = filterOperationsRows(result.items, session);
  const processingCount = visibleItems.filter(
    (item) => item.status === 'processing',
  ).length;
  const pendingCount = visibleItems.filter(
    (item) => item.status === 'pending_approval',
  ).length;
  const financeConfirmedCount = visibleItems.filter(
    (item) => item.financeReviewStatus === 'confirmed',
  ).length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['customerName', query.customerName],
    ['supplierName', query.supplierName],
    ['ownerName', query.ownerName],
    ['type', query.type],
    ['financeReviewStatus', query.financeReviewStatus],
    ['receiptCollectionStatus', query.receiptCollectionStatus],
    ['shipmentBatchNo', query.shipmentBatchNo],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    customerName: query.customerName,
    supplierName: query.supplierName,
    createdBy: query.createdBy,
    ownerName: query.ownerName,
    type: query.type,
    financeReviewStatus: query.financeReviewStatus,
    receiptCollectionStatus: query.receiptCollectionStatus,
    shipmentBatchNo: query.shipmentBatchNo,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式售后单"
      subtitle="正式售后页承接客诉、退款、返工与财务复核，突出售后闭环与资金确认。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {canProcessAfterSales ? (
            <Link
              href="/app/after-sales/new"
              style={primaryLinkStyle}
            >
              新建售后单
            </Link>
          ) : null}
        </div>
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '处理中', value: processingCount },
          { label: '待审批', value: pendingCount },
          { label: '财务已确认', value: financeConfirmedCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="优先保留售后类型、财务复核、收款状态与发货批次追溯等字段。"
      >
        <form method="get" className="erp-filter-form" style={fieldGridStyle}>
          <label style={labelStyle}>
            关键词 Keyword
            <input name="keyword" defaultValue={query.keyword} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            单号 Doc No
            <input name="docNo" defaultValue={query.docNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            状态 Status
            <select name="status" defaultValue={query.status ?? ''} style={inputStyle}>
              <option value="">全部</option>
              {afterSalesStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
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
            供应商 Supplier
            <input
              name="supplierName"
              defaultValue={query.supplierName}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            负责人 Owner
            <input name="ownerName" defaultValue={query.ownerName} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            售后类型 Type
            <select name="type" defaultValue={query.type ?? ''} style={inputStyle}>
              <option value="">全部</option>
              {afterSalesTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            财务复核 Finance
            <select
              name="financeReviewStatus"
              defaultValue={query.financeReviewStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {financeConfirmStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            收款状态 Receipt
            <select
              name="receiptCollectionStatus"
              defaultValue={query.receiptCollectionStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {receiptCollectionStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            发货批次 Shipment Batch
            <input
              name="shipmentBatchNo"
              defaultValue={query.shipmentBatchNo}
              style={inputStyle}
            />
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
                {key}: {value}
              </span>
            ))
          )}
        </div>
      </FilterPanel>

      <FormalDataTable title="查询结果" total={result.total}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeadCellStyle}>售后单号</th>
              <th style={tableHeadCellStyle}>客户 / 供应商</th>
              <th style={tableHeadCellStyle}>负责人 Owner</th>
              <th style={tableHeadCellStyle}>售后状态</th>
              <th style={tableHeadCellStyle}>财务 / 收款</th>
              <th style={tableHeadCellStyle}>追溯批次</th>
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
                <td style={tableCellStyle}>
                  {formatCounterpartyChineseDisplay(item.customerName)}
                  <br />
                  {formatCounterpartyChineseDisplay(item.supplierName)}
                </td>
                <td style={tableCellStyle}>{item.ownerName}</td>
                <td style={tableCellStyle}>
                  {item.status}
                  <br />
                  {item.type}
                </td>
                <td style={tableCellStyle}>
                  {item.financeReviewStatus}
                  <br />
                  {item.receiptCollectionStatus}
                </td>
                <td style={tableCellStyle}>
                  {item.shipmentBatchNo ? (
                    <Link
                      href={`/app/shipment-batches?docNo=${encodeURIComponent(item.shipmentBatchNo)}`}
                      style={rowLinkStyle}
                    >
                      追溯发货批次 {item.shipmentBatchNo}
                    </Link>
                  ) : (
                    '无关联发货批次'
                  )}
                </td>
                <td style={tableCellStyle}>
                  <Link
                    className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                    href={toFormalAfterSalesDetailHref(item.detailHref)}
                  >
                    查看详情 {item.docNo}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <FormalPagination
          pathname="/app/after-sales"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="售后单"
        />
      </FormalDataTable>

      <AuditLogTable items={auditLogs} />
    </AppShell>
  );
}
