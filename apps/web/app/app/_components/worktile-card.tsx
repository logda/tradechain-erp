import Link from 'next/link';

const cardStyles = {
  card: {
    border: '1px solid #d7e0ea',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,247,250,0.94) 100%)',
    borderRadius: '22px',
    padding: '22px',
    boxShadow: '0 18px 54px rgba(15, 23, 42, 0.06)',
    display: 'grid',
    gap: '14px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
  },
  description: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.7,
    fontSize: '14px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  link: {
    color: '#0f172a',
    textDecoration: 'none',
    fontWeight: 700,
  },
  badge: {
    border: '1px solid #d7e0ea',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#334155',
    background: '#f8fafc',
  },
} satisfies Record<string, React.CSSProperties>;

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
    <article style={cardStyles.card}>
      <p style={cardStyles.eyebrow}>正式模块</p>
      <h3 style={cardStyles.title}>{title}</h3>
      <p style={cardStyles.description}>{description}</p>
      <div style={cardStyles.footer}>
        <Link href={href} style={cardStyles.link}>
          {title}
        </Link>
        {badge ? <span style={cardStyles.badge}>{badge}</span> : null}
      </div>
    </article>
  );
}
