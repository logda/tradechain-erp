'use client';

import { useSyncExternalStore } from 'react';

export const workspaceLocationEvent = 'erp:workspace-location';
export const workspaceContentReadyEvent = 'erp:workspace-content-ready';

export function workspaceHref(pathname: string, search = '') {
  const params = new URLSearchParams(search);
  for (const name of ['role', 'user', 'access', 'username', 'userId', 'legacyUserIds']) params.delete(name);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

function subscribeLocation(callback: () => void) {
  window.addEventListener(workspaceLocationEvent, callback);
  window.addEventListener('popstate', callback);
  return () => {
    window.removeEventListener(workspaceLocationEvent, callback);
    window.removeEventListener('popstate', callback);
  };
}

export function useWorkspaceSearch(pathname: string | null) {
  return useSyncExternalStore(subscribeLocation,
    () => pathname && window.location.pathname === pathname ? window.location.search : '',
    () => '');
}

function scrollKey(sessionKey: string, href: string) {
  return `erp-workspace-scroll:${sessionKey}:${href}`;
}

export function saveWorkspaceScroll(sessionKey: string, href: string) {
  try {
    sessionStorage.setItem(scrollKey(sessionKey, href), JSON.stringify({ top: window.scrollY, left: window.scrollX }));
  } catch { /* A storage restriction must not prevent navigation. */ }
}

export function readWorkspaceScroll(sessionKey: string, href: string): { top: number; left: number } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(scrollKey(sessionKey, href)) ?? 'null');
    if (saved && Number.isFinite(saved.top) && Number.isFinite(saved.left)) {
      return { top: saved.top, left: saved.left };
    }
  } catch { /* There is no saved position when storage is unavailable. */ }
  return null;
}
