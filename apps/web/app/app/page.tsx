import Link from 'next/link';
import { WorktileCard } from './_components/worktile-card';
import { AppShell } from './_components/app-shell';
import {
  canViewFormalAuditCenter,
  canViewFormalModule,
  resolveDemoSession,
  type DemoSession,
} from './_lib/demo-session';
import { StatStrip } from './_components/stat-strip';
import { getFormalTodos, type FormalTodoItem } from './_lib/formal-todos';
import { buildFormalApiRequestHeaders } from './_lib/formal-api-request-headers';

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '18px',
} satisfies React.CSSProperties;

const todoLayerGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const todoLayerCardStyle = {
  border: '1px solid #d7e0ea',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.9)',
  padding: '18px',
  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const todoLayerTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const todoLayerValueStyle = {
  margin: '10px 0 0',
  fontSize: '28px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const todoLayerLinkStyle = {
  display: 'inline-flex',
  marginTop: '14px',
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

type SearchParams = Record<string, string | string[] | undefined>;

type FormalTodoApiResponse = {
  items: FormalTodoItem[];
  total: number;
  closedTotal: number;
};

function getTodoApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidFormalTodoApiResponse(
  value: unknown,
): value is FormalTodoApiResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as FormalTodoApiResponse).items) &&
    typeof (value as FormalTodoApiResponse).closedTotal === 'number'
  );
}

function buildFormalTodoApiUrl(session: DemoSession) {
  const params = new URLSearchParams({
    role: session.role,
    user: session.user,
  });

  return `${getTodoApiBaseUrl()}/todos/formal?${params.toString()}`;
}

async function loadFormalTodos(session: DemoSession) {
  try {
    const response = await fetch(buildFormalTodoApiUrl(session), {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidFormalTodoApiResponse(result) ? result : null;
  } catch {
    return null;
  }
}

function countByDomain(items: FormalTodoItem[], domains: FormalTodoItem['domain'][]) {
  return items.filter((item) => domains.includes(item.domain)).length;
}

export default async function AppHomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const liveTodos = await loadFormalTodos(session);
  const visibleTodos = getFormalTodos(session, liveTodos?.items);
  const closedTodoCount = liveTodos?.closedTotal ?? 0;

  return (
    <AppShell
      title="ERP 正式工作台"
      subtitle="当前已开放销售、采购、发货、售后、财务、主数据与老板看板入口。"
      session={session}
      todoCountOverride={visibleTodos.length}
    >
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>首页待办摘要</h3>
        <StatStrip
          items={[
            { label: '全部待办', value: visibleTodos.length },
            { label: '销售待办', value: countByDomain(visibleTodos, ['sales']) },
            {
              label: '采购运营待办',
              value: countByDomain(visibleTodos, [
                'purchase',
                'operations',
                'after_sales',
              ]),
            },
            { label: '已自动收口', value: closedTodoCount },
          ]}
        />
      </section>

      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>待办分层</h3>
        <div style={todoLayerGridStyle}>
          <article style={todoLayerCardStyle}>
            <p style={todoLayerTitleStyle}>销售待办</p>
            <p style={todoLayerValueStyle}>{countByDomain(visibleTodos, ['sales'])}</p>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>报价、销售单与销售闭环</p>
            <Link href="/app/todos#sales" style={todoLayerLinkStyle}>
              查看销售待办
            </Link>
          </article>
          <article style={todoLayerCardStyle}>
            <p style={todoLayerTitleStyle}>采购与运营待办</p>
            <p style={todoLayerValueStyle}>
              {countByDomain(visibleTodos, ['purchase', 'operations'])}
            </p>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>采购、发货与异常处理</p>
            <Link href="/app/todos#purchase" style={todoLayerLinkStyle}>
              查看采购与运营待办
            </Link>
          </article>
          <article style={todoLayerCardStyle}>
            <p style={todoLayerTitleStyle}>售后待办</p>
            <p style={todoLayerValueStyle}>{countByDomain(visibleTodos, ['after_sales'])}</p>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>售后处理与财务复核</p>
            <Link href="/app/todos#after-sales" style={todoLayerLinkStyle}>
              查看售后待办
            </Link>
          </article>
        </div>
      </section>

      <section style={gridStyle}>
        {session.role === 'admin' ? (
          <WorktileCard
            title="用户管理"
            href="/app/admin/users"
            description="管理员可以新增用户、注销用户，并查看当前账号的业务权限覆盖范围。"
            badge="Admin"
          />
        ) : null}
        <WorktileCard
          title="主数据中心"
          href="/app/master-data"
          description="先进入主数据中心，再分流到往来单位与商品 / SKU 维护。"
          badge="Master Data"
        />
        {canViewFormalModule(session, 'admin') ? (
          <WorktileCard
            title="商品 / SKU 主数据"
            href="/app/master-data/products"
            description="统一维护 SKU、中文名、英文名、分类、单位和价格，作为明细行基础。"
            badge="Product"
          />
        ) : null}
        {canViewFormalModule(session, 'sales') ? (
          <WorktileCard
            title="销售工作台"
            href="/app/sales"
            description="进入正式销售入口，查看需求/报价模块、销售单模块与待办汇总。"
            badge="Sales"
          />
        ) : null}
        <WorktileCard
          title="正式待办中心"
          href="/app/todos"
          description="按当前账号分层聚合销售、采购与运营、售后待办，遵循角色和数据权限。"
          badge="Todo"
        />
        {canViewFormalModule(session, 'boss') ? (
          <WorktileCard
            title="老板看板"
            href="/app/dashboard/boss"
            description="查看待办总览、销售汇总、采购汇总与财务回款。"
            badge="Dashboard"
          />
        ) : null}
        {canViewFormalModule(session, 'boss') ? (
          <WorktileCard
            title="财务中心"
            href="/app/finance"
            description="聚合销售回款、售后财务复核与财务确认入口。"
            badge="Finance"
          />
        ) : null}
        {canViewFormalModule(session, 'boss') ? (
          <WorktileCard
            title="报表中心"
            href="/app/reports"
            description="查看毛利报表、期间汇总和经营指标。"
            badge="Reports"
          />
        ) : null}
        {canViewFormalAuditCenter(session) ? (
          <WorktileCard
            title="日志中心"
            href="/app/logs"
            description="集中查看报价、销售、采购、发货、售后和主数据操作日志。"
            badge="Audit"
          />
        ) : null}
        {canViewFormalModule(session, 'purchase') ? (
          <WorktileCard
            title="采购工作台"
            href="/app/purchase"
            description="进入采购入口，查看采购单、发货协同、售后协同与采购待办。"
            badge="Purchase"
          />
        ) : null}
        {canViewFormalModule(session, 'operations') ? (
          <>
            <WorktileCard
              title="运营工作台"
              href="/app/operations"
              description="进入运营入口，聚合发货批次、回单状态、售后处理与财务闭环。"
              badge="Operations"
            />
            <WorktileCard
              title="正式发货批次"
              href="/app/shipment-batches"
              description="查看分批发货、异常批次、回单发送与采购销售关联。"
              badge="Shipment"
            />
            <WorktileCard
              title="正式售后单"
              href="/app/after-sales"
              description="查看售后类型、财务复核、收款状态与发货批次追溯。"
              badge="After-sales"
            />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
