import { AppShell } from '../../../_components/app-shell';
import { resolveDemoSession } from '../../../_lib/demo-session';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { loadActiveProductOptions } from '../../../_lib/product-options';
import { loadQuoteSourceOptions } from '../../../_lib/quote-source-options';
import {
  loadSalesUserOptions,
  resolveDefaultSalesUserId,
} from '../../../_lib/sales-user-options';
import { canUseFormalQuoteActions } from '../../../_lib/formal-access';
import { CreateFormalQuoteForm } from './create-formal-quote-form';
type SearchParams = Record<string, string | string[] | undefined>;

const shellBodyStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, #edf4ff 100%)',
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

export default async function AppNewFormalQuotePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  if (!canUseFormalQuoteActions(session)) {
    return (
      <AppShell
        title="正式新建需求和报价"
        subtitle="当前角色不具备需求和报价创建权限，不能创建单据。"
        session={session}
      >
        <section style={formPanelStyle}>
          <h2>无权限创建正式需求和报价</h2>
          <p>请切换到销售、销售主管、老板或管理员账号后再创建单据。</p>
        </section>
      </AppShell>
    );
  }

  const customerOptions = await loadActiveCounterpartyOptions('customer', session);
  const productOptions = await loadActiveProductOptions(session);
  const salesUsers = await loadSalesUserOptions(session);
  const defaultSalesUserId = resolveDefaultSalesUserId(session, salesUsers);
  const sourceOptions = await loadQuoteSourceOptions(session);

  return (
    <AppShell
      title="正式新建需求和报价"
      subtitle="需求单可选择产品库产品或手填新产品；报价单只选择产品库产品。"
      session={session}
    >
      <section style={shellBodyStyle}>

        <article style={heroCardStyle}>
          <h3 style={titleStyle}>正式需求和报价创建 / Formal Quote Create</h3>
          <p style={subStyle}>
            承接客户编号、负责人、来源渠道与需求说明，创建成功后按单据类型跳转到对应详情页。
          </p>
        </article>

        <article style={formPanelStyle}>
          <CreateFormalQuoteForm
            customerOptions={customerOptions}
            productOptions={productOptions}
            salesUsers={salesUsers}
            sourceOptions={sourceOptions}
            defaultSalesUserId={defaultSalesUserId}
            role={session.role}
            user={session.user}
            access={encodeAccessScopes(session.accessScopes)}
          />
        </article>
      </section>
    </AppShell>
  );
}
