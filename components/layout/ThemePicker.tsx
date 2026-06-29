'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { THEMES, THEME_KEYS } from '@/lib/themes'
import { cn } from '@/lib/utils'

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-th-sm bg-th-surface-alt border border-th-border text-[11px] font-mono text-th-muted hover:text-th-text transition-colors btn-press"
        title="Change theme"
      >
        <span
          className="w-3 h-3 rounded-full block"
          style={{ background: THEMES[theme].swatch }}
        />
        <span className="hidden sm:block">{THEMES[theme].name}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-th-surface border border-th-border rounded-th-lg shadow-panel overflow-hidden w-52 animate-slide-up">
            <div className="p-1.5 space-y-0.5">
              {THEME_KEYS.map((key) => {
                const t = THEMES[key]
                const active = theme === key
                return (
                  <button
                    key={key}
                    onClick={() => { setTheme(key); setOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-th-sm text-left transition-colors btn-press',
                      active ? 'bg-th-surface-alt' : 'hover:bg-th-surface-alt',
                    )}
                  >
                    {/* Mini swatch */}
                    <div
                      className="w-7 h-5 rounded flex-shrink-0 relative overflow-hidden"
                      style={{ background: t.swatch === '#00FF85' ? '#000' : t.swatch === '#E8A33D' ? '#15140F' : '#EDF1F8' }}
                    >
                      <div
                        className="absolute bottom-0 right-0 w-3.5 h-3.5"
                        style={{ background: t.swatch }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-[12px] font-semibold', active ? 'text-th-accent' : 'text-th-text')}>{t.name}</p>
                      <p className="text-[10px] text-th-muted truncate">{t.desc}</p>
                    </div>
                    {active && <Check size={12} className="text-th-accent shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
