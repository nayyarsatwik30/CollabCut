'use client'

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TL, smoothstep } from '../story'
import { THEME_ATTR, readTheme } from '../theme'
import { Backdrop } from './Backdrop'
import { Burst } from './Burst'
import { Butterflies, type PointerState } from './Butterflies'
import { ReelFlowers } from './ReelFlowers'
import { buildEnvironment } from './environment'
import { Glow } from './Glow'
import { applyPalette, palette } from './palette'
import { Spheres } from './Spheres'
import { Trails } from './Trails'
import { createSceneState } from './state'
import { SCENE, type Quality } from './quality'

// Keeps the scene on the page's theme. Background and fog share the palette's
// colour objects, so following a theme change is one in-place update.
function ThemeSync() {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const fog = new THREE.Fog(0, 8.5, 19)
    fog.color = palette.bg
    scene.background = palette.bg
    scene.fog = fog
    const sync = () => {
      applyPalette(readTheme())
      invalidate()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTR] })
    return () => {
      observer.disconnect()
      scene.background = null
      scene.fog = null
    }
  }, [scene, invalidate])
  return null
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

  // Fiber restarts its clock from zero whenever the frame loop is paused or
  // resumed, but a burst is timed against that clock. A stored timestamp from
  // before the pause would then read as a burst that has not happened yet
  // (a negative age, so a huge flash). The merge flash lasts about two
  // seconds, so after a pause it is over; mark it expired.
  useEffect(() => {
    state.burstStart = -1
  }, [active, state])

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
        <ThemeSync />
        <StudioEnvironment />
        <CameraRig pointer={pointer} progress={progress} />
        <Backdrop state={state} progress={progress} />
        {/* Order matters: the flowers place their heads, the spheres grow out of
            them, and the butterflies read both. */}
        <ReelFlowers state={state} progress={progress} count={quality.flowers} size={SCENE.flowerSize} />
        <Spheres state={state} progress={progress} />
        <Butterflies count={quality.butterflies} flowers={quality.flowers} pointer={pointer} progress={progress} state={state} />
        <Trails state={state} segments={quality.trailSegments} embers={quality.embers} />
        <Burst state={state} />
        {quality.bloom && <Glow progress={progress} />}
        <AdaptiveDpr max={quality.maxDpr} />
      </Canvas>
    </div>
  )
}
