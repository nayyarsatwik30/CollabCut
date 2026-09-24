'use client'

import { ThinkingOrb, type OrbState } from 'thinking-orbs'

interface OrbProps {
  state?: OrbState
  size?: 20 | 64
  label?: string
  className?: string
}

export function Orb({ state = 'working', size = 20, label, className }: OrbProps) {
  return <ThinkingOrb state={state} size={size} theme="dark" aria-label={label} className={className} />
}
