const stripStyles = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '14px',
  },
  item: {
    border: '1px solid #d7e0ea',
    borderRadius: '18px',
    padding: '16px 18px',
    background: 'rgba(255,255,255,0.86)',
    boxShadow: '0 14px 46px rgba(15, 23, 42, 0.05)',
  },
  label: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
  },
  value: {
    margin: '8px 0 0',
    fontSize: '28px',
    fontWeight: 700,
    color: '#0f172a',
  },
} satisfies Record<string, React.CSSProperties>;

export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section style={stripStyles.wrap} aria-label="summary-strip">
      {items.map((item) => (
        <article key={item.label} style={stripStyles.item}>
          <p style={stripStyles.label}>{item.label}</p>
          <p style={stripStyles.value}>{item.value}</p>
        </article>
      ))}
    </section>
  );
}
