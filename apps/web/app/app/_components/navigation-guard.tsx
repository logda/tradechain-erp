'use client';

import { useEffect, useRef, useState } from 'react';
import { saveWorkspaceScroll, workspaceHref, workspaceLocationEvent } from '../_lib/workspace-navigation';
import { editingForms, hasPendingFiles, hasUnsavedContent, hasUnsavedForm, markWorkspaceInputChanged, workspacePageElement } from '../_lib/workspace-editing';
import { ConfirmDialog } from './confirm-dialog';

type PendingLeave = { message: string; closing: boolean; proceed: () => void };

export function NavigationGuard({ sessionKey }: { sessionKey: string }) {
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const approvedAnchor = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    let approvedUnload = false;
    let approvalTimer: ReturnType<typeof setTimeout> | undefined;
    function resetApproval() {
      approvedUnload = false;
      if (approvalTimer) clearTimeout(approvalTimer);
    }
    function markDirty(event: Event) {
      resetApproval();
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (target instanceof HTMLInputElement && ['search', 'hidden', 'submit', 'button'].includes(target.type)) return;
      const form = target.form;
      if (form && editingForms().includes(form)) markWorkspaceInputChanged(target);
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (approvedUnload) { resetApproval(); return; }
      if (!hasUnsavedContent(document)) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (approvedAnchor.current === anchor) {
        approvedAnchor.current = null;
        approvedUnload = true;
        approvalTimer = setTimeout(resetApproval, 0);
        return;
      }
      resetApproval();
      const target = new URL(anchor.href, window.location.href);
      const closingPath = anchor.dataset.workspaceClosePath;
      const sameLocation = target.pathname === location.pathname && target.search === location.search && target.origin === location.origin;
      if (!closingPath && sameLocation) return;
      const internal = target.origin === location.origin && /^\/app(?:\/|$)/.test(target.pathname) && target.pathname !== '/app/logout';
      const forms = closingPath ? editingForms(workspacePageElement(closingPath) ?? document.createElement('div'))
        : editingForms().filter(form => !internal || !form.closest('[data-workspace-retained="true"]'));
      const hasFiles = forms.some(hasPendingFiles);
      const hasFailure = forms.some(form => form.dataset.saveState === 'error');
      const hasUnsaved = forms.some(hasUnsavedForm);
      if (hasFiles || hasUnsaved) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setPending({ closing: !!closingPath,
          message: `${hasFailure ? '保存失败，' : ''}当前仍有未保存的内容。${hasFiles ? '附件尚未上传。' : ''}\n${closingPath ? '关闭此页签' : '离开系统'}会丢弃未保存内容${hasFiles ? '和附件选择' : ''}。确定继续吗？`,
          proceed: () => { approvedAnchor.current = anchor; anchor.click(); approvedAnchor.current = null; },
        });
        return;
      }
      saveWorkspaceScroll(sessionKey, workspaceHref(location.pathname, location.search));
    }
    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', beforeUnload);

    let cancelled = false;
    let removeHistory = () => undefined;
    // Install after Next's history wrappers, and restore them on unmount.
    queueMicrotask(() => {
      if (cancelled) return;
      const push = history.pushState;
      const replace = history.replaceState;
      let index = history.state?.__erpNavigation?.sessionKey === sessionKey
        ? history.state.__erpNavigation.index as number : 0;
      function tagged(state: unknown, position: number) {
        return { ...(state as Record<string, unknown> ?? {}), __erpNavigation: { sessionKey, index: position } };
      }
      replace.call(history, tagged(history.state, index), '', location.href);
      function changed() {
        resetApproval();
        window.dispatchEvent(new Event(workspaceLocationEvent));
      }
      const guardedPush: History['pushState'] = function (state, unused, url) {
        saveWorkspaceScroll(sessionKey, workspaceHref(location.pathname, location.search));
        push.call(history, tagged(state, ++index), unused, url);
        changed();
      };
      const guardedReplace: History['replaceState'] = function (state, unused, url) {
        replace.call(history, tagged(state, index), unused, url);
        changed();
      };
      history.pushState = guardedPush;
      history.replaceState = guardedReplace;
      const popState = (event: PopStateEvent) => {
        if (event.state?.__erpNavigation?.sessionKey === sessionKey) index = event.state.__erpNavigation.index;
        changed();
      };
      window.addEventListener('popstate', popState);
      removeHistory = () => {
        window.removeEventListener('popstate', popState);
        if (history.pushState === guardedPush) history.pushState = push;
        if (history.replaceState === guardedReplace) history.replaceState = replace;
      };
    });
    return () => {
      cancelled = true;
      resetApproval();
      removeHistory();
      document.removeEventListener('input', markDirty, true);
      document.removeEventListener('change', markDirty, true);
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [sessionKey]);
  return pending ? <ConfirmDialog title={pending.closing ? '关闭编辑页' : '离开系统'}
    message={pending.message} confirmLabel={pending.closing ? '关闭并丢弃' : '离开并丢弃'}
    onCancel={() => setPending(null)} onConfirm={() => { setPending(null); pending.proceed(); }} /> : null;
}
