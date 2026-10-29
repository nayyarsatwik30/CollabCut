import { priorityMeta } from '@/lib/priority'

// Three ascending bars; the first `bars` are filled, the rest are faint.
export function PriorityBars({ bars, size = 10 }: { bars: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className="shrink-0">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={i * 3.5}
          y={7 - i * 3}
          width="2.5"
          height={3 + i * 3}
          rx="0.5"
          fill="currentColor"
          opacity={i < bars ? 1 : 0.4}
        />
      ))}
    </svg>
  )
}

// Read-only priority badge: squared, violet, bars glyph + P-label. Distinct
// from the round, dotted StatusBadge pills.
export function PriorityBadge({ priority, size = 'md' }: { priority: number; size?: 'sm' | 'md' }) {
  const meta = priorityMeta(priority)
  return (
    <span
      role="img"
      aria-label={meta.a11y}
      title={meta.a11y}
      className={`inline-flex shrink-0 items-center font-mono font-bold rounded-[3px] ${size === 'sm' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[10px] px-1.5 py-0.5 gap-1.5'}`}
      style={{
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 45%, transparent)`,
      }}
    >
      <PriorityBars bars={meta.bars} size={size === 'sm' ? 11 : 12} />
      {meta.label}
    </span>
  )
}
