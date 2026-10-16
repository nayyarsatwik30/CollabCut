'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { PRIORITY_OPTIONS, priorityMeta } from '@/lib/priority'

interface PriorityMenuProps {
  value: number
  onChange: (priority: number) => void
  // 'sm' matches the Board card badge, 'md' the review-screen header badge.
  size?: 'sm' | 'md'
}

// useLayoutEffect warns during SSR; this is a no-op there and the real thing in the browser.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const GAP = 4
const EDGE = 8

// Admin-only priority picker. Replaces the native <select> so the list can be
// styled to match the app. The popover renders in a portal (only while `open`,
// which can only become true from a user event, so SSR never touches document) with fixed
// positioning (Board columns clip overflow) and closes on outside press,
// Escape, scroll and resize. Optimistic update / revert / error toast stay in
// the caller, which already owns the PATCH.
export function PriorityMenu({ value, onChange, size = 'md' }: PriorityMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const meta = priorityMeta(value)

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    setPos(null)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const openMenu = () => {
    const current = PRIORITY_OPTIONS.findIndex((p) => p.value === value)
    setActiveIndex(current >= 0 ? current : 0)
    setOpen(true)
  }

  // Place below the trigger; flip above when there is no room. Runs before
  // paint (menu is visibility:hidden until pos is set) so it never flashes.
  useIsoLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuH = menuRef.current.offsetHeight
    const menuW = menuRef.current.offsetWidth
    const fitsBelow = window.innerHeight - rect.bottom >= menuH + GAP + EDGE
    const top = fitsBelow || rect.top < menuH + GAP + EDGE ? rect.bottom + GAP : rect.top - menuH - GAP
    const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - menuW - EDGE))
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (open && pos) menuRef.current?.focus({ preventScroll: true })
  }, [open, pos])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      close()
    }
    const onScrollOrResize = (e: Event) => {
      if (e.type === 'scroll' && menuRef.current?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, close])

  const select = (priority: number) => {
    close(true)
    if (priority !== value) onChange(priority)
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    const last = PRIORITY_OPTIONS.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i >= last ? 0 : i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i <= 0 ? last : i - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0) }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(PRIORITY_OPTIONS[activeIndex].value) }
    else if (e.key === 'Escape') { e.preventDefault(); close(true) }
    else if (e.key === 'Tab') close()
  }

  const text = size === 'sm' ? 'text-[9px] px-1.5 py-0.5 gap-1' : 'text-[11px] px-2 py-0.5 gap-1.5'
  const dot = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  // Swallow pointer/click/drag so the Board card's own handlers (open review,
  // start drag) never see interaction with the menu. React events bubble
  // through portals, so the menu needs this as much as the trigger does.
  const isolate = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onDragStart: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() },
  }

  return (
    // draggable wrapper + cancelled dragstart: pressing on the trigger starts a
    // drag on its nearest draggable ancestor (this span), which we cancel, so
    // the Board card behind it never starts dragging from here.
    <span draggable className="inline-flex shrink-0" {...isolate}>
      <button
        ref={triggerRef}
        type="button"
        draggable={false}
        title="Change priority"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-label={`Priority ${meta.label}. Change priority`}
        onClick={(e) => { e.stopPropagation(); open ? close() : openMenu() }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openMenu() }
        }}
        className={`inline-flex items-center font-mono font-bold rounded-th-sm border-0 outline-none cursor-pointer transition-colors hover:brightness-125 focus-visible:ring-1 focus-visible:ring-th-accent ${text}`}
        style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 16%, transparent)` }}
      >
        <span className={`${dot} rounded-full shrink-0`} style={{ background: meta.color }} />
        {meta.label}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          id={`${uid}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Priority"
          aria-activedescendant={`${uid}-opt-${activeIndex}`}
          onKeyDown={onMenuKeyDown}
          {...isolate}
          className="fixed z-[900] min-w-[136px] p-1 rounded-th-sm bg-th-surface border border-th-border shadow-card-hover outline-none"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
        >
          {PRIORITY_OPTIONS.map((p, i) => {
            const selected = p.value === value
            return (
              <div
                key={p.value}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={(e) => { e.stopPropagation(); select(p.value) }}
                className="flex items-center gap-2 h-8 px-2 rounded-th-sm cursor-pointer text-[12px] text-th-text select-none"
                style={{ background: i === activeIndex ? 'var(--th-surface-hov)' : 'transparent' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="font-mono font-bold" style={{ color: p.color }}>{p.label}</span>
                <span className="text-th-muted">{p.name}</span>
                <Check size={12} className="ml-auto shrink-0" style={{ opacity: selected ? 1 : 0 }} aria-hidden />
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </span>
  )
}
