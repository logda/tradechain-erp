import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { resolveDemoSession } from '../../_lib/demo-session';
import { buildPurchaseSplitDraft, type PurchaseSplitSalesOrder } from '../../_lib/purchase-split-draft';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { canCreateFormalPurchaseOrder } from '../../_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type PurchaseTransferSalesOrder = PurchaseSplitSalesOrder & {
  status: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
};

type PurchaseOwnerOption = {
  id: number;
  username: string;
  realName: string;
  roleCode: string;
  status: string;
};

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasValidSalesOrderDetail(value: unknown): value is PurchaseTransferSalesOrder {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PurchaseTransferSalesOrder).id === 'number' &&
    typeof (value as PurchaseTransferSalesOrder).salesNo === 'string' &&
    typeof (value as PurchaseTransferSalesOrder).status === 'string' &&
    typeof (value as PurchaseTransferSalesOrder).currentVersionNo === 'number' &&
    typeof (value as PurchaseTransferSalesOrder).purchaseAggregateStatus === 'string' &&
    typeof (value as PurchaseTransferSalesOrder).shipmentAggregateStatus === 'string' &&
    (
      (value as PurchaseTransferSalesOrder).items === undefined ||
      Array.isArray((value as PurchaseTransferSalesOrder).items)
    )
  );
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

function buildFallbackPurchaseOwnerOptions(session: { role: string; user: string }) {
  if (session.role === 'purchase') {
    return [
      {
        id: resolveUserId(session.user),
        username: session.user.toLowerCase(),
        realName: session.user,
        roleCode: 'purchase',
        status: 'active',
      },
    ];
  }

  return [
    {
      id: resolveUserId(session.user),
      username: session.user.toLowerCase(),
      realName: session.user,
      roleCode: session.role,
      status: 'active',
    },
  ];
}

function resolveUserId(user: string) {
  if (user === 'Leo') {
    return 2002;
  }

  if (user === 'Zoe') {
    return 2001;
  }

  return 2000;
}

async function loadSalesOrderDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/sales-orders/${id}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSalesOrderDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadPurchaseOwnerOptions(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSalesOrderApiBaseUrl()}/purchase-orders/owner-options`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
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

const shellBodyStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #eef6ff 100%)',
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
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
  maxWidth: '360px',
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  justifySelf: 'start',
} satisfies React.CSSProperties;

const infoBoxStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '16px',
  padding: '16px',
  background: '#f8fbff',
  display: 'grid',
  gap: '8px',
} satisfies React.CSSProperties;

const warningBoxStyle = {
  border: '1px solid #fecaca',
  borderRadius: '14px',
  padding: '14px 16px',
  background: '#fff7ed',
  color: '#9a3412',
  fontSize: '14px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const infoTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '8px',
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

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

export default async function AppNewPurchaseOrderPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canCreateFormalPurchaseOrder(session)) {
    return (
      <AppShell
        title="正式转采购单"
        subtitle="当前角色不具备采购提交权限，不能创建采购单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限创建正式采购单</h2>
          <p>请切换到采购、采购主管或管理员账号后再创建采购单。</p>
        </section>
      </AppShell>
    );
  }

  const salesOrderId = readParam(resolvedSearchParams.salesOrderId) ?? '';
  const [salesOrder, purchaseOwnerOptions] = await Promise.all([
    loadSalesOrderDetail(salesOrderId, session),
    loadPurchaseOwnerOptions(session),
  ]);
  const purchaseDraft = salesOrder ? buildPurchaseSplitDraft(salesOrder) : [];
  const createdBy = resolveUserId(session.user);
  const actionRequestHeaders = buildFormalRequestHeaders(session);
  const defaultPurchaseOwnerName = purchaseOwnerOptions[0]?.realName ?? session.user;
  const missingPurchaseDataItems = purchaseDraft.filter(
    (item) => item.supplierId <= 0 || item.unitPrice <= 0,
  );
  const canGeneratePurchaseOrders = purchaseDraft.length > 0;

  return (
    <AppShell
      title="正式转采购单"
      subtitle="支持按销售单加载采购拆单草稿，并直接生成正式采购单。"
      session={session}
    >
      <section style={shellBodyStyle}>

        <article style={heroCardStyle}>
          <h3 style={titleStyle}>销售转采购 / Sales to Purchase</h3>
          <p style={subStyle}>
            先输入销售单号加载销售明细，再按当前账号生成供应商拆单草稿，适合演示完整转单链路。
          </p>
        </article>

        <article style={formPanelStyle}>
          <form method="get" style={{ display: 'grid', gap: '12px' }}>
            <label style={labelStyle}>
              销售单 ID Sales Order
              <input
                name="salesOrderId"
                defaultValue={salesOrderId}
                style={inputStyle}
                type="number"
              />
            </label>
            <button type="submit" style={primaryButtonStyle}>
              加载销售单
            </button>
          </form>

          {salesOrder ? (
            <>
              <section style={infoBoxStyle}>
                <h4 style={infoTitleStyle}>{`销售单 ${salesOrder.salesNo}`}</h4>
                <span>{`状态：${salesOrder.status}`}</span>
                <span>{`版本：V${salesOrder.currentVersionNo}`}</span>
                <span>{`采购汇总：${salesOrder.purchaseAggregateStatus}`}</span>
                <span>{`发货汇总：${salesOrder.shipmentAggregateStatus}`}</span>
              </section>

              <section style={infoBoxStyle}>
                <strong>采购拆单预览</strong>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={headCellStyle}>销售行</th>
                        <th style={headCellStyle}>供应商</th>
                        <th style={headCellStyle}>SKU</th>
                        <th style={headCellStyle}>内部编码</th>
                        <th style={headCellStyle}>商品</th>
                        <th style={headCellStyle}>图片</th>
                        <th style={headCellStyle}>数量/件</th>
                        <th style={headCellStyle}>每件数量</th>
                        <th style={headCellStyle}>数量</th>
                        <th style={headCellStyle}>采购单价</th>
                        <th style={headCellStyle}>发货至</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseDraft.map((item) => (
                        <tr key={`${item.salesItemId}-${item.sku}`}>
                          <td style={cellStyle}>{item.salesItemId}</td>
                          <td style={cellStyle}>
                            {item.supplierId > 0 ? item.supplierId : '未配置供应商'}
                          </td>
                          <td style={cellStyle}>{item.sku}</td>
                          <td style={cellStyle}>{item.internalCode ?? '-'}</td>
                          <td style={cellStyle}>{item.productName}</td>
                          <td style={cellStyle}>{item.imageUrls?.length ?? 0}</td>
                          <td style={cellStyle}>{item.packageQuantity ?? '-'}</td>
                          <td style={cellStyle}>{item.unitsPerPackage ?? '-'}</td>
                          <td style={cellStyle}>{item.quantity}</td>
                          <td style={cellStyle}>
                            {item.unitPrice > 0 ? item.unitPrice : '待补采购价'}
                          </td>
                          <td style={cellStyle}>{item.shipTo ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {missingPurchaseDataItems.length > 0 ? (
                <p role="alert" style={warningBoxStyle}>
                  {`有 ${missingPurchaseDataItems.length} 行商品未配置供应商或采购价，可以先生成采购单；采购需在草稿或待采购认领状态补充后再提交审批。`}
                </p>
              ) : null}

              {canGeneratePurchaseOrders ? (
                <MutationActionForm
                  endpoint={`${getSalesOrderApiBaseUrl()}/purchase-orders/from-sales-order/${salesOrder.id}`}
                  label="生成采购单"
                  successLabel="已生成采购单"
                  requiredAction="purchase.order.create"
                  requiredActionLabel="创建采购单"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'createdBy',
                      value: createdBy,
                      dataType: 'number',
                    },
                    {
                      name: 'ownerName',
                      label: '采购负责人 Purchase Owner',
                      value: defaultPurchaseOwnerName,
                      display: 'select',
                      required: true,
                      helpText:
                        session.role === 'purchase'
                          ? '普通采购只能选择自己'
                          : '可选范围按当前角色权限控制',
                      options: purchaseOwnerOptions.map((owner) => ({
                        label: `${owner.realName} / ${owner.roleCode}`,
                        value: owner.realName,
                      })),
                    },
                    {
                      name: 'items',
                      value: JSON.stringify(purchaseDraft),
                      dataType: 'json',
                    },
                    {
                      name: 'salesOrderNo',
                      value: salesOrder.salesNo,
                    },
                    {
                      name: 'customerOrderNo',
                      value: salesOrder.customerOrderNo ?? '',
                    },
                    {
                      name: 'storeName',
                      value: salesOrder.storeName ?? '',
                    },
                    {
                      name: 'orderDate',
                      value: salesOrder.orderDate ?? '',
                    },
                    {
                      name: 'factoryEstimatedDeliveryDate',
                      value: salesOrder.estimatedDeliveryDate ?? '',
                    },
                    {
                      name: 'shipTo',
                      value: salesOrder.shipTo ?? '',
                    },
                    {
                      name: 'purchaseOrderAttachments',
                      value: JSON.stringify(salesOrder.salesOrderAttachments ?? []),
                      dataType: 'json',
                    },
                  ]}
                />
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              请先输入销售单 ID，然后加载销售单后再生成采购单。
            </p>
          )}
        </article>
      </section>
    </AppShell>
  );
}
