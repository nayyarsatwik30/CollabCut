'use client'

import { useRef, useState, useCallback } from 'react'
import { Comment } from '@/lib/types'
import { formatTimecode, formatDuration, clamp } from '@/lib/utils'

interface FilmScrubberProps {
  currentTime: number
  duration: number
  comments: Comment[]
  onSeek: (time: number) => void
}

const STATUS_CSS: Record<string, string> = {
  open:     'var(--th-open)',
  resolved: 'var(--th-resolved)',
  changes:  'var(--th-changes)',
}

export function FilmScrubber({ currentTime, duration, comments, onSeek }: FilmScrubberProps) {
  const trackRef   = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [hoverX,   setHoverX]   = useState<number | null>(null)

  const getTimeAt = useCallback((clientX: number): number => {
    const el = trackRef.current
    if (!el || !duration) return 0
    const { left, width } = el.getBoundingClientRect()
    return clamp((clientX - left) / width, 0, 1) * duration
  }, [duration])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    onSeek(getTimeAt(e.clientX))
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current
    if (!el) return
    const { left } = el.getBoundingClientRect()
    setHoverX(e.clientX - left)
    if (dragging) onSeek(getTimeAt(e.clientX))
  }

  const handlePointerUp = () => setDragging(false)

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="px-4 pb-3 select-none">
      {/* Film strip */}
      <div
        ref={trackRef}
        className="film-strip mb-1"
        style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { setHoverX(null); if(!dragging) setDragging(false) }}
      >
        {/* Played region */}
        <div
          className="film-strip-played"
          style={{ width: `${pct}%`, transition: dragging ? 'none' : 'width 0.08s linear' }}
        />

        {/* Comment dots */}
        {duration > 0 && comments.map((c) => (
          <button
            key={c.id}
            className="film-strip-dot"
            style={{
              left: `${(c.timeSec / duration) * 100}%`,
              background: STATUS_CSS[c.status] ?? 'var(--th-accent)',
              boxShadow: `0 0 6px ${STATUS_CSS[c.status] ?? 'var(--th-accent)'}88`,
            }}
            onClick={(e) => { e.stopPropagation(); onSeek(c.timeSec) }}
            title={c.text}
          />
        ))}

        {/* Playhead */}
        <div
          className="film-strip-playhead"
          style={{ left: `${pct}%`, transition: dragging ? 'none' : 'left 0.08s linear' }}
        />

        {/* Hover tooltip */}
        {hoverX !== null && duration > 0 && (
          <div
            className="tooltip"
            style={{
              left: clamp(hoverX, 32, (trackRef.current?.offsetWidth ?? 0) - 32),
              bottom: 'calc(100% + 10px)',
              transform: 'translateX(-50%)',
            }}
          >
            {formatTimecode(getTimeAt((trackRef.current?.getBoundingClientRect().left ?? 0) + hoverX))}
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="flex items-center justify-between font-mono text-[10px] text-th-muted">
        <span>{formatTimecode(currentTime)}</span>
        <span>{formatDuration(currentTime)} / {formatDuration(duration)}</span>
        <span>{formatTimecode(duration)}</span>
      </div>
    </div>
  )
}
