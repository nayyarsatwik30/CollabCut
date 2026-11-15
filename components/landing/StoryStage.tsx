'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { detectTier, qualityFor, MOBILE_QUERY, REDUCED_MOTION_QUERY, type Tier } from './scene/quality'
import { STORY_SCROLL_VH, TL, clamp01, smoothstep } from './story'

// three.js and the scene live in their own chunk, fetched only after the
// hero text has painted and only on devices that will actually render it.
const SceneCanvas = dynamic(() => import('./scene/SceneCanvas'), { ssr: false })

function StaticButterflies() {
  const items = [
    { left: '58%', top: '18%', size: 120, rotate: -18, opacity: 0.9 },
    { left: '78%', top: '34%', size: 72, rotate: 24, opacity: 0.55 },
    { left: '44%', top: '40%', size: 54, rotate: -34, opacity: 0.35 },
    { left: '70%', top: '56%', size: 92, rotate: 8, opacity: 0.7 },
    { left: '88%', top: '12%', size: 44, rotate: 40, opacity: 0.3 },
  ]
  return (
    <div className="lp-static-flutter" aria-hidden="true">
      {items.map((b, i) => (
        <svg key={i} viewBox="-50 -42 100 84" width={b.size} height={b.size * 0.84} style={{ left: b.left, top: b.top, opacity: b.opacity, transform: `rotate(${b.rotate}deg)` }}>
          <g fill="currentColor">
            <path d="M0 0C10-30 40-38 46-22C50-8 30 2 0 2Z" opacity=".92" />
            <path d="M0 2C22 4 36 14 30 26C24 36 8 26 0 6Z" opacity=".7" />
            <path d="M0 0C-7-26-30-32-34-19C-37-7-22 2 0 2Z" opacity=".6" />
            <path d="M0 2C-16 4-27 13-22 23C-18 31-6 23 0 6Z" opacity=".45" />
            <ellipse cx="0" cy="3" rx="1.6" ry="10" opacity=".35" />
          </g>
        </svg>
      ))}
    </div>
  )
}

// The hero and the "all your tools" story share one pinned stage and one
// canvas. Two modes:
//  - static (server render, phones, reduced motion, no WebGL2): ordinary
//    stacked blocks, everything readable, nothing pinned.
//  - pinned: the section becomes STORY_SCROLL_VH tall with a sticky viewport;
//    scroll position drives the captions here and the 3D scene via `progress`.
export function StoryStage({ hero, captionA, captionB }: { hero: ReactNode; captionA: ReactNode; captionB: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const aRef = useRef<HTMLDivElement>(null)
  const bRef = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const [mode, setMode] = useState<'static' | 'pinned'>('static')
  const [tier, setTier] = useState<Tier | null>(null)
  const [active, setActive] = useState(true)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  // Pin immediately when the device allows it; pick the 3D tier once idle.
  useEffect(() => {
    const queries = [window.matchMedia(MOBILE_QUERY), window.matchMedia(REDUCED_MOTION_QUERY)]
    const pinnable = () => !queries.some((q) => q.matches)
    let idleId = 0
    const idle = 'requestIdleCallback' in window
    const decideTier = () => {
      const t = detectTier()
      setTier(t)
      setMode(t === 'none' ? 'static' : 'pinned')
    }
    const decide = () => {
      setMode(pinnable() ? 'pinned' : 'static')
      idleId = idle ? window.requestIdleCallback(decideTier, { timeout: 1200 }) : window.setTimeout(decideTier, 250)
    }
    const cancel = () => (idle ? window.cancelIdleCallback(idleId) : clearTimeout(idleId))
    decide()
    const onChange = () => { cancel(); decide() }
    queries.forEach((q) => q.addEventListener('change', onChange))
    return () => {
      cancel()
      queries.forEach((q) => q.removeEventListener('change', onChange))
    }
  }, [])

  // Render only while the stage is on screen and the tab is visible.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    let onScreen = true
    const update = () => setActive(onScreen && !document.hidden)
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update() })
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])

  // Scroll -> progress -> caption styles. Reads layout once per frame at most,
  // writes only opacity/transform.
  useEffect(() => {
    const section = sectionRef.current
    const layers = [heroRef.current, aRef.current, bRef.current]
    if (mode !== 'pinned' || !section) {
      progress.current = 0
      layers.forEach((el) => el?.removeAttribute('style'))
      return
    }
    let raf = 0
    const show = (el: HTMLElement | null, opacity: number, y: number) => {
      if (!el) return
      el.style.opacity = opacity.toFixed(3)
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
      el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible'
    }
    const apply = () => {
      raf = 0
      const rect = section.getBoundingClientRect()
      const range = rect.height - window.innerHeight
      const p = range > 0 ? clamp01(-rect.top / range) : 0
      progress.current = p
      show(heroRef.current, 1 - smoothstep(TL.heroOut[0], TL.heroOut[1], p), -p * 420)
      const aIn = smoothstep(TL.captionAIn[0], TL.captionAIn[1], p)
      const aOut = smoothstep(TL.captionAOut[0], TL.captionAOut[1], p)
      show(aRef.current, aIn * (1 - aOut), (1 - aIn) * 28 - aOut * 28)
      const bIn = smoothstep(TL.captionBIn[0], TL.captionBIn[1], p)
      show(bRef.current, bIn, (1 - bIn) * 24)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply) }
    apply()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [mode])

  useEffect(() => { if (tier === 'none') setReady(false) }, [tier])

  const webgl = mode === 'pinned' && tier !== null && tier !== 'none'

  return (
    <section ref={sectionRef} className="lp-story" data-mode={mode} style={mode === 'pinned' ? { height: `${STORY_SCROLL_VH}vh` } : undefined} aria-label="Introduction">
      <div className="lp-story-sticky">
        <div className="lp-stage">
          {tier === 'none' && <StaticButterflies />}
          {webgl && (
            <div className="lp-stage-canvas" data-ready={ready} aria-hidden="true">
              <SceneCanvas quality={qualityFor(tier)} active={active} progress={progress} onReady={onReady} />
            </div>
          )}
          <div ref={heroRef} className="lp-stage-content">{hero}</div>
        </div>
        <div ref={aRef} className="lp-caption lp-caption-a">{captionA}</div>
        <div ref={bRef} className="lp-caption lp-caption-b">{captionB}</div>
      </div>
    </section>
  )
}
