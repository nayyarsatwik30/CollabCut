'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
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
  const videoRef     = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [muted,       setMuted]       = useState(false)
  const [volume,      setVolume]      = useState(1)
  const [showVolume,  setShowVolume]  = useState(false)

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }, [])

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
      videoRef.current.muted  = val === 0
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
      if (e.key === 'ArrowLeft')  stepFrame(-1)
      if (e.key === 'ArrowRight') stepFrame(1)
      if (e.key === 'm') toggleMute()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, stepFrame])

  const activeComment = comments.find((c) => Math.abs(c.timeSec - currentTime) < 0.4)

  const openCount   = comments.filter((c) => !c.resolved).length
  const resolvedCnt = comments.filter((c) =>  c.resolved).length

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-1 bg-black flex items-center justify-center relative overflow-hidden min-h-0 cursor-pointer"
        onClick={togglePlay}
      >
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
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

        {src && !playing && (
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
              : <Play  size={16} className="text-th-accent-fg ml-0.5" />
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