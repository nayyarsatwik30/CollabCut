'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// A line of text hanging from an invisible pivot (see .lp-tagline
// transform-origin). The angle is integrated as a damped spring pendulum:
// nearby cursor movement and scroll velocity push it, a slow irregular
// "air" torque keeps it alive, and damping lets it settle. Nothing here is
// a keyframe loop, so it never repeats exactly.
const STIFFNESS = 15 // rad/s^2 per rad  -> ~1.6s natural period
const DAMPING = 0.85 // 1/s             -> several visible swings per push
const MAX_ANGLE = 0.15 // rad (~8.5deg) hard stop
const CURSOR_GAIN = 0.022
const CURSOR_RADIUS = 280 // px; influence falls off with distance
const SCROLL_GAIN = 0.0016
const STEP = 1 / 120

export function SwayTagline({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let theta = 0.07
    let omega = 0
    let kick = 0
    let t = Math.random() * 100
    let last = performance.now()
    let acc = 0
    let raf = 0
    let running = false

    let px: number | null = null
    let pt = 0
    let lastScroll = window.scrollY

    const onPointerMove = (e: PointerEvent) => {
      if (px !== null) {
        const dt = Math.max(1, e.timeStamp - pt)
        const vx = Math.max(-3, Math.min(3, (e.clientX - px) / dt)) // px/ms
        const r = el.getBoundingClientRect()
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
        const falloff = 1 / (1 + (d / CURSOR_RADIUS) ** 2)
        kick += vx * falloff * CURSOR_GAIN
      }
      px = e.clientX
      pt = e.timeStamp
    }

    const onScroll = () => {
      const y = window.scrollY
      const dy = Math.max(-120, Math.min(120, y - lastScroll))
      lastScroll = y
      kick += dy * SCROLL_GAIN
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      acc += dt
      omega += kick
      kick = 0
      while (acc >= STEP) {
        t += STEP
        const air = 0.5 * Math.sin(t * 0.71) + 0.33 * Math.sin(t * 1.13 + 1.7) + 0.22 * Math.sin(t * 0.29 + 0.4)
        const alpha = -STIFFNESS * theta - DAMPING * omega + air * 0.55
        omega += alpha * STEP
        theta += omega * STEP
        acc -= STEP
      }
      if (theta > MAX_ANGLE) { theta = MAX_ANGLE; omega *= -0.3 }
      if (theta < -MAX_ANGLE) { theta = -MAX_ANGLE; omega *= -0.3 }
      el.style.transform = `rotate(${theta.toFixed(5)}rad)`
      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
    io.observe(el)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      stop()
      io.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      el.style.transform = ''
    }
  }, [])

  return <span ref={ref} className={className}>{children}</span>
}
