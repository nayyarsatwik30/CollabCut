'use client'

import { Layers, Upload, Check } from 'lucide-react'
import { AssetVersion } from '@/lib/types'

interface VersionPanelProps {
  versions: AssetVersion[]
  activeVersion: number
  onSwitch: (version: number) => void
  onUpload: () => void
}

export function VersionPanel({ versions, activeVersion, onSwitch, onUpload }: VersionPanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-th-muted mb-4">
          Version stack
        </p>

        <div className="space-y-2.5">
          {versions.map((v) => {
            const active = v.versionNumber === activeVersion
            return (
              <button
                key={v.id}
                onClick={() => onSwitch(v.versionNumber)}
                className="w-full text-left p-4 rounded-th border transition-all btn-press"
                style={{
                  background: active ? 'color-mix(in srgb, var(--th-accent) 10%, transparent)' : 'var(--th-surface-alt)',
                  borderColor: active ? 'var(--th-accent)' : 'var(--th-border)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <Layers size={13} style={{ color: active ? 'var(--th-accent)' : 'var(--th-muted)' }} />
                  <span
                    className="text-[13px] font-semibold flex-1"
                    style={{ color: active ? 'var(--th-accent)' : 'var(--th-text)' }}
                  >
                    {v.label}
                  </span>
                  {active && (
                    <span
                      className="font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-th-full"
                      style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)' }}
                    >
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-th-muted pl-[21px]">
                  {v.uploadedAt} · {v.sizeLabel}
                </p>
              </button>
            )
          })}
        </div>

        {/* Upload new version */}
        <button
          onClick={onUpload}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-th border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors text-[13px] font-medium btn-press"
        >
          <Upload size={14} /> Upload new version
        </button>
      </div>

      {/* Compare CTA */}
      <div className="p-4 border-t border-th-border shrink-0">
        <button className="w-full py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[12px] text-th-muted hover:text-th-text hover:bg-th-surface-hov transition-colors btn-press">
          Compare v{activeVersion} with previous
        </button>
      </div>
    </div>
  )
}
