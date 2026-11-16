'use client'

import { useEffect } from 'react'

// Ties each step's text to the scroll position: as a step travels from the
// lower part of the viewport to its centre, `--rise` on that step goes 0 -> 1,
// and CSS turns that into the text coming up out of shadow (opacity, blur,
// a small upward move). Scrolling back down the page reverses it. Nothing is
// pinned and scrolling is never intercepted; this only reads the position.
//
// Without JavaScript, and under reduced motion, `--rise` is never set and the
// text is simply visible.
const START = 0.94 // step centre at this fraction of the viewport height: fully in shadow
const END = 0.54 // ...and at this one: fully risen

export function StepsRise({ target }: { target: string }) {
  useEffect(() => {
    const section = document.querySelector<HTMLElement>(target)
    if (!section) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const steps = Array.from(section.querySelectorAll<HTMLElement>('.lp-step'))
    let frame = 0
    let near = false

    const update = () => {
      frame = 0
      const vh = window.innerHeight
      for (const step of steps) {
        const text = step.querySelector<HTMLElement>('.lp-step-text')
        const rect = (text ?? step).getBoundingClientRect()
        const centre = (rect.top + rect.height / 2) / vh
        const t = Math.min(1, Math.max(0, (START - centre) / (START - END)))
        // Slow, smooth ease in and out.
        const eased = t * t * t * (t * (t * 6 - 15) + 10)
        step.style.setProperty('--rise', eased.toFixed(3))
      }
    }
    const request = () => { if (near && !frame) frame = requestAnimationFrame(update) }

    // Only listen to scroll while the section is near the viewport.
    const io = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting
      if (near) request()
    }, { rootMargin: '60% 0px 60% 0px' })
    io.observe(section)
    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      if (frame) cancelAnimationFrame(frame)
      for (const step of steps) step.style.removeProperty('--rise')
    }
  }, [target])

  return null
}
