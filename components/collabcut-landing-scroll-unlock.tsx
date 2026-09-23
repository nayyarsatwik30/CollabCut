'use client'
import { useEffect } from 'react'

// The app shell (Board/Dashboard/Review) relies on html/body having
// overflow:hidden with internal-panel scrolling. The marketing landing
// pages are long, normally-scrolling pages, so they opt out of that
// rule for as long as they're mounted, and restore it on unmount.
export function LandingScrollUnlock() {
  useEffect(() => {
    document.documentElement.classList.add('cc-scroll-unlocked')
    document.body.classList.add('cc-scroll-unlocked')
    return () => {
      document.documentElement.classList.remove('cc-scroll-unlocked')
      document.body.classList.remove('cc-scroll-unlocked')
    }
  }, [])
  return null
}
