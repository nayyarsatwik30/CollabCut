// Shared P1/P2/P3 label + color mapping so every place that renders the
// badge (Board card, editor-card preview, project folder view, review
// screen, dashboard) stays in sync. Colors reuse the same tokens the Board's
// own COLUMNS already use (app/board/page.tsx) instead of introducing new ones.
export const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1', color: 'var(--th-changes)' },
  { value: 2, label: 'P2', color: '#fb923c' },
  { value: 3, label: 'P3', color: 'var(--th-muted)' },
] as const

export function priorityMeta(priority: number) {
  return PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[2]
}
