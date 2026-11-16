// The landing's colours, defined once. The DOM gets them as CSS variables
// (see ThemeBoot.tsx) and the 3D scene as THREE.Color objects (see
// scene/palette.ts). Swap the accent here; nothing else needs touching.

export const ACCENT = '#B8E41E' // Spring Lime
export const INK = '#050505'
export const CREAM = '#ECE6DC'

export type ThemeName = 'dark' | 'light'

// The landing has its own theme, separate from the web tool's data-theme.
export const THEME_ATTR = 'data-lp-theme'
export const THEME_KEY = 'collabcut-landing-theme'
export const DEFAULT_THEME: ThemeName = 'dark'

export interface ThemeTokens {
  bg: string
  fg: string
  muted: string
  surface: string // card backgrounds
  line: string
  lineStrong: string
  accentEdge: string // thin edge around accent fills; only Light needs one
  quiet: string // opacity of the receding "Sign in" link
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    bg: INK,
    fg: CREAM,
    muted: '#A9A398',
    surface: 'linear-gradient(160deg, rgba(236, 230, 220, 0.07), rgba(236, 230, 220, 0.02))',
    line: 'rgba(236, 230, 220, 0.14)',
    lineStrong: 'rgba(236, 230, 220, 0.35)',
    accentEdge: 'transparent',
    quiet: '0.55',
  },
  light: {
    bg: CREAM,
    fg: INK,
    muted: '#5E5A52',
    surface: '#F4F0E8',
    line: 'rgba(5, 5, 5, 0.14)',
    lineStrong: 'rgba(5, 5, 5, 0.35)',
    accentEdge: INK,
    quiet: '0.6',
  },
}

export function readTheme(): ThemeName {
  return document.documentElement.getAttribute(THEME_ATTR) === 'light' ? 'light' : 'dark'
}
