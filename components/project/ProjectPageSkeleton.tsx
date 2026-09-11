import { Skeleton } from '@/components/ui/Skeleton'
import { CardGridSkeleton } from '@/components/ui/CardGridSkeleton'

// Mirrors ProjectPage's real layout (top bar, tabs, Custom Cut / Board Cut
// sections) so the swap from skeleton to real content doesn't reflow.
export function ProjectPageSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-5">
        <Skeleton className="h-3.5 w-14 rounded-th-sm" />
        <Skeleton className="h-3.5 w-36 rounded-th-sm" />
      </div>

      <div className="shrink-0 bg-th-surface border-b border-th-border px-5 flex gap-5 py-3.5">
        <Skeleton className="h-3.5 w-14 rounded-th-sm" />
        <Skeleton className="h-3.5 w-16 rounded-th-sm" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-28 rounded-th-sm" />
              <Skeleton className="h-8 w-24 rounded-th" />
            </div>
            <CardGridSkeleton count={4} minWidth={200} />
          </section>

          <div className="h-px bg-th-border shrink-0" />

          <section>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24 rounded-th-sm" />
              <Skeleton className="h-8 w-24 rounded-th" />
            </div>
            <CardGridSkeleton count={4} minWidth={200} />
          </section>
        </div>
      </div>
    </div>
  )
}
