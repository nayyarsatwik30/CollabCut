'use client'

import { DEFAULT_EDITOR_STORAGE_CAP_GB } from '@/lib/storage-config'
import type { WorkspaceStoragePlan } from '@/lib/useStorageUsage'

const BYTES_PER_GB = 1024 ** 3
const BYTES_PER_MB = 1024 ** 2

// Under 1 GB, show MB - at one decimal of GB a 24 MB upload renders as
// "0.0 GB" and looks like it never registered.
function formatUsed(bytes: number): string {
  return bytes < BYTES_PER_GB ? `${Math.round(bytes / BYTES_PER_MB)} MB` : `${(bytes / BYTES_PER_GB).toFixed(1)} GB`
}

interface StorageUsageBarProps {
  usedBytes: number | null
  loading?: boolean
  variant?: 'full' | 'compact'
  workspacePlan?: WorkspaceStoragePlan | null
}

export function StorageUsageBar({ usedBytes, loading, variant = 'full', workspacePlan }: StorageUsageBarProps) {
  const usedGB = (usedBytes ?? 0) / BYTES_PER_GB
  const capGB = workspacePlan?.storage_gb ?? DEFAULT_EDITOR_STORAGE_CAP_GB
  const label = workspacePlan ? 'Workspace storage' : 'Storage'
  const remainingGB = Math.max(capGB - usedGB, 0)
  const percent = Math.min((usedGB / capGB) * 100, 100)
  const over = usedGB > capGB
  const barColor = over ? 'var(--th-changes)' : percent > 85 ? '#fb923c' : 'var(--th-accent)'

  if (variant === 'compact') {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-th-muted font-mono uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-th-muted font-mono">
            {loading ? '—' : `${formatUsed(usedBytes ?? 0)} / ${capGB} GB`}
          </span>
        </div>
        <div className="h-1.5 rounded-th-full bg-th-surface-alt overflow-hidden">
          <div className="h-full rounded-th-full transition-all" style={{ width: `${loading ? 0 : percent}%`, background: barColor }} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-3">
      <div>
        <span className="text-th-muted block text-[11px] font-mono uppercase mb-1">{label} usage</span>
        <p className="text-[14px] font-semibold">{loading ? 'Loading…' : `${formatUsed(usedBytes ?? 0)} of ${capGB} GB used`}</p>
      </div>
      <div className="h-2.5 rounded-th-full bg-th-surface-alt overflow-hidden">
        <div className="h-full rounded-th-full transition-all" style={{ width: `${loading ? 0 : percent}%`, background: barColor }} />
      </div>
      <p className="text-[12px] text-th-muted">
        {loading ? '' : over ? 'Over storage limit' : `${remainingGB.toFixed(1)} GB remaining`}
      </p>
    </div>
  )
}
