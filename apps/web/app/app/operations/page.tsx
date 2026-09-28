import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { WorktileCard } from '../_components/worktile-card';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import {
  canUseFormalAfterSalesProcessActions,
  canUseFormalShipmentUpdateActions,
} from '../_lib/formal-access';

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

export default async function AppOperationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'operations')) {
    return (
      <AppShell
        title="运营工作台"
        subtitle="当前角色不在运营域内，不能查看发货批次和售后闭环入口。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问运营工作台</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="运营工作台"
      subtitle="运营入口聚合发货批次、回单状态、售后处理与财务闭环。"
      session={session}
    >
      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>核心模块</h2>
          <p style={metaStyle}>运营侧重点看发货进度、货代节点、回单发送与售后闭环。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="库存中心"
            href="/app/inventory"
            description="查看库存余额和出入库台账。"
            badge="Inventory"
          />
          <WorktileCard
            title="发货批次模块"
            href="/app/shipment-batches"
            description="分批发货、货代发出、到港到仓、回单状态与发送。"
            badge="Shipment"
          />
          <WorktileCard
            title="售后模块"
            href="/app/after-sales"
            description="售后处理、责任跟进、财务复核、收款状态和闭环确认。"
            badge="After-sales"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>快捷入口</h2>
          <p style={metaStyle}>快速创建单据或查找需要跟进的业务。</p>
        </div>
        <div style={quickActionStyle}>
          {canUseFormalShipmentUpdateActions(session) ? (
            <Link href="/app/shipment-batches/new" style={quickActionLinkStyle}>
              新建发货批次
            </Link>
          ) : null}
          <Link
            href="/app/shipment-batches?receiptSendStatus=pending"
            style={quickActionLinkStyle}
          >
            待发送回单
          </Link>
          {canUseFormalAfterSalesProcessActions(session) ? (
            <Link href="/app/after-sales/new" style={quickActionLinkStyle}>
              新建售后单
            </Link>
          ) : null}
          <Link
            href="/app/after-sales?status=finance_reviewing"
            style={quickActionLinkStyle}
          >
            财务待复核售后
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
