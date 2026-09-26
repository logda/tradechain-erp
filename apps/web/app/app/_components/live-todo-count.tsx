'use client';

import { useEffect, useState } from 'react';

export function LiveTodoCount({ initialCount }: { initialCount?: number }) {
  const [count, setCount] = useState<number | null>(initialCount ?? null);

  useEffect(() => {
    if (initialCount !== undefined) {
      setCount(initialCount);
      return;
    }
    let active = true;
    Promise.resolve()
      .then(() => fetch('/api/formal-todos/count', { cache: 'no-store' }))
      .then((response) => response?.ok ? response.json() : null)
      .then((result: { count?: number } | null) => {
        if (active && typeof result?.count === 'number') setCount(result.count);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [initialCount]);

  return <>消息待办 Todo: {count === null ? '—' : String(count).padStart(2, '0')}</>;
}
