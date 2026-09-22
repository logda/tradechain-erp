import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { StatStrip } from '../_components/stat-strip';
import { WorktileCard } from '../_components/worktile-card';
import { canViewFormalModule, resolveDemoSession } from '../_lib/demo-session';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

type GrossProfitSummary = {
  generatedAt: string;
  currency: string;
  totalRevenue: number;
  totalProcurementCost: number;
  totalAfterSalesCost: number;
  grossProfit: number;
  grossMargin: number;
};

type PeriodSummary = {
  generatedAt: string;
  period: string;
  salesOrdersCreated: number;
  purchaseOrdersCreated: number;
  shipmentBatchesCreated: number;
  afterSalesCreated: number;
  closedOrders: number;
  reopenedApprovals: number;
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

function getReportApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeGrossProfitSummary(value: unknown): GrossProfitSummary {
  const summary =
    typeof value === 'object' && value !== null ? (value as Partial<GrossProfitSummary>) : {};

  return {
    generatedAt: typeof summary.generatedAt === 'string' ? summary.generatedAt : '',
    currency: typeof summary.currency === 'string' ? summary.currency : 'CNY',
    totalRevenue: normalizeNumber(summary.totalRevenue),
    totalProcurementCost: normalizeNumber(summary.totalProcurementCost),
    totalAfterSalesCost: normalizeNumber(summary.totalAfterSalesCost),
    grossProfit: normalizeNumber(summary.grossProfit),
    grossMargin: normalizeNumber(summary.grossMargin),
  };
}

function normalizePeriodSummary(value: unknown): PeriodSummary {
  const summary =
    typeof value === 'object' && value !== null ? (value as Partial<PeriodSummary>) : {};

  return {
    generatedAt: typeof summary.generatedAt === 'string' ? summary.generatedAt : '',
    period: typeof summary.period === 'string' ? summary.period : '',
    salesOrdersCreated: normalizeNumber(summary.salesOrdersCreated),
    purchaseOrdersCreated: normalizeNumber(summary.purchaseOrdersCreated),
    shipmentBatchesCreated: normalizeNumber(summary.shipmentBatchesCreated),
    afterSalesCreated: normalizeNumber(summary.afterSalesCreated),
    closedOrders: normalizeNumber(summary.closedOrders),
    reopenedApprovals: normalizeNumber(summary.reopenedApprovals),
  };
}

async function loadSummary<T>(
  endpoint: string,
  normalizer: (value: unknown) => T,
  session: { role: string; user: string },
) {
  try {
    const response = await fetch(`${getReportApiBaseUrl()}${endpoint}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return normalizer(null);
    }

    const value = (await response.json().catch(() => null)) as unknown;
    return normalizer(value);
  } catch {
    return normalizer(null);
  }
}

export default async function AppReportsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'boss')) {
    return (
      <AppShell
        title="报表中心"
        subtitle="当前角色不在老板视角内，不能查看报表中心。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问报表中心</h2>
          <p>请切换到老板、销售主管、采购主管或管理员视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const grossProfit = await loadSummary(
    '/reports/gross-profit',
    normalizeGrossProfitSummary,
    session,
  );

  const period = await loadSummary(
    '/reports/period-summary',
    normalizePeriodSummary,
    session,
  );

  return (
    <AppShell
      title="报表中心"
      subtitle="把毛利、期间汇总和经营指标从老板看板中拆出来，作为独立报表入口。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '毛利', value: grossProfit.grossProfit.toLocaleString('zh-CN') },
          { label: '毛利率', value: `${(grossProfit.grossMargin * 100).toFixed(1)}%` },
          { label: '期间单据', value: period.salesOrdersCreated + period.purchaseOrdersCreated },
          { label: '重提审批', value: period.reopenedApprovals },
        ]}
      />

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>核心模块</h2>
          <p style={metaStyle}>老板和财务先看报表，再跳回销售、采购、售后明细。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="毛利报表"
            href="/app/dashboard/boss"
            description="查看收入、采购成本、售后成本、毛利和毛利率。"
            badge="Gross Profit"
          />
          <WorktileCard
            title="期间汇总"
            href="/app/dashboard/boss"
            description="查看期间新增销售单、采购单、发货和售后单。"
            badge="Period"
          />
          <WorktileCard
            title="老板看板"
            href="/app/dashboard/boss"
            description="回到经营总览，继续查看待办和业务分布。"
            badge="Dashboard"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={titleStyle}>快捷入口</h2>
          <p style={metaStyle}>常用报表跳转先放在最前面。</p>
        </div>
        <div style={quickActionStyle}>
          <Link href="/app/dashboard/boss" style={quickActionLinkStyle}>
            进入老板看板
          </Link>
          <Link href="/app/sales/orders?financeConfirmStatus=pending" style={quickActionLinkStyle}>
            回款待确认
          </Link>
          <Link href="/app/after-sales?financeReviewStatus=pending" style={quickActionLinkStyle}>
            售后财务复核
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
