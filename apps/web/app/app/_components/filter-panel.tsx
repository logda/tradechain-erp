import type { ReactNode } from 'react';

export function FilterPanel({
  title = '当前筛选',
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <details className="erp-card erp-filter-panel" aria-label={title}>
      <summary className="erp-filter-panel__heading">
        <h2 className="erp-filter-panel__title">{title}</h2>
      </summary>
      <div className="erp-filter-panel__content">
        {subtitle ? <p className="erp-filter-panel__subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </details>
  );
}
