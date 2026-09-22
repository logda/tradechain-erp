import Link from 'next/link';
import { AppShell } from '../../_components/app-shell';
import { StatStrip } from '../../_components/stat-strip';
import {
  canViewFormalModule,
  resolveDemoSession,
  type DemoSession,
} from '../../_lib/demo-session';
import { buildFormalApiRequestHeaders } from '../../_lib/formal-api-request-headers';

type BossDashboardSummary = {
  generatedAt: string;
  workflowAlerts: Array<{
    key: string;
    label: string;
    count: number;
    severity?: string;
  }>;
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

const cardGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '18px',
} satisfies React.CSSProperties;

const cardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.88)',
  padding: '22px',
  boxShadow: '0 16px 52px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const listStyle = {
  margin: '12px 0 0',
  paddingLeft: '18px',
  color: '#475569',
  lineHeight: 1.8,
} satisfies React.CSSProperties;

const drilldownLinkStyle = {
  display: 'inline-flex',
  marginTop: '16px',
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '9px 13px',
  background: '#0f172a',
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 700,
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

function normalizeWorkflowAlerts(value: unknown): BossDashboardSummary['workflowAlerts'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const entry = item as {
      key?: unknown;
      label?: unknown;
      count?: unknown;
      severity?: unknown;
    };

    return [
      {
        key: typeof entry.key === 'string' ? entry.key : 'unknown',
        label: typeof entry.label === 'string' ? entry.label : '未命名提醒',
        count: normalizeNumber(entry.count),
        severity: typeof entry.severity === 'string' ? entry.severity : undefined,
      },
    ];
  });
}

function normalizeBossDashboardSummary(value: unknown): BossDashboardSummary {
  const summary =
    typeof value === 'object' && value !== null ? (value as Partial<BossDashboardSummary>) : {};

  return {
    generatedAt: typeof summary.generatedAt === 'string' ? summary.generatedAt : '',
    workflowAlerts: normalizeWorkflowAlerts(summary.workflowAlerts),
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

async function loadBossDashboardSummary(session: DemoSession) {
  try {
    const response = await fetch(`${getDashboardApiBaseUrl()}/dashboard/boss`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return normalizeBossDashboardSummary(null);
    }

    const value = (await response.json().catch(() => null)) as unknown;
    return normalizeBossDashboardSummary(value);
  } catch {
    return normalizeBossDashboardSummary(null);
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AppBossDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);

  if (!canViewFormalModule(session, 'boss')) {
    return (
      <AppShell
        title="老板看板"
        subtitle="当前角色不具备经营看板查看权限。"
        session={session}
      >
        <section style={deniedStyle}>
          <h2>无权限访问老板看板</h2>
          <p>请切换到老板、销售主管或采购主管视角后再查看。</p>
        </section>
      </AppShell>
    );
  }

  const summary = await loadBossDashboardSummary(session);
  const workflowAlertTotal = summary.workflowAlerts.reduce(
    (total, item) => total + item.count,
    0,
  );

  return (
    <AppShell
      title="老板看板"
      subtitle="正式看板优先承载待办总览、销售采购汇总、财务回款和异常提醒。"
      session={session}
    >
      <StatStrip
        items={[
          { label: '待办总量', value: workflowAlertTotal },
          { label: '销售总单', value: summary.salesOverview.totalOrders },
          { label: '采购总单', value: summary.purchaseOverview.totalOrders },
          { label: '财务待确认', value: summary.financeOverview.pendingConfirmation },
        ]}
      />

      <section style={cardGridStyle}>
        <article style={cardStyle}>
          <h2>待办总览</h2>
          <ul style={listStyle}>
            {summary.workflowAlerts.map((item) => (
              <li key={item.key}>
                {item.label}：{item.count} 条
              </li>
            ))}
          </ul>
          <Link href="/app/todos" style={drilldownLinkStyle}>
            查看待办明细
          </Link>
        </article>

        <article style={cardStyle}>
          <h2>销售汇总</h2>
          <ul style={listStyle}>
            <li>待审批销售单：{summary.salesOverview.pendingApproval} 条</li>
            <li>执行中销售单：{summary.salesOverview.inProduction} 条</li>
            <li>部分发货：{summary.salesOverview.partiallyShipped} 条</li>
            <li>已完成发货：{summary.salesOverview.fullyShipped} 条</li>
          </ul>
          <Link href="/app/sales/orders" style={drilldownLinkStyle}>
            查看销售单列表
          </Link>
        </article>

        <article style={cardStyle}>
          <h2>采购汇总</h2>
          <ul style={listStyle}>
            <li>待审批采购单：{summary.purchaseOverview.pendingApproval} 条</li>
            <li>执行中采购单：{summary.purchaseOverview.purchasing} 条</li>
            <li>部分到货：{summary.purchaseOverview.partiallyReceived} 条</li>
            <li>已完成采购：{summary.purchaseOverview.completed} 条</li>
          </ul>
          <Link href="/app/purchase-orders" style={drilldownLinkStyle}>
            查看采购单列表
          </Link>
          <Link
            href="/app/purchase-orders?approvalStatus=pending_purchase_manager_approval"
            style={{ ...drilldownLinkStyle, marginLeft: '10px' }}
          >
            查看待审批采购
          </Link>
          <Link
            href="/app/shipment-batches?hasException=yes"
            style={{ ...drilldownLinkStyle, marginLeft: '10px' }}
          >
            查看异常发货批次
          </Link>
        </article>

        <article style={cardStyle}>
          <h2>财务与回款</h2>
          <ul style={listStyle}>
            <li>待确认回款：{summary.financeOverview.pendingConfirmation} 条</li>
            <li>已确认回款：{summary.financeOverview.confirmedThisMonth} 条</li>
            <li>预收抵扣：{summary.financeOverview.prepaidDeducted} 条</li>
            <li>售后待闭环：{summary.afterSalesOverview.openCases} 条</li>
            <li>售后待审批：{summary.afterSalesOverview.pendingApproval} 条</li>
            <li>售后处理中：{summary.afterSalesOverview.processing} 条</li>
            <li>售后财务复核：{summary.afterSalesOverview.financeReviewing} 条</li>
            <li>售后已闭环：{summary.afterSalesOverview.closedThisMonth} 条</li>
          </ul>
          <Link href="/app/after-sales" style={drilldownLinkStyle}>
            查看售后闭环
          </Link>
          <Link
            href="/app/after-sales?financeReviewStatus=pending"
            style={{ ...drilldownLinkStyle, marginLeft: '10px' }}
          >
            查看财务复核售后
          </Link>
          <Link
            href="/app/sales/orders?financeConfirmStatus=pending"
            style={{ ...drilldownLinkStyle, marginLeft: '10px' }}
          >
            查看回款与财务
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
