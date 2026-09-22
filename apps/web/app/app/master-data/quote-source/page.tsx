import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { canUseFormalMasterDataActions } from '../../_lib/formal-access';
import { loadQuoteSourceOptions } from '../../_lib/quote-source-options';
import { QuoteSourcePageClient } from './quote-source-page-client';

type SearchParams = Record<string, string | string[] | undefined>;

const sectionStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const linkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

function getApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

export default async function AppQuoteSourcePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canManageMasterData = canUseFormalMasterDataActions(session);

  if (!canViewFormalModule(session, 'admin')) {
    return (
      <AppShell title="报价来源字典" subtitle="当前角色不具备来源字典查看权限。" session={session}>
        <section style={sectionStyle}>
          <h2>无权限访问报价来源字典</h2>
          <p>请切换到管理员账号后再维护报价来源。</p>
        </section>
      </AppShell>
    );
  }

  const items = await loadQuoteSourceOptions(session, { includeDisabled: true });

  return (
    <AppShell
      title="报价来源字典"
      subtitle="统一维护正式报价单的来源渠道，用于销售录单时选择。"
      session={session}
    >
      <section style={sectionStyle}>
        <Link href="/app/master-data" style={linkStyle}>
          返回主数据中心
        </Link>
        <div>
          <h2 style={{ margin: '0 0 10px' }}>来源维护说明</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.8 }}>
            支持维护线上、TikTok、展会、转介绍等来源，正式报价单创建页会直接读取这里的启用项。
          </p>
        </div>
        {canManageMasterData ? (
          <QuoteSourcePageClient
            endpoint={`${getApiBaseUrl()}/quote-sources`}
            updatedBy={session.user}
            actorAccessScopes={session.accessScopes}
            initialItems={items}
          />
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>当前角色仅可查看报价来源字典。</p>
        )}
      </section>
    </AppShell>
  );
}
