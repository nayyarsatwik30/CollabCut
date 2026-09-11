import { Skeleton } from '@/components/ui/Skeleton'

// Mirrors BoardPage's real layout (top bar, stats row, 5 status columns of
// cards) so the swap from skeleton to real content doesn't reflow.
export function BoardSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
        <Skeleton className="h-4 w-16 rounded-th-sm" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-36 rounded-th-sm" />
          <Skeleton className="h-8 w-20 rounded-th" />
        </div>
      </div>

      <div className="shrink-0 px-6 py-4 border-b border-th-border flex items-center gap-3">
        <Skeleton className="h-7 w-16 rounded-th" />
        <div className="w-px h-6 bg-th-border mx-1" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-th-full" />
        ))}
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <div className="flex gap-4 h-full min-w-max">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[260px] shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-2 py-2">
                <Skeleton className="w-2 h-2 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-th-sm" />
              </div>
              <div className="flex-1 px-1 space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="rounded-th-lg border border-th-border p-3 space-y-2.5">
                    <Skeleton className="h-4 w-3/4 rounded-th-sm" />
                    <Skeleton className="h-3 w-1/2 rounded-th-sm" />
                    <Skeleton className="h-6 w-full rounded-th-sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
