'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUpRight } from '@/components/ui/icons'

// The magnetic "venom" button: an accent pill that reaches for the cursor.
//
// Two layers. The label is a real link sitting over the pill; it is what you
// click, tab to and read. Under it is a decorative SVG layer holding the pill
// plus a chain of blobs and some loose drops, all run through a blur +
// alpha-threshold filter so that separate circles melt into one gooey body.
//
// Without a fine pointer, or with reduced motion, none of that mounts: the
// link is simply a plain accent pill.
//
// All numbers below are at the design size (200 x 60) and scale with `width`.
const DESIGN_W = 200
const DESIGN_H = 60
const BLOB_RADII = [19, 18, 16, 14.5, 12.5, 10.5, 8.5, 6.5]
const BLOB_STIFFNESS = [0.22, 0.19, 0.16, 0.14, 0.12, 0.1, 0.085, 0.07]
const DAMPING = 0.78
const REACH = 140 // how close the cursor has to come
const PILL_MAX_X = 22
const PILL_MAX_Y = 14
const BLUR = 11
const STRAY_COUNT = 5
const STRAY_REROLL = 0.35 // seconds between new drift offsets
const STRAY_GRAVITY = 0.06
const STRAY_DAMPING = 0.82
const SPLAT_COUNT = 10
const STEP_MS = 1000 / 60 // the constants above are per step at 60 Hz

const GOO_QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface Body { x: number; y: number; vx: number; vy: number }
interface Drop extends Body { r: number; size: number; ox: number; oy: number }

// Two variants:
//  - 'solid' (Sign up): the accent pill is always there and reaches for a
//    cursor that comes near.
//  - 'reveal' (Sign in): plain text at rest. Hovering it brings the pill up
//    underneath, in the page's text colour, and from then on it behaves like
//    the solid one until the cursor has gone out of reach, when it fades back
//    to plain text.
export function MagneticButton({ href, label, width = 120, variant = 'solid' }: { href: string; label: string; width?: number; variant?: 'solid' | 'reveal' }) {
  const reveal = variant === 'reveal'
  const s = width / DESIGN_W
  const height = (width * DESIGN_H) / DESIGN_W
  const [goo, setGoo] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const pillRef = useRef<SVGRectElement>(null)
  const blobRefs = useRef<(SVGCircleElement | null)[]>([])
  const dropRefs = useRef<(SVGCircleElement | null)[]>([])
  const splatRef = useRef<() => void>(() => {})
  const filterId = `lp-goo-${useId().replace(/:/g, '')}`

  useEffect(() => {
    const query = window.matchMedia(GOO_QUERY)
    const update = () => setGoo(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    const link = linkRef.current
    if (!goo || !wrap || !link) return

    const half = height / 2
    const cx = width / 2
    const cy = half
    const reach = REACH * s
    const pill: Body = { x: 0, y: 0, vx: 0, vy: 0 } // offset from rest
    const blobs: Body[] = BLOB_RADII.map(() => ({ x: cx, y: cy, vx: 0, vy: 0 }))
    const drops: Drop[] = Array.from({ length: STRAY_COUNT + SPLAT_COUNT }, (_, i) => ({
      x: cx, y: cy, vx: 0, vy: 0, r: 0, ox: 0, oy: 0,
      size: i < STRAY_COUNT ? (3 + Math.random() * 4) * s : 0,
    }))
    const blobR = new Float32Array(BLOB_RADII.length)
    let mouseX = 0
    let mouseY = 0
    let present = false // the cursor is somewhere in the window
    let armed = !reveal // 'reveal' only wakes once the link itself is hovered
    const arm = (on: boolean) => {
      if (!reveal || armed === on) return
      armed = on
      wrap.dataset.shown = on ? 'on' : 'off'
    }
    let raf = 0
    let running = false
    let last = 0
    let acc = 0
    let time = 0
    let rolled = -1

    // One 60 Hz step. Returns whether anything is still moving.
    const step = (left: number, top: number) => {
      time += 1 / 60
      const lx = mouseX - left
      const ly = mouseY - top
      // Nearest point of the resting pill to the cursor: the pill is a
      // capsule, so that is the nearest point on its axis, pushed out by its radius.
      const ax = clamp(lx, half, width - half)
      const dx = lx - ax
      const dy = ly - cy
      const dl = Math.hypot(dx, dy) || 1e-4
      const ux = dx / dl
      const uy = dy / dl
      const prox = present && armed ? clamp(1 - (dl - half) / reach, 0, 1) : 0
      // Out of reach: a revealed pill goes back to being plain text.
      if (prox <= 0) arm(false)
      let moving = prox > 0

      // The pill leans toward the cursor on a damped spring.
      const tx = clamp((lx - cx) * 0.3 * prox, -PILL_MAX_X * s, PILL_MAX_X * s)
      const ty = clamp((ly - cy) * 0.3 * prox, -PILL_MAX_Y * s, PILL_MAX_Y * s)
      pill.vx = (pill.vx + (tx - pill.x) * 0.14) * DAMPING
      pill.vy = (pill.vy + (ty - pill.y) * 0.14) * DAMPING
      pill.x += pill.vx
      pill.y += pill.vy
      if (Math.abs(pill.x) + Math.abs(pill.y) + Math.abs(pill.vx) + Math.abs(pill.vy) > 0.05) moving = true

      // The chain is strung from just inside the pill's nearest edge out to
      // the cursor. Far away it only reaches part of the way.
      const ex = ax + pill.x + ux * half * 0.8
      const ey = cy + pill.y + uy * half * 0.8
      const extend = Math.min(1, prox * 1.8)
      const swell = 0.5 + 0.5 * prox
      for (let k = 0; k < blobs.length; k++) {
        const b = blobs[k]
        let gx = cx + pill.x
        let gy = cy + pill.y
        if (prox > 0) {
          const f = ((k + 1) / blobs.length) * extend
          // Sideways wobble, perpendicular to the pull.
          const wobble = Math.sin(time * 5 + k * 1.9) * (7 + k * 1.6) * s * prox
          gx = ex + (lx - ex) * f - uy * wobble
          gy = ey + (ly - ey) * f + ux * wobble
        }
        b.vx = (b.vx + (gx - b.x) * BLOB_STIFFNESS[k]) * DAMPING
        b.vy = (b.vy + (gy - b.y) * BLOB_STIFFNESS[k]) * DAMPING
        b.x += b.vx
        b.y += b.vy
        blobR[k] = BLOB_RADII[k] * s * swell
        if (Math.abs(gx - b.x) + Math.abs(gy - b.y) + Math.abs(b.vx) + Math.abs(b.vy) > 0.05) moving = true
      }

      // Stray drops drift around the cursor; their offsets are re-rolled every so often.
      const reroll = Math.floor(time / STRAY_REROLL) !== rolled
      if (reroll) rolled = Math.floor(time / STRAY_REROLL)
      const near = prox > 0.05
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]
        if (i < STRAY_COUNT) {
          if (reroll) {
            d.ox = (Math.random() - 0.5) * 56 * s
            d.oy = (Math.random() - 0.5) * 56 * s
          }
          if (near) {
            // A drop that had gone is born again from the pill's edge.
            if (d.r < 0.05) { d.x = ex; d.y = ey; d.vx = 0; d.vy = 0 }
            d.vx += (lx + d.ox - d.x) * 0.05
            d.vy += (ly + d.oy - d.y) * 0.05
          }
          d.vy += STRAY_GRAVITY
          // Held near the cursor they are well damped; let go, they fall away.
          const damping = near ? STRAY_DAMPING : 0.96
          d.vx *= damping
          d.vy *= damping
          d.r += ((near ? d.size * (0.4 + 0.6 * prox) : 0) - d.r) * 0.12
        } else {
          // Splat drops: thrown out by a click, shrinking as they go.
          d.vy += STRAY_GRAVITY
          d.vx *= 0.9
          d.vy *= 0.9
          d.r *= 0.93
        }
        if (d.r < 0.05) d.r = 0
        d.x += d.vx
        d.y += d.vy
        if (d.r > 0) moving = true
      }
      return moving
    }

    const render = () => {
      pillRef.current?.setAttribute('transform', `translate(${pill.x.toFixed(2)} ${pill.y.toFixed(2)})`)
      link.style.transform = `translate3d(${pill.x.toFixed(2)}px, ${pill.y.toFixed(2)}px, 0)`
      blobs.forEach((b, k) => {
        const el = blobRefs.current[k]
        if (!el) return
        el.setAttribute('cx', b.x.toFixed(2))
        el.setAttribute('cy', b.y.toFixed(2))
        el.setAttribute('r', blobR[k].toFixed(2))
      })
      drops.forEach((d, i) => {
        const el = dropRefs.current[i]
        if (!el) return
        el.setAttribute('cx', d.x.toFixed(2))
        el.setAttribute('cy', d.y.toFixed(2))
        el.setAttribute('r', d.r.toFixed(2))
      })
    }

    // Runs only while something is moving, then stops until the cursor comes back.
    const frame = (now: number) => {
      acc += Math.min(now - last, 50)
      last = now
      const rect = wrap.getBoundingClientRect()
      let moving = true
      while (acc >= STEP_MS) {
        moving = step(rect.left, rect.top)
        acc -= STEP_MS
      }
      render()
      if (moving) raf = requestAnimationFrame(frame)
      else running = false
    }
    const start = () => {
      if (running) return
      running = true
      last = performance.now()
      acc = STEP_MS
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      mouseX = e.clientX
      mouseY = e.clientY
      present = true
      if (running || !armed) return
      const rect = wrap.getBoundingClientRect()
      const ax = clamp(mouseX - rect.left, half, width - half)
      if (Math.hypot(mouseX - rect.left - ax, mouseY - rect.top - cy) - half < reach) start()
    }
    const onLeave = () => { present = false }
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      mouseX = e.clientX
      mouseY = e.clientY
      present = true
      arm(true)
      start()
    }

    splatRef.current = () => {
      for (let i = STRAY_COUNT; i < drops.length; i++) {
        const d = drops[i]
        const angle = Math.random() * Math.PI * 2
        const speed = (10 + Math.random() * 14) * s
        d.x = cx + pill.x + Math.cos(angle) * half * 0.6
        d.y = cy + pill.y + Math.sin(angle) * half * 0.6
        d.vx = Math.cos(angle) * speed
        d.vy = Math.sin(angle) * speed
        d.r = (9 + Math.random() * 7) * s
      }
      // The pill and the chain take the kick too, then settle back.
      pill.vy += 5 * s
      blobs.forEach((b) => { b.vx += (Math.random() - 0.5) * 16 * s; b.vy += (Math.random() - 0.5) * 16 * s })
      start()
    }

    render()
    if (reveal) link.addEventListener('pointerenter', onEnter)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      link.removeEventListener('pointerenter', onEnter)
      delete wrap.dataset.shown
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      splatRef.current = () => {}
      link.style.transform = ''
    }
  }, [goo, width, height, s, reveal])

  // The filter has to cover everything the goo can reach.
  const pad = REACH * s + 48

  return (
    <span ref={wrapRef} className={reveal ? 'lp-magnet lp-magnet-reveal' : 'lp-magnet'} data-goo={goo ? 'on' : 'off'} style={{ width, height }}>
      {goo && (
        <svg className="lp-magnet-goo" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          <defs>
            <filter id={filterId} filterUnits="userSpaceOnUse" x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={BLUR * s} result="blur" />
              <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12" result="goo" />
              {/* A thin edge in --accent-edge behind the body: ink in Light, nothing in Dark. */}
              <feMorphology in="goo" operator="dilate" radius="1" result="fat" />
              <feFlood style={{ floodColor: 'var(--accent-edge)' }} result="ink" />
              <feComposite in="ink" in2="fat" operator="in" result="edge" />
              <feMerge>
                <feMergeNode in="edge" />
                <feMergeNode in="goo" />
              </feMerge>
            </filter>
          </defs>
          <g filter={`url(#${filterId})`} style={{ fill: reveal ? 'var(--fg)' : 'var(--accent)' }}>
            <rect ref={pillRef} x={0} y={0} width={width} height={height} rx={height / 2} />
            {BLOB_RADII.map((_, k) => <circle key={`b${k}`} ref={(el) => { blobRefs.current[k] = el }} cx={width / 2} cy={height / 2} r={0} />)}
            {Array.from({ length: STRAY_COUNT + SPLAT_COUNT }, (_, i) => <circle key={`d${i}`} ref={(el) => { dropRefs.current[i] = el }} cx={width / 2} cy={height / 2} r={0} />)}
          </g>
        </svg>
      )}
      <Link ref={linkRef} className="lp-magnet-link" href={href} onClick={() => splatRef.current()}>
        {label}{!reveal && <> <ArrowUpRight tone="inherit" size={14} aria-hidden="true" /></>}
      </Link>
    </span>
  )
}
