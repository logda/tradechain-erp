import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { StatStrip } from '../_components/stat-strip';
import {
  getFormalClosedTodoCount,
  getFormalTodos,
  type FormalTodoItem,
} from '../_lib/formal-todos';
import {
  canViewFormalModule,
  resolveDemoSession,
  type DemoSession,
} from '../_lib/demo-session';
import { buildFormalApiRequestHeaders } from '../_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const cardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: '#ffffff',
  padding: '18px',
  display: 'grid',
  gap: '12px',
  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const cardHeadStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
} satisfies React.CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const docNoStyle = {
  margin: '8px 0 0',
  fontSize: '14px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const metaStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const badgeStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '5px 9px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#334155',
  background: '#f8fafc',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

const linkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const anchorCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background: '#f8fafc',
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
} satisfies React.CSSProperties;

function countByDomain(items: FormalTodoItem[], domain: FormalTodoItem['domain']) {
  return items.filter((item) => item.domain === domain).length;
}

function getPriorityLabel(priority: FormalTodoItem['priority']) {
  if (priority === 'high') {
    return '高优先级';
  }

  if (priority === 'medium') {
    return '中优先级';
  }

  return '低优先级';
}

function getDomainLabel(domain: FormalTodoItem['domain']) {
  if (domain === 'sales') return '销售';
  if (domain === 'purchase') return '采购';
  if (domain === 'operations') return '运营';
  return '售后';
}

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

function groupTodosByLayer(todos: FormalTodoItem[]) {
  return {
    sales: todos.filter((todo) => todo.domain === 'sales'),
    purchase: todos.filter((todo) => todo.domain === 'purchase' || todo.domain === 'operations'),
    afterSales: todos.filter((todo) => todo.domain === 'after_sales'),
  };
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

export default async function AppTodosPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const liveTodos = await loadFormalTodos(session);
  const todos = getFormalTodos(session, liveTodos?.items);
  const closedTodoCount =
    liveTodos?.closedTotal ?? getFormalClosedTodoCount(session);

  return (
    <AppShell
      title="正式待办中心"
      subtitle="按当前登录角色聚合报价、销售单、采购、发货和售后待办，演示权限边界与业务闭环。"
      session={session}
      todoCountOverride={todos.length}
    >
      <div style={toolbarStyle}>
        <Link href="/app" style={backLinkStyle}>
          返回正式首页
        </Link>
        {canViewFormalModule(session, 'boss') ? (
          <Link href="/app/dashboard/boss" style={backLinkStyle}>
            去经营驾驶舱
          </Link>
        ) : null}
      </div>

      <StatStrip
        items={[
          { label: '全部待办', value: todos.length },
          { label: '已自动收口', value: closedTodoCount },
          { label: '销售待办', value: countByDomain(todos, 'sales') },
          { label: '采购与运营', value: countByDomain(todos, 'purchase') + countByDomain(todos, 'operations') },
          { label: '售后待办', value: countByDomain(todos, 'after_sales') },
        ]}
      />

      <section style={sectionStyle} id="sales">
        <div style={anchorCardStyle}>
          <div>
            <h2 style={{ margin: 0 }}>销售待办</h2>
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>报价与销售单的审批、重提和跟进。</p>
          </div>
          <Link href="/app/todos#sales" style={linkStyle}>
            共 {countByDomain(todos, 'sales')} 条
          </Link>
        </div>
        <div style={gridStyle}>
          {groupTodosByLayer(todos).sales.map((todo) => (
            <article key={todo.id} style={cardStyle}>
              <div style={cardHeadStyle}>
                <div>
                  <h3 style={titleStyle}>{todo.title}</h3>
                  <p style={docNoStyle}>{todo.docNo}</p>
                  <p style={metaStyle}>
                    {todo.moduleLabel}
                    {' · '}
                    {todo.statusLabel}
                  </p>
                </div>
                <span style={badgeStyle}>{getPriorityLabel(todo.priority)}</span>
              </div>
              <p style={metaStyle}>{todo.description}</p>
              <p style={metaStyle}>负责人 Owner: {todo.ownerName}</p>
              <Link href={todo.href} style={linkStyle}>
                打开单据
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section style={sectionStyle} id="purchase">
        <div style={anchorCardStyle}>
          <div>
            <h2 style={{ margin: 0 }}>采购与运营待办</h2>
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>采购、发货和异常处理。</p>
          </div>
          <Link href="/app/todos#purchase" style={linkStyle}>
            共 {countByDomain(todos, 'purchase') + countByDomain(todos, 'operations')} 条
          </Link>
        </div>
        <div style={gridStyle}>
          {groupTodosByLayer(todos).purchase.map((todo) => (
            <article key={todo.id} style={cardStyle}>
              <div style={cardHeadStyle}>
                <div>
                  <h3 style={titleStyle}>{todo.title}</h3>
                  <p style={docNoStyle}>{todo.docNo}</p>
                  <p style={metaStyle}>
                    {todo.moduleLabel}
                    {' · '}
                    {todo.statusLabel}
                  </p>
                </div>
                <span style={badgeStyle}>{getPriorityLabel(todo.priority)}</span>
              </div>
              <p style={metaStyle}>{todo.description}</p>
              <p style={metaStyle}>负责人 Owner: {todo.ownerName}</p>
              <Link href={todo.href} style={linkStyle}>
                打开单据
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section style={sectionStyle} id="after-sales">
        <div style={anchorCardStyle}>
          <div>
            <h2 style={{ margin: 0 }}>售后待办</h2>
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>售后处理与财务复核。</p>
          </div>
          <Link href="/app/todos#after-sales" style={linkStyle}>
            共 {countByDomain(todos, 'after_sales')} 条
          </Link>
        </div>
        <div style={gridStyle}>
          {groupTodosByLayer(todos).afterSales.map((todo) => (
            <article key={todo.id} style={cardStyle}>
              <div style={cardHeadStyle}>
                <div>
                  <h3 style={titleStyle}>{todo.title}</h3>
                  <p style={docNoStyle}>{todo.docNo}</p>
                  <p style={metaStyle}>
                    {todo.moduleLabel}
                    {' · '}
                    {todo.statusLabel}
                  </p>
                </div>
                <span style={badgeStyle}>{getPriorityLabel(todo.priority)}</span>
              </div>
              <p style={metaStyle}>{todo.description}</p>
              <p style={metaStyle}>负责人 Owner: {todo.ownerName}</p>
              <Link href={todo.href} style={linkStyle}>
                打开单据
              </Link>
            </article>
          ))}
        </div>
      </section>

      <p style={{ marginTop: '14px', color: '#64748b', fontSize: '13px' }}>
        作废/联动作废待办不再占用待办数，相关单据会在来源详情页继续保留追溯入口。
      </p>
    </AppShell>
  );
}
