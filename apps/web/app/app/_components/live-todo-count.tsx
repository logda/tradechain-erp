'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function LiveTodoCount({ initialCount, sessionKey, refreshKey }: {
  initialCount?: number | null; sessionKey?: string; refreshKey?: number;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(initialCount ?? null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(initialCount === null ? 'error' : initialCount === undefined ? 'loading' : 'ready');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener('erp:formal-todos-changed', refresh);
    return () => window.removeEventListener('erp:formal-todos-changed', refresh);
  }, []);

  useEffect(() => {
    if (initialCount !== undefined && retry === 0) {
      setCount(initialCount);
      setStatus(initialCount === null ? 'error' : 'ready');
      if (initialCount === null) return;
    }
    let active = true;
    if (initialCount === undefined || retry > 0) setStatus('loading');
    Promise.resolve()
      .then(() => fetch('/api/formal-todos/count', { cache: 'no-store' }))
      .then((response) => response?.ok ? response.json() : null)
      .then((result: { count?: number } | null) => {
        if (!active) return;
        if (typeof result?.count === 'number' && Number.isInteger(result.count) && result.count >= 0) {
          setCount(result.count);
          setStatus('ready');
        } else setStatus('error');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [initialCount, pathname, sessionKey, refreshKey, retry]);

  return <>
    <Link href="/app/todos" className="erp-shell__account-link">消息待办 Todo: {status === 'loading' ? '加载中…' : status === 'error' ? '暂不可用' : String(count).padStart(2, '0')}</Link>
    {status === 'error' ? <button type="button" className="erp-todo-button" aria-label="重试待办数量" onClick={() => setRetry((value) => value + 1)}>重试</button> : null}
  </>;
}
