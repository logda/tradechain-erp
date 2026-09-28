'use client';

import { useEffect } from 'react';
import { saveWorkspaceScroll, workspaceHref, workspaceLocationEvent } from '../_lib/workspace-navigation';

function isQueryForm(form: HTMLFormElement) {
  return form.getAttribute('method')?.toLowerCase() === 'get' ||
    form.matches('.erp-filter-form, .erp-todo-filters');
}

function leaveMessage() {
  const forms = Array.from(document.forms).filter((form) => !isQueryForm(form));
  const hasFiles = forms.some((form) => Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .some((input) => Boolean(input.files?.length)));
  const hasFailure = forms.some((form) => form.dataset.saveState === 'error');
  const hasUnsaved = forms.some((form) => ['waiting', 'saving', 'skipped', 'error'].includes(form.dataset.saveState ?? ''));
  if (!hasFiles && !hasUnsaved) return null;
  return `${hasFiles ? '存在未上传附件。' : ''}${hasFailure ? '保存失败，' : ''}当前仍有未保存的内容。离开后未保存内容和文件选择可能丢失，确定离开吗？`;
}

export function NavigationGuard({ sessionKey }: { sessionKey: string }) {
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
      if (target instanceof HTMLInputElement && target.type === 'search') return;
      const form = target.form;
      if (form && !isQueryForm(form)) form.dataset.saveState = 'waiting';
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (approvedUnload) { resetApproval(); return; }
      if (!leaveMessage()) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function click(event: MouseEvent) {
      resetApproval();
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.dataset.workspaceCloseOnly === 'true') return;
      const target = new URL(anchor.href, window.location.href);
      if (target.pathname === location.pathname && target.search === location.search && target.origin === location.origin) return;
      const message = leaveMessage();
      if (message && !window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (message) {
        approvedUnload = true;
        approvalTimer = setTimeout(resetApproval, 0);
      }
      saveWorkspaceScroll(sessionKey, workspaceHref(location.pathname, location.search));
    }
    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', beforeUnload);

    let cancelled = false;
    let removeHistory = () => undefined;
    // Next patches history in its parent effect. Install after those effects so cleanup
    // restores its functions, rather than leaving a guard inside Next's wrapper.
    queueMicrotask(() => {
      if (cancelled) return;
      const push = history.pushState;
      const replace = history.replaceState;
      let index = history.state?.__erpNavigation?.sessionKey === sessionKey
        ? history.state.__erpNavigation.index as number : 0;
      let currentHref = location.href;
      let currentState = history.state;
      let restoring = false;
      function tagged(state: unknown, position: number) {
        return { ...(state as Record<string, unknown> ?? {}), __erpNavigation: { sessionKey, index: position } };
      }
      replace.call(history, tagged(currentState, index), '', currentHref);
      currentState = history.state;
      function changed() {
        resetApproval();
        currentHref = location.href;
        currentState = history.state;
        window.dispatchEvent(new Event(workspaceLocationEvent));
      }
      const guardedPush: History['pushState'] = function (state, unused, url) {
        saveWorkspaceScroll(sessionKey, workspaceHref(location.pathname, location.search));
        push.call(history, tagged(state, index + 1), unused, url);
        index += 1;
        changed();
      };
      const guardedReplace: History['replaceState'] = function (state, unused, url) {
        replace.call(history, tagged(state, index), unused, url);
        changed();
      };
      history.pushState = guardedPush;
      history.replaceState = guardedReplace;
      function popState(event: PopStateEvent) {
        if (restoring) {
          event.stopImmediatePropagation();
          restoring = false;
          return;
        }
        const message = leaveMessage();
        if (message && currentHref !== location.href && !window.confirm(message)) {
          event.stopImmediatePropagation();
          const target = event.state?.__erpNavigation;
          if (target?.sessionKey === sessionKey && Number.isInteger(target.index)) {
            restoring = true;
            history.go(index - target.index);
          } else {
            // Entries from before the shell mounted have no index. Keep the live form
            // and restore its URL without dispatching a route change to Next.
            push.call(history, currentState, '', currentHref);
          }
          return;
        }
        const target = event.state?.__erpNavigation;
        if (target?.sessionKey === sessionKey) index = target.index;
        changed();
      }
      window.addEventListener('popstate', popState, true);
      removeHistory = () => {
        window.removeEventListener('popstate', popState, true);
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
  return null;
}
