'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  canViewFormalAuditCenter,
  canViewFormalModule,
  type DemoSession,
  type FormalModule,
  getDemoRoleLabel,
} from '../_lib/demo-session';
import { LiveTodoCount } from './live-todo-count';
import { WorkspaceTabs } from './workspace-tabs';
import { NavigationGuard } from './navigation-guard';
import { useWorkspaceSearch } from '../_lib/workspace-navigation';
import { hasUnsavedContent, workspacePageClosedEvent, workspacePageElement } from '../_lib/workspace-editing';
import { WorkspacePageActiveContext } from './workspace-page-context';

type NavEntryVisible = FormalModule | 'all' | 'salesOrPurchase';

const navEntries: Array<{
  href: string;
  label: string;
  visible: NavEntryVisible;
}> = [
  { href: '/app', label: '首页', visible: 'all' as const },
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
  { href: '/app/todos', label: '待办中心', visible: 'all' as const },
  { href: '/app/dashboard/boss', label: '经营驾驶舱', visible: 'boss' as const },
  { href: '/app/finance', label: '财务中心', visible: 'boss' as const },
  { href: '/app/reports', label: '报表中心', visible: 'boss' as const },
  { href: '/app/logs', label: '日志中心', visible: 'audit' as const },
  { href: '/app/admin/users', label: '用户管理', visible: 'admin' as const },
] as const;

type ShellProps = {
  title: string;
  tabLabel?: string;
  subtitle?: string;
  children: ReactNode;
  session?: DemoSession;
  todoCountOverride?: number | null;
};

type ShellPage = {
  title: string;
  tabLabel?: string;
  session: DemoSession;
  todoCountOverride?: number | null;
  pathname: string | null;
  search: string;
};

const defaultSession: DemoSession = { role: 'boss', user: 'Mia' };
const ShellPageContext = createContext<((page: ShellPage, children: ReactNode) => void) | null>(null);
const RegisteredPagesContext = createContext<string[]>([]);
const workspaceIdentity = (session: DemoSession) => JSON.stringify([session.userId, session.username ?? session.user, session.role, session.accessScopes]);

export function PersistentAppShell({ session, children }: { session: DemoSession; children: ReactNode }) {
  const identity = workspaceIdentity(session);
  return <WorkspaceShell key={identity} session={session}>{children}</WorkspaceShell>;
}

function WorkspaceShell({ session, children }: { session: DemoSession; children: ReactNode }) {
  const pathname = usePathname();
  const search = useWorkspaceSearch(pathname);
  const [page, setPage] = useState<ShellPage>({ title: '首页', session, pathname: null, search: '' });
  const [pages, setPages] = useState<Record<string, ReactNode>>({});
  const scope = useRef(workspaceIdentity(session));
  const publishPage = useCallback((nextPage: ShellPage, content: ReactNode) => {
    setPage(nextPage);
    if (!nextPage.pathname) return;
    const path = nextPage.pathname;
    const identity = workspaceIdentity(nextPage.session);
    const changedScope = identity !== scope.current;
    scope.current = identity;
    setPages(previous => {
      if (changedScope) return { [path]: content };
      const next = Object.fromEntries(Object.entries(previous).filter(([key]) =>
        key === path || hasUnsavedContent(workspacePageElement(key))));
      next[path] = previous[path] && hasUnsavedContent(workspacePageElement(path)) ? previous[path] : content;
      return Object.keys(previous).length === Object.keys(next).length &&
        Object.keys(next).every(key => next[key] === previous[key]) ? previous : next;
    });
  }, []);
  useEffect(() => {
    const close = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      setPages(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== path)));
    };
    window.addEventListener(workspacePageClosedEvent, close);
    return () => window.removeEventListener(workspacePageClosedEvent, close);
  }, []);
  return (
    <ShellPageContext.Provider value={publishPage}>
      <RegisteredPagesContext.Provider value={Object.keys(pages)}>
      <NavigationGuard sessionKey={`${session.username ?? session.user}:${session.role}`} />
      <ShellView {...page} registerCurrent={page.pathname === pathname && page.search === search}>
        {children}
        {Object.entries(pages).map(([path, content]) => <WorkspacePageActiveContext.Provider key={path} value={path === pathname}>
          <div data-workspace-page={path} data-workspace-retained="true" hidden={path !== pathname}
            style={{ display: path === pathname ? 'contents' : 'none' }}>{content}</div>
        </WorkspacePageActiveContext.Provider>)}
      </ShellView>
      </RegisteredPagesContext.Provider>
    </ShellPageContext.Provider>
  );
}

export function AppShell({ title, tabLabel, children, session = defaultSession, todoCountOverride }: ShellProps) {
  const publishPage = useContext(ShellPageContext);
  const registeredPages = useContext(RegisteredPagesContext);
  const pathname = usePathname();
  const search = useWorkspaceSearch(pathname);
  useEffect(() => {
    publishPage?.({ title, tabLabel, session, todoCountOverride, pathname, search }, children);
  }, [publishPage, title, tabLabel, session, todoCountOverride, pathname, search, children]);
  if (publishPage) return registeredPages.includes(pathname ?? '') ? null : <>{children}</>;
  return <ShellView title={title} tabLabel={tabLabel} session={session} todoCountOverride={todoCountOverride}>{children}</ShellView>;
}

function ShellView({
  title,
  tabLabel,
  children,
  session = defaultSession,
  todoCountOverride,
  registerCurrent = true,
}: ShellProps & { registerCurrent?: boolean }) {
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
              业务工作台
            </p>
          </div>

          <div className="erp-shell__account" aria-label="当前账号">
            <div className="erp-shell__account-identity">
              <span>{`用户 User: ${session.user}`}</span>
              <span>{`角色 Role: ${roleLabel}`}</span>
            </div>
            <LiveTodoCount initialCount={todoCountOverride} sessionKey={`${session.username ?? session.user}:${session.role}`} refreshKey={Date.now()} />
            <a href="/app/logout" className="erp-shell__account-link erp-shell__account-logout">
              退出登录
            </a>
          </div>

          <nav className="erp-shell__nav" aria-label="formal-app-nav">
            {[
              { title: '业务', paths: ['/app', '/app/todos', '/app/sales', '/app/purchase', '/app/operations'] },
              { title: '资料与库存', paths: ['/app/master-data/products', '/app/master-data', '/app/warehouses', '/app/inventory'] },
              { title: '管理与报表', paths: ['/app/dashboard/boss', '/app/finance', '/app/reports', '/app/logs', '/app/admin/users'] },
            ].map(group => {
              const entries = visibleNavEntries.filter(entry => group.paths.includes(entry.href));
              return entries.length ? <div key={group.title}>
                <p style={{ margin: '12px 8px 4px', fontSize: 12, color: '#64748b' }}>{group.title}</p>
                {entries.map(entry => <Link key={entry.href} href={entry.href} className="erp-shell__nav-link">{entry.label}</Link>)}
              </div> : null;
            })}
          </nav>

        </aside>

        <section className="erp-shell__content">
          <h2 className="erp-shell__visually-hidden">{title}</h2>
          <WorkspaceTabs title={title} tabLabel={tabLabel} sessionKey={`${session.username ?? session.user}:${session.role}`} registerCurrent={registerCurrent} />
          <div className="erp-shell__body">{children}</div>
        </section>
      </div>
    </main>
  );
}
