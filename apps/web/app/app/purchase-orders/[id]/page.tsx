import Link from 'next/link';
import type { ShipmentBatchListResponse } from '@erp/shared';
import { ActionPermissionNote } from '../../_components/action-permission-note';
import { AuditLogTable } from '../../_components/audit-log-table';
import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { PurchaseOrderDraftForm } from './purchase-order-draft-form';
import { PurchaseShipmentActionForm } from './purchase-shipment-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../_lib/demo-session';
import {
  canApproveFormalPurchaseOrder,
  canSubmitFormalPurchaseOrder,
  canUseFormalShipmentUpdateActions,
  canViewFormalPurchaseOrderDetail,
  getFormalDetailAccessDeniedLabel,
  resolveFormalUserId,
} from '../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { formatCounterpartyChineseDisplay } from '../../_lib/counterparty-display';
import {
  loadActiveCounterpartyOptions,
  type CounterpartyOption,
} from '../../_lib/counterparty-options';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';

type SearchParams = Record<string, string | string[] | undefined>;

type AppPurchaseOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type PurchaseOrderDetail = {
  id: number;
  purchaseNo: string;
  status: string;
  currentVersionNo: number;
  sourceSalesOrderId: number;
  salesOrderNo: string;
  sourceSalesNo?: string;
  supplierId?: number;
  supplierName?: string;
  ownerName?: string;
  createdBy?: number;
  customerOrderNo?: string;
  storeName?: string;
  orderDate?: string;
  factoryEstimatedDeliveryDate?: string;
  shipTo?: string;
  domesticFreight?: number;
  purchaseOrderAttachments?: Array<{
    key?: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  currentBatchCount: number;
  cancelReason?: string;
  versionHistory?: Array<{
    versionNo: number;
    status: string;
    createdAt: string;
    changeReason?: string;
  }>;
  items?: Array<{
    lineNo: number;
    sourceSalesItemId: number;
    supplierId: number;
    productId: number;
    sku: string;
    internalCode?: string;
    productName: string;
    unit: string;
    quantity: number;
    packageQuantity?: number;
    unitsPerPackage?: number;
    unitPrice: number;
    amount: number;
    imageUrls?: string[];
    factoryEstimatedDeliveryDate?: string;
    shipTo?: string;
    domesticFreight?: number;
  }>;
};

type PurchaseOwnerOption = {
  id: number;
  username: string;
  realName: string;
  roleCode: string;
  status: string;
};

type LinkedShipmentBatch = ShipmentBatchListResponse['items'][number];

function getPurchaseOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function normalizePurchaseOrderDetail(value: unknown): PurchaseOrderDetail | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as PurchaseOrderDetail).id !== 'number' ||
    typeof (value as PurchaseOrderDetail).purchaseNo !== 'string' ||
    typeof (value as PurchaseOrderDetail).status !== 'string' ||
    typeof (value as PurchaseOrderDetail).currentVersionNo !== 'number' ||
    (
      (value as PurchaseOrderDetail).items !== undefined &&
      !Array.isArray((value as PurchaseOrderDetail).items)
    ) ||
    (
      (value as PurchaseOrderDetail).versionHistory !== undefined &&
      !Array.isArray((value as PurchaseOrderDetail).versionHistory)
    )
  ) {
    return null;
  }

  const detail = value as PurchaseOrderDetail;
  const sourceSalesOrderId =
    typeof detail.sourceSalesOrderId === 'number' ? detail.sourceSalesOrderId : 0;
  const salesOrderNo =
    typeof detail.salesOrderNo === 'string'
      ? detail.salesOrderNo
      : typeof detail.sourceSalesNo === 'string'
        ? detail.sourceSalesNo
        : '';

  return {
    ...detail,
    sourceSalesOrderId,
    salesOrderNo,
    currentBatchCount:
      typeof detail.currentBatchCount === 'number' ? detail.currentBatchCount : 0,
  };
}

function hasValidPurchaseOwnerOptions(value: unknown): value is PurchaseOwnerOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PurchaseOwnerOption).realName === 'string' &&
        typeof (item as PurchaseOwnerOption).roleCode === 'string',
    )
  );
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

async function loadPurchaseOrderDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${id}`, {
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
    return normalizePurchaseOrderDetail(result);
  } catch {
    return null;
  }
}

async function loadPurchaseOrderAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getPurchaseOrderApiBaseUrl()}/purchase-orders/audit-logs`, {
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

async function loadLinkedShipmentBatches(
  purchaseOrderNo: string,
  session: { role: string; user: string },
): Promise<LinkedShipmentBatch[]> {
  if (!purchaseOrderNo.trim()) {
    return [];
  }

  try {
    const searchParams = new URLSearchParams({
      purchaseOrderNo,
      pageSize: '50',
    });
    const response = await fetch(
      `${getPurchaseOrderApiBaseUrl()}/shipment-batches?${searchParams.toString()}`,
      {
        cache: 'no-store',
        headers: {
          ...buildFormalRequestHeaders(session),
          ...buildSignedFormalRequestHeaders(session),
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidShipmentBatchListResponse(result) ? result.items : [];
  } catch {
    return [];
  }
}

function buildFallbackPurchaseOwnerOptions(session: { role: string; user: string }) {
  return [
    {
      id: resolveFormalUserId(session.user),
      username: session.user.toLowerCase(),
      realName: session.user,
      roleCode: session.role,
      status: 'active',
    },
  ];
}

async function loadPurchaseOwnerOptions(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getPurchaseOrderApiBaseUrl()}/purchase-orders/owner-options`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return buildFallbackPurchaseOwnerOptions(session);
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidPurchaseOwnerOptions(result)
      ? result
      : buildFallbackPurchaseOwnerOptions(session);
  } catch {
    return buildFallbackPurchaseOwnerOptions(session);
  }
}

function buildShipmentBatchDraft(
  purchaseOrder: PurchaseOrderDetail,
  createdBy: number,
  linkedShipmentBatches: LinkedShipmentBatch[] = [],
) {
  const purchaseTotalQty = (purchaseOrder.items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const previousShippedQty = linkedShipmentBatches.reduce(
    (sum, shipmentBatch) => sum + (Number(shipmentBatch.shippedQty) || 0),
    0,
  );
  const remainingTotalQty = Math.max(purchaseTotalQty - previousShippedQty, 0);
  const defaultShippedQty = remainingTotalQty || purchaseTotalQty;
  const shippedQtyByLine = new Map<number, number>();
  const hasLineShipmentInfo = linkedShipmentBatches.some(
    (shipmentBatch) => shipmentBatch.items?.length,
  );

  for (const shipmentBatch of linkedShipmentBatches) {
    for (const item of shipmentBatch.items ?? []) {
      shippedQtyByLine.set(
        item.purchaseLineNo,
        (shippedQtyByLine.get(item.purchaseLineNo) ?? 0) +
          (Number(item.shippedQty) || 0),
      );
    }
  }

  let qtyToAllocate = defaultShippedQty;
  const items = (purchaseOrder.items ?? []).map((item) => {
    const lineRemainingQty = Math.max(
      item.quantity -
        (hasLineShipmentInfo ? shippedQtyByLine.get(item.lineNo) ?? 0 : 0),
      0,
    );
    const lineShippedQty = Math.min(lineRemainingQty, qtyToAllocate);
    qtyToAllocate = Math.max(qtyToAllocate - lineShippedQty, 0);

    return {
      purchaseLineNo: item.lineNo,
      sourceSalesItemId: item.sourceSalesItemId,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      unit: item.unit,
      shippedQty: lineShippedQty,
      purchaseQty: item.quantity,
    };
  });

  return {
    salesOrderId: purchaseOrder.sourceSalesOrderId,
    purchaseOrderId: purchaseOrder.id,
    purchaseTotalQty,
    previousShippedQty,
    totalQty: defaultShippedQty,
    shippedQty: defaultShippedQty,
    accumulatedQty: previousShippedQty + defaultShippedQty,
    remainingQty: Math.max(remainingTotalQty - defaultShippedQty, 0),
    shippedAt: '2026-07-11T12:00:00.000Z',
    createdBy,
    purchaseOrderCurrentStatus: purchaseOrder.status,
    currentBatchCount: purchaseOrder.currentBatchCount,
    items,
  };
}

function canCreateShipmentBatchForPurchaseStatus(status: string) {
  return [
    'purchasing',
    'partial_shipped',
    'partial_to_forwarder',
    'partial_forwarder_shipped',
    'partial_arrived',
  ].includes(status);
}

function buildStockInDraft(
  purchaseOrder: PurchaseOrderDetail,
  createdBy: number,
) {
  return {
    sourceBizType: 'purchase_order',
    sourceBizId: purchaseOrder.id,
    sourceDocNo: purchaseOrder.purchaseNo,
    sourceCurrentStatus: purchaseOrder.status,
    warehouseId: 1,
    locationId: 11,
    createdBy,
    items: (purchaseOrder.items ?? []).map((item) => ({
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      quantity: item.quantity,
    })),
  };
}

function resolvePrimarySupplierId(purchaseOrder: PurchaseOrderDetail) {
  return purchaseOrder.items?.[0]?.supplierId ?? 0;
}

function formatPurchaseSupplierLineValue(
  purchaseOrder: PurchaseOrderDetail,
  supplierId: number,
) {
  if (supplierId > 0) {
    return String(supplierId);
  }

  return purchaseOrder.supplierName?.trim() || '待补供应商';
}

function formatPurchaseUnitPrice(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    return '待补采购价';
  }

  return String(value);
}

function formatPurchaseValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
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

function formatPurchaseOrderStatus(status: string | null | undefined) {
  const normalized = status?.trim();
  if (!normalized) {
    return '-';
  }

  const label = purchaseOrderStatusLabels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
}

const shipmentBatchStatusLabels: Record<string, string> = {
  shipped: '已发货',
  to_forwarder: '已交货代',
  forwarder_shipped: '货代已发出',
  arrived: '已到货',
  exception: '异常',
};

function formatShipmentBatchStatus(status: string | null | undefined) {
  const normalized = status?.trim();
  if (!normalized) {
    return '-';
  }

  const label = shipmentBatchStatusLabels[normalized];
  return label ? `${normalized} / ${label}` : normalized;
}

function toFormalShipmentBatchDetailHref(detailHref: string) {
  const id = detailHref.split('/').filter(Boolean).at(-1);
  return id ? `/app/shipment-batches/${id}` : '/app/shipment-batches';
}

function renderPurchaseImages(item: NonNullable<PurchaseOrderDetail['items']>[number]) {
  const imageUrls = item.imageUrls ?? [];

  if (!imageUrls.length) {
    return '-';
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {imageUrls.map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={`${item.productName} 图片 ${index + 1}`}
            style={{
              width: '48px',
              height: '48px',
              objectFit: 'cover',
              borderRadius: '6px',
              border: '1px solid #d8e1ea',
            }}
          />
        </a>
      ))}
    </div>
  );
}

function renderPurchaseAttachments(
  attachments: PurchaseOrderDetail['purchaseOrderAttachments'],
) {
  if (!attachments?.length) {
    return '-';
  }

  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {attachments.map((attachment) => (
        <a
          key={`${attachment.url}-${attachment.fileName}`}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          style={subtleLinkStyle}
        >
          {attachment.fileName}
        </a>
      ))}
    </div>
  );
}

function buildResubmitPurchaseOrderDraft(
  purchaseOrder: PurchaseOrderDetail,
  linkedShipmentBatchCount = purchaseOrder.currentBatchCount,
) {
  return {
    currentStatus: purchaseOrder.status,
    hasShipmentBatches:
      purchaseOrder.currentBatchCount > 0 || linkedShipmentBatchCount > 0,
    sourceSalesOrderId: purchaseOrder.sourceSalesOrderId,
    supplierId: resolvePrimarySupplierId(purchaseOrder),
    changeReason: '采购条件变化，需要重新提交',
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
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #eef6ff 100%)',
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
  minWidth: '920px',
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

export default async function AppPurchaseOrderDetailPage({
  params,
  searchParams,
}: AppPurchaseOrderDetailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canViewFormalModule(session, 'purchase')) {
    return (
      <AppShell
        title="正式采购单详情"
        subtitle="正式采购详情页承接采购审批、改单重提与来源追溯。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/purchase-orders" style={backLinkStyle}>
            返回正式采购单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('purchase_order')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张采购单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const createdBy = resolveFormalUserId(session.user);
  const { id } = await params;
  const [purchaseOrder, auditLogs, purchaseOwnerOptions, supplierOptions] = await Promise.all([
    loadPurchaseOrderDetail(id, session),
    loadPurchaseOrderAuditLogs(session),
    loadPurchaseOwnerOptions(session),
    loadActiveCounterpartyOptions('supplier', session),
  ]);

  if (!purchaseOrder) {
    return (
      <AppShell
        title="正式采购单详情"
        subtitle="正式采购详情页承接采购审批、改单重提与来源追溯。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/purchase-orders"
            style={backLinkStyle}
          >
            返回正式采购单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>采购单详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式采购单列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalPurchaseOrderDetail(session, purchaseOrder)) {
    return (
      <AppShell
        title="正式采购单详情"
        subtitle="正式采购详情页承接采购审批、改单重提与来源追溯。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link href="/app/purchase-orders" style={backLinkStyle}>
            返回正式采购单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('purchase_order')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张采购单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const linkedShipmentBatches = await loadLinkedShipmentBatches(
    purchaseOrder.purchaseNo,
    session,
  );
  const effectiveCurrentBatchCount = Math.max(
    purchaseOrder.currentBatchCount,
    linkedShipmentBatches.length,
  );
  const resubmitPurchaseOrderDraft = buildResubmitPurchaseOrderDraft(
    purchaseOrder,
    effectiveCurrentBatchCount,
  );
  const shipmentBatchDraft = {
    ...buildShipmentBatchDraft(purchaseOrder, createdBy, linkedShipmentBatches),
    currentBatchCount: effectiveCurrentBatchCount,
  };
  const canApprovePurchaseOrder = canApproveFormalPurchaseOrder(session);
  const canSubmitPurchaseOrder = canSubmitFormalPurchaseOrder(session);
  const canUpdateShipment = canUseFormalShipmentUpdateActions(session);
  const canOpenSourceSalesOrder =
    canViewFormalModule(session, 'sales') && purchaseOrder.sourceSalesOrderId > 0;
  const remainingShipmentQty = Math.max(
    (purchaseOrder.items ?? []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    ) -
      linkedShipmentBatches.reduce(
        (sum, shipmentBatch) => sum + (Number(shipmentBatch.shippedQty) || 0),
        0,
      ),
    0,
  );
  const canExecutePurchaseFulfillment =
    canUpdateShipment &&
    purchaseOrder.sourceSalesOrderId > 0 &&
    canCreateShipmentBatchForPurchaseStatus(purchaseOrder.status) &&
    remainingShipmentQty > 0;
  const canShowPurchaseSubmitAction =
    canSubmitPurchaseOrder &&
    (purchaseOrder.status === 'draft' ||
      purchaseOrder.status === 'pending_purchase_claim');
  const canSavePurchaseDraft = canShowPurchaseSubmitAction;
  const submitPurchaseOrderLabel =
    purchaseOrder.status === 'pending_purchase_claim'
      ? '认领并提交采购审批'
      : '提交采购审批';
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const supplierPickerOptions: CounterpartyOption[] =
    purchaseOrder.supplierId &&
    purchaseOrder.supplierId > 0 &&
    !supplierOptions.some((option) => option.id === purchaseOrder.supplierId)
      ? [
          {
            id: purchaseOrder.supplierId,
            type: 'supplier',
            code: String(purchaseOrder.supplierId),
            name: purchaseOrder.supplierName ?? String(purchaseOrder.supplierId),
            shortName: '',
          },
          ...supplierOptions,
        ]
      : supplierOptions;

  return (
    <AppShell
      title="正式采购单详情"
      subtitle="展示采购审批、版本、来源与履约信息的正式承接页。"
      session={session}
    >
      <section style={detailLayoutStyle}>
        <div style={actionBarStyle}>
          <Link
            href="/app/purchase-orders"
            style={backLinkStyle}
          >
            返回正式采购单列表
          </Link>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
          {canOpenSourceSalesOrder ? (
            <Link
              href={`/app/sales/orders/${purchaseOrder.sourceSalesOrderId}`}
              style={backLinkStyle}
            >
              返回对应销售单
            </Link>
          ) : null}
        </div>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>Purchase Order Detail / 采购单详情</p>
          <h3 style={heroTitleStyle}>{`采购单 ${purchaseOrder.purchaseNo}`}</h3>
          <p style={heroSubStyle}>
            采购详情聚焦审批状态、来源销售单、供应商、采购负责人和版本历史。
          </p>
          {canExecutePurchaseFulfillment ? (
            <div style={heroActionStyle}>
              <Link
                href={`/app/shipment-batches/new?salesOrderId=${purchaseOrder.sourceSalesOrderId}&purchaseOrderId=${purchaseOrder.id}`}
                style={heroActionLinkStyle}
              >
                打开发货批次页
              </Link>
            </div>
          ) : null}
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>供应商 Supplier</p>
            <p style={valueStyle}>
              供应商：
              {formatCounterpartyChineseDisplay(purchaseOrder.supplierName, {
                fallback: '未提供',
              })}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>采购负责人 Purchase Owner</p>
            <p style={valueStyle}>{`采购负责人：${purchaseOrder.ownerName ?? '未提供'}`}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>状态 Status</p>
            <p style={valueStyle}>{formatPurchaseOrderStatus(purchaseOrder.status)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>版本 Version</p>
            <p style={valueStyle}>V{purchaseOrder.currentVersionNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>单据编号 Purchase No</p>
            <p style={valueStyle}>{purchaseOrder.purchaseNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>订单编码 Sales Order No</p>
            <p style={valueStyle}>{formatPurchaseValue(purchaseOrder.salesOrderNo)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>编码 Customer PO No</p>
            <p style={valueStyle}>{formatPurchaseValue(purchaseOrder.customerOrderNo)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>门店 Store</p>
            <p style={valueStyle}>{formatPurchaseValue(purchaseOrder.storeName)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>订货日期 Order Date</p>
            <p style={valueStyle}>{formatPurchaseValue(purchaseOrder.orderDate)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>工厂预计交货时间 Factory ETA</p>
            <p style={valueStyle}>
              {formatPurchaseValue(purchaseOrder.factoryEstimatedDeliveryDate)}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>发货至 Ship To</p>
            <p style={valueStyle}>{formatPurchaseValue(purchaseOrder.shipTo)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>采购单附件 Attachments</p>
            <div style={{ marginTop: '10px' }}>
              {renderPurchaseAttachments(purchaseOrder.purchaseOrderAttachments)}
            </div>
          </article>
          {purchaseOrder.cancelReason ? (
            <article style={infoCardStyle}>
              <p style={labelStyle}>作废原因 Cancel Reason</p>
              <p style={valueStyle}>{purchaseOrder.cancelReason}</p>
            </article>
          ) : null}
        </div>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>来源追溯</h3>
          <p style={valueStyle}>
            {purchaseOrder.sourceSalesOrderId > 0
              ? `来源销售单：${purchaseOrder.salesOrderNo} / #${purchaseOrder.sourceSalesOrderId}`
              : `来源销售单：${formatPurchaseValue(purchaseOrder.salesOrderNo)}`}
          </p>
          <p style={heroSubStyle}>
            来源销售单信息会保留在系统追溯字段中，采购明细仅展示采购执行需要识别的字段。
          </p>
          {canOpenSourceSalesOrder ? (
            <Link
              href={`/app/sales/orders/${purchaseOrder.sourceSalesOrderId}`}
              style={subtleLinkStyle}
            >
              查看来源销售单
            </Link>
          ) : null}
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>关联发货单</h3>
          {linkedShipmentBatches.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {linkedShipmentBatches.map((shipmentBatch) => (
                <div
                  key={shipmentBatch.detailHref}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    border: '1px solid #d8e1ea',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <p style={{ ...labelStyle, letterSpacing: 0, textTransform: 'none' }}>
                      发货单号 Shipment No
                    </p>
                    <p style={{ ...valueStyle, marginTop: '6px', fontSize: '16px' }}>
                      {shipmentBatch.docNo}
                    </p>
                    <p style={{ ...heroSubStyle, marginTop: '4px' }}>
                      {`状态：${formatShipmentBatchStatus(shipmentBatch.status)}`}
                    </p>
                  </div>
                  <Link
                    href={toFormalShipmentBatchDetailHref(shipmentBatch.detailHref)}
                    style={heroActionLinkStyle}
                  >
                    查看发货单 {shipmentBatch.docNo}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p style={heroSubStyle}>暂无关联发货单</p>
          )}
        </article>

        {purchaseOrder.versionHistory?.length ? (
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
                  {purchaseOrder.versionHistory.map((entry) => (
                    <tr key={`${entry.versionNo}-${entry.createdAt}`}>
                      <td style={cellStyle}>{`V${entry.versionNo}`}</td>
                    <td style={cellStyle}>{formatPurchaseOrderStatus(entry.status)}</td>
                      <td style={cellStyle}>{entry.createdAt}</td>
                      <td style={cellStyle}>{entry.changeReason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>采购明细</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>行号 Line</th>
                  <th style={headCellStyle}>供应商 Supplier</th>
                  <th style={headCellStyle}>货品编码 Product No</th>
                  <th style={headCellStyle}>内部编码 Internal Code</th>
                  <th style={headCellStyle}>货品名称 Product Name</th>
                  <th style={headCellStyle}>图片 Image</th>
                  <th style={headCellStyle}>数量/件 Quantity</th>
                  <th style={headCellStyle}>每件数量 Quan</th>
                  <th style={headCellStyle}>总数量 Total Q</th>
                  <th style={headCellStyle}>单位 Unit</th>
                  <th style={headCellStyle}>单价(元) Unit Price</th>
                  <th style={headCellStyle}>国内运费 Freight</th>
                  <th style={headCellStyle}>合计 Total</th>
                  <th style={headCellStyle}>工厂预计交货时间 Factory ETA</th>
                  <th style={headCellStyle}>发货至 Ship To</th>
                </tr>
              </thead>
              <tbody>
                {(purchaseOrder.items ?? []).map((item) => (
                  <tr key={`${item.lineNo}-${item.sku}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>
                      {formatPurchaseSupplierLineValue(purchaseOrder, item.supplierId)}
                    </td>
                    <td style={cellStyle}>{item.sku}</td>
                    <td style={cellStyle}>{formatPurchaseValue(item.internalCode)}</td>
                    <td style={cellStyle}>{item.productName}</td>
                    <td style={cellStyle}>{renderPurchaseImages(item)}</td>
                    <td style={cellStyle}>{formatPurchaseValue(item.packageQuantity)}</td>
                    <td style={cellStyle}>{formatPurchaseValue(item.unitsPerPackage)}</td>
                    <td style={cellStyle}>{item.quantity}</td>
                    <td style={cellStyle}>{item.unit}</td>
                    <td style={cellStyle}>{formatPurchaseUnitPrice(item.unitPrice)}</td>
                    <td style={cellStyle}>{formatPurchaseValue(item.domesticFreight)}</td>
                    <td style={cellStyle}>{item.amount}</td>
                    <td style={cellStyle}>
                      {formatPurchaseValue(
                        item.factoryEstimatedDeliveryDate ??
                          purchaseOrder.factoryEstimatedDeliveryDate,
                      )}
                    </td>
                    <td style={cellStyle}>
                      {formatPurchaseValue(item.shipTo ?? purchaseOrder.shipTo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article style={actionPanelStyle}>
          <ActionPermissionNote>
            当前角色动作权限：可提交采购审批；通过/驳回需采购主管、老板或管理员。
          </ActionPermissionNote>
          <div style={actionGridStyle}>
            {canSavePurchaseDraft ? (
              <PurchaseOrderDraftForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${purchaseOrder.id}/draft`}
                currentStatus={purchaseOrder.status}
                currentOwnerName={purchaseOrder.ownerName ?? purchaseOwnerOptions[0]?.realName ?? session.user}
                ownerOptions={purchaseOwnerOptions}
                supplierOptions={supplierPickerOptions}
                currentSupplierId={purchaseOrder.supplierId ?? 0}
                currentSupplierName={purchaseOrder.supplierName ?? ''}
                items={(purchaseOrder.items ?? []).map((item) => ({
                  lineNo: item.lineNo,
                  sku: item.sku,
                  productName: item.productName,
                  unitPrice: item.unitPrice,
                }))}
                requestHeaders={actionRequestHeaders}
                isPurchaseUser={session.role === 'purchase'}
              />
            ) : null}
            {canApprovePurchaseOrder &&
            purchaseOrder.status === 'pending_purchase_manager_approval' ? (
              <MutationActionForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${purchaseOrder.id}/approve`}
                label="通过采购审批"
                requiredAction="purchase.order.approve"
                requiredActionLabel="采购审批"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: purchaseOrder.status,
                  },
                ]}
              />
            ) : null}
            {canApprovePurchaseOrder &&
            purchaseOrder.status === 'pending_purchase_manager_approval' ? (
              <MutationActionForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${purchaseOrder.id}/reject`}
                label="驳回采购审批"
                requiredAction="purchase.order.approve"
                requiredActionLabel="采购审批"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: purchaseOrder.status,
                  },
                ]}
              />
            ) : null}
            {canSubmitPurchaseOrder &&
            purchaseOrder.status === 'purchasing' &&
            effectiveCurrentBatchCount === 0 ? (
              <MutationActionForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${purchaseOrder.id}/resubmit`}
                label="重提采购审批"
                requiredAction="purchase.order.submit"
                requiredActionLabel="采购单提交"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: resubmitPurchaseOrderDraft.currentStatus,
                  },
                  {
                    name: 'hasShipmentBatches',
                    value: resubmitPurchaseOrderDraft.hasShipmentBatches,
                    dataType: 'boolean',
                  },
                  {
                    name: 'sourceSalesOrderId',
                    value: resubmitPurchaseOrderDraft.sourceSalesOrderId,
                    dataType: 'number',
                  },
                  {
                    name: 'supplierId',
                    value: resubmitPurchaseOrderDraft.supplierId,
                    dataType: 'number',
                  },
                  {
                    name: 'changeReason',
                    value: resubmitPurchaseOrderDraft.changeReason,
                  },
                ]}
              />
            ) : null}
            {canExecutePurchaseFulfillment ? (
              <PurchaseShipmentActionForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/shipment-batches`}
                requestHeaders={actionRequestHeaders}
                draft={shipmentBatchDraft}
              />
            ) : null}
            {canShowPurchaseSubmitAction ? (
              <MutationActionForm
                endpoint={`${getPurchaseOrderApiBaseUrl()}/purchase-orders/${purchaseOrder.id}/submit`}
                label={submitPurchaseOrderLabel}
                requiredAction="purchase.order.submit"
                requiredActionLabel="采购单提交"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: purchaseOrder.status,
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
