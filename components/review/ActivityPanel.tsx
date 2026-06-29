import { ActivityItem } from '@/lib/types'
import { Avatar } from '@/components/ui/Badge'

interface ActivityPanelProps {
  items: ActivityItem[]
}

export function ActivityPanel({ items }: ActivityPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-th-muted mb-4">
        Timeline
      </p>

      <div className="space-y-0">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex gap-3 pb-5 mb-5 border-b border-th-border last:border-b-0 last:mb-0 last:pb-0"
          >
            {/* Avatar + connecting line */}
            <div className="flex flex-col items-center gap-0 shrink-0">
              <Avatar initials={item.initials} color={item.avatarColor} size="sm" />
              {i < items.length - 1 && (
                <div className="w-px flex-1 mt-2 min-h-[20px]" style={{ background: 'var(--th-border)' }} />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[12px] leading-relaxed">
                <span className="font-semibold">{item.who}</span>{' '}
                <span className="text-th-muted">{item.action}</span>
                {item.detail && (
                  <span className="font-mono text-[10px] text-th-accent ml-1.5">{item.detail}</span>
                )}
              </p>
              <p className="font-mono text-[10px] text-th-faint mt-0.5">{item.createdAt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
