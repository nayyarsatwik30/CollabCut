'use client'

import { ThinkingOrb, type OrbState, type OrbTheme } from 'thinking-orbs'

interface OrbProps {
  state?: OrbState
  size?: 20 | 32 | 64
  label?: string
  className?: string
  /** 'auto' follows the app root's data-theme; pin 'dark' on always-dark surfaces (video). */
  theme?: OrbTheme
}

export function Orb({ state = 'composing', size = 64, label, className, theme = 'auto' }: OrbProps) {
  return <ThinkingOrb state={state} size={size} theme={theme} aria-label={label} className={className} />
}
