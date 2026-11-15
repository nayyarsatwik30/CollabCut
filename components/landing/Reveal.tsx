'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Fades its children up the first time they scroll into view. The server
// render is fully visible; the hidden state is applied only after hydration,
// only to elements still below the fold, and never under reduced motion, so
// content can't get stuck invisible. The motion itself is CSS ([data-reveal]).
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
    el.dataset.reveal = 'pending'
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      el.dataset.reveal = 'in'
      io.disconnect()
    }, { rootMargin: '0px 0px -12% 0px' })
    io.observe(el)
    return () => {
      io.disconnect()
      delete el.dataset.reveal
    }
  }, [])

  return <div ref={ref} className={className} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</div>
}
