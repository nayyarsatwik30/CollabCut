'use client'

import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface HlsVideoProps {
  src: string
  className?: string
}

// Plain <video src=".m3u8"> only plays in Safari - Chrome/Firefox/Edge need
// hls.js to demux the stream via MSE. Mirrors the loading logic in
// VideoPlayer, stripped down for the version-compare view's native controls.
export function HlsVideo({ src, className }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    let hls: Hls | null = null

    if (src.includes('.m3u8') && v.canPlayType('application/vnd.apple.mpegurl') === '') {
      if (Hls.isSupported()) {
        hls = new Hls()
        hls.loadSource(src)
        hls.attachMedia(v)
      }
    } else {
      v.src = src
    }

    return () => {
      hls?.destroy()
    }
  }, [src])

  return <video ref={videoRef} controls className={className} playsInline />
}
