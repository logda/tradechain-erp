import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { loadActiveCounterpartyOptions } from '../../_lib/counterparty-options';
import { resolveDemoSession } from '../../_lib/demo-session';
import { canUseFormalAfterSalesProcessActions } from '../../_lib/formal-access';
import { CreateFormalAfterSalesForm } from './create-formal-after-sales-form';

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const shellBodyStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #fff6ee 100%)',
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

export default async function AppNewFormalAfterSalesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canUseFormalAfterSalesProcessActions(session)) {
    return (
      <AppShell
        title="正式新建售后单"
        subtitle="当前角色不具备售后处理权限，不能创建售后单。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限创建正式售后单</h2>
          <p>请切换到采购、采购主管或管理员账号后再创建售后单。</p>
          <Link href="/app" style={backLinkStyle}>
            返回正式首页
          </Link>
        </section>
      </AppShell>
    );
  }

  const customerOptions = await loadActiveCounterpartyOptions('customer', session);
  const supplierOptions = await loadActiveCounterpartyOptions('supplier', session);

  return (
    <AppShell
      title="正式新建售后单"
      subtitle="正式售后页支持从销售、采购和发货追溯节点快速创建售后单。"
      session={session}
    >
      <section style={shellBodyStyle}>
        <div style={toolbarStyle}>
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
          <h3 style={titleStyle}>正式创建售后单 / Formal After-sales Create</h3>
          <p style={subStyle}>
            先承接售后类型、问题描述与业务来源关联字段，创建成功后直接进入正式售后详情页。
          </p>
        </article>

        <article style={formPanelStyle}>
          <CreateFormalAfterSalesForm
            customerOptions={customerOptions}
            supplierOptions={supplierOptions}
            createdBy={resolveUserId(session.user)}
            role={session.role}
            user={session.user}
            access={encodeAccessScopes(session.accessScopes)}
            defaultSalesOrderId={readParam(resolvedSearchParams.salesOrderId)}
            defaultPurchaseOrderId={readParam(resolvedSearchParams.purchaseOrderId)}
            defaultShipmentBatchId={readParam(resolvedSearchParams.shipmentBatchId)}
          />
        </article>
      </section>
    </AppShell>
  );
}
