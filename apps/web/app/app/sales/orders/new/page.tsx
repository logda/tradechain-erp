import React from 'react';

import { AppShell } from '../../../_components/app-shell';
import { resolveDemoSession } from '../../../_lib/demo-session';
import {
  canUseFormalSalesOrderActions,
  resolveFormalUserId,
} from '../../../_lib/formal-access';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { loadActiveProductOptions } from '../../../_lib/product-options';
import {
  loadSalesUserOptions,
  resolveDefaultSalesUserId,
} from '../../../_lib/sales-user-options';
import { CreateSalesOrderForm } from './create-sales-order-form';

type SearchParams = Record<string, string | string[] | undefined>;

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

function encodeAccessScopes(accessScopes: ReturnType<typeof resolveDemoSession>['accessScopes']) {
  if (!accessScopes) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(accessScopes));
}

export default async function AppNewSalesOrderPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canUseFormalSalesOrderActions(session)) {
    return (
      <AppShell
        title="正式新建销售单"
        subtitle="当前角色不具备销售单创建权限，不能创建销售单。"
        session={session}
      >
        <section style={formPanelStyle}>
          <h2>无权限创建正式销售单</h2>
          <p>请切换到销售、销售主管、老板或管理员账号后再创建销售单。</p>
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
      title="正式新建销售单"
      subtitle="支持销售不通过报价直接建单，先进入草稿，再进入审批、采购与发货链路。"
      session={session}
    >
      <section style={shellBodyStyle}>

        <article style={heroCardStyle}>
          <h3 style={titleStyle}>直接新建销售单 / Direct Sales Order</h3>
          <p style={subStyle}>
            该入口用于未经过报价转单的直建场景，先收口客户、标题和负责人，默认按当前视角自动带入创建人。
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
          />
        </article>
      </section>
    </AppShell>
  );
}
