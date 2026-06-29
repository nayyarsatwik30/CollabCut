'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { ThemeKey } from '@/lib/types'
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/themes'

interface ThemeContextValue {
  theme: ThemeKey
  setTheme: (key: ThemeKey) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME)

  // On mount, read from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null
    if (stored) applyTheme(stored)
  }, [])

  function applyTheme(key: ThemeKey) {
    setThemeState(key)
    document.documentElement.setAttribute('data-theme', key)
    localStorage.setItem(THEME_STORAGE_KEY, key)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
