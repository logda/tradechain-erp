'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type WorkspaceTab = { href: string; label: string };

function storageKey(sessionKey: string) {
  return `erp-workspace-tabs:${sessionKey}`;
}

function readTabs(key: string): WorkspaceTab[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(saved) ? saved.filter((tab): tab is WorkspaceTab =>
      !!tab && typeof tab.href === 'string' && /^\/app(?:\/|$)/.test(tab.href) &&
      typeof tab.label === 'string') : [];
  } catch {
    return [];
  }
}

function writeTabs(key: string, tabs: WorkspaceTab[]) {
  sessionStorage.setItem(key, JSON.stringify(tabs));
}

function tabLabel(title: string, pathname: string) {
  const last = pathname.split('/').at(-1);
  return last && /^\d+$/.test(last) ? `${title} #${last}` : title;
}

export function WorkspaceTabs({ title, sessionKey }: { title: string; sessionKey: string }) {
  const pathname = usePathname();
  const key = storageKey(sessionKey);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);

  useEffect(() => {
    if (!pathname?.startsWith('/app')) return;
    const label = tabLabel(title, pathname);
    const existing = readTabs(key);
    const index = existing.findIndex((tab) => tab.href === pathname);
    const next = index < 0
      ? [...existing, { href: pathname, label }]
      : existing.map((tab, position) => position === index ? { ...tab, label } : tab);
    writeTabs(key, next);
    setTabs(next);
  }, [key, pathname, title]);

  function closeTab(href: string) {
    const index = tabs.findIndex((tab) => tab.href === href);
    if (index < 0) return;
    const next = tabs.filter((tab) => tab.href !== href);
    if (next.length === 0) {
      const home = [{ href: '/app', label: '正式首页' }];
      writeTabs(key, home);
      setTabs(home);
      return;
    }
    writeTabs(key, next);
    setTabs(next);
  }

  return (
    <nav className="erp-workspace-tabs" aria-label="系统工作区页签">
      <div className="erp-workspace-tabs__list" role="tablist" aria-label="已打开的页面">
        {tabs.map((tab, index) => (
          <div className={`erp-workspace-tabs__item${tab.href === pathname ? ' is-active' : ''}`} key={tab.href}>
            <Link role="tab" aria-selected={tab.href === pathname} href={tab.href}
              className="erp-workspace-tabs__switch" title={tab.label}>
              {tab.label}
            </Link>
            <Link role="button" href={tabs[index + 1]?.href ?? tabs[index - 1]?.href ?? '/app'}
              className="erp-workspace-tabs__close"
              aria-label={`关闭${tab.label}页签`} title={`关闭${tab.label}页签`}
              onClick={(event) => {
                if (tab.href !== pathname || (tabs.length === 1 && pathname === '/app')) event.preventDefault();
                closeTab(tab.href);
              }}>×</Link>
          </div>
        ))}
      </div>
    </nav>
  );
}
