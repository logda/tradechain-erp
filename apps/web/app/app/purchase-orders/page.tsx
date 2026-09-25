import Link from 'next/link';
import {
  purchaseApprovalStatuses,
  purchaseFulfillmentStatuses,
  purchaseOrderIsResubmittedOptions,
  type PurchaseOrderListResponse,
} from '@erp/shared';
import { getPurchaseOrderPreviewResponse } from '../../purchase-orders/purchase-order-preview';
import { AppShell } from '../_components/app-shell';
import { AuditLogTable } from '../_components/audit-log-table';
import { FilterPanel } from '../_components/filter-panel';
import { FormalDataTable } from '../_components/formal-data-table';
import { FormalPagination } from '../_components/formal-pagination';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalModule,
  filterPurchaseOrderRows,
  resolveDemoSession,
} from '../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../_lib/audit-log';
import { formatCounterpartyChineseDisplay } from '../_lib/counterparty-display';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

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

function getPurchaseOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidPurchaseOrderListResponse(
  value: unknown,
): value is PurchaseOrderListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PurchaseOrderListResponse).items) &&
    typeof (value as PurchaseOrderListResponse).total === 'number'
  );
}

async function loadPurchaseOrderList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getPurchaseOrderApiBaseUrl()}/purchase-orders${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidPurchaseOrderListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadPurchaseOrderAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getPurchaseOrderApiBaseUrl()}/purchase-orders/audit-logs`, {
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

function toFormalPurchaseOrderDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/purchase-orders/${id}` : '/app/purchase-orders';
}

const purchaseOrderStatusLabels: Record<string, string> = {
  draft: '草稿',
  pending_purchase_claim: '待采购认领',
  pending_purchase_manager_approval: '待采购主管审批',
  purchasing: '采购中',
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
  void: '已作废',
};

function formatPurchaseOrderStatus(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return '-';
  }

  const label = purchaseOrderStatusLabels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
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

export default async function AppPurchaseOrdersPage({
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
    supplierName: readParam(resolvedSearchParams.supplierName),
    createdBy: readParam(resolvedSearchParams.createdBy),
    ownerName: readParam(resolvedSearchParams.ownerName),
    approvalStatus: readParam(resolvedSearchParams.approvalStatus),
    fulfillmentStatus: readParam(resolvedSearchParams.fulfillmentStatus),
    salesOrderNo: readParam(resolvedSearchParams.salesOrderNo),
    isResubmitted: normalizeTriStateFilter(
      readParam(resolvedSearchParams.isResubmitted),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const purchaseOrderSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    purchaseOrderSearchParams.set(key, String(value));
  });

  if (!canViewFormalModule(session, 'purchase')) {
    return (
      <AppShell
        title="正式采购单"
        subtitle="当前角色不在采购域内，不能查看采购单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式采购单</h2>
          <p>请切换到采购、采购主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadPurchaseOrderList(purchaseOrderSearchParams, session)) ??
    getPurchaseOrderPreviewResponse(query);
  const auditLogs = (await loadPurchaseOrderAuditLogs(session))?.items ?? [];
  const visibleItems = filterPurchaseOrderRows(result.items, session);
  const purchasingCount = visibleItems.filter(
    (item) => item.status === 'purchasing',
  ).length;
  const pendingCount = visibleItems.filter(
    (item) => item.status === 'pending_purchase_manager_approval',
  ).length;
  const pendingClaimCount = visibleItems.filter(
    (item) => item.status === 'pending_purchase_claim',
  ).length;
  const resubmittedCount = visibleItems.filter((item) => item.isResubmitted).length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['supplierName', query.supplierName],
    ['ownerName', query.ownerName],
    ['approvalStatus', query.approvalStatus],
    ['fulfillmentStatus', query.fulfillmentStatus],
    ['salesOrderNo', query.salesOrderNo],
    ['isResubmitted', query.isResubmitted !== 'all' ? query.isResubmitted : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    supplierName: query.supplierName,
    createdBy: query.createdBy,
    ownerName: query.ownerName,
    approvalStatus: query.approvalStatus,
    fulfillmentStatus: query.fulfillmentStatus,
    salesOrderNo: query.salesOrderNo,
    isResubmitted: query.isResubmitted !== 'all' ? query.isResubmitted : undefined,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式采购单"
      subtitle="采购页承接销售拆单、采购审批与履约跟进。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        {['admin', 'boss', 'purchase_manager'].includes(session.role) &&
          canViewFormalModule(session, 'purchase') &&
          session.accessScopes?.actions?.includes('purchase.order.approve') !== false ? (
            <Link href="/app/purchase-orders/assignments" style={mutedLinkStyle}>
              分配采购负责人
            </Link>
          ) : null}
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '待采购认领', value: pendingClaimCount },
          { label: '采购执行中', value: purchasingCount },
          { label: '待审批', value: pendingCount },
          { label: '重提单', value: resubmittedCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="优先保留采购拆单、审批状态、销售来源追溯等高频字段。"
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
              {purchaseApprovalStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatPurchaseOrderStatus(status)}
                </option>
              ))}
              {purchaseFulfillmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatPurchaseOrderStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            审批状态 Approval Status
            <select
              name="approvalStatus"
              defaultValue={query.approvalStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {purchaseApprovalStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatPurchaseOrderStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            履约状态 Fulfillment Status
            <select
              name="fulfillmentStatus"
              defaultValue={query.fulfillmentStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {purchaseFulfillmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatPurchaseOrderStatus(status)}
                </option>
              ))}
            </select>
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
            采购负责人 Purchase Owner
            <input name="ownerName" defaultValue={query.ownerName} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            销售单号 Sales Order
            <input
              name="salesOrderNo"
              defaultValue={query.salesOrderNo}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            是否重提 Resubmitted
            <select
              name="isResubmitted"
              defaultValue={query.isResubmitted}
              style={inputStyle}
            >
              {purchaseOrderIsResubmittedOptions.map((value) => (
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
              <th style={tableHeadCellStyle}>采购单号</th>
              <th style={tableHeadCellStyle}>供应商 Supplier</th>
              <th style={tableHeadCellStyle}>采购负责人</th>
              <th style={tableHeadCellStyle}>审批 / 履约</th>
              <th style={tableHeadCellStyle}>来源销售单</th>
              <th style={tableHeadCellStyle}>改单重提</th>
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
                  {formatCounterpartyChineseDisplay(item.supplierName)}
                </td>
                <td style={tableCellStyle}>{item.ownerName}</td>
                <td style={tableCellStyle}>
                  {formatPurchaseOrderStatus(item.approvalStatus)}
                  <br />
                  {formatPurchaseOrderStatus(item.fulfillmentStatus)}
                </td>
                <td style={tableCellStyle}>
                  <Link
                    href={`/app/sales/orders?docNo=${encodeURIComponent(item.salesOrderNo)}`}
                    style={rowLinkStyle}
                  >
                    追溯销售单 {item.salesOrderNo}
                  </Link>
                </td>
                <td style={tableCellStyle}>
                  {item.isResubmitted ? 'yes / 已重提' : 'no / 首次提交'}
                </td>
                <td style={tableCellStyle}>
                  <Link
                    className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                    href={toFormalPurchaseOrderDetailHref(item.detailHref)}
                  >
                    查看详情 {item.docNo}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <FormalPagination
          pathname="/app/purchase-orders"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="采购单"
        />
      </FormalDataTable>

      <AuditLogTable session={session} items={auditLogs} />
    </AppShell>
  );
}
