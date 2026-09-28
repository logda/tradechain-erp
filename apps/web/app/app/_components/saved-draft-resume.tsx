'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function forgetSavedDraft(kind: 'sales' | 'quote', actorId: number | undefined, role: string, draftId: number | null) {
  if (!actorId || !draftId) return;
  const key = `erp-saved-draft:${role}:${actorId}:${kind}`;
  try { if (Number(sessionStorage.getItem(key)) === draftId) sessionStorage.removeItem(key); } catch {}
}

export function SavedDraftResume({ kind, actorId, role, draftId, enabled }: {
  kind: 'sales' | 'quote'; actorId?: number; role: string; draftId: number | null; enabled: boolean;
}) {
  const [savedId, setSavedId] = useState<number | null>(null);
  const key = `erp-saved-draft:${role}:${actorId}:${kind}`;
  useEffect(() => {
    if (!enabled || !actorId) return;
    try {
      if (draftId) sessionStorage.setItem(key, String(draftId));
      const id = Number(sessionStorage.getItem(key));
      setSavedId(Number.isSafeInteger(id) && id > 0 ? id : null);
    } catch { /* Navigation protection remains available when browser storage is unavailable. */ }
  }, [key, actorId, draftId, enabled]);
  if (!enabled || !savedId) return null;
  return <p><Link href={kind === 'sales' ? `/app/sales/orders/${savedId}/edit` : `/app/sales/quotes/${savedId}`}>继续编辑已保存草稿</Link>{' '}
    <button type="button" onClick={() => { try { sessionStorage.removeItem(key); } catch {} setSavedId(null); }}>隐藏此提示</button>
  </p>;
}
