'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function FilterPanel({ title = '当前筛选', subtitle, children, appliedSummary, onClear, clearHref }: {
  title?: string; subtitle?: string; children: ReactNode;
  appliedSummary?: string; onClear?: () => void; clearHref?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [formSummary, setFormSummary] = useState('');
  const [pathname, setPathname] = useState('');
  useEffect(() => {
    setPathname(window.location.pathname);
    if (appliedSummary !== undefined) return;
    const filters: string[] = [];
    for (const field of content.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name]:not([type="hidden"]),select[name]') ?? []) {
      if (['page', 'pageSize', 'sortBy', 'sortOrder'].includes(field.name)) continue;
      if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) && !field.defaultChecked) continue;
      const value = field instanceof HTMLSelectElement ? [...field.options].find(option => option.defaultSelected)?.value ?? field.value : field.defaultValue;
      if (!value || value === 'all') continue;
      const label = [...(field.closest('label')?.childNodes ?? [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim().split(/\s+[A-Za-z]/)[0] || field.name;
      const text = field instanceof HTMLSelectElement ? [...field.options].find(option => option.value === value)?.textContent ?? value : value;
      filters.push(`${label}：${text.trim()}`);
    }
    setFormSummary(filters.join('；'));
  }, [children, appliedSummary]);
  const summary = appliedSummary ?? formSummary;
  return <div>
    <details className="erp-card erp-filter-panel" aria-label={title}>
      <summary className="erp-filter-panel__heading"><h2 className="erp-filter-panel__title">{title}</h2></summary>
      <div ref={content} className="erp-filter-panel__content">
        {subtitle ? <p className="erp-filter-panel__subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </details>
    {summary ? <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
      <span>已选：{summary}</span>
      {onClear ? <button type="button" className="erp-button erp-button--secondary erp-button--compact" onClick={onClear}>清除筛选</button> : <Link href={clearHref ?? pathname}>清除筛选</Link>}
    </div> : null}
  </div>;
}
