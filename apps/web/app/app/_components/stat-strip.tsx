export function StatStrip({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section className="erp-stat-strip" aria-label="summary-strip">
      {items.map((item) => (
        <article key={item.label} className="erp-card erp-stat-strip__item">
          <p className="erp-stat-strip__label">{item.label}</p>
          <p className="erp-stat-strip__value">{item.value}</p>
        </article>
      ))}
    </section>
  );
}
