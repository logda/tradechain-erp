import Link from 'next/link';

export function WorktileCard({
  title,
  href,
  description,
  badge,
}: {
  title: string;
  href: string;
  description: string;
  badge?: string;
}) {
  return (
    <article className="erp-card erp-worktile" aria-label={title}>
      <p className="erp-worktile__eyebrow">正式模块</p>
      <h3 className="erp-worktile__title">{title}</h3>
      <p className="erp-worktile__description">{description}</p>
      <div className="erp-worktile__footer">
        <Link href={href} className="erp-worktile__link">
          {title}
        </Link>
        {badge ? <span className="erp-chip">{badge}</span> : null}
      </div>
    </article>
  );
}
