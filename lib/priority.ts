// Shared P1/P2/P3 metadata so every place that renders the priority (Board
// card, editor-card preview, project folder view, review screen, dashboard,
// PriorityMenu) stays in sync. Priority is deliberately a different visual
// family from status badges: a squared shape instead of the status pills'
// round one, and a signal-bars glyph whose filled count encodes the level
// (3 = highest), so it reads without relying on color.
//
// The chip look comes from the palette (classes in globals.css): P1 is a
// lime fill with Ink text, P2 an outline in the text colour, P3 a muted outline.

export const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1', name: 'High', bars: 3, a11y: 'Priority 1 (highest)' },
  { value: 2, label: 'P2', name: 'Medium', bars: 2, a11y: 'Priority 2 (medium)' },
  { value: 3, label: 'P3', name: 'Low', bars: 1, a11y: 'Priority 3 (lowest)' },
] as const

export function priorityMeta(priority: number) {
  const m = PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[2]
  return { ...m, chip: `chip-p${m.value}` }
}
