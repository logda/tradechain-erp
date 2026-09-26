import Link from 'next/link';
import { AppShell } from '../_components/app-shell';
import { FormalTodoCenter } from '../_components/formal-todo-center';
import { StatStrip } from '../_components/stat-strip';
import { getFormalTodos, type FormalTodoItem } from '../_lib/formal-todos';
import { canViewFormalModule, resolveDemoSession } from '../_lib/demo-session';
import { loadFormalTodos } from '../_lib/load-formal-todos';

type SearchParams = Record<string, string | string[] | undefined>;

function countByDomain(items: FormalTodoItem[], domain: FormalTodoItem['domain']) {
  return items.filter((item) => item.domain === domain).length;
}

export default async function AppTodosPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = resolveDemoSession(searchParams ? await searchParams : {});
  const liveTodos = await loadFormalTodos(session);
  const todos = getFormalTodos(session, liveTodos?.items ?? [])
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));

  return (
    <AppShell title="正式待办中心" session={session} todoCountOverride={todos.length}>
      <div className="erp-todo-links">
        {canViewFormalModule(session, 'boss') ? <Link href="/app/dashboard/boss">去经营驾驶舱</Link> : null}
      </div>
      <StatStrip items={[
        { label: '全部待办', value: todos.length },
        { label: '已自动收口', value: liveTodos?.closedTotal ?? 0 },
        { label: '销售待办', value: countByDomain(todos, 'sales') },
        { label: '采购与运营', value: countByDomain(todos, 'purchase') + countByDomain(todos, 'operations') },
        { label: '售后待办', value: countByDomain(todos, 'after_sales') },
      ]} />
      {!liveTodos ? <p role="status" className="erp-home-todo-error">待办暂时无法加载，请刷新页面重试。</p> : null}
      <FormalTodoCenter todos={todos} />
      <p className="erp-todo-footnote">作废/联动作废待办不再占用待办数，相关单据会在来源详情页继续保留追溯入口。</p>
    </AppShell>
  );
}
