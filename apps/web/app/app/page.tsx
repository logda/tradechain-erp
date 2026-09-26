import { AppShell } from './_components/app-shell';
import { StatStrip } from './_components/stat-strip';
import { TodoGroup } from './_components/todo-group';
import { resolveDemoSession } from './_lib/demo-session';
import { getFormalTodos } from './_lib/formal-todos';
import { loadFormalTodos } from './_lib/load-formal-todos';

type SearchParams = Record<string, string | string[] | undefined>;
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
