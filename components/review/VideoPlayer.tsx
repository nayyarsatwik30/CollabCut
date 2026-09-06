'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Hls from 'hls.js'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Download } from 'lucide-react'
import { Comment } from '@/lib/types'
import { formatTimecode } from '@/lib/utils'
import { FilmScrubber } from './FilmScrubber'

interface VideoPlayerProps {
  src?: string
  comments: Comment[]
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (dur: number) => void
  approved?: boolean
}

export function VideoPlayer({ src, comments, onTimeUpdate, onDurationChange, approved }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showVolume, setShowVolume] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return

    setVideoReady(false)
    setVideoError(false)
    let hls: Hls | null = null

    // Safety net: if nothing (success or error event) resolves the loading
    // state within a reasonable window, surface an error instead of leaving
    // the spinner spinning forever.
    const stallTimeout = setTimeout(() => {
      setVideoReady((ready) => {
        // TEMP DEBUG - remove after diagnosing the playback failure
        if (!ready) console.log('[VideoPlayer debug] 20s stall timeout fired with no ready/error event - forcing error UI')
        if (!ready) setVideoError(true)
        return ready
      })
    }, 20000)

    const isM3u8 = src.includes('.m3u8')
    const hlsSupported = Hls.isSupported()
    const nativeHlsSupport = v.canPlayType('application/vnd.apple.mpegurl')

    // TEMP DEBUG - remove after diagnosing the playback failure
    console.log('[VideoPlayer debug] branch check:', { isM3u8, hlsSupported, nativeHlsSupport: JSON.stringify(nativeHlsSupport), src })

    if (isM3u8 && hlsSupported) {
      // Primary path: hls.js supported (Chrome/Firefox/Edge and any other
      // browser with Media Source Extensions). This must be checked first -
      // canPlayType() is not a reliable signal to gate this on.
      // TEMP DEBUG - remove after diagnosing the playback failure
      console.log('[VideoPlayer debug] creating new Hls instance for src:', src)
      hls = new Hls()
      hls.on(Hls.Events.ERROR, (_event, data) => {
        // TEMP DEBUG - remove after diagnosing the playback failure
        // (logging the raw `data` object directly, not via JSON.stringify -
        // hls.js error payloads can carry circular frag/context references
        // that would throw on stringify)
        console.log('[VideoPlayer debug] hls.js ERROR event:', {
          fatal: data.fatal,
          type: data.type,
          details: data.details,
          reason: (data as any).reason,
          url: (data as any).url ?? (data as any).response?.url ?? (data as any).frag?.url,
          httpStatus: (data as any).response?.code,
          errorMessage: (data as any).error?.message,
        })
        console.log('[VideoPlayer debug] hls.js ERROR event (raw):', data)
        if (!data.fatal) return
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[VideoPlayer debug] fatal network error, calling hls.startLoad() to retry')
            hls?.startLoad()
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[VideoPlayer debug] fatal media error, calling hls.recoverMediaError()')
            hls?.recoverMediaError()
            break
          default:
            console.log('[VideoPlayer debug] fatal unrecoverable error, destroying hls instance and surfacing error UI')
            setVideoError(true)
            hls?.destroy()
            break
        }
      })
      console.log('[VideoPlayer debug] calling hls.loadSource()', src)
      hls.loadSource(src)
      console.log('[VideoPlayer debug] calling hls.attachMedia()')
      hls.attachMedia(v)
    } else if (isM3u8 && nativeHlsSupport !== '') {
      // Fallback: hls.js unsupported but the browser can play HLS natively
      // (Safari). Only reached when hlsSupported is false.
      console.log('[VideoPlayer debug] hls.js unsupported, using native <video> src for:', src)
      v.src = src
    } else if (!isM3u8) {
      // Not an HLS stream at all - play as a normal direct source.
      console.log('[VideoPlayer debug] non-.m3u8 src, setting directly:', src)
      v.src = src
    } else {
      // .m3u8 source but neither hls.js nor native HLS support exists.
      console.log('[VideoPlayer debug] no hls.js and no native HLS support - cannot play', src)
      setVideoError(true)
    }

    return () => {
      clearTimeout(stallTimeout)
      if (hls) {
        // TEMP DEBUG - remove after diagnosing the playback failure
        console.log('[VideoPlayer debug] effect cleanup - destroying hls instance for src:', src)
      }
      hls?.destroy()
    }
  }, [src, reloadKey])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v || !src) return
    const playPromise = v.paused ? v.play() : v.pause()
    if (playPromise && typeof (playPromise as any).catch === 'function') {
      (playPromise as Promise<void>).catch(() => { })
    }
  }, [src])

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current
    if (!v || !isFinite(time)) return
    v.currentTime = Math.min(Math.max(0, time), duration)
  }, [duration])

  const stepFrame = useCallback((dir: 1 | -1) => {
    seekTo(currentTime + (dir / 24))
  }, [currentTime, seekTo])

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    onTimeUpdate?.(v.currentTime)
  }, [onTimeUpdate])

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setDuration(v.duration)
    onDurationChange?.(v.duration)
  }, [onDurationChange])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
    }
    setMuted(val === 0)
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !muted
    setMuted(!muted)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowLeft') stepFrame(-1)
      if (e.key === 'ArrowRight') stepFrame(1)
      if (e.key === 'm') toggleMute()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, stepFrame])

  const activeComment = comments.find((c) => Math.abs(c.timeSec - currentTime) < 0.4)

  const openCount = comments.filter((c) => !c.resolved).length
  const resolvedCnt = comments.filter((c) => c.resolved).length

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0 cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 0 }}
        onClick={togglePlay}
      >
        {src ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onCanPlay={() => setVideoReady(true)}
            onWaiting={() => setVideoReady(false)}
            onPlaying={() => setVideoReady(true)}
            onError={(e) => {
              // TEMP DEBUG - remove after diagnosing the playback failure
              const mediaError = (e.target as HTMLVideoElement).error
              console.log('[VideoPlayer debug] native <video> onError:', {
                code: mediaError?.code,
                message: mediaError?.message,
                currentSrc: (e.target as HTMLVideoElement).currentSrc,
              })
              setVideoError(true)
            }}
            playsInline
          />
        ) : (
          <div className="text-center text-white/60">
            <p className="text-[13px]">No video source available</p>
          </div>
        )}

        {src && (
          <div className="absolute bottom-3 left-3 font-mono text-[13px] text-th-accent bg-black/65 px-2.5 py-1 rounded pointer-events-none tracking-widest">
            {formatTimecode(currentTime)}
          </div>
        )}

        {approved && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-th-resolved text-white text-[11px] font-bold px-3 py-1 rounded-th-full pointer-events-none">
            ✓ APPROVED
          </div>
        )}

        {activeComment && (
          <div className="comment-bubble border border-th-open/40">
            {activeComment.text}
          </div>
        )}

        {src && videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center px-4">
              <p className="text-white text-[13px] font-medium mb-1">Couldn't load this video</p>
              <p className="text-white/60 text-[11px] mb-3">The stream failed to load. Try again, or refresh the page.</p>
              <button
                onClick={(e) => { e.stopPropagation(); setReloadKey((k) => k + 1) }}
                className="pointer-events-auto px-3.5 py-1.5 rounded-th-sm bg-white/10 border border-white/20 text-white text-[12px] hover:bg-white/20 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {src && !videoReady && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
            <div className="w-8 h-8 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          </div>
        )}

        {src && videoReady && !videoError && !playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Play size={22} className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-th-surface border-t border-th-border shrink-0">
        <FilmScrubber
          currentTime={currentTime}
          duration={duration}
          comments={comments}
          onSeek={seekTo}
        />

        <div className="flex items-center gap-2 px-4 pb-3">
          <button onClick={() => stepFrame(-1)} title="Previous frame (←)"
            className="w-8 h-8 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-th-muted hover:text-th-text hover:bg-th-surface-hov transition-colors btn-press">
            <SkipBack size={14} />
          </button>

          <button onClick={togglePlay} title="Play/Pause (Space)"
            className="w-9 h-9 rounded-full bg-th-accent flex items-center justify-center btn-press hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 4px 12px color-mix(in srgb, var(--th-accent) 40%, transparent)' }}>
            {playing
              ? <Pause size={16} className="text-th-accent-fg" />
              : <Play size={16} className="text-th-accent-fg ml-0.5" />
            }
          </button>

          <button onClick={() => stepFrame(1)} title="Next frame (→)"
            className="w-8 h-8 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-th-muted hover:text-th-text hover:bg-th-surface-hov transition-colors btn-press">
            <SkipForward size={14} />
          </button>

          <div className="relative flex items-center gap-1.5"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}>
            <button onClick={toggleMute}
              className="w-8 h-8 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-th-muted hover:text-th-text transition-colors btn-press">
              {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            {showVolume && (
              <div className="absolute left-0 bottom-full mb-2 bg-th-surface border border-th-border rounded-th-sm p-2 shadow-panel">
                <input
                  type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-th-accent"
                  style={{ accentColor: 'var(--th-accent)' }}
                />
              </div>
            )}
          </div>

          <div className="ml-2 flex items-center gap-3 font-mono text-[11px] text-th-muted">
            <span style={{ color: 'var(--th-open)' }}>{openCount} open</span>
            <span style={{ color: 'var(--th-resolved)' }}>{resolvedCnt} resolved</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href={src ?? '#'}
              download
              className="w-8 h-8 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-th-muted hover:text-th-text transition-colors btn-press"
              title="Download"
              onClick={(e) => !src && e.preventDefault()}
            >
              <Download size={13} />
            </a>
            <button onClick={toggleFullscreen}
              className="w-8 h-8 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-th-muted hover:text-th-text transition-colors btn-press"
              title="Fullscreen">
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}