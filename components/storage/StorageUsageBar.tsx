'use client'

import type { WorkspaceStoragePlan } from '@/lib/useStorageUsage'

const BYTES_PER_GB = 1024 ** 3
const BYTES_PER_MB = 1024 ** 2

// Under 1 GB, show MB - at one decimal of GB a 24 MB upload renders as
// "0.0 GB" and looks like it never registered.
function formatUsed(bytes: number): string {
  return bytes < BYTES_PER_GB ? `${Math.round(bytes / BYTES_PER_MB)} MB` : `${(bytes / BYTES_PER_GB).toFixed(1)} GB`
}

// workspace_plans.storage_gb is binary GB (2048 = 2 TB), so whole-TB caps
// read as "2 TB" rather than "2048 GB".
function formatGB(gb: number): string {
  return gb >= 1024 ? `${Number((gb / 1024).toFixed(1))} TB` : `${Number(gb.toFixed(1))} GB`
}

interface StorageUsageBarProps {
  usedBytes: number | null
  loading?: boolean
  variant?: 'full' | 'compact'
  workspacePlan?: WorkspaceStoragePlan | null
}

export function StorageUsageBar({ usedBytes, loading, variant = 'full', workspacePlan }: StorageUsageBarProps) {
  // Usage loaded but no plan came back = /api/storage-usage's plan_missing
  // case. Never fall back to a made-up cap - say so instead. (A failed fetch
  // leaves usedBytes null, which renders as the neutral '—' state.)
  const planMissing = !loading && usedBytes !== null && !workspacePlan
  const usedText = formatUsed(usedBytes ?? 0)
  const usedGB = (usedBytes ?? 0) / BYTES_PER_GB
  const capGB = workspacePlan?.storage_gb ?? 0
  const label = workspacePlan ? 'Workspace storage' : 'Storage'
  const remainingGB = Math.max(capGB - usedGB, 0)
  const percent = capGB > 0 ? Math.min((usedGB / capGB) * 100, 100) : 0
  const over = capGB > 0 && usedGB > capGB
  const barColor = over ? 'var(--th-changes)' : percent > 85 ? '#fb923c' : 'var(--th-accent)'
  const pending = loading || usedBytes === null

  if (variant === 'compact') {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-th-muted font-mono uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-th-muted font-mono">
            {pending ? '—' : planMissing ? `${usedText} · No plan` : `${usedText} / ${formatGB(capGB)}`}
          </span>
        </div>
        <div className="h-1.5 rounded-th-full bg-th-surface-alt overflow-hidden">
          <div className="h-full rounded-th-full transition-all" style={{ width: `${pending ? 0 : percent}%`, background: barColor }} />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-3">
      <div>
        <span className="text-th-muted block text-[11px] font-mono uppercase mb-1">{label} usage</span>
        <p className="text-[14px] font-semibold">
          {pending ? 'Loading…' : planMissing ? `${usedText} used` : `${usedText} of ${formatGB(capGB)} used`}
        </p>
      </div>
      <div className="h-2.5 rounded-th-full bg-th-surface-alt overflow-hidden">
        <div className="h-full rounded-th-full transition-all" style={{ width: `${pending ? 0 : percent}%`, background: barColor }} />
      </div>
      <p className="text-[12px] text-th-muted">
        {pending
          ? ''
          : planMissing
            ? 'No plan assigned to your workspace - contact support to set one up.'
            : over ? 'Over storage limit' : `${formatGB(remainingGB)} remaining`}
      </p>
    </div>
  )
}
