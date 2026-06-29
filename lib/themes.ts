import { Theme, ThemeKey } from './types'

export const THEMES: Record<ThemeKey, Theme> = {
  film: {
    name: 'Film Lab',
    desc: 'Warm dark · pro video tool feel',
    swatch: '#E8A33D',
    font: "'Bricolage Grotesque', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  arctic: {
    name: 'Arctic Studio',
    desc: 'Cool white · editorial & clean',
    swatch: '#1A4DB8',
    font: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  noir: {
    name: 'Noir',
    desc: 'Pure black · electric green',
    swatch: '#00FF85',
    font: "'JetBrains Mono', monospace",
    mono: "'JetBrains Mono', monospace",
  },
  sunset: {
    name: 'Sunset Cut',
    desc: 'Warm cream · indie film zine',
    swatch: '#C4501A',
    font: "'Fraunces', serif",
    mono: "'IBM Plex Mono', monospace",
  },
  slate: {
    name: 'Slate Pro',
    desc: 'Deep slate · modern SaaS',
    swatch: '#8B5CF6',
    font: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
}

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export const DEFAULT_THEME: ThemeKey = 'film'
export const THEME_STORAGE_KEY = 'dailies-theme'
