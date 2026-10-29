// Shared P1/P2/P3 metadata so every place that renders the priority (Board
// card, editor-card preview, project folder view, review screen, dashboard,
// PriorityMenu) stays in sync. Priority is deliberately a different visual
// family from status badges: violet (no status uses it - status is
// amber/red/orange/green/blue/grey), a squared shape instead of the status
// pills' round one, and a signal-bars glyph whose filled count encodes the
// level (3 = highest), so it reads without relying on color.
//
// color-mix with --th-text keeps the violet legible on both the light theme
// (pulled darker) and the dark-navy theme (pulled lighter).
export const PRIORITY_COLOR = 'color-mix(in srgb, #8b5cf6 62%, var(--th-text))'

export const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1', name: 'High', bars: 3, a11y: 'Priority 1 (highest)' },
  { value: 2, label: 'P2', name: 'Medium', bars: 2, a11y: 'Priority 2 (medium)' },
  { value: 3, label: 'P3', name: 'Low', bars: 1, a11y: 'Priority 3 (lowest)' },
] as const

export function priorityMeta(priority: number) {
  const m = PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[2]
  return { ...m, color: PRIORITY_COLOR }
}
