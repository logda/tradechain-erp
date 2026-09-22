import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { StatStrip } from '../_components/stat-strip';
import { WorktileCard } from '../_components/worktile-card';
import { canViewFormalModule, resolveDemoSession } from '../_lib/demo-session';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';
import {
  canConfirmFormalAfterSalesFinance,
  canUseFormalSalesFinanceActions,
} from '../_lib/formal-access';

type SearchParams = Record<string, string | string[] | undefined>;

type FinanceDashboardResponse = {
  generatedAt: string;
  salesOverview: {
    totalOrders: number;
    pendingApproval: number;
    inProduction: number;
    partiallyShipped: number;
    fullyShipped: number;
  };
  purchaseOverview: {
    totalOrders: number;
    pendingApproval: number;
    purchasing: number;
    partiallyReceived: number;
    completed: number;
  };
  afterSalesOverview: {
    openCases: number;
    pendingApproval: number;
    processing: number;
    financeReviewing: number;
    closedThisMonth: number;
  };
  financeOverview: {
    pendingConfirmation: number;
    confirmedThisMonth: number;
    prepaidDeducted: number;
  };
};

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

function getDashboardApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeFinanceDashboard(value: unknown): FinanceDashboardResponse {
  const summary =
    typeof value === 'object' && value !== null ? (value as Partial<FinanceDashboardResponse>) : {};

  return {
    generatedAt: typeof summary.generatedAt === 'string' ? summary.generatedAt : '',
    salesOverview: {
      totalOrders: normalizeNumber(summary.salesOverview?.totalOrders),
      pendingApproval: normalizeNumber(summary.salesOverview?.pendingApproval),
      inProduction: normalizeNumber(summary.salesOverview?.inProduction),
      partiallyShipped: normalizeNumber(summary.salesOverview?.partiallyShipped),
      fullyShipped: normalizeNumber(summary.salesOverview?.fullyShipped),
    },
    purchaseOverview: {
      totalOrders: normalizeNumber(summary.purchaseOverview?.totalOrders),
      pendingApproval: normalizeNumber(summary.purchaseOverview?.pendingApproval),
      purchasing: normalizeNumber(summary.purchaseOverview?.purchasing),
      partiallyReceived: normalizeNumber(summary.purchaseOverview?.partiallyReceived),
      completed: normalizeNumber(summary.purchaseOverview?.completed),
    },
    afterSalesOverview: {
      openCases: normalizeNumber(summary.afterSalesOverview?.openCases),
      pendingApproval: normalizeNumber(summary.afterSalesOverview?.pendingApproval),
      processing: normalizeNumber(summary.afterSalesOverview?.processing),
      financeReviewing: normalizeNumber(summary.afterSalesOverview?.financeReviewing),
      closedThisMonth: normalizeNumber(summary.afterSalesOverview?.closedThisMonth),
    },
    financeOverview: {
      pendingConfirmation: normalizeNumber(summary.financeOverview?.pendingConfirmation),
      confirmedThisMonth: normalizeNumber(summary.financeOverview?.confirmedThisMonth),
      prepaidDeducted: normalizeNumber(summary.financeOverview?.prepaidDeducted),
    },
  };
}

async function loadFinanceDashboard(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getDashboardApiBaseUrl()}/dashboard/boss`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return normalizeFinanceDashboard(null);
    }

    const value = (await response.json().catch(() => null)) as unknown;
    return normalizeFinanceDashboard(value);
  } catch {
    return normalizeFinanceDashboard(null);
  }
}

export default async function AppFinancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'boss')) {
    return (
      <AppShell
        title="财务中心"
        subtitle="当前角色不在老板/财务视角内，不能查看财务中心。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问财务中心</h2>
          <p>请切换到老板、销售主管、采购主管或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const dashboard = await loadFinanceDashboard(session);

  const canSalesFinanceAction = canUseFormalSalesFinanceActions(session);
  const canAfterSalesFinanceAction = canConfirmFormalAfterSalesFinance(session);

  return (
    <AppShell
      title="财务中心"
      subtitle="聚合回款、财务确认与售后复核，作为财务视角的统一入口。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '待确认财务', value: dashboard.financeOverview.pendingConfirmation },
          { label: '本月已确认', value: dashboard.financeOverview.confirmedThisMonth },
          { label: '预付抵扣', value: dashboard.financeOverview.prepaidDeducted },
          { label: '售后财务复核', value: dashboard.afterSalesOverview.financeReviewing },
        ]}
      />

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>核心模块</h2>
          <p style={metaStyle}>财务先看回款，再看售后复核，必要时回到销售单和售后单处理。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="销售回款"
            href="/app/sales/orders?receiptStatus=unpaid"
            description="查看未收款、部分收款、已全款与财务确认状态。"
            badge="Sales Finance"
          />
          <WorktileCard
            title="售后财务复核"
            href="/app/after-sales?financeReviewStatus=pending"
            description="查看待财务复核的售后单与处理中的闭环。"
            badge="After-sales Finance"
          />
          <WorktileCard
            title="老板看板"
            href="/app/dashboard/boss"
            description="查看销售、采购、售后与财务的经营总览。"
            badge="Dashboard"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>快捷入口</h2>
          <p style={metaStyle}>把财务确认所需的高频跳转放在最前面。</p>
        </div>
        <div style={quickActionStyle}>
          {canSalesFinanceAction ? (
            <Link href="/app/sales/orders?financeConfirmStatus=pending" style={quickActionLinkStyle}>
              待确认销售单
            </Link>
          ) : null}
          {canAfterSalesFinanceAction ? (
            <Link href="/app/after-sales?financeReviewStatus=pending" style={quickActionLinkStyle}>
              待财务复核售后
            </Link>
          ) : null}
          <Link href="/app/sales/orders?receiptStatus=fully_paid" style={quickActionLinkStyle}>
            已全款销售单
          </Link>
          <Link href="/app/dashboard/boss" style={quickActionLinkStyle}>
            进入经营驾驶舱
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
