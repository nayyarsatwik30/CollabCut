import { Skeleton } from './Skeleton'

// Matches the shape shared by ProjectCard and the asset cards on the
// project/dashboard pages: an aspect-video thumbnail over a text block
// with two lines. `minWidth` mirrors whichever auto-fill grid it's dropped
// into (200px for asset grids, 240px for project/dashboard grids).
export function CardGridSkeleton({ count = 8, minWidth = 240 }: { count?: number; minWidth?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col h-full bg-th-surface border border-th-border rounded-th-lg overflow-hidden">
          <Skeleton className="aspect-video shrink-0 rounded-none" />
          <div className="p-3.5 flex-1 flex flex-col justify-center gap-2 min-h-[56px]">
            <Skeleton className="h-3.5 w-3/4 rounded-th-sm" />
            <Skeleton className="h-3 w-1/2 rounded-th-sm" />
          </div>
        </div>
      ))}
    </div>
  )
}
