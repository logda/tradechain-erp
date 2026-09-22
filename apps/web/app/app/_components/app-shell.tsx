import Link from 'next/link';
import React from 'react';
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

const shellStyles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #eef3f8 0%, #f8fafc 28%, #edf2f7 100%)',
    color: '#0f172a',
    fontFamily:
      '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  frame: {
    display: 'grid',
    gridTemplateColumns: '272px minmax(0, 1fr)',
    minHeight: '100vh',
  },
  sidebar: {
    borderRight: '1px solid #d6dee8',
    background:
      'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(27,39,58,0.98) 100%)',
    color: '#e2e8f0',
    padding: '28px 22px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '22px',
  },
  brand: {
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15, 23, 42, 0.22)',
    padding: '18px',
    borderRadius: '18px',
  },
  brandTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  brandSub: {
    margin: '8px 0 0',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#94a3b8',
  },
  navGroup: {
    display: 'grid',
    gap: '10px',
  },
  navLink: {
    color: '#e2e8f0',
    textDecoration: 'none',
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: '12px',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
  },
  navMeta: {
    marginTop: 'auto',
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: 1.8,
  },
  content: {
    padding: '24px clamp(20px, 2.4vw, 36px) 40px',
    width: '100%',
    boxSizing: 'border-box',
  },
  topbar: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: '20px 24px',
    marginBottom: '24px',
    padding: '24px 26px',
    border: '1px solid #d8e1ea',
    borderRadius: '24px',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%)',
    boxShadow: '0 20px 70px rgba(15, 23, 42, 0.07)',
    backdropFilter: 'blur(14px)',
  },
  titleWrap: {
    display: 'grid',
    gap: '10px',
    alignContent: 'start',
    flex: '1 1 520px',
    minWidth: '260px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(30px, 3vw, 44px)',
    fontWeight: 700,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.8,
    maxWidth: '760px',
  },
  userPanel: {
    display: 'grid',
    gap: '14px',
    alignContent: 'start',
    justifyItems: 'stretch',
    flex: '1 1 360px',
    minWidth: '280px',
    maxWidth: '560px',
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px',
  },
  pill: {
    border: '1px solid #d8e1ea',
    borderRadius: '18px',
    padding: '14px 16px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.92) 100%)',
    fontSize: '13px',
    color: '#334155',
    fontWeight: 600,
    minHeight: '54px',
    display: 'flex',
    alignItems: 'center',
  },
  switchLink: {
    border: '1px solid #d8e1ea',
    borderRadius: '999px',
    padding: '8px 12px',
    background: '#ffffff',
    fontSize: '12px',
    color: '#0f172a',
    textDecoration: 'none',
    fontWeight: 700,
  },
  logoutLink: {
    border: '1px solid #d8e1ea',
    borderRadius: '999px',
    padding: '10px 14px',
    background: '#ffffff',
    fontSize: '13px',
    color: '#9f1239',
    textDecoration: 'none',
    fontWeight: 700,
    width: 'fit-content',
    justifySelf: 'end',
  },
  body: {
    display: 'grid',
    gap: '22px',
  },
} satisfies Record<string, React.CSSProperties>;

type NavEntryVisible = FormalModule | 'all' | 'salesOrPurchase';

const navEntries: Array<{
  href: string;
  label: string;
  visible: NavEntryVisible;
}> = [
  { href: '/app', label: '正式首页', visible: 'all' as const },
  { href: '/app/mvp', label: '全链路验收中心', visible: 'all' as const },
  {
    href: '/app/master-data',
    label: '主数据中心',
    visible: 'all' as const,
  },
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

function buildSessionHref(href: string, session: DemoSession) {
  const [pathnameAndSearch, hash = ''] = href.split('#');
  const [pathname, search = ''] = pathnameAndSearch.split('?');
  const searchParams = new URLSearchParams(search);
  searchParams.set('role', session.role);
  searchParams.set('user', session.user);

  if (session.accessScopes) {
    searchParams.set(
      'access',
      encodeURIComponent(JSON.stringify(session.accessScopes)),
    );
  } else {
    searchParams.delete('access');
  }

  const queryString = searchParams.toString();
  return `${pathname}${queryString ? `?${queryString}` : ''}${hash ? `#${hash}` : ''}`;
}

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
    <main style={shellStyles.page}>
      <div style={shellStyles.frame}>
        <aside style={shellStyles.sidebar}>
          <div style={shellStyles.brand}>
            <h1 style={shellStyles.brandTitle}>NEXUS ERP</h1>
            <p style={shellStyles.brandSub}>
              正式工作台入口
              <br />
              全链路业务系统
            </p>
          </div>

          <nav style={shellStyles.navGroup} aria-label="formal-app-nav">
            {visibleNavEntries.map((entry) => (
              <Link key={entry.href} href={buildSessionHref(entry.href, session)} style={shellStyles.navLink}>
                {entry.label}
              </Link>
            ))}
          </nav>

          <div style={shellStyles.navMeta}>
            当前角色：{roleLabel}
            <br />
            当前用户：{session.user}
            <br />
            当前权限：{accessScopeLabel}
          </div>
        </aside>

        <section style={shellStyles.content}>
          <header style={shellStyles.topbar}>
            <div style={shellStyles.titleWrap}>
              <p style={shellStyles.eyebrow}>正式工作台</p>
              <h2 style={shellStyles.title}>{title}</h2>
              {subtitle ? <p style={shellStyles.subtitle}>{subtitle}</p> : null}
            </div>

            <div style={shellStyles.userPanel}>
              <div style={shellStyles.metaGrid}>
                <span style={shellStyles.pill}>{`角色 Role: ${roleLabel}`}</span>
                <span style={shellStyles.pill}>{`用户 User: ${session.user}`}</span>
                <span style={shellStyles.pill}>{`权限 Scope: ${accessScopeLabel}`}</span>
                <span style={shellStyles.pill}>消息待办 Todo: {todoCount}</span>
              </div>
              <a href="/app/logout" style={shellStyles.logoutLink}>
                退出登录
              </a>
            </div>
          </header>

          <div style={shellStyles.body}>{children}</div>
        </section>
      </div>
    </main>
  );
}
