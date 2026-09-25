import Link from 'next/link';
import {
  formatSalesDocumentSourceMode,
  normalizeSalesDocumentSourceMode,
  resolveSalesDocumentSourceMode,
  salesApprovalStatuses,
  salesDocumentSourceModeOptions,
  salesFulfillmentStatuses,
  salesOrderHasAfterSalesOptions,
  type SalesOrderListResponse,
} from '@erp/shared';
import { getSalesOrderPreviewResponse } from '../../../sales-orders/sales-order-preview';
import { AppShell } from '../../_components/app-shell';
import { AuditLogTable } from '../../_components/audit-log-table';
import { FilterPanel } from '../../_components/filter-panel';
import { FormalDataTable } from '../../_components/formal-data-table';
import { FormalPagination } from '../../_components/formal-pagination';
import { StatStrip } from '../../_components/stat-strip';
import {
  canViewFormalModule,
  filterSalesOrderRows,
  resolveDemoSession,
} from '../../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';
import { formatCounterpartyBilingualDisplay } from '../../_lib/counterparty-display';
import { canUseFormalSalesOrderActions } from '../../_lib/formal-access';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toFormalSalesOrderDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/sales/orders/${id}` : '/app/sales/orders';
}

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function buildFormalReadHeaders(session: { role: string; user: string }) {
  return {
    ...buildFormalRequestHeaders(session),
    ...buildSignedFormalRequestHeaders(session),
  };
}

function hasValidSalesOrderListResponse(
  value: unknown,
): value is SalesOrderListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as SalesOrderListResponse).items) &&
    typeof (value as SalesOrderListResponse).total === 'number'
  );
}

async function loadSalesOrderList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalReadHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSalesOrderListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadSalesOrderAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders/audit-logs`, {
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

function formatListValue(value: string | null | undefined) {
  return value?.trim() ? value : '-';
}

const salesOrderStatusLabels: Record<string, string> = {
  draft: '草稿',
  rejected: '已驳回',
  pending_sales_manager_approval: '待销售主管审批',
  pending_purchase_assignment: '待分配采购负责人',
  purchasing: '采购中',
  partial_purchasing: '部分采购中',
  partial_shipped: '部分已发货',
  shipped: '已发货',
  partial_to_forwarder: '部分交货代',
  to_forwarder: '已交货代',
  partial_forwarder_shipped: '部分货代发出',
  forwarder_shipped: '货代已发出',
  partial_arrived: '部分到货',
  arrived: '已到货',
  partial_exception: '部分异常',
  exception: '异常',
  closed: '已关闭',
  void: '已作废',
};

function formatSalesOrderStatus(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return '-';
  }

  const label = salesOrderStatusLabels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
}

function getSalesOrderStatusTone(value: string | null | undefined) {
  if (value === 'draft') {
    return 'neutral';
  }

  if (value === 'rejected') {
    return 'danger';
  }

  if (value === 'pending_sales_manager_approval') {
    return 'warning';
  }

  if (value === 'closed') {
    return 'success';
  }

  if (value === 'void' || value === 'exception' || value === 'partial_exception') {
    return 'danger';
  }

  return 'active';
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const actionWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const primaryLinkStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#ffffff',
  background: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const secondaryLinkStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '10px 14px',
  color: '#0f172a',
  background: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const mutedLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const filterFormStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '18px 16px',
  alignItems: 'end',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
  fontSize: '14px',
  fontWeight: 700,
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '8px',
  boxSizing: 'border-box' as const,
  width: '100%',
  minHeight: '40px',
  padding: '8px 12px',
  background: '#fff',
  color: '#0f172a',
  fontSize: '14px',
  outlineColor: '#2563eb',
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
  borderCollapse: 'separate' as const,
  borderSpacing: 0,
  minWidth: '100%',
  tableLayout: 'fixed' as const,
} satisfies React.CSSProperties;

const tableScrollStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const tableHeadCellStyle = {
  textAlign: 'left' as const,
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  padding: '14px 12px',
  background: '#f8fafc',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const stickyActionHeadCellStyle = {
  ...tableHeadCellStyle,
  position: 'sticky' as const,
  right: 0,
  zIndex: 2,
  boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const tableCellStyle = {
  padding: '16px 12px',
  borderBottom: '1px solid #eef2f7',
  fontSize: '14px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
  lineHeight: 1.55,
} satisfies React.CSSProperties;

const stickyActionCellStyle = {
  ...tableCellStyle,
  position: 'sticky' as const,
  right: 0,
  zIndex: 1,
  background: '#ffffff',
  boxShadow: '-10px 0 18px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const mutedCellLabelStyle = {
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 700,
} satisfies React.CSSProperties;

const docNoStyle = {
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 800,
  color: '#0f172a',
  lineHeight: 1.3,
} satisfies React.CSSProperties;

const titleStyle = {
  display: 'block',
  marginTop: '4px',
  maxWidth: '260px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#334155',
  fontSize: '13px',
  lineHeight: 1.45,
} satisfies React.CSSProperties;

const twoLineCellStyle = {
  display: 'grid',
  gap: '6px',
} satisfies React.CSSProperties;

const dateLineStyle = {
  display: 'flex',
  gap: '6px',
  alignItems: 'baseline',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const subtleTextStyle = {
  color: '#475569',
  fontSize: '13px',
  wordBreak: 'break-word' as const,
} satisfies React.CSSProperties;

const badgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 800,
  lineHeight: 1.2,
  border: '1px solid transparent',
  whiteSpace: 'normal' as const,
  wordBreak: 'break-word' as const,
} satisfies React.CSSProperties;

const sourceBadgeStyle = {
  ...badgeBaseStyle,
  color: '#155e75',
  background: '#ecfeff',
  border: '1px solid #bae6fd',
} satisfies React.CSSProperties;

const sourceFilterLinkStyle = {
  display: 'inline-flex',
  width: 'fit-content',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '12px',
  borderBottom: '1px solid #94a3b8',
} satisfies React.CSSProperties;

const statusBadgeStyle = {
  ...badgeBaseStyle,
  maxWidth: '190px',
} satisfies React.CSSProperties;

const statusToneStyles: Record<string, React.CSSProperties> = {
  active: {
    color: '#075985',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
  },
  neutral: {
    color: '#475569',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },
  warning: {
    color: '#92400e',
    background: '#fffbeb',
    border: '1px solid #fde68a',
  },
  success: {
    color: '#166534',
    background: '#ecfdf5',
    border: '1px solid #bbf7d0',
  },
  danger: {
    color: '#991b1b',
    background: '#fef2f2',
    border: '1px solid #fecaca',
  },
};

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

export default async function AppSalesOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canCreateSalesOrder = canUseFormalSalesOrderActions(session);
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    customerName: readParam(resolvedSearchParams.customerName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    approvalStatus: readParam(resolvedSearchParams.approvalStatus),
    fulfillmentStatus: readParam(resolvedSearchParams.fulfillmentStatus),
    receiptStatus: readParam(resolvedSearchParams.receiptStatus),
    financeConfirmStatus: readParam(resolvedSearchParams.financeConfirmStatus),
    sourceMode: normalizeSalesDocumentSourceMode(
      readParam(resolvedSearchParams.sourceMode),
    ),
    hasAfterSales: (readParam(resolvedSearchParams.hasAfterSales) ?? 'all') as
      | 'all'
      | 'yes'
      | 'no',
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const salesOrderSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    salesOrderSearchParams.set(key, String(value));
  });

  if (!canViewFormalModule(session, 'sales')) {
    return (
      <AppShell
        title="正式销售单"
        subtitle="当前角色不在销售域内，不能查看销售单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式销售单</h2>
          <p>请切换到销售、销售主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadSalesOrderList(salesOrderSearchParams, session)) ??
    getSalesOrderPreviewResponse(query);
  const auditLogs = (await loadSalesOrderAuditLogs(session))?.items ?? [];
  const visibleItems = filterSalesOrderRows(result.items, session);
  const executingCount = visibleItems.filter(
    (item) => item.status === 'purchasing',
  ).length;
  const pendingCount = visibleItems.filter(
    (item) => item.status === 'pending_sales_manager_approval',
  ).length;
  const afterSalesCount = visibleItems.filter((item) => item.hasAfterSales).length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['status', query.status],
    ['customerName', query.customerName],
    ['ownerName', query.ownerName],
    ['approvalStatus', query.approvalStatus],
    ['fulfillmentStatus', query.fulfillmentStatus],
    ['receiptStatus', query.receiptStatus],
    ['financeConfirmStatus', query.financeConfirmStatus],
    ['sourceMode', query.sourceMode !== 'all' ? query.sourceMode : undefined],
    ['hasAfterSales', query.hasAfterSales !== 'all' ? query.hasAfterSales : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    customerName: query.customerName,
    createdBy: query.createdBy,
    ownerName: query.ownerName,
    approvalStatus: query.approvalStatus,
    fulfillmentStatus: query.fulfillmentStatus,
    receiptStatus: query.receiptStatus,
    financeConfirmStatus: query.financeConfirmStatus,
    sourceMode: query.sourceMode !== 'all' ? query.sourceMode : undefined,
    hasAfterSales: query.hasAfterSales !== 'all' ? query.hasAfterSales : undefined,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式销售单"
      subtitle="正式页复用当前销售单查询与来源方式口径，突出筛选、摘要和追溯。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <Link href="/app/sales" style={mutedLinkStyle}>
          返回工作台
        </Link>
        <div style={actionWrapStyle}>
          <Link
            href="/app/sales/quotes"
            style={secondaryLinkStyle}
          >
            从报价转入
          </Link>
          {canCreateSalesOrder ? (
            <Link
              href="/app/sales/orders/new"
              style={primaryLinkStyle}
            >
              新建销售单
            </Link>
          ) : null}
        </div>
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '执行中', value: executingCount },
          { label: '待审批', value: pendingCount },
          { label: '售后中', value: afterSalesCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="统一强调来源方式、审批履约、发货和售后标记。"
      >
        <form method="get" className="erp-filter-form" style={filterFormStyle}>
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
              {salesApprovalStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
              {salesFulfillmentStatuses.map((status) => (
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
            负责人 Owner
            <input name="ownerName" defaultValue={query.ownerName} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            来源方式 Source Mode
            <select name="sourceMode" defaultValue={query.sourceMode} style={inputStyle}>
              {salesDocumentSourceModeOptions.map((value) => (
                <option key={value} value={value}>
                  {value} / {formatSalesDocumentSourceMode(value)}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            收款状态 Receipt
            <select
              name="receiptStatus"
              defaultValue={query.receiptStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              <option value="unpaid">unpaid / 未收款</option>
              <option value="deposit_received">deposit_received / 已收定金</option>
              <option value="fully_paid">fully_paid / 已全款</option>
              <option value="prepaid_deducted">prepaid_deducted / 预付款抵扣</option>
            </select>
          </label>
          <label style={labelStyle}>
            财务确认 Finance
            <select
              name="financeConfirmStatus"
              defaultValue={query.financeConfirmStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              <option value="pending">pending / 待确认</option>
              <option value="confirmed">confirmed / 已确认</option>
            </select>
          </label>
          <label style={labelStyle}>
            是否有售后 After-sales
            <select
              name="hasAfterSales"
              defaultValue={query.hasAfterSales}
              style={inputStyle}
            >
              {salesOrderHasAfterSalesOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={query.pageSize} />
          <button className="erp-button erp-button--primary" type="submit">
            查询
          </button>
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
        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={tableHeadCellStyle}>销售单号 / 标题</th>
                <th style={tableHeadCellStyle}>销售单状态 Status</th>
                <th style={tableHeadCellStyle}>客户 Customer</th>
                <th style={tableHeadCellStyle}>客户订单 / 门店</th>
                <th style={tableHeadCellStyle}>订货日期 / 截止日期</th>
                <th style={tableHeadCellStyle}>来源 Source</th>
                <th style={tableHeadCellStyle}>负责人</th>
                <th style={stickyActionHeadCellStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.detailHref}>
                  <td style={tableCellStyle}>
                    <strong style={docNoStyle}>{item.docNo}</strong>
                    <span style={titleStyle} title={item.title}>{item.title}</span>
                  </td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        ...statusBadgeStyle,
                        ...statusToneStyles[getSalesOrderStatusTone(item.status)],
                      }}
                    >
                      {formatSalesOrderStatus(item.status)}
                    </span>
                  </td>
                  <td style={tableCellStyle}>
                    {formatCounterpartyBilingualDisplay(item.counterpartyName, {
                      fullName: item.counterpartyFullName,
                    })}
                  </td>
                  <td style={tableCellStyle}>
                    <div style={twoLineCellStyle}>
                      <span>
                        <span style={mutedCellLabelStyle}>订单：</span>
                        {formatListValue(item.customerOrderNo)}
                      </span>
                      <span>
                        <span style={mutedCellLabelStyle}>门店：</span>
                        {formatListValue(item.storeName)}
                      </span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={twoLineCellStyle}>
                      <span style={dateLineStyle}>
                        <span style={mutedCellLabelStyle}>订货：</span>
                        {formatListValue(item.orderDate)}
                      </span>
                      <span style={dateLineStyle}>
                        <span style={mutedCellLabelStyle}>截止：</span>
                        {formatListValue(item.estimatedDeliveryDate)}
                      </span>
                    </div>
                  </td>
                  <td style={tableCellStyle}>
                    <div style={twoLineCellStyle}>
                      <span style={subtleTextStyle}>{item.sourceSummary}</span>
                      <span style={sourceBadgeStyle}>
                        {formatSalesDocumentSourceMode(
                          resolveSalesDocumentSourceMode(item.sourceSummary),
                        )}
                      </span>
                    </div>
                    <Link
                      href={`/app/sales/orders?sourceMode=${resolveSalesDocumentSourceMode(item.sourceSummary)}`}
                      style={sourceFilterLinkStyle}
                      aria-label={`按来源方式筛选 ${formatSalesDocumentSourceMode(
                        resolveSalesDocumentSourceMode(item.sourceSummary),
                      )}`}
                    >
                      筛选此来源
                    </Link>
                  </td>
                  <td style={tableCellStyle}>{item.ownerName}</td>
                  <td style={stickyActionCellStyle}>
                    <Link
                      href={toFormalSalesOrderDetailHref(item.detailHref)}
                      className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                      aria-label={`查看详情 ${item.docNo}`}
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormalPagination
          pathname="/app/sales/orders"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="销售单"
        />
      </FormalDataTable>

      <AuditLogTable session={session} items={auditLogs} />
    </AppShell>
  );
}
