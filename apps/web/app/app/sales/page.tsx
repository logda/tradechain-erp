import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { WorktileCard } from '../_components/worktile-card';
import { StatStrip } from '../_components/stat-strip';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../_lib/demo-session';
import { getFormalTodos } from '../_lib/formal-todos';
import { loadFormalTodos } from '../_lib/load-formal-todos';
import { DataScopeNote } from '../_components/data-scope-note';
import { DataLoadError } from '../_components/data-load-error';
import { TodoGroup } from '../_components/todo-group';
import { canUseFormalSalesOrderActions } from '../_lib/formal-access';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SalesSummary = {
  generatedAt: string;
  scope?: { dataScope: string; timeRange: string };
  currency: string;
  totals: {
    salesOrderCount: number;
    submittedAmount: number;
    shippedAmount: number;
    voidedAmount: number;
  };
  afterSalesOverview: {
    openCases: number;
    pendingApproval: number;
    processing: number;
    financeReviewing: number;
    closedThisMonth: number;
  };
  shipmentBreakdown: Array<{
    status: string;
    count: number;
  }>;
  receiptBreakdown: Array<{
    status: string;
    count: number;
  }>;
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

const sectionTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const sectionMetaStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const todoStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.88)',
  padding: '22px',
  boxShadow: '0 16px 52px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const quickActionStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '8px',
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

function normalizeBreakdown(
  value: unknown,
): Array<{
  status: string;
  count: number;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as { status?: unknown; count?: unknown };

    return [
      {
        status: typeof entry.status === 'string' ? entry.status : 'unknown',
        count: normalizeNumber(entry.count),
      },
    ];
  });
}

function normalizeSalesSummary(value: unknown): SalesSummary {
  const summary =
    typeof value === 'object' && value !== null ? (value as Partial<SalesSummary>) : {};

  return {
    generatedAt: typeof summary.generatedAt === 'string' && !Number.isNaN(Date.parse(summary.generatedAt)) ? summary.generatedAt : new Date().toISOString(),
    scope: summary.scope,
    currency: typeof summary.currency === 'string' ? summary.currency : 'CNY',
    totals: {
      salesOrderCount: normalizeNumber(summary.totals?.salesOrderCount),
      submittedAmount: normalizeNumber(summary.totals?.submittedAmount),
      shippedAmount: normalizeNumber(summary.totals?.shippedAmount),
      voidedAmount: normalizeNumber(summary.totals?.voidedAmount),
    },
    afterSalesOverview: {
      openCases: normalizeNumber(summary.afterSalesOverview?.openCases),
      pendingApproval: normalizeNumber(summary.afterSalesOverview?.pendingApproval),
      processing: normalizeNumber(summary.afterSalesOverview?.processing),
      financeReviewing: normalizeNumber(summary.afterSalesOverview?.financeReviewing),
      closedThisMonth: normalizeNumber(summary.afterSalesOverview?.closedThisMonth),
    },
    shipmentBreakdown: normalizeBreakdown(summary.shipmentBreakdown),
    receiptBreakdown: normalizeBreakdown(summary.receiptBreakdown),
  };
}

async function loadSalesSummary(session: Parameters<typeof buildFormalApiRequestHeaders>[0]) {
  try {
    const response = await fetch(`${getReportApiBaseUrl()}/reports/sales-summary`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const value = (await response.json().catch(() => null)) as unknown;
    const data = value as Partial<SalesSummary> | null;
    if (!data?.totals || ![data.totals.salesOrderCount, data.totals.submittedAmount, data.totals.shippedAmount, data.totals.voidedAmount].every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
    return normalizeSalesSummary(data);
  } catch {
    return null;
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AppSalesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canCreateSalesOrder = canUseFormalSalesOrderActions(session);

  if (!canViewFormalModule(session, 'sales')) {
    return (
      <AppShell
        title="销售工作台"
        subtitle="当前角色不在销售域内，不能查看报价与销售单模块。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问销售工作台</h2>
          <p>请切换到销售、销售主管或老板视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const [liveTodos, salesSummary] = await Promise.all([loadFormalTodos(session), loadSalesSummary(session)]);
  const todoItems = getFormalTodos(session, liveTodos?.items ?? []).filter((todo) => todo.domain === 'sales');

  return (
    <AppShell
      title="销售工作台"
      subtitle="查看销售进度、常用业务和待办。"
      session={session}
      todoCountOverride={liveTodos?.total ?? null}
    >
      <DataScopeNote session={session} dataScope={salesSummary?.scope?.dataScope} generatedAt={salesSummary?.generatedAt} timeRange={salesSummary?.scope?.timeRange} />
      {salesSummary ? <StatStrip
        items={[
          { label: '销售单总数', value: salesSummary.totals.salesOrderCount },
          { label: '提交金额', value: salesSummary.totals.submittedAmount.toLocaleString('zh-CN') },
          { label: '已发货金额', value: salesSummary.totals.shippedAmount.toLocaleString('zh-CN') },
          { label: '作废金额', value: salesSummary.totals.voidedAmount.toLocaleString('zh-CN') },
        ]}
      /> : <DataLoadError label="销售统计" />}
      {salesSummary ? <p style={sectionMetaStyle}>金额单位：人民币元。提交金额不含草稿、驳回和作废；已发货金额按采购实际发货数量与销售价计算；作废金额按作废销售单整单计算。</p> : null}

      <section style={sectionStyle}>
        <div>
          <h2 style={sectionTitleStyle}>核心模块</h2>
          <p style={sectionMetaStyle}>先进入报价、销售单与待办，减少首页噪音。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="需求/报价模块"
            href="/app/sales/quotes"
            description="需求单可选择产品库产品或手填新产品；报价单只选择产品库产品，并在老板定价后由销售记录客户反馈。"
            badge="Demand / Quote"
          />
          <WorktileCard
            title="销售单模块"
            href="/app/sales/orders"
            description="查看销售单、来源和履约进度。"
            badge="Sales Order"
          />
          <WorktileCard
            title="发货单模块"
            href="/app/shipment-batches"
            description="销售只读查看货代发货日期、预计到货时间、客户、货物名称、到货情况与备注。"
            badge="Shipment"
          />
          <WorktileCard
            title="销售待办"
            href="/app/todos"
            description="查看需要处理和正在跟进的销售业务。"
            badge="Todo"
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div>
          <h2 style={sectionTitleStyle}>辅助模块</h2>
          <p style={sectionMetaStyle}>样品保留在这里，避免和主流程抢视觉焦点。</p>
        </div>
        <div style={gridStyle}>
          <WorktileCard
            title="样品模块"
            href="/app/sales/samples"
            description="查看样品单、来源报价和历史版本。"
            badge="Sample"
          />
        </div>
      </section>

      <section id="todo" style={todoStyle} data-todo-block>
        <DataScopeNote session={session} generatedAt={liveTodos?.generatedAt} />
        {liveTodos ? <TodoGroup title="销售待办" todos={todoItems} /> : <DataLoadError label="待办" />}
        <div style={quickActionStyle}>
          {canCreateSalesOrder ? (
            <Link
              href="/app/sales/orders/new"
              style={quickActionLinkStyle}
            >
              直接新建销售单
            </Link>
          ) : null}
          <Link
            href="/app/sales/orders?hasAfterSales=yes"
            style={quickActionLinkStyle}
          >
            查看有售后销售单
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
