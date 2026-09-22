'use client'

import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

export function SimplePlayer({ playbackId }: { playbackId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const src = `https://stream.mux.com/${playbackId}.m3u8`

    let hls: Hls | null = null
    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(v)
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = src
    }

    return () => hls?.destroy()
  }, [playbackId])

  return <video ref={videoRef} controls style={{ width: '100%', maxWidth: 480 }} />
}
