import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  canViewFormalAuditCenter,
  canViewFormalModule,
  type DemoSession,
  type FormalModule,
  getDemoRoleLabel,
} from '../_lib/demo-session';
import { LiveTodoCount } from './live-todo-count';
import { WorkspaceTabs } from './workspace-tabs';

type NavEntryVisible = FormalModule | 'all' | 'salesOrPurchase';

const navEntries: Array<{
  href: string;
  label: string;
  visible: NavEntryVisible;
}> = [
  { href: '/app', label: '正式首页', visible: 'all' as const },
  {
    href: '/app/master-data',
    label: '主数据中心',
    visible: 'all' as const,
  },
  { href: '/app/master-data/products', label: '产品库', visible: 'salesOrPurchase' as const },
  { href: '/app/sales', label: '销售中心', visible: 'sales' as const },
  { href: '/app/purchase', label: '采购中心', visible: 'purchase' as const },
  {
    href: '/app/warehouses',
    label: '仓库中心',
    visible: 'purchase' as const,
  },
  {
    href: '/app/operations',
    label: '运营中心',
    visible: 'operations' as const,
  },
  {
    href: '/app/inventory',
    label: '库存中心',
    visible: 'operations' as const,
  },
  { href: '/app/todos', label: '正式待办中心', visible: 'all' as const },
  { href: '/app/dashboard/boss', label: '经营驾驶舱', visible: 'boss' as const },
  { href: '/app/finance', label: '财务中心', visible: 'boss' as const },
  { href: '/app/reports', label: '报表中心', visible: 'boss' as const },
  { href: '/app/logs', label: '日志中心', visible: 'audit' as const },
  { href: '/app/admin/users', label: '用户管理', visible: 'admin' as const },
] as const;

export function AppShell({
  title,
  children,
  session = {
    role: 'boss',
    user: 'Mia',
  },
  todoCountOverride,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  session?: DemoSession;
  todoCountOverride?: number;
}) {
  const roleLabel = getDemoRoleLabel(session.role);
  const visibleNavEntries = navEntries.filter((entry) => {
    if (entry.visible === 'all') {
      return true;
    }

    if (entry.visible === 'audit') {
      return canViewFormalAuditCenter(session);
    }

    if (entry.visible === 'salesOrPurchase') {
      return canViewFormalModule(session, 'sales') || canViewFormalModule(session, 'purchase');
    }

    return canViewFormalModule(session, entry.visible);
  });

  return (
    <main className="erp-app erp-shell">
      <div className="erp-shell__frame">
        <aside className="erp-shell__sidebar">
          <div className="erp-shell__brand">
            <h1 className="erp-shell__brand-title">NEXUS ERP</h1>
            <p className="erp-shell__brand-subtitle">
              正式工作台入口
              <br />
              全链路业务系统
            </p>
          </div>

          <div className="erp-shell__account" aria-label="当前账号">
            <div className="erp-shell__account-identity">
              <span>{`用户 User: ${session.user}`}</span>
              <span>{`角色 Role: ${roleLabel}`}</span>
            </div>
            <Link href="/app/todos" className="erp-shell__account-link">
              <LiveTodoCount initialCount={todoCountOverride} />
            </Link>
            <a href="/app/logout" className="erp-shell__account-link erp-shell__account-logout">
              退出登录
            </a>
          </div>

          <nav className="erp-shell__nav" aria-label="formal-app-nav">
            {visibleNavEntries.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                className="erp-shell__nav-link"
              >
                {entry.label}
              </Link>
            ))}
          </nav>

        </aside>

        <section className="erp-shell__content">
          <h2 className="erp-shell__visually-hidden">{title}</h2>
          <WorkspaceTabs title={title} sessionKey={`${session.username ?? session.user}:${session.role}`} />
          <div className="erp-shell__body">{children}</div>
        </section>
      </div>
    </main>
  );
}
