'use client'

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { TL, smoothstep } from '../story'
import { Backdrop } from './Backdrop'
import { Burst } from './Burst'
import { Butterflies, type PointerState } from './Butterflies'
import { buildEnvironment } from './environment'
import { Glow } from './Glow'
import { Spheres } from './Spheres'
import { Trails } from './Trails'
import { createSceneState } from './state'
import type { Quality } from './quality'

// Palette comes from the landing's CSS tokens so a palette swap in
// landing.css reaches the shaders too.
function readTokens() {
  const root = document.querySelector('.lp') ?? document.documentElement
  const style = getComputedStyle(root)
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return { bg: get('--bg', '#000000'), fg: get('--fg', '#ffffff'), glow: get('--glow', '#ffffff') }
}

// Steps resolution down if the device can't hold ~45fps.
function AdaptiveDpr({ max }: { max: number }) {
  const setDpr = useThree((s) => s.setDpr)
  const acc = useRef({ frames: 0, time: 0, dpr: Math.min(max, window.devicePixelRatio || 1) })
  useFrame((_, delta) => {
    const a = acc.current
    a.frames++
    a.time += Math.min(delta, 0.1)
    if (a.frames < 90) return
    if (a.time / a.frames > 1 / 45 && a.dpr > 1) {
      a.dpr = Math.max(1, a.dpr - 0.25)
      setDpr(a.dpr)
    }
    a.frames = 0
    a.time = 0
  })
  return null
}

// Procedural studio lighting for the physically based spheres.
function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const target = buildEnvironment(gl)
    scene.environment = target.texture
    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene])
  return null
}

// Slight handheld drift, a touch of cursor parallax, and a slow push-in as
// everything converges.
function CameraRig({ pointer, progress }: { pointer: MutableRefObject<PointerState>; progress: MutableRefObject<number> }) {
  const eased = useRef({ x: 0, y: 0 })
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime
    const p = progress.current
    const story = smoothstep(0.05, 0.2, p)
    const e = eased.current
    const h = 1 - Math.exp(-dt * 2.2)
    e.x += (pointer.current.x - e.x) * h
    e.y += (pointer.current.y - e.y) * h
    const cam = state.camera
    cam.position.x = (Math.sin(t * 0.13) * 0.14 + e.x * 0.22) * story
    cam.position.y = (Math.cos(t * 0.11) * 0.09 + e.y * 0.12) * story
    cam.position.z = 8 - 0.55 * smoothstep(TL.converge[0], TL.pop[1], p)
    cam.lookAt(0, 0, 0)
  })
  return null
}

export default function SceneCanvas({ quality, active, progress, onReady }: { quality: Quality; active: boolean; progress: MutableRefObject<number>; onReady: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const pointer = useRef<PointerState>({ x: 0.45, y: 0, lastMove: -1e9 })
  const tokens = useMemo(readTokens, [])
  const state = useMemo(createSceneState, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect()
      if (!r || !r.width || !r.height) return
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
      pointer.current.lastMove = performance.now()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        flat
        dpr={[1, quality.maxDpr]}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 35, position: [0, 0, 8], near: 0.1, far: 60 }}
        style={{ pointerEvents: 'none' }}
        onCreated={onReady}
      >
        <color attach="background" args={[tokens.bg]} />
        <fog attach="fog" args={[tokens.bg, 8.5, 19]} />
        <StudioEnvironment />
        <CameraRig pointer={pointer} progress={progress} />
        <Backdrop state={state} progress={progress} fg={tokens.fg} bg={tokens.bg} glow={tokens.glow} />
        <Butterflies count={quality.butterflies} pointer={pointer} progress={progress} fg={tokens.fg} bg={tokens.bg} />
        <Spheres state={state} progress={progress} fg={tokens.fg} bg={tokens.bg} glow={tokens.glow} />
        <Trails state={state} segments={quality.trailSegments} embers={quality.embers} glow={tokens.glow} />
        <Burst state={state} glow={tokens.glow} />
        {quality.bloom && <Glow progress={progress} />}
        <AdaptiveDpr max={quality.maxDpr} />
      </Canvas>
    </div>
  )
}
