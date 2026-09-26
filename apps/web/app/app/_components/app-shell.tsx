import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  canViewFormalAuditCenter,
  canViewFormalModule,
  type DemoSession,
  type FormalModule,
  getDemoAccessScopeLabel,
  getDemoRoleLabel,
} from '../_lib/demo-session';
import { getFormalTodoCount } from '../_lib/formal-todos';
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
  subtitle,
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
  const accessScopeLabel = getDemoAccessScopeLabel(session);
  const todoCount = String(
    todoCountOverride ?? getFormalTodoCount(session),
  ).padStart(2, '0');
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

          <div className="erp-shell__meta">
            当前角色：{roleLabel}
            <br />
            当前用户：{session.user}
            <br />
            当前权限：{accessScopeLabel}
          </div>
        </aside>

        <section className="erp-shell__content">
          <header className="erp-shell__topbar" data-backdrop>
            <div className="erp-shell__title-wrap">
              <p className="erp-shell__eyebrow">正式工作台</p>
              <h2 className="erp-shell__title">{title}</h2>
              {subtitle ? <p className="erp-shell__subtitle">{subtitle}</p> : null}
            </div>

            <div className="erp-shell__user-panel">
              <div className="erp-shell__meta-grid">
                <span className="erp-shell__pill">{`角色 Role: ${roleLabel}`}</span>
                <span className="erp-shell__pill">{`用户 User: ${session.user}`}</span>
                <span className="erp-shell__pill">{`权限 Scope: ${accessScopeLabel}`}</span>
                <span className="erp-shell__pill">消息待办 Todo: {todoCount}</span>
              </div>
              <a
                href="/app/logout"
                className="erp-button erp-button--secondary erp-shell__logout"
              >
                退出登录
              </a>
            </div>
          </header>

          <WorkspaceTabs title={title} sessionKey={`${session.username ?? session.user}:${session.role}`} />
          <div className="erp-shell__body">{children}</div>
        </section>
      </div>
    </main>
  );
}
