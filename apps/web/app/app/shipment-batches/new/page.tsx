import { AppShell } from '../../_components/app-shell';
import { resolveDemoSession } from '../../_lib/demo-session';
import { canUseFormalShipmentUpdateActions } from '../../_lib/formal-access';
import { CreateFormalShipmentBatchForm } from './create-formal-shipment-batch-form';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type ShipmentSourceDraft = {
  purchaseOrderCurrentStatus: string;
  currentBatchCount: number;
  salesOrderNo: string;
  purchaseOrderNo: string;
  purchasingUnit: string;
  destination: string;
  goodsName: string;
  totalPackages: number;
  estimatedArrivalDate: string;
  shippedQty: number;
  accumulatedQty: number;
  remainingQty: number;
  items: Array<{
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

type PurchaseOrderSource = {
  id: number;
  purchaseNo: string;
  status: string;
  currentBatchCount: number;
  sourceSalesOrderId: number;
  salesOrderNo: string;
  supplierName?: string;
  shipTo?: string;
  factoryEstimatedDeliveryDate?: string;
  items?: Array<{
    lineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    quantity: number;
    packageQuantity?: number;
  }>;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getShipmentBatchApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidPurchaseOrderSource(value: unknown): value is PurchaseOrderSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PurchaseOrderSource).id === 'number' &&
    typeof (value as PurchaseOrderSource).purchaseNo === 'string' &&
    typeof (value as PurchaseOrderSource).status === 'string' &&
    typeof (value as PurchaseOrderSource).sourceSalesOrderId === 'number' &&
    typeof (value as PurchaseOrderSource).salesOrderNo === 'string' &&
    typeof (value as PurchaseOrderSource).currentBatchCount === 'number' &&
    (
      (value as PurchaseOrderSource).items === undefined ||
      Array.isArray((value as PurchaseOrderSource).items)
    )
  );
}

function buildShipmentSourceDraft(purchaseOrder: PurchaseOrderSource): ShipmentSourceDraft {
  const items = (purchaseOrder.items ?? []).map((item) => ({
    purchaseLineNo: item.lineNo,
    sourceSalesItemId: item.sourceSalesItemId,
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    unit: item.unit,
    shippedQty: item.quantity,
    purchaseQty: item.quantity,
  }));
  const shippedQty = items.reduce((sum, item) => sum + item.shippedQty, 0);
  const totalPackages = (purchaseOrder.items ?? []).reduce(
    (sum, item) => sum + (Number(item.packageQuantity) || 0),
    0,
  );

  return {
    purchaseOrderCurrentStatus: purchaseOrder.status,
    currentBatchCount: purchaseOrder.currentBatchCount,
    salesOrderNo: purchaseOrder.salesOrderNo,
    purchaseOrderNo: purchaseOrder.purchaseNo,
    purchasingUnit: purchaseOrder.supplierName ?? '',
    destination: purchaseOrder.shipTo ?? '',
    goodsName: items.map((item) => item.productName).filter(Boolean).join('、'),
    totalPackages,
    estimatedArrivalDate: purchaseOrder.factoryEstimatedDeliveryDate ?? '',
    shippedQty,
    accumulatedQty: shippedQty,
    remainingQty: 0,
    items,
  };
}

async function loadShipmentSourceDraft(
  purchaseOrderId: string | undefined,
  session: ReturnType<typeof resolveDemoSession>,
) {
  if (!purchaseOrderId?.trim()) {
    return null;
  }

  try {
    const response = await fetch(
      `${getShipmentBatchApiBaseUrl()}/purchase-orders/${purchaseOrderId}`,
      {
        cache: 'no-store',
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidPurchaseOrderSource(result) ? buildShipmentSourceDraft(result) : null;
  } catch {
    return null;
  }
}

const shellBodyStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #eefcf7 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const titleStyle = {
  margin: '0 0 8px',
  fontSize: '28px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const subStyle = {
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.8,
  color: '#475569',
} satisfies React.CSSProperties;

const formPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '24px',
  background: '#ffffff',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

function resolveUserId(user: string) {
  if (user === 'Zoe') {
    return 2001;
  }

  if (user === 'Leo') {
    return 2002;
  }

  return 2000;
}

function encodeAccessScopes(accessScopes: ReturnType<typeof resolveDemoSession>['accessScopes']) {
  if (!accessScopes) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
}

export default async function AppNewFormalShipmentBatchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const defaultSalesOrderId = readParam(resolvedSearchParams.salesOrderId);
  const defaultPurchaseOrderId = readParam(resolvedSearchParams.purchaseOrderId);

  if (!canUseFormalShipmentUpdateActions(session)) {
    return (
      <AppShell
        title="正式新建发货批次"
        subtitle="当前角色不具备发货更新权限，不能创建发货批次。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限创建正式发货批次</h2>
          <p>请切换到采购、采购主管或管理员账号后再创建发货批次。</p>
        </section>
      </AppShell>
    );
  }

  const sourceDraft = await loadShipmentSourceDraft(defaultPurchaseOrderId, session);

  return (
    <AppShell
      title="正式新建发货批次"
      subtitle="正式发货页支持按采购执行单据创建首批或新增批次，承接多批次发货演示。"
      session={session}
    >
      <section style={shellBodyStyle}>

        <article style={heroCardStyle}>
          <h3 style={titleStyle}>正式创建发货批次 / Formal Shipment Create</h3>
          <p style={subStyle}>
            先收口销售单、采购单、数量与发货时间字段，创建成功后直接跳入正式发货批次详情页。
          </p>
        </article>

        <article style={formPanelStyle}>
          <CreateFormalShipmentBatchForm
            createdBy={resolveUserId(session.user)}
            role={session.role}
            user={session.user}
            access={encodeAccessScopes(session.accessScopes)}
            defaultSalesOrderId={defaultSalesOrderId}
            defaultPurchaseOrderId={defaultPurchaseOrderId}
            sourceDraft={sourceDraft}
          />
        </article>
      </section>
    </AppShell>
  );
}
