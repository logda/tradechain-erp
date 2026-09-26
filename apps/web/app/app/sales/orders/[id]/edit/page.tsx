import React from 'react';

import { AppShell } from '../../../../_components/app-shell';
import {
  canUseFormalSalesOrderActions,
  canViewFormalSalesOrderDetail,
  getFormalDetailAccessDeniedLabel,
  resolveFormalUserId,
} from '../../../../_lib/formal-access';
import { resolveDemoSession } from '../../../../_lib/demo-session';
import { loadActiveCounterpartyOptions } from '../../../../_lib/counterparty-options';
import { loadActiveProductOptions } from '../../../../_lib/product-options';
import {
  loadSalesUserOptions,
  resolveDefaultSalesUserId,
} from '../../../../_lib/sales-user-options';
import { buildFormalApiRequestHeaders } from '../../../../_lib/formal-api-request-headers';
import {
  CreateSalesOrderForm,
  type InitialSalesOrderFormValue,
} from '../../new/create-sales-order-form';

type SearchParams = Record<string, string | string[] | undefined>;

type AppSalesOrderEditPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type SalesOrderEditDetail = InitialSalesOrderFormValue & {
  status: string;
  salesNo: string;
  currentVersionNo: number;
  purchaseAggregateStatus: string;
  shipmentAggregateStatus: string;
  createdBy?: number;
};

const shellBodyStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #eef8ff 100%)',
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

function getSalesOrderApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function encodeAccessScopes(accessScopes: ReturnType<typeof resolveDemoSession>['accessScopes']) {
  if (!accessScopes) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
}

function hasValidSalesOrderEditDetail(value: unknown): value is SalesOrderEditDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SalesOrderEditDetail).id === 'number' &&
    typeof (value as SalesOrderEditDetail).salesNo === 'string' &&
    typeof (value as SalesOrderEditDetail).status === 'string' &&
    typeof (value as SalesOrderEditDetail).currentVersionNo === 'number' &&
    typeof (value as SalesOrderEditDetail).purchaseAggregateStatus === 'string' &&
    typeof (value as SalesOrderEditDetail).shipmentAggregateStatus === 'string'
  );
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
        headers: buildFormalApiRequestHeaders(session),
      },
    );

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSalesOrderEditDetail(result) ? result : null;
  } catch {
    return null;
  }
}

export default async function AppEditSalesOrderDraftPage({
  params,
  searchParams,
}: AppSalesOrderEditPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const { id } = await params;

  if (!canUseFormalSalesOrderActions(session)) {
    return (
      <AppShell
        title="编辑销售单草稿"
        subtitle="当前角色不具备销售单草稿编辑权限。"
        session={session}
      >
        <section style={formPanelStyle}>
          <h2>{getFormalDetailAccessDeniedLabel('sales_order')}</h2>
          <p>当前登录账号没有权限编辑这张销售单。</p>
        </section>
      </AppShell>
    );
  }

  const salesOrder = await loadSalesOrderDetail(id, session);
  if (!salesOrder || !canViewFormalSalesOrderDetail(session, salesOrder)) {
    return (
      <AppShell
        title="编辑销售单草稿"
        subtitle="正式工作台下继续补充销售单草稿。"
        session={session}
      >
        <section style={formPanelStyle}>
          <h2>{getFormalDetailAccessDeniedLabel('sales_order')}</h2>
          <p>当前登录账号没有权限编辑这张销售单，或销售单不存在。</p>
        </section>
      </AppShell>
    );
  }

  if (salesOrder.status !== 'draft' && salesOrder.status !== 'rejected') {
    return (
      <AppShell
        title="编辑销售单草稿"
        subtitle="只有草稿或已驳回销售单可以继续保存草稿。"
        session={session}
      >
        <section style={formPanelStyle}>
          <h2>当前销售单不可编辑</h2>
          <p>只有 draft / 草稿或 rejected / 已驳回状态可以继续编辑并保存草稿。</p>
        </section>
      </AppShell>
    );
  }

  const [customerOptions, productOptions, salesUsers] = await Promise.all([
    loadActiveCounterpartyOptions('customer', session),
    loadActiveProductOptions(session),
    loadSalesUserOptions(session),
  ]);
  const defaultSalesUserId = resolveDefaultSalesUserId(session, salesUsers);
  const currentUserId = resolveFormalUserId(session.user);

  return (
    <AppShell
      title="编辑销售单草稿"
      subtitle="继续补充草稿内容，保存后仍停留在草稿；也可以直接提交审批。"
      session={session}
    >
      <section style={shellBodyStyle}>

        <article style={heroCardStyle}>
          <h3 style={titleStyle}>{`编辑草稿 ${salesOrder.salesNo}`}</h3>
          <p style={subStyle}>
            当前销售单仍是草稿，可继续调整客户、日期、标题、明细、图片和附件。
          </p>
        </article>

        <article style={formPanelStyle}>
          <CreateSalesOrderForm
            customerOptions={customerOptions}
            productOptions={productOptions}
            salesUsers={salesUsers}
            defaultSalesUserId={defaultSalesUserId}
            createdBy={currentUserId}
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
        </article>
      </section>
    </AppShell>
  );
}
