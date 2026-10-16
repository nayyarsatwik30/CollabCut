'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { THEME_KEY } from '@/components/layout/theme-boot'

type Theme = 'light' | 'dark'

function themeRoot(): HTMLElement {
  return document.documentElement
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(themeRoot().getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    themeRoot().setAttribute('data-theme', next)
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    setTheme(next)
  }

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={toggle}
      className="relative w-[52px] h-7 rounded-full border border-th-border bg-th-surface-alt shrink-0 transition-colors"
    >
      <Sun size={13} className="absolute left-[7px] top-1/2 -translate-y-1/2 text-th-muted" />
      <Moon size={13} className="absolute right-[7px] top-1/2 -translate-y-1/2 text-th-muted" />
      <span
        className="absolute top-[2px] left-[2px] w-6 h-6 rounded-full bg-th-accent text-th-accent-fg flex items-center justify-center transition-transform"
        style={{ transform: dark ? 'translateX(24px)' : 'translateX(0)' }}
      >
        {dark ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  )
}
