import Link from 'next/link';
import { ActionPermissionNote } from '../../_components/action-permission-note';
import { AuditLogTable } from '../../_components/audit-log-table';
import { AppShell } from '../../_components/app-shell';
import { MutationActionForm } from '../../_components/mutation-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../_lib/demo-session';
import {
  canConfirmFormalAfterSalesFinance,
  canUseFormalAfterSalesProcessActions,
  canViewFormalAfterSalesDetail,
  getFormalDetailAccessDeniedLabel,
} from '../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../_lib/audit-log';
import { buildFormalRequestHeaders } from '../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../_lib/formal-request-signature';

type SearchParams = Record<string, string | string[] | undefined>;

type AppAfterSalesDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type AfterSalesDetail = {
  id: number;
  afterSalesNo: string;
  status: string;
  financeReviewStatus: string;
  salesOrderId?: number;
  purchaseOrderId?: number;
  shipmentBatchId?: number;
  type?: string;
  issueDescription?: string;
  items?: Array<{
    lineNo: number;
    shipmentLineNo: number;
    purchaseLineNo: number;
    sourceSalesItemId: number;
    productId: number;
    sku: string;
    productName: string;
    unit: string;
    affectedQty: number;
    shipmentQty: number;
  }>;
};

function getAfterSalesApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidAfterSalesDetail(value: unknown): value is AfterSalesDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AfterSalesDetail).id === 'number' &&
    typeof (value as AfterSalesDetail).afterSalesNo === 'string' &&
    typeof (value as AfterSalesDetail).status === 'string' &&
    typeof (value as AfterSalesDetail).financeReviewStatus === 'string'
  );
}

async function loadAfterSalesDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getAfterSalesApiBaseUrl()}/after-sales/${id}`, {
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
    return hasValidAfterSalesDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadAfterSalesAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getAfterSalesApiBaseUrl()}/after-sales/audit-logs`, {
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
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #fff6ee 100%)',
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

const helperTextStyle = {
  margin: '0 0 16px',
  fontSize: '14px',
  lineHeight: 1.7,
  color: '#475569',
} satisfies React.CSSProperties;

const tableWrapStyle = {
  overflowX: 'auto' as const,
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
} satisfies React.CSSProperties;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '960px',
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

function formatAfterSalesType(value?: string) {
  if (value === 'customer_complaint') return '客户投诉';
  if (value === 'quality_issue') return '质量问题';
  if (value === 'shipment_damage') return '运输损坏';
  if (value === 'refund') return '退款';
  return value ?? '未分类';
}

function formatAfterSalesWorkflowStatus(value?: string) {
  if (value === 'pending_submit') return '待提交';
  if (value === 'pending_approval') return '待审批';
  if (value === 'processing') return '处理中';
  if (value === 'finance_reviewing') return '财务复核中';
  if (value === 'finished') return '待关闭';
  if (value === 'closed') return '已关闭';
  return '未知';
}

export default async function AppAfterSalesDetailPage({
  params,
  searchParams,
}: AppAfterSalesDetailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canViewFormalModule(session, 'operations')) {
    return (
      <AppShell
        title="正式售后单详情"
        subtitle="正式售后详情页承接售后状态、财务复核与关单前确认。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/after-sales"
            style={backLinkStyle}
          >
            返回正式售后单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              {getFormalDetailAccessDeniedLabel('after_sales')}
            </h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张售后单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const { id } = await params;
  const [afterSalesOrder, auditLogs] = await Promise.all([
    loadAfterSalesDetail(id, session),
    loadAfterSalesAuditLogs(session),
  ]);

  if (!afterSalesOrder) {
    return (
      <AppShell
        title="正式售后单详情"
        subtitle="正式售后详情页承接售后状态、财务复核与关单前确认。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/after-sales"
            style={backLinkStyle}
          >
            返回正式售后单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>售后单详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式售后单列表后重试。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!canViewFormalAfterSalesDetail(session)) {
    return (
      <AppShell
        title="正式售后单详情"
        subtitle="正式售后详情页承接售后状态、财务复核与关单前确认。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <Link
            href="/app/after-sales"
            style={backLinkStyle}
          >
            返回正式售后单列表
          </Link>
          <div style={heroCardStyle}>
            <h3 style={heroTitleStyle}>
              {getFormalDetailAccessDeniedLabel('after_sales')}
            </h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张售后单。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const canConfirmFinance = canConfirmFormalAfterSalesFinance(session);
  const canProcessAfterSales = canUseFormalAfterSalesProcessActions(session);
  const actionRequestHeaders = buildFormalRequestHeaders(session);

  return (
    <AppShell
      title="正式售后单详情"
      subtitle="展示售后状态、来源追溯、财务复核状态与关单条件，承接售后闭环。"
      session={session}
    >
      <section style={detailLayoutStyle}>
        <div style={actionBarStyle}>
          <Link
            href="/app/after-sales"
            style={backLinkStyle}
          >
            返回正式售后单列表
          </Link>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
        </div>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>After-sales Detail / 售后单详情</p>
          <h3 style={heroTitleStyle}>{`售后单 ${afterSalesOrder.afterSalesNo}`}</h3>
          <p style={heroSubStyle}>
            当前页面已经接通销售单、采购单和发货批次，便于追踪问题来源、处理过程和财务确认。
          </p>
          <div style={heroActionStyle}>
            {afterSalesOrder.salesOrderId ? (
              <Link
                href={`/app/sales/orders/${afterSalesOrder.salesOrderId}`}
                style={backLinkStyle}
              >
                打开销售单
              </Link>
            ) : null}
            {afterSalesOrder.purchaseOrderId ? (
              <Link
                href={`/app/purchase-orders/${afterSalesOrder.purchaseOrderId}`}
                style={backLinkStyle}
              >
                打开采购单
              </Link>
            ) : null}
            {afterSalesOrder.shipmentBatchId ? (
              <Link
                href={`/app/shipment-batches/${afterSalesOrder.shipmentBatchId}`}
                style={backLinkStyle}
              >
                打开发货批次
              </Link>
            ) : null}
          </div>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>链路追溯</h3>
          <p style={valueStyle}>
            {`销售单 #${afterSalesOrder.salesOrderId ?? '-'} → 采购单 #${afterSalesOrder.purchaseOrderId ?? '-'} → 发货批次 #${afterSalesOrder.shipmentBatchId ?? '-'}`}
          </p>
          <p style={heroSubStyle}>
            来源销售、采购与发货信息会保留在系统追溯字段中，售后明细仅展示处理需要识别的字段。
          </p>
        </article>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>流程摘要</h3>
          <div style={gridStyle}>
            <p style={valueStyle}>
              {`当前状态：${afterSalesOrder.status} / ${formatAfterSalesWorkflowStatus(afterSalesOrder.status)}`}
            </p>
            <p style={valueStyle}>
              {`财务复核：${afterSalesOrder.financeReviewStatus} / ${afterSalesOrder.financeReviewStatus === 'confirmed' ? '已确认' : '待确认'}`}
            </p>
            <p style={valueStyle}>
              {`关单条件：${afterSalesOrder.status === 'closed' ? '已关闭' : afterSalesOrder.financeReviewStatus === 'confirmed' ? '可关闭' : '未满足'}`}
            </p>
          </div>
          <p style={heroSubStyle}>
            流程摘要帮助业务快速判断当前卡点，避免在审批、财务和关单之间来回跳转。
          </p>
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>状态 Status</p>
            <p style={valueStyle}>{afterSalesOrder.status}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>财务复核 Finance Review</p>
            <p style={valueStyle}>{afterSalesOrder.financeReviewStatus}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>单据编号 After-sales No</p>
            <p style={valueStyle}>{afterSalesOrder.afterSalesNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>售后类型 Type</p>
            <p style={valueStyle}>{formatAfterSalesType(afterSalesOrder.type)}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>问题描述 Issue</p>
            <p style={valueStyle}>{afterSalesOrder.issueDescription ?? '未填写'}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>发货批次 Shipment Batch</p>
            <p style={valueStyle}>{afterSalesOrder.shipmentBatchId ?? '未关联'}</p>
            {afterSalesOrder.shipmentBatchId ? (
              <Link
                href={`/app/shipment-batches/${afterSalesOrder.shipmentBatchId}`}
                style={subtleLinkStyle}
              >
                查看发货追溯
              </Link>
            ) : null}
          </article>
        </div>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>售后明细</h3>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headCellStyle}>行号 Line</th>
                  <th style={headCellStyle}>发货行 Shipment Line</th>
                  <th style={headCellStyle}>采购行 Purchase Line</th>
                  <th style={headCellStyle}>SKU</th>
                  <th style={headCellStyle}>商品 Product</th>
                  <th style={headCellStyle}>影响数量 Affected Qty</th>
                  <th style={headCellStyle}>发货数量 Shipment Qty</th>
                  <th style={headCellStyle}>单位 Unit</th>
                </tr>
              </thead>
              <tbody>
                {(afterSalesOrder.items ?? []).map((item) => (
                  <tr key={`${item.lineNo}-${item.sku}`}>
                    <td style={cellStyle}>{item.lineNo}</td>
                    <td style={cellStyle}>{item.shipmentLineNo}</td>
                    <td style={cellStyle}>{item.purchaseLineNo}</td>
                    <td style={cellStyle}>{item.sku}</td>
                    <td style={cellStyle}>{item.productName}</td>
                    <td style={cellStyle}>{item.affectedQty}</td>
                    <td style={cellStyle}>{item.shipmentQty}</td>
                    <td style={cellStyle}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article style={actionPanelStyle}>
          <ActionPermissionNote>
            当前角色动作权限：可推进售后处理；财务确认需老板或管理员。
          </ActionPermissionNote>
          <p style={helperTextStyle}>
            按当前状态逐步推进售后闭环，覆盖审批、财务复核、完成处理和关单。
          </p>
          <div style={actionGridStyle}>
            {canProcessAfterSales && afterSalesOrder.status === 'pending_submit' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/submit`}
                label="提交售后审批"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales && afterSalesOrder.status === 'pending_approval' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/approve`}
                label="审批通过"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales && afterSalesOrder.status === 'pending_approval' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/reject`}
                label="驳回重提"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales && afterSalesOrder.status === 'processing' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/start-processing`}
                label="进入财务复核"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                ]}
              />
            ) : null}
            {canConfirmFinance &&
            afterSalesOrder.status === 'finance_reviewing' &&
            afterSalesOrder.financeReviewStatus === 'pending' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/confirm-finance`}
                label="财务确认"
                requiredAction="finance.confirm"
                requiredActionLabel="财务确认"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                  {
                    name: 'financeReviewStatus',
                    value: afterSalesOrder.financeReviewStatus,
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales && afterSalesOrder.status === 'finance_reviewing' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/finish`}
                label="处理完成"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                ]}
              />
            ) : null}
            {canProcessAfterSales &&
            afterSalesOrder.status === 'finished' &&
            afterSalesOrder.financeReviewStatus === 'confirmed' ? (
              <MutationActionForm
                endpoint={`${getAfterSalesApiBaseUrl()}/after-sales/${afterSalesOrder.id}/close`}
                label="关闭售后"
                requiredAction="after_sales.process"
                requiredActionLabel="售后处理"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: afterSalesOrder.status,
                  },
                  {
                    name: 'financeReviewStatus',
                    value: afterSalesOrder.financeReviewStatus,
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
