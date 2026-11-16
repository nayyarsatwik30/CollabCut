'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { DEFAULT_THEME, THEME_ATTR, THEME_KEY, type ThemeName } from './theme'

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function savedTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// Dark / Light switch for the landing only. The choice lives on <html> as
// data-lp-theme (the CSS and the 3D scene both follow that attribute) and in
// localStorage. Which icon shows is decided in CSS from the attribute, so the
// button is right from the first paint.
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME)

  // The inline boot script only runs on a full page load. Arriving here by an
  // in-app link, this applies the saved theme before the browser paints.
  useBrowserLayoutEffect(() => {
    const saved = savedTheme()
    document.documentElement.setAttribute(THEME_ATTR, saved)
    setTheme(saved)
  }, [])

  const toggle = () => {
    const next: ThemeName = theme === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute(THEME_ATTR, next)
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    setTheme(next)
  }

  return (
    <button type="button" className="lp-theme-toggle" onClick={toggle} aria-pressed={theme === 'light'} aria-label="Light theme" title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}>
      <Sun className="lp-icon-sun" size={15} aria-hidden="true" />
      <Moon className="lp-icon-moon" size={15} aria-hidden="true" />
    </button>
  )
}
