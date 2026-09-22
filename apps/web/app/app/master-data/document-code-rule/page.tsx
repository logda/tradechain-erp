import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { canUseFormalMasterDataActions } from '../../_lib/formal-access';
import {
  defaultCustomerOrderNoRule,
  defaultDemandNoRule,
  defaultQuoteNoRule,
  normalizeDocumentCodeRule,
  type DocumentCodeRule,
} from './document-code-rule';
import { DocumentCodeRulePageClient } from './document-code-rule-page-client';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

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

type DocumentCodeRuleSet = {
  demandNoRule: DocumentCodeRule;
  quoteNoRule: DocumentCodeRule;
  customerOrderNoRule: DocumentCodeRule;
};

function hasValidDocumentCodeRule(value: unknown): value is DocumentCodeRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as DocumentCodeRule).strategy === 'composed_segments' &&
    typeof (value as DocumentCodeRule).serialLength === 'number' &&
    typeof (value as DocumentCodeRule).serialScope === 'string' &&
    Array.isArray((value as DocumentCodeRule).segments) &&
    typeof (value as DocumentCodeRule).updatedAt === 'string' &&
    typeof (value as DocumentCodeRule).updatedBy === 'string'
  );
}

function hasValidRuleSet(value: unknown): value is DocumentCodeRuleSet {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasValidDocumentCodeRule((value as DocumentCodeRuleSet).demandNoRule) &&
    hasValidDocumentCodeRule((value as DocumentCodeRuleSet).quoteNoRule) &&
    hasValidDocumentCodeRule((value as DocumentCodeRuleSet).customerOrderNoRule)
  );
}

function buildFallbackRuleSet(): DocumentCodeRuleSet {
  return {
    demandNoRule: defaultDemandNoRule,
    quoteNoRule: defaultQuoteNoRule,
    customerOrderNoRule: defaultCustomerOrderNoRule,
  };
}

async function loadRuleSet(session: ReturnType<typeof resolveDemoSession>) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/document-code-rules`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return buildFallbackRuleSet();
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidRuleSet(result)
      ? {
          demandNoRule: normalizeDocumentCodeRule(result.demandNoRule),
          quoteNoRule: normalizeDocumentCodeRule(result.quoteNoRule),
          customerOrderNoRule: normalizeDocumentCodeRule(result.customerOrderNoRule),
        }
      : buildFallbackRuleSet();
  } catch {
    return buildFallbackRuleSet();
  }
}

export default async function AppDocumentCodeRulePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canManageMasterData = canUseFormalMasterDataActions(session);

  if (!canViewFormalModule(session, 'admin')) {
    return (
      <AppShell
        title="单据编号规则"
        subtitle="当前角色不具备单据编号规则查看权限。"
        session={session}
      >
        <section style={sectionStyle}>
          <h2>无权限访问单据编号规则</h2>
          <p>请切换到管理员账号后再配置需求单号、报价单号和客户订单号规则。</p>
        </section>
      </AppShell>
    );
  }

  const ruleSet = await loadRuleSet(session);

  return (
    <AppShell
      title="单据编号规则"
      subtitle="统一配置需求单号、报价单号和客户订单号的自动生成规则，作为主数据中心的一部分。"
      session={session}
    >
      <section style={sectionStyle}>
        <Link href="/app/master-data" style={linkStyle}>
          返回主数据中心
        </Link>
        {canManageMasterData ? (
          <DocumentCodeRulePageClient
            endpoint={`${getApiBaseUrl()}/document-code-rules`}
            initialRuleSet={ruleSet}
            updatedBy={session.user}
            actorAccessScopes={session.accessScopes}
          />
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>当前角色仅可查看单据编号规则。</p>
        )}
      </section>
    </AppShell>
  );
}
