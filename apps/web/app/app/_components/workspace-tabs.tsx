'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readWorkspaceScroll, saveWorkspaceScroll, useWorkspaceSearch, workspaceContentReadyEvent, workspaceHref } from '../_lib/workspace-navigation';
import { workspacePageClosedEvent } from '../_lib/workspace-editing';

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

export function WorkspaceTabs({ title, tabLabel, sessionKey, registerCurrent = true }: { title: string; tabLabel?: string; sessionKey: string; registerCurrent?: boolean }) {
  const pathname = usePathname();
  const search = useWorkspaceSearch(pathname);
  const href = pathname ? workspaceHref(pathname, search) : '';
  const key = storageKey(sessionKey);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);

  useEffect(() => {
    if (!pathname?.startsWith('/app')) return;
    const existing = readTabs(key);
    if (!registerCurrent) {
      setTabs(existing);
      return;
    }
    const label = tabLabel ?? title;
    const index = existing.findIndex((tab) => tab.href.split('?')[0] === pathname);
    const next = index < 0
      ? [...existing, { href, label }]
      : existing.map((tab, position) => position === index ? { href, label } : tab);
    writeTabs(key, next);
    setTabs(next);
  }, [key, pathname, href, title, tabLabel, registerCurrent]);

  useEffect(() => {
    if (!registerCurrent || !pathname?.startsWith('/app')) return;
    const position = readWorkspaceScroll(sessionKey, href);
    const restore = () => {
      if (position && workspaceHref(location.pathname, location.search) === href) window.scrollTo({ ...position, behavior: 'instant' });
    };
    restore();
    const save = () => {
      if (workspaceHref(location.pathname, location.search) === href) saveWorkspaceScroll(sessionKey, href);
    };
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener(workspaceContentReadyEvent, restore);
    return () => {
      window.removeEventListener('scroll', save);
      window.removeEventListener(workspaceContentReadyEvent, restore);
    };
  }, [sessionKey, pathname, href, registerCurrent]);

  function closeTab(href: string) {
    const index = tabs.findIndex((tab) => tab.href === href);
    if (index < 0) return;
    window.dispatchEvent(new CustomEvent(workspacePageClosedEvent, { detail: href.split('?')[0] }));
    const next = tabs.filter((tab) => tab.href !== href);
    if (next.length === 0) {
      const home = [{ href: '/app', label: '首页' }];
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
          <div className={`erp-workspace-tabs__item${tab.href.split('?')[0] === pathname ? ' is-active' : ''}`} key={tab.href.split('?')[0]}>
            <Link role="tab" aria-selected={tab.href.split('?')[0] === pathname} href={tab.href}
              className="erp-workspace-tabs__switch" title={tab.label}>
              {tab.label}
            </Link>
            <Link role="button" href={tabs[index + 1]?.href ?? tabs[index - 1]?.href ?? '/app'}
              className="erp-workspace-tabs__close"
              aria-label={`关闭${tab.label}页签`} title={`关闭${tab.label}页签`}
              data-workspace-close-only={tab.href.split('?')[0] !== pathname || (tabs.length === 1 && pathname === '/app') ? 'true' : undefined}
              data-workspace-close-path={tab.href.split('?')[0]}
              onClick={(event) => {
                if (tab.href.split('?')[0] !== pathname || (tabs.length === 1 && pathname === '/app')) event.preventDefault();
                closeTab(tab.href);
              }}>×</Link>
          </div>
        ))}
      </div>
    </nav>
  );
}
