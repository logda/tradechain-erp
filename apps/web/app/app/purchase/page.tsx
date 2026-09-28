import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { WorktileCard } from '../_components/worktile-card';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import {
  canCreateFormalPurchaseOrder,
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

export default async function AppPurchasePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'purchase')) {
    return (
      <AppShell
        title="采购工作台"
        subtitle="当前角色不在采购域内，不能查看采购单、发货与售后协同入口。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问采购工作台</h2>
          <p>请切换到采购、采购主管、老板或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="采购工作台"
      subtitle="查看询价、采购、发货和售后业务。"
      session={session}
    >
      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>核心模块</h2>
          <p style={metaStyle}>采购侧先处理采购单，再承接发货批次与售后闭环。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="询价单模块"
            href="/app/sales/inquiries"
            description="承接销售提交后的待询价单，采购补录供应商、询价单位与采购价格。"
            badge="Inquiry"
          />
          <WorktileCard
            title="采购单模块"
            href="/app/purchase-orders"
            description="采购拆单、采购主管审批、改单重提、取消与销售来源追溯。"
            badge="Purchase"
          />
          <WorktileCard
            title="仓库中心"
            href="/app/warehouses"
            description="查看仓库主数据、库位规模和后续收货入库承接入口。"
            badge="Warehouse"
          />
          <WorktileCard
            title="发货单模块"
            href="/app/shipment-batches"
            description="多批次发货、货代节点、到港到仓、回单发送与异常标记。"
            badge="Shipment"
          />
          <WorktileCard
            title="售后协同"
            href="/app/after-sales"
            description="售后申请、处理、财务复核、收款状态与闭环追溯。"
            badge="After-sales"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>快捷入口</h2>
          <p style={metaStyle}>常用动作直接从工作台进入，减少在列表里来回找。</p>
        </div>
        <div style={quickActionStyle}>
          {canCreateFormalPurchaseOrder(session) ? (
            <Link href="/app/purchase-orders/new" style={quickActionLinkStyle}>
              新建采购单
            </Link>
          ) : null}
          <Link
            href="/app/purchase-orders?approvalStatus=pending_purchase_manager_approval"
            style={quickActionLinkStyle}
          >
            待审批采购单
          </Link>
          <Link
            href="/app/sales/inquiries?status=pending_inquiry"
            style={quickActionLinkStyle}
          >
            待询价单
          </Link>
          {canUseFormalShipmentUpdateActions(session) ? (
            <Link href="/app/shipment-batches/new" style={quickActionLinkStyle}>
              创建发货批次
            </Link>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
