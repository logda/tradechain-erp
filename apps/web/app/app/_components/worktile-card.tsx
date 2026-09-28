import Link from 'next/link';

export function WorktileCard({ title, href, description }: { title: string; href: string; description: string; badge?: string }) {
  return <article className="erp-card erp-worktile" aria-label={title}>
    <h3 className="erp-worktile__title"><Link href={href} className="erp-worktile__link">{title}</Link></h3>
    <p className="erp-worktile__description">{description}</p>
  </article>;
}
