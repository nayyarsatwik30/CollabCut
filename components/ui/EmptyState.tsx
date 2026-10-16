import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  sub?: string
  link?: { href: string; label: string }
  className?: string
  children?: React.ReactNode
}

// App-themed empty state: flat-vector illustration (solid shapes, three theme
// colors, no gradients/shadows/transparency), bold heading, muted subtext,
// optional underlined teal link or action children.
export function EmptyState({ icon: Icon, title, sub, link, className = '', children }: EmptyStateProps) {
  return (
    <div className={`app-empty ${className}`}>
      <div className="relative w-24 h-24 mb-2">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden className="absolute inset-0">
          <circle cx="48" cy="48" r="44" fill="var(--th-bg-elevated)" />
          <rect x="30" y="18" width="44" height="56" rx="8" transform="rotate(8 52 46)" fill="var(--th-border)" />
          <rect x="24" y="20" width="44" height="56" rx="8" fill="var(--th-bg)" />
          <circle cx="46" cy="42" r="15" fill="var(--th-accent)" />
          <rect x="33" y="63" width="26" height="4" rx="2" fill="var(--th-border)" />
          <rect x="37" y="70" width="18" height="4" rx="2" fill="var(--th-border)" />
          <circle cx="84" cy="22" r="4" fill="var(--th-accent)" />
          <circle cx="12" cy="72" r="3" fill="var(--th-border)" />
        </svg>
        <span className="absolute text-th-accent-fg" style={{ left: 36, top: 32 }}><Icon size={20} strokeWidth={1.75} /></span>
      </div>
      <p className="app-empty-title">{title}</p>
      {sub && <p className="app-empty-sub">{sub}</p>}
      {link && <Link href={link.href} className="app-empty-link">{link.label}</Link>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
