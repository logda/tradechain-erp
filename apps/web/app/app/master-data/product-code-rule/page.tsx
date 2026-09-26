import { AppShell } from '../../_components/app-shell';
import { canViewFormalModule, resolveDemoSession } from '../../_lib/demo-session';
import { canUseFormalProductActions } from '../../_lib/formal-access';
import {
  defaultProductCodeRule,
  defaultProductCodeRuleSet,
  defaultSalesProductCodeRule,
  normalizeProductCodeRule,
  type ProductCodeRule,
  type ProductCodeRuleSet,
} from '../products/product-code-rule';
import { ProductCodeRulePageClient } from './product-code-rule-page-client';
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

function getProductApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidProductCodeRuleResponse(value: unknown): value is ProductCodeRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProductCodeRule).strategy === 'composed_segments' &&
    typeof (value as ProductCodeRule).serialLength === 'number' &&
    typeof (value as ProductCodeRule).serialScope === 'string' &&
    Array.isArray((value as ProductCodeRule).segments) &&
    typeof (value as ProductCodeRule).updatedAt === 'string' &&
    typeof (value as ProductCodeRule).updatedBy === 'string'
  );
}

async function loadProductCodeRule(session: ReturnType<typeof resolveDemoSession>) {
  try {
    const response = await fetch(`${getProductApiBaseUrl()}/products/code-rules`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return defaultProductCodeRuleSet;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    if (
      typeof result === 'object' &&
      result !== null &&
      hasValidProductCodeRuleResponse((result as Partial<ProductCodeRuleSet>).purchase) &&
      hasValidProductCodeRuleResponse((result as Partial<ProductCodeRuleSet>).sales)
    ) {
      return {
        purchase: normalizeProductCodeRule(
          (result as ProductCodeRuleSet).purchase,
        ),
        sales: normalizeProductCodeRule((result as ProductCodeRuleSet).sales),
      };
    }
    if (hasValidProductCodeRuleResponse(result)) {
      return {
        purchase: normalizeProductCodeRule(result),
        sales: defaultSalesProductCodeRule,
      };
    }
    return defaultProductCodeRuleSet;
  } catch {
    return {
      purchase: defaultProductCodeRule,
      sales: defaultSalesProductCodeRule,
    };
  }
}

export default async function AppProductCodeRulePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canManageMasterData = canUseFormalProductActions(session);

  if (!canViewFormalModule(session, 'admin') && !canViewFormalModule(session, 'sales') && !canViewFormalModule(session, 'purchase')) {
    return (
      <AppShell
        title="产品编码规则"
        subtitle="当前角色不具备产品编码规则查看权限。"
        session={session}
      >
        <section style={sectionStyle}>
          <h2>无权限访问产品编码规则</h2>
          <p>请切换到管理员账号后再配置自动生成规则。</p>
        </section>
      </AppShell>
    );
  }

  const rules = await loadProductCodeRule(session);

  return (
    <AppShell
      title="产品编码规则"
      subtitle="统一配置产品编码自动生成方式，供产品资料新增时直接复用。"
      session={session}
    >
      <section style={sectionStyle}>
        {canManageMasterData ? (
          <ProductCodeRulePageClient
            endpointBase={`${getProductApiBaseUrl()}/products/code-rules`}
            initialRules={rules}
            updatedBy={session.user}
            actorAccessScopes={session.accessScopes}
          />
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>当前角色仅可查看产品编码规则。</p>
        )}
      </section>
    </AppShell>
  );
}
