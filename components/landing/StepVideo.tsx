'use client'

import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'

// A 16:9 slot for a step's screen recording.
//
// The frame underneath (black, hairline border, play icon, "Demo video") is
// always rendered and is the finished empty state. When `src` is given, the
// video is layered on top and fades in once it has a frame to show; if it
// fails to load, the frame simply stays. Same box either way: no layout shift.
//
// Playback: muted, looped, inline, preload="metadata". It plays only while
// at least a third of it is on screen and pauses when it leaves. Under
// reduced motion it never autoplays; the viewer gets controls instead.
export function StepVideo({ src, poster, number, name }: { src?: string; poster?: string; number: string; name: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [shown, setShown] = useState(false)
  const [failed, setFailed] = useState(false)
  const [manual, setManual] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video || !src || failed) return
    // The file may already be loaded (or already have failed) before hydration.
    if (video.readyState >= 2) setShown(true)
    if (video.error) { setFailed(true); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setManual(true)
      return
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {})
      else video.pause()
    }, { threshold: 0.35 })
    io.observe(video)
    return () => {
      io.disconnect()
      video.pause()
    }
  }, [src, failed])

  const hasVideo = Boolean(src) && !failed
  // With controls (reduced motion) the video shows straight away, so the
  // play button is reachable even if the browser has not decoded a frame yet.
  const visible = hasVideo && (shown || manual)

  return (
    <div className="lp-step-media" data-state={visible ? 'video' : 'empty'}>
      <div className="lp-step-frame" aria-hidden={visible ? true : undefined}>
        <Play size={18} strokeWidth={1.5} aria-hidden="true" />
        <span className="lp-step-frame-label">Demo video</span>
      </div>
      {hasVideo && (
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          controls={manual}
          aria-label={`Screen recording: step ${Number(number)}, ${name}`}
          onLoadedData={() => setShown(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
