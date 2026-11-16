'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from '@/components/ui/icons'
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
      className="toggle"
    >
      <Sun size={13} tone="muted" className="absolute left-[9px] top-1/2 -translate-y-1/2" />
      <Moon size={13} tone="muted" className="absolute right-[9px] top-1/2 -translate-y-1/2" />
      <span className="toggle-knob ic-on-fill">
        {dark ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  )
}
