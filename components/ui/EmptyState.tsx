import Link from 'next/link'

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  sub?: string
  link?: { href: string; label: string }
  className?: string
  children?: React.ReactNode
}

// App-themed empty state: flat tinted illustration, bold heading, muted
// subtext, optional underlined teal link or action children.
export function EmptyState({ icon: Icon, title, sub, link, className = '', children }: EmptyStateProps) {
  return (
    <div className={`app-empty ${className}`}>
      <div className="relative w-24 h-24 mb-2 flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden className="absolute inset-0">
        <circle cx="48" cy="48" r="44" fill="var(--th-bg-elevated)" />
        <circle cx="48" cy="48" r="30" fill="color-mix(in srgb, var(--th-accent) 14%, transparent)" />
        <circle cx="82" cy="20" r="4" fill="var(--th-accent)" opacity="0.5" />
        <circle cx="12" cy="70" r="3" fill="var(--th-border)" />
      </svg>
        <span className="relative text-th-accent-text"><Icon size={28} strokeWidth={1.5} /></span>
      </div>
      <p className="app-empty-title">{title}</p>
      {sub && <p className="app-empty-sub">{sub}</p>}
      {link && <Link href={link.href} className="app-empty-link">{link.label}</Link>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
