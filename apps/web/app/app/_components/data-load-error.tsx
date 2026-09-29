'use client';

import { useTransition } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export function DataLoadError({ label, message, retryLabel, children }: {
  label: string; message?: string; retryLabel?: string; children?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div role="alert" className="erp-home-todo-error">
    <p>{message ?? `${label}暂不可用，请重试。`}</p>
    {children}
    <button type="button" className="erp-todo-button" disabled={pending} onClick={() => startTransition(() => {
      router.refresh();
    })}>{pending ? '加载中…' : retryLabel ?? `重试${label}`}</button>
  </div>;
}
