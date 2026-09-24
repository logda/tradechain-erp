import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { StatStrip } from '../_components/stat-strip';
import { WorktileCard } from '../_components/worktile-card';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import { canUseFormalMasterDataActions } from '../_lib/formal-access';

type SearchParams = Record<string, string | string[] | undefined>;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '18px',
} satisfies React.CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const metaStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const quickActionStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const quickActionLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
  border: '1px solid #d7e0ea',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const deniedStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: '#ffffff',
  padding: '24px',
} satisfies React.CSSProperties;

export default async function AppMasterDataPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'home')) {
    return (
      <AppShell
        title="主数据中心"
        subtitle="当前账号无法访问正式工作台。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问主数据中心</h2>
          <p>请先切换到有效正式账号。</p>
        </section>
      </AppShell>
    );
  }

  const canEditMasterData = canUseFormalMasterDataActions(session);
  const canEditCounterparties = session.accessScopes?.actions?.includes('counterparty.write') ?? true;

  return (
    <AppShell
      title="主数据中心"
      subtitle="统一维护客户、供应商和商品/SKU，作为销售、采购和履约的基础。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '主数据范围', value: '客户 / 供应商 / SKU' },
          { label: '写入权限', value: canEditMasterData || canEditCounterparties ? '可编辑' : '只读' },
          { label: '业务覆盖', value: '销售 / 采购 / 运营' },
        ]}
      />

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>核心模块</h2>
          <p style={metaStyle}>先进入主数据，再给销售、采购和运营单据提供引用基础。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="往来单位"
            href="/app/master-data/counterparties"
            description="客户、供应商、客户兼供应商统一管理。"
            badge="Counterparty"
          />
          {canViewFormalModule(session, 'admin') ? (
            <WorktileCard
              title="商品 / SKU"
              href="/app/master-data/products"
              description="中文名、英文名、SKU、单位、售价和采购价统一维护。"
              badge="Product"
            />
          ) : null}
          {canViewFormalModule(session, 'admin') ? (
            <WorktileCard
              title="产品编码规则"
              href="/app/master-data/product-code-rule"
              description="配置产品编码自动生成规则，支持供应商编码加序列号。"
              badge="Rule"
            />
          ) : null}
          {canViewFormalModule(session, 'admin') ? (
            <WorktileCard
              title="单据编号规则"
              href="/app/master-data/document-code-rule"
              description="配置需求单号、报价单号与客户订单号自动生成规则，支持年月日加流水号。"
              badge="Rule"
            />
          ) : null}
          {canViewFormalModule(session, 'admin') ? (
            <WorktileCard
              title="报价来源字典"
              href="/app/master-data/quote-source"
              description="维护正式报价单的来源渠道，如线上、TikTok、展会、转介绍。"
              badge="Source"
            />
          ) : null}
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>快捷入口</h2>
          <p style={metaStyle}>按当前岗位权限进入对应的主数据页面。</p>
        </div>
        <div style={quickActionStyle}>
          <Link href="/app/master-data/counterparties" style={quickActionLinkStyle}>
            查看往来单位
          </Link>
          {canViewFormalModule(session, 'admin') ? (
            <Link href="/app/master-data/products" style={quickActionLinkStyle}>
              查看商品 / SKU
            </Link>
          ) : null}
          {canEditCounterparties ? (
            <Link href="/app/master-data/counterparties" style={quickActionLinkStyle}>
              新增往来单位
            </Link>
          ) : null}
          {canEditMasterData && canViewFormalModule(session, 'admin') ? (
            <Link href="/app/master-data/products" style={quickActionLinkStyle}>
              新增商品 / SKU
            </Link>
          ) : null}
          {canEditMasterData && canViewFormalModule(session, 'admin') ? (
            <Link href="/app/master-data/product-code-rule" style={quickActionLinkStyle}>
              配置产品编码规则
            </Link>
          ) : null}
          {canEditMasterData && canViewFormalModule(session, 'admin') ? (
            <Link href="/app/master-data/document-code-rule" style={quickActionLinkStyle}>
              配置单据编号规则
            </Link>
          ) : null}
          {canEditMasterData && canViewFormalModule(session, 'admin') ? (
            <Link href="/app/master-data/quote-source" style={quickActionLinkStyle}>
              维护报价来源字典
            </Link>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
