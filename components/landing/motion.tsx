'use client'

import type { RefObject } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

// Calm, B2B-appropriate ease-out - deliberately no springy overshoot (this
// replaces the old .reveal CSS's bouncy cubic-bezier(0.34, 1.56, 0.64, 1)).
export const EASE = [0.16, 1, 0.3, 1] as const

type Trigger = 'mount' | 'inView'

interface ViewportProps {
  /** 'mount' animates immediately (above-the-fold content); 'inView' waits until scrolled into view. */
  trigger?: Trigger
  /** The scrollable ancestor to observe against - this page scrolls inside its own container, not the window. */
  root?: RefObject<Element | null>
  margin?: string
  amount?: 'some' | 'all' | number
}

function useFadeUpVariants(distance: number, delay: number): Variants {
  const reduced = useReducedMotion()
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced ? { duration: 0.01 } : { duration: 0.45, ease: EASE, delay },
    },
  }
}

function useStaggerVariants(staggerChildren: number, delayChildren: number): Variants {
  const reduced = useReducedMotion()
  return {
    hidden: {},
    visible: { transition: reduced ? {} : { staggerChildren, delayChildren } },
  }
}

function viewportBehavior({ trigger = 'inView', root, margin = '0px 0px -40px 0px', amount = 0.12 }: ViewportProps) {
  return trigger === 'inView'
    ? { whileInView: 'visible' as const, viewport: { once: true, root, margin, amount } }
    : { animate: 'visible' as const }
}

interface RevealProps extends ViewportProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  distance?: number
  delay?: number
}

/** Single fade+slide-up block - standalone headings, the trusted-by strip, the mock player, etc. */
export function Reveal({ children, className, style, trigger, root, margin, amount, distance = 16, delay = 0 }: RevealProps) {
  const variants = useFadeUpVariants(distance, delay)
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      variants={variants}
      {...viewportBehavior({ trigger, root, margin, amount })}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps extends ViewportProps {
  children: React.ReactNode
  className?: string
  staggerChildren?: number
  delayChildren?: number
}

/** Staggering container - wrap a group of <RevealItem> children (hero lines, card grids). */
export function Stagger({ children, className, trigger, root, margin, amount, staggerChildren = 0.07, delayChildren = 0 }: StaggerProps) {
  const variants = useStaggerVariants(staggerChildren, delayChildren)
  return (
    <motion.div
      className={className}
      initial="hidden"
      variants={variants}
      {...viewportBehavior({ trigger, root, margin, amount })}
    >
      {children}
    </motion.div>
  )
}

interface RevealItemProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  distance?: number
}

/**
 * Child of <Stagger> - inherits "hidden"/"visible" timing from the parent's variants
 * context. Kept as its own wrapper element (never merged onto a hover-styled card div)
 * because Framer writes its animated `transform` directly as an inline style, which
 * would otherwise permanently outrank the card's CSS `:hover` transform.
 */
export function RevealItem({ children, className, style, distance = 16 }: RevealItemProps) {
  const variants = useFadeUpVariants(distance, 0)
  return (
    <motion.div className={className} style={style} variants={variants}>
      {children}
    </motion.div>
  )
}
