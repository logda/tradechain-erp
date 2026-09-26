import Link from 'next/link';
import { ActionPermissionNote } from '../../../_components/action-permission-note';
import { AppShell } from '../../../_components/app-shell';
import { AuditLogTable } from '../../../_components/audit-log-table';
import { ImagePreviewGallery } from '../../../_components/image-preview-gallery';
import { MutationActionForm } from '../../../_components/mutation-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../../_lib/demo-session';
import {
  canUseFormalSalesFinanceActions,
  canUseFormalSalesOrderActions,
  canViewFormalSalesOrderDetail,
  getFormalDetailAccessDeniedLabel,
} from '../../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../../_lib/formal-request-signature';
import { formatCounterpartyBilingualDisplay } from '../../../_lib/counterparty-display';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { loadActiveProductOptions } from '../../../_lib/product-options';
import {
  loadSalesUserOptions,
  resolveDefaultSalesUserId,
} from '../../../_lib/sales-user-options';
import { CreateSalesOrderForm } from '../new/create-sales-order-form';

type SearchParams = Record<string, string | string[] | undefined>;

type AppSalesOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type SalesOrderDetail = {
  id: number;
  salesNo: string;
  title?: string;
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
  sourceQuoteOrderId?: number;
  sourceQuoteVersionNo?: number;
  sourceQuoteNo?: string;
  sourceDocumentType?: 'demand' | 'quote';
  receiptSendStatus?: string;
  salesUserId?: number;
  createdBy?: number;
  afterSalesEndStatus?: string;
  receiptStatus?: string;
  financeStatus?: string;
  customerId?: number;
  customerCode?: string;
  customerEntryMode?: 'existing' | 'manual';
  customerName?: string;
  customerFullName?: string | null;
  customerOrderNo?: string;
  orderingUnit?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  shipTo?: string;
  salesOrderAttachment?: string;
  salesOrderRemark?: string;
  salesOrderAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  cancelReason?: string;
  autoVoidedPurchaseOrderIds?: number[];
  linkedPurchaseOrders?: Array<{
    id: number;
    purchaseNo: string;
    status: string;
  }>;
  versionHistory?: Array<{
    versionNo: number;
    status: string;
    createdAt: string;
    changeReason?: string;
  }>;
  items?: Array<{
    lineNo: number;
    sourceQuoteLineNo?: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    packageQuantity?: number;
    unitsPerPackage?: number;
    cartonQuantity?: number;
    outerCartonSizeCm?: string;
    outerCartonGrossWeightKg?: number;
    totalQuantity?: number;
    salePrice: number;
    amount: number;
    factoryPicUrls?: string[];
  }>;
};

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidSalesOrderDetail(value: unknown): value is SalesOrderDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SalesOrderDetail).id === 'number' &&
    typeof (value as SalesOrderDetail).salesNo === 'string' &&
    typeof (value as SalesOrderDetail).status === 'string' &&
    typeof (value as SalesOrderDetail).currentVersionNo === 'number' &&
    typeof (value as SalesOrderDetail).purchaseAggregateStatus === 'string' &&
    typeof (value as SalesOrderDetail).shipmentAggregateStatus === 'string' &&
    (
      (value as SalesOrderDetail).items === undefined ||
      Array.isArray((value as SalesOrderDetail).items)
    ) &&
    (
          (value as SalesOrderDetail).versionHistory === undefined ||
      Array.isArray((value as SalesOrderDetail).versionHistory)
    )
  );
}

function resolveUserId(user: string) {
  if (user === 'Zoe') {
    return 2001;
  }

  if (user === 'Leo') {
    return 2002;
  }

  return 2000;
}

function resolveSalesClosureSnapshot(salesOrder: SalesOrderDetail) {
  const receiptSendStatus = salesOrder.receiptSendStatus ?? 'pending';
  const afterSalesEndStatus = salesOrder.afterSalesEndStatus ?? 'not_started';
  const receiptStatus = salesOrder.receiptStatus ?? 'unpaid';
  const financeStatus = salesOrder.financeStatus ?? 'pending';
  const shipmentDone =
    salesOrder.shipmentAggregateStatus === 'to_forwarder' ||
    salesOrder.shipmentAggregateStatus === 'forwarder_shipped' ||
    salesOrder.shipmentAggregateStatus === 'arrived' ||
    salesOrder.shipmentAggregateStatus === 'closed';
  const deliveryDone =
    salesOrder.shipmentAggregateStatus === 'shipped' || shipmentDone;
  const receiptPaid =
    receiptStatus === 'deposit_received' ||
    receiptStatus === 'fully_paid' ||
    receiptStatus === 'prepaid_deducted';
  const receiptSent = receiptSendStatus === 'sent';
  const afterSalesDone = afterSalesEndStatus === 'closed';
  const financeConfirmed = financeStatus === 'confirmed';

  return {
    receiptSendStatus,
    afterSalesEndStatus,
    receiptStatus,
    financeStatus,
    canClose: shipmentDone,
    checks: [
      {
        label: '收款',
        passed: receiptPaid,
      },
      {
        label: '财务',
        passed: financeConfirmed,
      },
      {
        label: '交货',
        passed: deliveryDone,
      },
      {
        label: '回单',
        passed: receiptSent,
      },
      {
        label: '售后',
        passed: afterSalesDone,
      },
      {
        label: '交货代',
        passed: shipmentDone,
      },
    ],
  };
}

async function loadSalesOrderDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getSalesOrderApiBaseUrl()}/sales-orders/${id}`,
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
    return hasValidSalesOrderDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadSalesOrderCostWarning(id: number, session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders/${id}/cost-warning`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });
    if (!response.ok) return null;
    const result = (await response.json().catch(() => null)) as unknown;
    if (!result || typeof result !== 'object' || !Array.isArray((result as { productNames?: unknown }).productNames)) {
      return null;
    }
    const names = (result as { productNames: unknown[] }).productNames;
    return names.every((name) => typeof name === 'string') ? names as string[] : null;
  } catch {
    return null;
  }
}

async function loadSalesOrderAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders/audit-logs`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
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
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #edf8f3 100%)',
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
} satisfies React.CSSProperties;

const actionPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '20px 22px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const actionGridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '860px',
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

function formatSalesValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function formatBilingualStatus(
  value: string | null | undefined,
  labels: Record<string, string>,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return '-';
  }

  const label = labels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
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

const purchaseAggregateStatusLabels: Record<string, string> = {
  draft: '草稿',
  rejected: '已驳回',
  pending_purchase_claim: '待采购认领',
  pending_purchase_manager_approval: '待采购主管审批',
  pending_sales_manager_approval: '待销售主管审批',
  approved: '已审批',
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

const shipmentAggregateStatusLabels: Record<string, string> = {
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
  closed: '已关闭',
  void: '已作废',
};

const receiptSendStatusLabels: Record<string, string> = {
  pending: '待发送',
  sent: '已发送',
};

const afterSalesEndStatusLabels: Record<string, string> = {
  not_started: '未启动',
  pending_submit: '待提交',
  pending_approval: '待审批',
  processing: '处理中',
  finance_reviewing: '财务复核中',
  finished: '已完成',
  closed: '已闭环',
};

const receiptStatusLabels: Record<string, string> = {
  unpaid: '未收款',
  deposit_received: '已收定金',
  fully_paid: '已全款',
  prepaid_deducted: '已扣预付款',
};

const financeStatusLabels: Record<string, string> = {
  pending: '待确认',
  confirmed: '已确认',
};

function formatSalesOrderStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, salesOrderStatusLabels);
}

function formatPurchaseAggregateStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, purchaseAggregateStatusLabels);
}

function formatShipmentAggregateStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, shipmentAggregateStatusLabels);
}

function formatReceiptSendStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, receiptSendStatusLabels);
}

function formatAfterSalesEndStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, afterSalesEndStatusLabels);
}

function formatReceiptStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, receiptStatusLabels);
}

function formatFinanceStatus(value: string | null | undefined) {
  return formatBilingualStatus(value, financeStatusLabels);
}

function resolveSalesOrderSourceDocumentType(salesOrder: SalesOrderDetail) {
  if (salesOrder.sourceDocumentType === 'demand' || salesOrder.sourceDocumentType === 'quote') {
    return salesOrder.sourceDocumentType;
  }

  return salesOrder.sourceQuoteNo?.startsWith('XQ') ? 'demand' : 'quote';
}

function formatSalesPerson(value: number | undefined) {
  if (value === 2001) {
    return 'Zoe';
  }

  if (value === 2002) {
    return 'Leo';
  }

  if (value === 2000) {
    return 'Mia';
  }

  return formatSalesValue(value);
}

function encodeAccessScopes(accessScopes: ReturnType<typeof resolveDemoSession>['accessScopes']) {
  if (!accessScopes) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
}

function formatSalesOrderRemark(salesOrder: SalesOrderDetail) {
  return formatSalesValue(salesOrder.salesOrderRemark ?? salesOrder.salesOrderAttachment);
}

function isImageAttachment(attachment: NonNullable<SalesOrderDetail['salesOrderAttachments']>[number]) {
  return (
    attachment.mimeType.startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(attachment.url)
  );
}

function renderSalesOrderAttachments(
  attachments: SalesOrderDetail['salesOrderAttachments'],
) {
  if (!attachments?.length) {
    return '-';
  }

  return (
    <div style={{ display: 'grid', gap: '8px', minWidth: '180px' }}>
      {attachments.map((attachment) => (
        <a
          key={`${attachment.url}-${attachment.fileName}`}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          style={{
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isImageAttachment(attachment) ? (
            <img
              src={attachment.url}
              alt=""
              aria-hidden="true"
              style={{
                width: '42px',
                height: '32px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid #d8e1ea',
              }}
            />
          ) : null}
          <span>{attachment.fileName}</span>
        </a>
      ))}
    </div>
  );
}

function renderFactoryPics(item: NonNullable<SalesOrderDetail['items']>[number]) {
  return (
    <ImagePreviewGallery
      productName={item.productName}
      imageUrls={item.factoryPicUrls}
    />
  );
}

export default async function AppSalesOrderDetailPage({
  params,
  searchParams,
}: AppSalesOrderDetailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canViewFormalModule(session, 'sales')) {
    return (
      <AppShell
        title="正式销售单详情"
        subtitle="正式工作台下查看销售单详情与履约追踪。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('sales_order')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张销售单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const createdBy = resolveUserId(session.user);
  const { id } = await params;
  const [salesOrder, auditLogs] = await Promise.all([
    loadSalesOrderDetail(id, session),
    loadSalesOrderAuditLogs(session),
  ]);

  if (!salesOrder) {
    return (
      <AppShell
        title="正式销售单详情"
        subtitle="正式工作台下查看销售单详情与履约追踪。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>销售订单详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式销售单列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalSalesOrderDetail(session, salesOrder)) {
    return (
      <AppShell
        title="正式销售单详情"
        subtitle="正式工作台下查看销售单详情与履约追踪。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('sales_order')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张销售单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const closureSnapshot = resolveSalesClosureSnapshot(salesOrder);
  const canUseSalesOrderActions = canUseFormalSalesOrderActions(session);
  const canUseFinanceActions = canUseFormalSalesFinanceActions(session);
  const isDraftStatus = salesOrder.status === 'draft' || salesOrder.status === 'rejected';
  const isPendingApprovalStatus =
    salesOrder.status === 'pending_sales_manager_approval';
  const isPurchasingStatus = salesOrder.status === 'purchasing';
  const isTerminalStatus =
    salesOrder.status === 'closed' || salesOrder.status === 'void';
  const canManageApprovedSalesOrder =
    session.role === 'admin' || session.role === 'boss' || session.role === 'sales_manager';
  const canUseSalesFinanceRole = session.role === 'admin' || session.role === 'boss';
  const canApproveSalesOrder =
    canUseSalesOrderActions &&
    isPendingApprovalStatus &&
    canManageApprovedSalesOrder;
  const belowCostProductNames = canApproveSalesOrder
    ? await loadSalesOrderCostWarning(salesOrder.id, session)
    : [];
  const canSubmitSalesOrder = canUseSalesOrderActions && isDraftStatus;
  const canResubmitSalesOrder = false;
  const canCancelSalesOrder = false;
  const canUpdateReceiptStatus =
    canUseFinanceActions &&
    canUseSalesFinanceRole &&
    !isPurchasingStatus &&
    !isDraftStatus &&
    !isPendingApprovalStatus &&
    !isTerminalStatus &&
    closureSnapshot.receiptStatus !== 'fully_paid';
  const canConfirmFinance =
    canUseFinanceActions &&
    canUseSalesFinanceRole &&
    !isPurchasingStatus &&
    !isDraftStatus &&
    !isPendingApprovalStatus &&
    !isTerminalStatus &&
    closureSnapshot.financeStatus !== 'confirmed' &&
    closureSnapshot.receiptStatus !== 'unpaid';
  const canCloseSalesOrder =
    canUseFinanceActions &&
    canUseSalesFinanceRole &&
    !isTerminalStatus &&
    closureSnapshot.canClose;
  const hasVisibleActions =
    canSubmitSalesOrder ||
    canApproveSalesOrder ||
    canResubmitSalesOrder ||
    canCancelSalesOrder ||
    canUpdateReceiptStatus ||
    canConfirmFinance ||
    canCloseSalesOrder;
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const draftEditData = canSubmitSalesOrder
    ? await Promise.all([
        loadActiveCounterpartyOptions('customer', session),
        loadActiveProductOptions(session),
        loadSalesUserOptions(session),
      ])
    : null;
  const sourceDocumentType = resolveSalesOrderSourceDocumentType(salesOrder);
  const sourceDocumentNoun = sourceDocumentType === 'demand' ? '需求' : '报价';
  const sourceDocumentNo = salesOrder.sourceQuoteNo ?? String(salesOrder.sourceQuoteOrderId ?? '');
  const sourceDocumentVersion = `V${salesOrder.sourceQuoteVersionNo ?? '-'}`;

  return (
    <AppShell
      title="正式销售单详情"
      subtitle="展示销售单审批、采购、发货、售后和财务收口的全链路追踪。"
      session={session}
    >
      <section style={detailLayoutStyle}>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>Sales Order Detail / 销售单详情</p>
          <h3 style={heroTitleStyle}>{`销售订单 ${salesOrder.salesNo}`}</h3>
          <p style={valueStyle}>
            {`订单标题：${formatSalesValue(salesOrder.title)}`}
          </p>
          <p style={heroSubStyle}>
            正式页聚焦审批状态、采购进度、发货汇总、售后闭环与财务确认。
          </p>
        </article>

        <article style={{ ...infoCardStyle, borderLeft: '4px solid #2563eb' }}>
          <p style={labelStyle}>状态 Status</p>
          <p style={valueStyle}>{formatSalesOrderStatus(salesOrder.status)}</p>
        </article>

        {canApproveSalesOrder && belowCostProductNames === null ? (
          <div role="alert" style={{ ...infoCardStyle, borderColor: '#fbbf24', background: '#fffbeb' }}>
            成本核对暂不可用，请稍后刷新页面重试。
          </div>
        ) : null}
        {belowCostProductNames?.length ? (
          <div
            role="alert"
            aria-label="销售价低于产品库成本提醒"
            style={{ ...infoCardStyle, borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b' }}
          >
            <strong>销售单价低于产品库成本</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '22px' }}>
              {belowCostProductNames.map((name, index) => (
                <li key={`${name}-${index}`}>{`${name}销售单价低于成本`}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>销售明细</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>行号 Line</th>
                  <th style={headCellStyle}>货品编码 Product No</th>
                  <th style={headCellStyle}>货品名称 Product Name</th>
                  <th style={headCellStyle}>工厂图片 Factory Images</th>
                  <th style={headCellStyle}>数量/件 Quantity</th>
                  <th style={headCellStyle}>每件数量 Quan</th>
                  <th style={headCellStyle}>总数量 Total Q</th>
                  <th style={headCellStyle}>装箱数</th>
                  <th style={headCellStyle}>外箱尺寸</th>
                  <th style={headCellStyle}>外箱毛重</th>
                  <th style={headCellStyle}>单位 Unit</th>
                  <th style={headCellStyle}>单价 Unit P</th>
                  <th style={headCellStyle}>合计 Total</th>
                </tr>
              </thead>
              <tbody>
                {(salesOrder.items ?? []).map((item) => (
                  <tr key={`${item.lineNo}-${item.sku}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>{item.sku}</td>
                    <td style={cellStyle}>{item.productName}</td>
                    <td style={cellStyle}>{renderFactoryPics(item)}</td>
                    <td style={cellStyle}>{item.packageQuantity ?? 1}</td>
                    <td style={cellStyle}>{item.unitsPerPackage ?? item.quantity}</td>
                    <td style={cellStyle}>{item.totalQuantity ?? item.quantity}</td>
                    <td style={cellStyle}>{item.cartonQuantity ?? '-'}</td>
                    <td style={cellStyle}>{item.outerCartonSizeCm || '-'}</td>
                    <td style={cellStyle}>{item.outerCartonGrossWeightKg ?? '-'}</td>
                    <td style={cellStyle}>{item.unit}</td>
                    <td style={cellStyle}>{item.salePrice}</td>
                    <td style={cellStyle}>{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>销售收口检查</h3>
          <p style={heroSubStyle}>
            交货代即完成内部主流程收口；回单、售后、财务和收款保留为跟踪项，不阻塞销售收口。
          </p>
          <div style={{ ...gridStyle, marginTop: '16px' }}>
            {closureSnapshot.checks.map((check) => (
              <p key={check.label} style={valueStyle}>
                {`${check.label}：${check.passed ? '通过' : '未通过'}`}
              </p>
            ))}
          </div>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>订单字段</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>Order No 订单编码</th>
                  <th style={headCellStyle}>Title 订单标题</th>
                  <th style={headCellStyle}>Ordering 订货单位</th>
                  <th style={headCellStyle}>门店</th>
                  <th style={headCellStyle}>Order Date 订货日期</th>
                  <th style={headCellStyle}>Sale person 销售</th>
                  <th style={headCellStyle}>截止日期 Deadline</th>
                  <th style={headCellStyle}>Ship to 发货至</th>
                  <th style={headCellStyle}>备注 Remark</th>
                  <th style={headCellStyle}>销售单附件</th>
                  <th style={headCellStyle}>客户订单号 Customer PO No</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.salesNo)}</td>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.title)}</td>
                  <td style={cellStyle}>
                    {formatSalesValue(
                      formatCounterpartyBilingualDisplay(
                        salesOrder.orderingUnit ?? salesOrder.customerName,
                        {
                          code: salesOrder.customerCode,
                          fullName: salesOrder.customerFullName,
                        },
                      ),
                    )}
                  </td>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.storeName)}</td>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.orderDate)}</td>
                  <td style={cellStyle}>{formatSalesPerson(salesOrder.salesUserId)}</td>
                  <td style={cellStyle}>
                    {formatSalesValue(salesOrder.estimatedDeliveryDate)}
                  </td>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.shipTo)}</td>
                  <td style={cellStyle}>
                    {formatSalesOrderRemark(salesOrder)}
                  </td>
                  <td style={cellStyle}>
                    {renderSalesOrderAttachments(salesOrder.salesOrderAttachments)}
                  </td>
                  <td style={cellStyle}>{formatSalesValue(salesOrder.customerOrderNo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>版本 Version</p>
            <p style={valueStyle}>V{salesOrder.currentVersionNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>采购汇总 Purchase Aggregate</p>
            <p style={valueStyle}>
              {formatPurchaseAggregateStatus(salesOrder.purchaseAggregateStatus)}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>发货汇总 Shipment Aggregate</p>
            <p style={valueStyle}>
              {formatShipmentAggregateStatus(salesOrder.shipmentAggregateStatus)}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>回单状态 Receipt Sent</p>
            <p style={valueStyle}>
              {formatReceiptSendStatus(closureSnapshot.receiptSendStatus)}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>收款状态 Receipt</p>
            <p style={valueStyle}>{formatReceiptStatus(closureSnapshot.receiptStatus)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>财务确认 Finance</p>
            <p style={valueStyle}>{formatFinanceStatus(closureSnapshot.financeStatus)}</p>
          </article>
          {salesOrder.cancelReason ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>作废原因 Cancel Reason</p>
              <p style={valueStyle}>{salesOrder.cancelReason}</p>
            </article>
          ) : null}
          {salesOrder.autoVoidedPurchaseOrderIds?.length ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>联动作废采购单 Linked Void POs</p>
              <p style={valueStyle}>
                {salesOrder.autoVoidedPurchaseOrderIds.join(', ')}
              </p>
            </article>
          ) : null}
        </div>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>售后状态摘要</h3>
          <div style={gridStyle}>
            <p style={valueStyle}>
              {`售后阶段：${formatAfterSalesEndStatus(closureSnapshot.afterSalesEndStatus)}`}
            </p>
            <p style={valueStyle}>
              {`关单判断：${closureSnapshot.afterSalesEndStatus === 'closed' ? '已闭环' : '未闭环'}`}
            </p>
          </div>
          <p style={heroSubStyle}>
            售后阶段由后销售单逐步回写，只有完成处理与财务确认后才会推进到闭环。
          </p>
        </article>

        {salesOrder.versionHistory?.length ? (
          <article style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>版本时间线</h3>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={headCellStyle}>版本 Version</th>
                    <th style={headCellStyle}>状态 Status</th>
                    <th style={headCellStyle}>创建时间 Created At</th>
                    <th style={headCellStyle}>变更原因 Change Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOrder.versionHistory.map((entry) => (
                    <tr key={`${entry.versionNo}-${entry.createdAt}`}>
                      <td style={cellStyle}>{`V${entry.versionNo}`}</td>
                      <td style={cellStyle}>{formatSalesOrderStatus(entry.status)}</td>
                      <td style={cellStyle}>{entry.createdAt}</td>
                      <td style={cellStyle}>{entry.changeReason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        <article style={actionPanelStyle}>
          <ActionPermissionNote>
            当前仅显示当前角色和当前销售单状态下可执行的动作。
          </ActionPermissionNote>
          {canSubmitSalesOrder && draftEditData ? (
            <CreateSalesOrderForm
              customerOptions={draftEditData[0]}
              productOptions={draftEditData[1]}
              salesUsers={draftEditData[2]}
              defaultSalesUserId={resolveDefaultSalesUserId(session, draftEditData[2])}
              createdBy={createdBy}
              role={session.role}
              user={session.user}
              access={encodeAccessScopes(session.accessScopes)}
              initialSalesOrder={{
                ...salesOrder,
                customerEntryMode:
                  salesOrder.customerEntryMode === 'manual' || !salesOrder.customerId
                    ? 'manual'
                    : 'existing',
              }}
            />
          ) : hasVisibleActions ? (
            <div style={actionGridStyle}>
              {canApproveSalesOrder ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/approve`}
                  label="审批通过"
                  successLabel="销售单审批通过，采购负责人归属与建单状态已更新"
                  requiredAction="sales.order.write"
                  requiredActionLabel="销售单操作"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: salesOrder.status,
                    },
                  ]}
                />
              ) : null}
              {canApproveSalesOrder ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/reject`}
                  label="驳回待修改"
                  successLabel="销售单已驳回，销售可继续修改后再提交"
                  requiredAction="sales.order.write"
                  requiredActionLabel="销售单操作"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: salesOrder.status,
                    },
                  ]}
                />
              ) : null}
              {canResubmitSalesOrder ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/resubmit`}
                  label="重提审批"
                  requiredAction="sales.order.write"
                  requiredActionLabel="销售单操作"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: salesOrder.status,
                    },
                    {
                      name: 'changeReason',
                      value: '正式页重提审批',
                    },
                    {
                      name: 'hasShipmentBatches',
                      value: false,
                      dataType: 'boolean',
                    },
                  ]}
                />
              ) : null}
              {canCancelSalesOrder ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/cancel`}
                  label="作废销售单"
                  successLabel="销售单已作废"
                  requiredAction="sales.order.write"
                  requiredActionLabel="销售单操作"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: salesOrder.status,
                    },
                    {
                      name: 'hasShipmentBatches',
                      value: false,
                      dataType: 'boolean',
                    },
                    {
                      name: 'unshippedPurchaseOrderIds',
                      value: '',
                      dataType: 'numberArray',
                    },
                    {
                      name: 'cancelReason',
                      value: '客户取消订单',
                    },
                  ]}
                />
              ) : null}
              {canUpdateReceiptStatus ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/receipt-status`}
                  label="更新收款状态"
                  requiredAction="finance.confirm"
                  requiredActionLabel="财务确认"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'receiptStatus',
                      value:
                        closureSnapshot.receiptStatus === 'unpaid'
                          ? 'fully_paid'
                          : closureSnapshot.receiptStatus,
                    },
                  ]}
                />
              ) : null}
              {canConfirmFinance ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/finance-confirm`}
                  label="财务确认"
                  requiredAction="finance.confirm"
                  requiredActionLabel="财务确认"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'receiptStatus',
                      value:
                        closureSnapshot.receiptStatus === 'unpaid'
                          ? 'fully_paid'
                          : closureSnapshot.receiptStatus,
                    },
                    {
                      name: 'financeStatus',
                      value: 'confirmed',
                    },
                  ]}
                />
              ) : null}
              {canCloseSalesOrder ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/sales-orders/${salesOrder.id}/close`}
                  label="销售收口"
                  successLabel="销售单已完成收口"
                  requiredAction="sales.order.write"
                  requiredActionLabel="销售单操作"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'canClose',
                      value: closureSnapshot.canClose,
                      dataType: 'boolean',
                    },
                  ]}
                />
              ) : null}
            </div>
          ) : (
            <p style={valueStyle}>当前状态下暂无可操作按钮。</p>
          )}
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>来源追溯</h3>
          {salesOrder.sourceQuoteOrderId ? (
            <Link
              href={`/app/sales/quotes/${salesOrder.sourceQuoteOrderId}`}
              style={{
                ...backLinkStyle,
                display: 'inline-flex',
                padding: '12px 16px',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#1d4ed8',
              }}
            >
              {`来源${sourceDocumentNoun} ${sourceDocumentNo} / ${sourceDocumentVersion}`}
            </Link>
          ) : (
            <p style={valueStyle}>来源类型：直建销售单</p>
          )}
        </article>

        <AuditLogTable session={session} items={auditLogs?.items ?? []} />
      </section>
    </AppShell>
  );
}
