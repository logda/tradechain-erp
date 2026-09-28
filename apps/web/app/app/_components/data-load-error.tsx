'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DataLoadError({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div role="alert" className="erp-home-todo-error">
    <p>{label}暂不可用，请重试。</p>
    <button type="button" className="erp-todo-button" disabled={pending} onClick={() => startTransition(() => {
      router.refresh();
    })}>{pending ? '加载中…' : `重试${label}`}</button>
  </div>;
}
