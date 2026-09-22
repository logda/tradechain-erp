import type { ReactNode } from 'react';

const panelStyles = {
  wrap: {
    border: '1px solid #d7e0ea',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.84)',
    boxShadow: '0 16px 52px rgba(15, 23, 42, 0.05)',
    padding: '20px 22px',
    display: 'grid',
    gap: '16px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
  },
} satisfies Record<string, React.CSSProperties>;

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
    <section style={panelStyles.wrap}>
      <div>
        <h2 style={panelStyles.title}>{title}</h2>
        {subtitle ? <p style={panelStyles.subtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
