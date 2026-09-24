import Link from 'next/link';
import {
  receiptSendStatuses,
  shipmentBatchHasExceptionOptions,
  shipmentBatchStatuses,
  type ShipmentBatchListResponse,
} from '@erp/shared';
import { getShipmentBatchPreviewResponse } from '../../shipment-batches/shipment-batch-preview';
import { AppShell } from '../_components/app-shell';
import { AuditLogTable } from '../_components/audit-log-table';
import { FilterPanel } from '../_components/filter-panel';
import { FormalDataTable } from '../_components/formal-data-table';
import { FormalPagination } from '../_components/formal-pagination';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../_lib/audit-log';
import { formatCounterpartyChineseDisplay } from '../_lib/counterparty-display';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';
import {
  canUseFormalShipmentUpdateActions,
  canViewFormalShipmentBatchModule,
} from '../_lib/formal-access';

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

function toFormalShipmentBatchDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/shipment-batches/${id}` : '/app/shipment-batches';
}

function getShipmentBatchApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidShipmentBatchListResponse(
  value: unknown,
): value is ShipmentBatchListResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ShipmentBatchListResponse).items) &&
    typeof (value as ShipmentBatchListResponse).total === 'number'
  );
}

async function loadShipmentBatchList(searchParams: URLSearchParams, session: { role: string; user: string }) {
  try {
    const query = searchParams.toString();
    const response = await fetch(
      `${getShipmentBatchApiBaseUrl()}/shipment-batches${query ? `?${query}` : ''}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidShipmentBatchListResponse(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadShipmentBatchAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getShipmentBatchApiBaseUrl()}/shipment-batches/audit-logs`, {
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

export default async function AppShipmentBatchesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canUpdateShipment = canUseFormalShipmentUpdateActions(session);
  const canOpenSalesOrders = canViewFormalModule(session, 'sales');
  const canOpenPurchaseOrders = canViewFormalModule(session, 'purchase');
  const query = {
    keyword: readParam(resolvedSearchParams.keyword),
    docNo: readParam(resolvedSearchParams.docNo),
    status: readParam(resolvedSearchParams.status),
    dateFrom: readParam(resolvedSearchParams.dateFrom),
    dateTo: readParam(resolvedSearchParams.dateTo),
    supplierName: readParam(resolvedSearchParams.supplierName),
    salesOrderNo: readParam(resolvedSearchParams.salesOrderNo),
    purchaseOrderNo: readParam(resolvedSearchParams.purchaseOrderNo),
    receiptSendStatus: readParam(resolvedSearchParams.receiptSendStatus),
    hasException: normalizeTriStateFilter(
      readParam(resolvedSearchParams.hasException),
    ),
    page: Number(readParam(resolvedSearchParams.page) ?? '1'),
    pageSize: Number(readParam(resolvedSearchParams.pageSize) ?? '20'),
  } as const;
  const shipmentBatchSearchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '' || Number.isNaN(value)) {
      return;
    }

    shipmentBatchSearchParams.set(key, String(value));
  });

  if (!canViewFormalShipmentBatchModule(session)) {
    return (
      <AppShell
        title="正式发货批次"
        subtitle="当前角色不在销售或采购履约域内，不能查看发货批次。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问正式发货批次</h2>
          <p>请切换到销售、采购、主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const result =
    (await loadShipmentBatchList(shipmentBatchSearchParams, session)) ??
    getShipmentBatchPreviewResponse(query);
  const auditLogs = (await loadShipmentBatchAuditLogs(session))?.items ?? [];
  const visibleItems = result.items;
  const shippedCount = visibleItems.filter((item) => item.status === 'shipped').length;
  const exceptionCount = visibleItems.filter((item) => item.hasException).length;
  const receiptSentCount = visibleItems.filter(
    (item) => item.receiptSendStatus === 'sent',
  ).length;
  const appliedFilters = [
    ['keyword', query.keyword],
    ['docNo', query.docNo],
    ['supplierName', query.supplierName],
    ['salesOrderNo', query.salesOrderNo],
    ['purchaseOrderNo', query.purchaseOrderNo],
    ['receiptSendStatus', query.receiptSendStatus],
    ['hasException', query.hasException !== 'all' ? query.hasException : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const paginationParams = {
    keyword: query.keyword,
    docNo: query.docNo,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    supplierName: query.supplierName,
    salesOrderNo: query.salesOrderNo,
    purchaseOrderNo: query.purchaseOrderNo,
    receiptSendStatus: query.receiptSendStatus,
    hasException: query.hasException !== 'all' ? query.hasException : undefined,
    role: readParam(resolvedSearchParams.role),
    user: readParam(resolvedSearchParams.user),
    access: readParam(resolvedSearchParams.access),
  };

  return (
    <AppShell
      title="正式发货批次"
      subtitle="正式发货页强调多批次发货、异常追踪、回单发送与销售采购双向追溯。"
      session={session}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={mutedLinkStyle}>
          返回正式首页
        </Link>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {canUpdateShipment ? (
            <Link
              href="/app/shipment-batches/new"
              style={primaryLinkStyle}
            >
              新建发货批次
            </Link>
          ) : null}
        </div>
      </div>

      <StatStrip
        items={[
          { label: '全部', value: visibleItems.length },
          { label: '已发货', value: shippedCount },
          { label: '异常批次', value: exceptionCount },
          { label: '回单已发送', value: receiptSentCount },
        ]}
      />

      <FilterPanel
        title="当前筛选"
        subtitle="优先覆盖批次状态、异常标记、回单发送与销售采购追溯字段。"
      >
        <form method="get" className="erp-filter-form" style={fieldGridStyle}>
          <label style={labelStyle}>
            关键词 Keyword
            <input name="keyword" defaultValue={query.keyword} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            单号 Batch No
            <input name="docNo" defaultValue={query.docNo} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            状态 Status
            <select name="status" defaultValue={query.status ?? ''} style={inputStyle}>
              <option value="">全部</option>
              {shipmentBatchStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
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
            销售单号 Sales Order
            <input
              name="salesOrderNo"
              defaultValue={query.salesOrderNo}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            采购单号 Purchase Order
            <input
              name="purchaseOrderNo"
              defaultValue={query.purchaseOrderNo}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            回单状态 Receipt
            <select
              name="receiptSendStatus"
              defaultValue={query.receiptSendStatus ?? ''}
              style={inputStyle}
            >
              <option value="">全部</option>
              {receiptSendStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            是否异常 Exception
            <select
              name="hasException"
              defaultValue={query.hasException}
              style={inputStyle}
            >
              {shipmentBatchHasExceptionOptions.map((value) => (
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
              <th style={tableHeadCellStyle}>批次号</th>
              <th style={tableHeadCellStyle}>供应商 Supplier</th>
              <th style={tableHeadCellStyle}>货物 / 件数</th>
              <th style={tableHeadCellStyle}>发货信息</th>
              <th style={tableHeadCellStyle}>到货信息</th>
              <th style={tableHeadCellStyle}>批次状态</th>
              <th style={tableHeadCellStyle}>关联单据</th>
              <th style={tableHeadCellStyle}>异常 / 回单</th>
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
                <td style={tableCellStyle}>
                  {item.goodsName ?? item.title}
                  <br />
                  {item.totalPackages ? `总件数：${item.totalPackages}` : '总件数：-'}
                </td>
                <td style={tableCellStyle}>
                  {item.shippingCode ? `发货编码：${item.shippingCode}` : '发货编码：-'}
                  <br />
                  {item.factoryShipDate ? `工厂发货：${item.factoryShipDate}` : '工厂发货：-'}
                  <br />
                  {item.freightStation ? `货运站：${item.freightStation}` : '货运站：-'}
                </td>
                <td style={tableCellStyle}>
                  {item.destination ? `目的地：${item.destination}` : '目的地：-'}
                  <br />
                  {item.arrivalStatus ? `到货情况：${item.arrivalStatus}` : '到货情况：-'}
                  <br />
                  {item.estimatedArrivalDate
                    ? `预计到货：${item.estimatedArrivalDate}`
                    : '预计到货：-'}
                </td>
                <td style={tableCellStyle}>
                  {item.status}
                  <br />
                  {item.secondaryStatus}
                </td>
                <td style={tableCellStyle}>
                  {canOpenSalesOrders ? (
                    <>
                      <Link
                        href={`/app/sales/orders?docNo=${encodeURIComponent(item.salesOrderNo)}`}
                        style={rowLinkStyle}
                      >
                        追溯销售单 {item.salesOrderNo}
                      </Link>
                      <br />
                    </>
                  ) : null}
                  {canOpenPurchaseOrders ? (
                    <Link
                      href={`/app/purchase-orders?docNo=${encodeURIComponent(item.purchaseOrderNo)}`}
                      style={rowLinkStyle}
                    >
                      追溯采购单 {item.purchaseOrderNo}
                    </Link>
                  ) : null}
                  {!canOpenSalesOrders && !canOpenPurchaseOrders ? '-' : null}
                </td>
                <td style={tableCellStyle}>
                  {item.hasException ? 'yes / 有异常' : 'no / 正常'}
                  <br />
                  {item.receiptSendStatus}
                </td>
                <td style={tableCellStyle}>
                  <Link
                    className="erp-button erp-button--secondary erp-button--compact erp-row-action"
                    href={toFormalShipmentBatchDetailHref(item.detailHref)}
                  >
                    查看详情 {item.docNo}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <FormalPagination
          pathname="/app/shipment-batches"
          params={paginationParams}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          summaryLabel="发货批次"
        />
      </FormalDataTable>

      <AuditLogTable session={session} items={auditLogs} />
    </AppShell>
  );
}
