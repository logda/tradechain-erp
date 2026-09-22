import type { ReactNode } from 'react';

export function FormalDataTable({
  title,
  total,
  children,
}: {
  title: string;
  total?: number;
  children: ReactNode;
}) {
  return (
    <section className="erp-card erp-data-table" aria-label={title}>
      <div className="erp-data-table__header">
        <h2 className="erp-data-table__title">{title}</h2>
        {typeof total === 'number' ? (
          <p className="erp-data-table__meta">共 {total} 条</p>
        ) : null}
      </div>
      <div
        className="erp-data-table__body erp-table-scroll"
        data-testid="formal-table-scroll"
      >
        {children}
      </div>
    </section>
  );
}
