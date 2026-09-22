import Link from 'next/link';
import { AuditLogTable } from '../../_components/audit-log-table';
import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../_lib/demo-session';
import {
  canUseFormalAfterSalesProcessActions,
  canUseFormalShipmentUpdateActions,
  canViewFormalShipmentBatchDetail,
  canViewFormalShipmentBatchModule,
  getFormalDetailAccessDeniedLabel,
  resolveFormalUserId,
} from '../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
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

async function loadShipmentBatchAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(
      `${getShipmentBatchApiBaseUrl()}/shipment-batches/audit-logs`,
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
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

const userNameById: Record<number, string> = {
  1: 'Admin',
  2: 'Mia',
  3: 'Zoe',
  4: 'Leo',
  2000: 'Mia',
  2001: 'Zoe',
  2002: 'Leo',
  9000: 'Admin',
};

function formatUserDisplay(userId: number | null | undefined) {
  if (!userId) {
    return '未发送';
  }

  const name = userNameById[userId];
  return name ? `${name} #${userId}` : `操作人 #${userId}`;
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
    reason: shipmentBatch.exceptionReason ?? '货物破损，需要人工跟进',
  };
}

const actionBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

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

const heroEyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
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

const heroActionStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '18px',
} satisfies React.CSSProperties;

const heroActionLinkStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#0f172a',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const infoCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const labelStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const valueStyle = {
  margin: '10px 0 0',
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
  whiteSpace: 'pre-line' as const,
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
        title="正式发货批次详情"
        subtitle="正式发货详情页承接销售和采购共同需要查看的发货字段。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/shipment-batches"
            style={backLinkStyle}
          >
            返回正式发货批次列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              {getFormalDetailAccessDeniedLabel('shipment_batch')}
            </h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张发货批次。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const createdBy = resolveFormalUserId(session.user);
  const { id } = await params;
  const [shipmentBatch, auditLogs] = await Promise.all([
    loadShipmentBatchDetail(id, session),
    loadShipmentBatchAuditLogs(session),
  ]);
  const afterSalesDraft = shipmentBatch
    ? buildAfterSalesDraft(shipmentBatch, createdBy)
    : null;

  if (!shipmentBatch) {
    return (
      <AppShell
        title="正式发货批次详情"
        subtitle="正式发货详情页承接批次状态、异常与回单发送跟踪。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/shipment-batches"
            style={backLinkStyle}
          >
            返回正式发货批次列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>发货批次详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式发货批次列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalShipmentBatchDetail(session)) {
    return (
      <AppShell
        title="正式发货批次详情"
        subtitle="正式发货详情页承接批次状态、异常与回单发送跟踪。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/shipment-batches"
            style={backLinkStyle}
          >
            返回正式发货批次列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              {getFormalDetailAccessDeniedLabel('shipment_batch')}
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

  return (
    <AppShell
      title="正式发货批次详情"
      subtitle="展示批次状态、货代节点、异常原因和回单发送状态，承接销售与售后之间的履约闭环。"
      session={session}
    >
      <section style={detailLayoutStyle}>
        <div style={actionBarStyle}>
          <Link
            href="/app/shipment-batches"
            style={backLinkStyle}
          >
            返回正式发货批次列表
          </Link>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
        </div>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>Shipment Batch Detail / 发货批次详情</p>
          <h3 style={heroTitleStyle}>{`发货批次 ${shipmentBatch.batchNo}`}</h3>
          <p style={heroSubStyle}>
            当前页面已经接通销售单、采购单、回单和售后入口，便于追踪多批次发货的完整履约路径。
          </p>
          <div style={heroActionStyle}>
            {canOpenSalesOrder ? (
              <Link
                href={`/app/sales/orders/${shipmentBatch.salesOrderId}`}
                style={heroActionLinkStyle}
              >
                打开销售单
              </Link>
            ) : null}
            {canOpenPurchaseOrder ? (
              <Link
                href={`/app/purchase-orders/${shipmentBatch.purchaseOrderId}`}
                style={heroActionLinkStyle}
              >
                打开采购单
              </Link>
            ) : null}
            {canProcessAfterSales ? (
              <Link
                href={`/app/after-sales/new?salesOrderId=${shipmentBatch.salesOrderId}&purchaseOrderId=${shipmentBatch.purchaseOrderId}&shipmentBatchId=${shipmentBatch.id}`}
                style={heroActionLinkStyle}
              >
                打开售后单页
              </Link>
            ) : null}
          </div>
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>状态 Status</p>
            <p style={valueStyle}>{formatShipmentStageLabel(shipmentBatch.status)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>回单发送 Receipt</p>
            <p style={valueStyle}>{formatReceiptLabel(shipmentBatch.receiptSendStatus)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>批次编号 Batch No</p>
            <p style={valueStyle}>{shipmentBatch.batchNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>销售单 Sales Order</p>
            <p style={valueStyle}>#{shipmentBatch.salesOrderId}</p>
            {canOpenSalesOrder ? (
              <Link href={`/app/sales/orders/${shipmentBatch.salesOrderId}`} style={subtleLinkStyle}>
                查看销售单追溯
              </Link>
            ) : null}
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>采购单 Purchase Order</p>
            <p style={valueStyle}>#{shipmentBatch.purchaseOrderId}</p>
            {canOpenPurchaseOrder ? (
              <Link
                href={`/app/purchase-orders/${shipmentBatch.purchaseOrderId}`}
                style={subtleLinkStyle}
              >
                查看采购单追溯
              </Link>
            ) : null}
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>回单地址 Receipt URL</p>
            <p style={valueStyle}>{shipmentBatch.receiptDocUrl ?? '未上传'}</p>
            {shipmentBatch.receiptDocUrl ? (
              <Link href={shipmentBatch.receiptDocUrl} style={subtleLinkStyle}>
                打开回单文件
              </Link>
            ) : null}
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>异常原因 Exception</p>
            <p style={valueStyle}>{shipmentBatch.exceptionReason ?? '正常'}</p>
            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '13px' }}>
              {shipmentBatch.hasException ? '已标记异常' : '暂无异常标记'}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>回单发送人 Receipt Sender</p>
            <p style={valueStyle}>{formatUserDisplay(shipmentBatch.receiptSentBy)}</p>
          </article>
        </div>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>发货台账字段</h3>
          <div style={gridStyle}>
            <div>
              <p style={labelStyle}>工厂发货日期 Factory Ship Date</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.factoryShipDate)}</p>
            </div>
            <div>
              <p style={labelStyle}>发货编码 Shipping Code</p>
              {shipmentBatch.shippingCodeItems?.length ? (
                <div style={tableWrapStyle}>
                  <table style={{ ...tableStyle, minWidth: '320px' }}>
                    <thead>
                      <tr>
                        <th style={headCellStyle}>发货编码 Code</th>
                        <th style={headCellStyle}>数量 Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipmentBatch.shippingCodeItems.map((item) => (
                        <tr key={`${item.code}-${item.quantity}`}>
                          <td style={cellStyle}>{item.code}</td>
                          <td style={cellStyle}>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={valueStyle}>{formatShipmentValue(shipmentBatch.shippingCode)}</p>
              )}
            </div>
            <div>
              <p style={labelStyle}>到货目的地 Destination</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.destination)}</p>
            </div>
            <div>
              <p style={labelStyle}>订单号 Order No</p>
              <p style={valueStyle}>{`#${shipmentBatch.salesOrderId}`}</p>
            </div>
            <div>
              <p style={labelStyle}>唛头 Mark</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.shippingMark)}</p>
            </div>
            <div>
              <p style={labelStyle}>客户 Customer</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.customerName)}</p>
            </div>
            <div>
              <p style={labelStyle}>货物名称 Goods Name</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.goodsName)}</p>
            </div>
            <div>
              <p style={labelStyle}>总件数 Total Packages</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.totalPackages)}</p>
            </div>
            <div>
              <p style={labelStyle}>采购单位 Purchasing Unit</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.purchasingUnit)}</p>
            </div>
            <div>
              <p style={labelStyle}>货运站 Freight Station</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.freightStation)}</p>
            </div>
            <div>
              <p style={labelStyle}>入仓单 Warehouse Entry No</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.warehouseEntryNo)}</p>
            </div>
            <div>
              <p style={labelStyle}>到货情况 Arrival Status</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.arrivalStatus)}</p>
            </div>
            <div>
              <p style={labelStyle}>货代发货日期 Forwarder Ship Date</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.forwarderShipDate)}</p>
            </div>
            <div>
              <p style={labelStyle}>预计到货时间 Estimated Arrival</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.estimatedArrivalDate)}</p>
            </div>
            <div>
              <p style={labelStyle}>备注 Remark</p>
              <p style={valueStyle}>{formatShipmentValue(shipmentBatch.remark)}</p>
            </div>
          </div>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>链路追溯</h3>
          <p style={valueStyle}>
            {`销售单 #${shipmentBatch.salesOrderId} → 采购单 #${shipmentBatch.purchaseOrderId} → 发货批次 ${shipmentBatch.batchNo}`}
          </p>
          <p style={heroSubStyle}>
            售后入口会自动携带 salesOrderId、purchaseOrderId、shipmentBatchId，避免断链录入。
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
                    value: buildReceiptDraft(shipmentBatch, createdBy).reason,
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

        <AuditLogTable items={auditLogs?.items ?? []} />
      </section>
    </AppShell>
  );
}
