import type { ReactNode } from 'react';

const tableStyles = {
  wrap: {
    border: '1px solid #d7e0ea',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    boxShadow: '0 18px 56px rgba(15, 23, 42, 0.06)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'center',
    padding: '18px 22px',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
  },
  meta: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
  body: {
    padding: '8px 14px 14px',
  },
} satisfies Record<string, React.CSSProperties>;

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
    <section style={tableStyles.wrap}>
      <div style={tableStyles.header}>
        <h2 style={tableStyles.title}>{title}</h2>
        {typeof total === 'number' ? (
          <p style={tableStyles.meta}>共 {total} 条</p>
        ) : null}
      </div>
      <div style={tableStyles.body}>{children}</div>
    </section>
  );
}
