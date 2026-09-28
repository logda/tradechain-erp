import { formatFormalUserLabel } from '../../_lib/formal-user-display';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { AuditLogTable } from '../../_components/audit-log-table';
import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import {
  canViewFormalModule,
  canViewFormalAuditCenter,
  resolveDemoSession,
  type DemoSession,
} from '../../_lib/demo-session';
import {
  canUseFormalAfterSalesProcessActions,
  canUseFormalShipmentUpdateActions,
  canViewFormalShipmentBatchDetail,
  canViewFormalShipmentBatchModule,
  resolveFormalUserId,
} from '../../_lib/formal-access';
import { hasValidUnifiedAuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';

type SearchParams = Record<string, string | string[] | undefined>;

type AppShipmentBatchDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type ShipmentBatchDetail = {
  id: number;
  batchNo: string;
  status: string;
  receiptSendStatus: string;
  factoryShipDate?: string;
  shippingCode?: string;
  shippingCodeItems?: Array<{
    code: string;
    quantity: number;
  }>;
  destination?: string;
  shippingMark?: string;
  goodsName?: string;
  totalPackages?: number;
  purchasingUnit?: string;
  customerName?: string;
  freightStation?: string;
  warehouseEntryNo?: string;
  arrivalStatus?: string;
  forwarderShipDate?: string;
  estimatedArrivalDate?: string;
  remark?: string;
  salesOrderId: number;
  purchaseOrderId: number;
  receiptDocUrl?: string;
  receiptSentBy?: number;
  hasException?: boolean;
  exceptionReason?: string;
  items?: Array<{
    lineNo: number;
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    shippedQty: number;
    purchaseQty: number;
  }>;
};

function getShipmentBatchApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function getAfterSalesApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidShipmentBatchDetail(value: unknown): value is ShipmentBatchDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ShipmentBatchDetail).id === 'number' &&
    typeof (value as ShipmentBatchDetail).batchNo === 'string' &&
    typeof (value as ShipmentBatchDetail).status === 'string' &&
    typeof (value as ShipmentBatchDetail).receiptSendStatus === 'string' &&
    typeof (value as ShipmentBatchDetail).salesOrderId === 'number' &&
    typeof (value as ShipmentBatchDetail).purchaseOrderId === 'number' &&
    (
      (value as ShipmentBatchDetail).items === undefined ||
      Array.isArray((value as ShipmentBatchDetail).items)
    )
  );
}

async function loadShipmentBatchDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getShipmentBatchApiBaseUrl()}/shipment-batches/${id}`,
      {
        cache: 'no-store',
        headers: {
          ...buildFormalRequestHeaders(session),
          ...buildSignedFormalRequestHeaders(session),
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidShipmentBatchDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadShipmentBatchAuditLogs(id: string, session: DemoSession) {
  if (!canViewFormalAuditCenter(session)) return null;
  try {
    const response = await fetch(
      `${getShipmentBatchApiBaseUrl()}/audit-logs?bizType=shipment_batch&bizId=${encodeURIComponent(id)}`,
      {
        cache: 'no-store',
        headers: {
          ...buildFormalRequestHeaders(session),
          ...buildSignedFormalRequestHeaders(session),
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidUnifiedAuditLogResponse(result) && !result.modules.some((module) => module.failed)
      ? { items: result.items.filter((item) => item.bizType === 'shipment_batch' && item.bizId === Number(id)) }
      : null;
  } catch {
    return null;
  }
}

async function loadSourceDocumentNo(module: 'sales' | 'purchase', id: number, session: DemoSession): Promise<string | null> {
  if (!canViewFormalModule(session, module)) return null;
  const path = module === 'sales' ? 'sales-orders' : 'purchase-orders';
  const field = module === 'sales' ? 'salesNo' : 'purchaseNo';
  try {
    const response = await fetch(`${getShipmentBatchApiBaseUrl()}/${path}/${id}`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result?.id === id && typeof result[field] === 'string' && result[field].trim()
      ? result[field].trim() : null;
  } catch {
    return null;
  }
}

function buildAfterSalesDraft(
  shipmentBatch: ShipmentBatchDetail,
  createdBy: number,
) {
  return {
    salesOrderId: shipmentBatch.salesOrderId,
    purchaseOrderId: shipmentBatch.purchaseOrderId,
    shipmentBatchId: shipmentBatch.id,
    type: 'customer_complaint',
    issueDescription: '客户反馈包装破损，进入售后跟进',
    createdBy,
    items: (shipmentBatch.items ?? []).map((item, index) => ({
      lineNo: index + 1,
      shipmentLineNo: item.lineNo,
      purchaseLineNo: item.purchaseLineNo,
      sourceSalesItemId: item.sourceSalesItemId,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      unit: item.unit,
      affectedQty: item.shippedQty,
      shipmentQty: item.shippedQty,
    })),
  };
}

function buildStockOutDraft(
  shipmentBatch: ShipmentBatchDetail,
  createdBy: number,
) {
  return {
    sourceBizType: 'shipment_batch',
    sourceBizId: shipmentBatch.id,
    sourceDocNo: shipmentBatch.batchNo,
    warehouseId: 1,
    locationId: 11,
    createdBy,
    items: (shipmentBatch.items ?? []).map((item) => ({
      productId: item.productId,
      quantity: item.shippedQty,
    })),
  };
}

function buildReceiptDraft(shipmentBatch: ShipmentBatchDetail, createdBy: number) {
  return {
    receiptDocUrl:
      shipmentBatch.receiptDocUrl ??
      `https://files.example.com/${shipmentBatch.batchNo}.pdf`,
    sentBy: createdBy,
  };
}

const detailLayoutStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #eefcf7 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: '10px 0 8px',
  fontSize: '32px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroSubStyle = {
  margin: 0,
  fontSize: '15px',
  color: '#475569',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const infoCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const actionPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '22px',
  padding: '22px',
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)',
  boxShadow: '0 18px 54px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const actionGridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  alignItems: 'start',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '900px',
} satisfies React.CSSProperties;

const headCellStyle = {
  textAlign: 'left' as const,
  fontSize: '12px',
  color: '#334155',
  background: '#eef3f8',
  borderBottom: '1px solid #cfd8e3',
  borderRight: '1px solid #d8e1ea',
  padding: '10px',
} satisfies React.CSSProperties;

const cellStyle = {
  padding: '12px 10px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
} satisfies React.CSSProperties;

function ShipmentFieldTable({ fields }: { fields: Array<[string, ReactNode]> }) {
  return (
    <div style={tableWrapStyle}>
      <table style={{ ...tableStyle, minWidth: '680px' }}><tbody>
        {Array.from({ length: Math.ceil(fields.length / 2) }, (_, index) => (
          <tr key={index}>
            {[fields[index * 2], fields[index * 2 + 1]].map((field, fieldIndex) => field ? (
              <Fragment key={field[0]}>
                <th scope="row" style={{ ...headCellStyle, width: '17%' }}>{field[0]}</th>
                <td style={{ ...cellStyle, width: '33%', whiteSpace: 'pre-line' }}>{field[1]}</td>
              </Fragment>
            ) : <td key={fieldIndex} colSpan={2} style={cellStyle} />)}
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

const subtleLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

function formatShipmentStageLabel(value: string) {
  if (value === 'shipped') return '已发货';
  if (value === 'to_forwarder') return '待货代';
  if (value === 'forwarder_shipped') return '货代已发出';
  if (value === 'arrived') return '已到货';
  return value;
}

function formatReceiptLabel(value: string) {
  if (value === 'pending') return '待发送';
  if (value === 'sent') return '已发送';
  if (value === 'confirmed') return '已确认';
  return value;
}

function formatShipmentValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

export default async function AppShipmentBatchDetailPage({
  params,
  searchParams,
}: AppShipmentBatchDetailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canViewFormalShipmentBatchModule(session)) {
    return (
      <AppShell
        title="发货批次详情"
        subtitle="查看发货批次。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              无权限访问发货批次
            </h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张发货批次。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const createdBy = resolveFormalUserId(session);
  const { id } = await params;
  const [shipmentBatch, auditLogs] = await Promise.all([
    loadShipmentBatchDetail(id, session),
    loadShipmentBatchAuditLogs(id, session),
  ]);
  const afterSalesDraft = shipmentBatch
    ? buildAfterSalesDraft(shipmentBatch, createdBy)
    : null;

  if (!shipmentBatch) {
    return (
      <AppShell
        title="发货批次详情"
        subtitle="查看发货批次。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>发货批次详情加载失败</h3>
            <p style={heroSubStyle}>请返回发货批次列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalShipmentBatchDetail(session)) {
    return (
      <AppShell
        title="发货批次详情"
        subtitle="查看发货批次。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              无权限访问发货批次
            </h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张发货批次。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const canUpdateShipment = canUseFormalShipmentUpdateActions(session);
  const canProcessAfterSales = canUseFormalAfterSalesProcessActions(session);
  const canOpenSalesOrder = canViewFormalModule(session, 'sales');
  const canOpenPurchaseOrder = canViewFormalModule(session, 'purchase');
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const stockOutDraft = buildStockOutDraft(shipmentBatch, createdBy);
  const [salesNo, purchaseNo] = await Promise.all([
    loadSourceDocumentNo('sales', shipmentBatch.salesOrderId, session),
    loadSourceDocumentNo('purchase', shipmentBatch.purchaseOrderId, session),
  ]);

  return (
    <AppShell
      title="发货批次详情"
      tabLabel={shipmentBatch.batchNo}
      subtitle="查看发货明细、物流进度与回单。"
      session={session}
    >
      <section style={detailLayoutStyle}>

        <article style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>{`发货批次 ${shipmentBatch.batchNo}`}</h3>
            {canProcessAfterSales ? (
              <Link
                href={`/app/after-sales/new?salesOrderId=${shipmentBatch.salesOrderId}&purchaseOrderId=${shipmentBatch.purchaseOrderId}&shipmentBatchId=${shipmentBatch.id}`}
                style={subtleLinkStyle}
              >
                打开售后单页
              </Link>
            ) : null}
          </div>
          <nav aria-label="单据来源" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px', fontSize: '13px' }}>
            {canOpenSalesOrder ? <Link href={`/app/sales/orders/${shipmentBatch.salesOrderId}`} style={subtleLinkStyle}>
              销售单 {salesNo ?? `单号暂不可用 #${shipmentBatch.salesOrderId}`}
            </Link> : <span>销售单 #{shipmentBatch.salesOrderId}</span>}
            <span aria-hidden="true">→</span>
            {canOpenPurchaseOrder ? <Link href={`/app/purchase-orders/${shipmentBatch.purchaseOrderId}`} style={subtleLinkStyle}>
              采购单 {purchaseNo ?? `单号暂不可用 #${shipmentBatch.purchaseOrderId}`}
            </Link> : <span>采购单 #{shipmentBatch.purchaseOrderId}</span>}
          </nav>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '12px', color: '#475569', fontSize: '13px' }}>
            <span>状态：<strong>{formatShipmentStageLabel(shipmentBatch.status)}</strong></span>
            <span>回单：<strong>{formatReceiptLabel(shipmentBatch.receiptSendStatus)}</strong></span>
            <span>发送人：<span>{shipmentBatch.receiptSentBy ? formatFormalUserLabel(shipmentBatch, 'receiptSentBy') : '未发送'}</span></span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '13px' }}>
            回单地址：{shipmentBatch.receiptDocUrl ? <Link href={shipmentBatch.receiptDocUrl} style={subtleLinkStyle}>{shipmentBatch.receiptDocUrl}</Link> : '未上传'}
          </p>
          <p style={{ margin: '10px 0 0', color: shipmentBatch.hasException ? '#b91c1c' : '#64748b', fontSize: '13px' }}>
            {shipmentBatch.hasException ? formatShipmentValue(shipmentBatch.exceptionReason) : '暂无异常标记'}
          </p>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>发货明细</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>行号 Line</th>
                  <th style={headCellStyle}>采购行 Purchase Line</th>
                  <th style={headCellStyle}>SKU</th>
                  <th style={headCellStyle}>商品 Product</th>
                  <th style={headCellStyle}>本批发货 Shipped Qty</th>
                  <th style={headCellStyle}>采购数量 Purchase Qty</th>
                  <th style={headCellStyle}>单位 Unit</th>
                </tr>
              </thead>
              <tbody>
                {(shipmentBatch.items ?? []).map((item) => (
                  <tr key={`${item.lineNo}-${item.sku}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>{item.purchaseLineNo}</td>
                    <td style={cellStyle}>{item.sku}</td>
                    <td style={cellStyle}>{item.productName}</td>
                    <td style={cellStyle}>{item.shippedQty}</td>
                    <td style={cellStyle}>{item.purchaseQty}</td>
                    <td style={cellStyle}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article style={actionPanelStyle}>
          <div style={actionGridStyle}>
            {canUpdateShipment && shipmentBatch.status === 'shipped' ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/mark-to-forwarder`}
                label="提交货代"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: shipmentBatch.status,
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment && shipmentBatch.status === 'to_forwarder' ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/mark-forwarder-shipped`}
                label="货代已发运"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: shipmentBatch.status,
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment && shipmentBatch.status === 'forwarder_shipped' ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/mark-arrived`}
                label="确认到货"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: shipmentBatch.status,
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment &&
            (shipmentBatch.status === 'forwarder_shipped' ||
              shipmentBatch.status === 'arrived') ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/upload-receipt`}
                label="上传回单"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'receiptDocUrl',
                    value: buildReceiptDraft(shipmentBatch, createdBy).receiptDocUrl,
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment &&
            shipmentBatch.receiptSendStatus !== 'sent' &&
            (shipmentBatch.status === 'forwarder_shipped' ||
              shipmentBatch.status === 'arrived') ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/send-receipt`}
                label="发送回单"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'receiptDocUrl',
                    value: buildReceiptDraft(shipmentBatch, createdBy).receiptDocUrl,
                  },
                  {
                    name: 'sentBy',
                    value: buildReceiptDraft(shipmentBatch, createdBy).sentBy,
                    dataType: 'number',
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment && shipmentBatch.status !== 'arrived' ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/shipment-batches/${shipmentBatch.id}/mark-exception`}
                label="标记异常"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: shipmentBatch.status,
                  },
                  {
                    name: 'reason',
                    value: '',
                    display: 'input',
                    label: '异常原因',
                    required: true,
                    helpText: '请填写实际发生的异常，例如物流延误，并说明需要跟进的事项。',
                  },
                ]}
              />
            ) : null}
            {canUpdateShipment ? (
              <MutationActionForm
                endpoint={`${getShipmentBatchApiBaseUrl()}/stock-out`}
                label="生成出库单"
                successLabel="操作成功，已生成出库单"
                successRedirectBasePath="/app/stock-out"
                requiredAction="shipment.update"
                requiredActionLabel="发货更新"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'sourceBizType',
                    value: stockOutDraft.sourceBizType,
                  },
                  {
                    name: 'sourceBizId',
                    value: stockOutDraft.sourceBizId,
                    dataType: 'number',
                  },
                  {
                    name: 'sourceDocNo',
                    value: stockOutDraft.sourceDocNo,
                  },
                  {
                    name: 'warehouseId',
                    value: stockOutDraft.warehouseId,
                    dataType: 'number',
                  },
                  {
                    name: 'locationId',
                    value: stockOutDraft.locationId,
                    dataType: 'number',
                  },
                  {
                    name: 'createdBy',
                    value: stockOutDraft.createdBy,
                    dataType: 'number',
                  },
                  {
                    name: 'items',
                    value: JSON.stringify(stockOutDraft.items),
                    dataType: 'json',
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales && afterSalesDraft ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales`}
                label="生成售后单"
                successLabel="操作成功，请前往正式售后单列表查看新单"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'salesOrderId',
                    value: afterSalesDraft.salesOrderId,
                    dataType: 'number',
                  },
                  {
                    name: 'purchaseOrderId',
                    value: afterSalesDraft.purchaseOrderId,
                    dataType: 'number',
                  },
                  {
                    name: 'shipmentBatchId',
                    value: afterSalesDraft.shipmentBatchId,
                    dataType: 'number',
                  },
                  {
                    name: 'type',
                    value: afterSalesDraft.type,
                  },
                  {
                    name: 'issueDescription',
                    value: afterSalesDraft.issueDescription,
                  },
                  {
                    name: 'createdBy',
                    value: afterSalesDraft.createdBy,
                    dataType: 'number',
                  },
                  {
                    name: 'items',
                    value: JSON.stringify(afterSalesDraft.items),
                    dataType: 'json',
                  },
                ]}
              />
            ) : null}
          </div>
        </article>

        <details style={infoCardStyle}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#334155' }}>发货台账字段</summary>
          <div style={{ marginTop: '12px' }}>
            <ShipmentFieldTable fields={[
              ['工厂发货日期 Factory Ship Date', formatShipmentValue(shipmentBatch.factoryShipDate)],
              ['发货编码 Shipping Code', shipmentBatch.shippingCodeItems?.length ? <div>{shipmentBatch.shippingCodeItems.map((item) => <div key={`${item.code}-${item.quantity}`}>{item.code} · {item.quantity}</div>)}</div> : formatShipmentValue(shipmentBatch.shippingCode)],
              ['到货目的地 Destination', formatShipmentValue(shipmentBatch.destination)],
              ['唛头 Mark', formatShipmentValue(shipmentBatch.shippingMark)],
              ['客户 Customer', formatShipmentValue(shipmentBatch.customerName)],
              ['货物名称 Goods Name', formatShipmentValue(shipmentBatch.goodsName)],
              ['总件数 Total Packages', formatShipmentValue(shipmentBatch.totalPackages)],
              ['采购单位 Purchasing Unit', formatShipmentValue(shipmentBatch.purchasingUnit)],
              ['货运站 Freight Station', formatShipmentValue(shipmentBatch.freightStation)],
              ['入仓单 Warehouse Entry No', formatShipmentValue(shipmentBatch.warehouseEntryNo)],
              ['到货情况 Arrival Status', formatShipmentValue(shipmentBatch.arrivalStatus)],
              ['货代发货日期 Forwarder Ship Date', formatShipmentValue(shipmentBatch.forwarderShipDate)],
              ['预计到货时间 Estimated Arrival', formatShipmentValue(shipmentBatch.estimatedArrivalDate)],
              ['备注 Remark', formatShipmentValue(shipmentBatch.remark)],
            ]} />
          </div>
        </details>

        {canViewFormalAuditCenter(session) && !auditLogs ? (
          <p role="alert">审计日志暂不可用，请刷新重试。</p>
        ) : canViewFormalAuditCenter(session) ? (
          <details style={infoCardStyle}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#334155' }}>操作历史</summary>
            <AuditLogTable session={session} items={auditLogs?.items ?? []} collapseChanges />
          </details>
        ) : null}
      </section>
    </AppShell>
  );
}
