import Link from 'next/link';
import { AppShell } from './_components/app-shell';
import { StatStrip } from './_components/stat-strip';
import { resolveDemoSession, type DemoSession } from './_lib/demo-session';
import { getFormalTodos, type FormalTodoItem } from './_lib/formal-todos';
import { buildFormalApiRequestHeaders } from './_lib/formal-api-request-headers';

type SearchParams = Record<string, string | string[] | undefined>;
type FormalTodoApiResponse = { items: FormalTodoItem[]; total: number; closedTotal: number };

function getTodoApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

async function loadFormalTodos(session: DemoSession): Promise<FormalTodoApiResponse | null> {
  try {
    const params = new URLSearchParams({ role: session.role, user: session.user });
    const response = await fetch(`${getTodoApiBaseUrl()}/todos/formal?${params}`, {
      cache: 'no-store',
      headers: buildFormalApiRequestHeaders(session),
    });
    if (!response.ok) return null;
    const result = await response.json() as FormalTodoApiResponse;
    return Array.isArray(result?.items) && typeof result.closedTotal === 'number' ? result : null;
  } catch {
    return null;
  }
}

function formatTodoTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function safeImageUrl(value?: string) {
  return value && (/^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//')))
    ? value : null;
}

function TodoGroup({ title, todos }: { title: string; todos: FormalTodoItem[] }) {
  return (
    <section className="erp-home-todo-group">
      <div className="erp-home-todo-group__head">
        <h3>{title}</h3>
        <span>共 {todos.length} 条</span>
      </div>
      {todos.length === 0 ? <p className="erp-home-todo-empty">暂无待办</p> : (
        <ul className="erp-home-todo-list">
          {todos.map((todo) => {
            const imageUrl = safeImageUrl(todo.imageUrls?.[0]);
            return (
              <li key={todo.id} className="erp-home-todo-row">
                <div className="erp-home-todo-row__image">
                  {imageUrl ? <img src={imageUrl} alt={todo.productNames?.[0] || '业务图片'} /> : <span>暂无图片</span>}
                </div>
                <div className="erp-home-todo-row__content">
                  <strong>{todo.title}</strong>
                  <span>{todo.docNo} · {todo.statusLabel}</span>
                  {todo.productNames?.length ? <span>产品：{todo.productNames.join('、')}</span> : null}
                  {todo.customerName ? <span>客户：{todo.customerName}</span> : null}
                  {todo.supplierName ? <span>供应商：{todo.supplierName}</span> : null}
                </div>
                <div className="erp-home-todo-row__action">
                  <time>{formatTodoTime(todo.createdAt)}</time>
                  <Link href={todo.href}>打开单据</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function AppHomePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = resolveDemoSession(searchParams ? await searchParams : {});
  const liveTodos = await loadFormalTodos(session);
  const todos = getFormalTodos(session, liveTodos?.items ?? []);
  const sorted = [...todos].sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  const purchase = sorted.filter((item) => item.domain === 'purchase' || item.domain === 'operations');
  const sales = sorted.filter((item) => item.domain === 'sales');
  const afterSales = sorted.filter((item) => item.domain === 'after_sales');

  return (
    <AppShell title="ERP 正式工作台" subtitle="按当前角色查看待处理业务；业务模块从左侧导航进入。" session={session} todoCountOverride={todos.length}>
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>首页待办摘要</h3>
        <StatStrip items={[
          { label: '全部待办', value: todos.length },
          { label: '采购运营待办', value: purchase.length },
          { label: '销售待办', value: sales.length },
          { label: '已自动收口', value: liveTodos?.closedTotal ?? 0 },
        ]} />
      </section>
      {!liveTodos ? <p className="erp-home-todo-error" role="status">待办暂时无法加载，请刷新页面重试。</p> : null}
      <div data-testid="home-todo-groups" className="erp-home-todo-groups">
        <TodoGroup title="采购与运营待办" todos={purchase} />
        <TodoGroup title="销售待办" todos={sales} />
        <TodoGroup title="售后待办" todos={afterSales} />
      </div>
    </AppShell>
  );
}
