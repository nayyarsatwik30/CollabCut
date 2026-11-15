'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOW_LAYER } from './Glow'
import { TOOL_COUNT, type SceneState } from './state'

// Each sphere drags a ribbon built from where it has actually been over the
// last ~0.6s. Because the ribbon is the recorded path, it is longer when the
// sphere is fast, shorter when slow, and bends when the sphere turns. The
// brightness recorded at each point is the glow (speed) at that moment.
const TRAIL_SECONDS = 0.62

const TRAIL_VERT = /* glsl */ `
attribute vec2 aUv;
attribute float aI;
attribute float aSeed;
varying vec2 vUv;
varying float vI;
varying float vSeed;
void main() {
  vUv = aUv;
  vI = aI;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`

const TRAIL_FRAG = /* glsl */ `
uniform vec3 uGlow;
uniform float uTime;
varying vec2 vUv;
varying float vI;
varying float vSeed;
${NOISE}
void main() {
  float across = abs(vUv.y);
  float along = 1.0 - vUv.x;
  // Turbulence streaming backwards along the trail: burning air, not a clean line.
  float n1 = noise(vec2(vUv.x * 4.0 - uTime * 2.2 + vSeed * 17.0, vUv.y * 1.8 + uTime * 0.6));
  float n2 = noise(vec2(vUv.x * 17.0 - uTime * 5.5 + vSeed * 5.0, vUv.y * 5.5 - uTime * 1.3));
  float turb = 0.5 + 0.7 * n1 + 0.3 * n2;
  float wobble = (n1 - 0.5) * 0.16 * vUv.x;
  float a2 = (across + wobble) * (across + wobble);
  // A broad, dim body of disturbed air; only a short stretch right behind
  // the sphere is hot enough (above 1.0) to reach the bloom pass.
  float body = exp(-a2 * 4.5) * pow(along, 1.25) * 0.42;
  float hot = exp(-a2 * 20.0) * pow(along, 3.2) * 1.15;
  float smoke = smoothstep(0.15, 0.85, n1 * 0.75 + n2 * 0.45);
  float a = (body * (0.35 + 0.9 * smoke) + hot * turb) * vI;
  // The tail breaks up into wisps instead of ending on a clean edge.
  a *= smoothstep(0.0, 0.4, along + (n1 - 0.5) * 0.55);
  a *= 1.0 - smoothstep(0.8, 1.0, across);
  // Soft start: normally hidden behind the sphere, but a sphere that has
  // shrunk away must not leave a hard-edged trail head.
  a *= smoothstep(0.0, 0.12, vUv.x + 0.02);
  gl_FragColor = vec4(uGlow * a, 1.0);
}
`

const EMBER_VERT = /* glsl */ `
attribute float aLife;
attribute float aSize;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale * aLife / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const EMBER_FRAG = /* glsl */ `
uniform vec3 uGlow;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d)) * vLife * vLife;
  gl_FragColor = vec4(uGlow * a * 0.9, 1.0);
}
`

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const

export function Trails({ state, segments, embers, glow }: { state: SceneState; segments: number; embers: number; glow: string }) {
  const N = segments
  const step = TRAIL_SECONDS / N

  const trail = useMemo(() => {
    const verts = TOOL_COUNT * N * 2
    const position = new THREE.BufferAttribute(new Float32Array(verts * 3), 3)
    const intensity = new THREE.BufferAttribute(new Float32Array(verts), 1)
    position.setUsage(THREE.DynamicDrawUsage)
    intensity.setUsage(THREE.DynamicDrawUsage)
    const uv = new Float32Array(verts * 2)
    const seed = new Float32Array(verts)
    const index: number[] = []
    for (let i = 0; i < TOOL_COUNT; i++) {
      for (let k = 0; k < N; k++) {
        const v = (i * N + k) * 2
        uv[v * 2] = k / (N - 1); uv[v * 2 + 1] = -1
        uv[v * 2 + 2] = k / (N - 1); uv[v * 2 + 3] = 1
        seed[v] = i * 0.37; seed[v + 1] = i * 0.37
        if (k < N - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', position)
    geometry.setAttribute('aI', intensity)
    geometry.setAttribute('aUv', new THREE.BufferAttribute(uv, 2))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geometry.setIndex(index)
    const material = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: { uGlow: { value: new THREE.Color(glow) }, uTime: { value: 0 } },
      side: THREE.DoubleSide,
      ...additive,
    })
    return { geometry, material, position, intensity, hist: new Float32Array(TOOL_COUNT * N * 3), histI: new Float32Array(TOOL_COUNT * N), histR: new Float32Array(TOOL_COUNT * N), side: new Float32Array(TOOL_COUNT * 3) }
  }, [N, glow])

  const ember = useMemo(() => {
    const count = Math.max(1, embers)
    const position = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    const life = new THREE.BufferAttribute(new Float32Array(count), 1)
    const size = new THREE.BufferAttribute(new Float32Array(count), 1)
    position.setUsage(THREE.DynamicDrawUsage)
    life.setUsage(THREE.DynamicDrawUsage)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', position)
    geometry.setAttribute('aLife', life)
    geometry.setAttribute('aSize', size)
    const material = new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      uniforms: { uGlow: { value: new THREE.Color(glow) }, uScale: { value: 1 } },
      ...additive,
    })
    return { count, geometry, material, position, life, size, vel: new Float32Array(count * 3), decay: new Float32Array(count), next: 0, debt: new Float32Array(TOOL_COUNT) }
  }, [embers, glow])

  useEffect(() => () => { trail.geometry.dispose(); trail.material.dispose() }, [trail])
  useEffect(() => () => { ember.geometry.dispose(); ember.material.dispose() }, [ember])

  const clock = useRef({ acc: 0, started: false, frames: 0 })

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const { pos, vel, radius, glow: glowIn } = state
    const cam = frame.camera.position
    const { hist, histI, histR, side } = trail
    const P = trail.position.array as Float32Array
    const I = trail.intensity.array as Float32Array
    trail.material.uniforms.uTime.value = frame.clock.elapsedTime

    const c = clock.current
    c.acc += dt
    let shifts = 0
    while (c.acc >= step) { c.acc -= step; shifts++ }
    shifts = Math.min(shifts, N - 1)

    let anyGlow = 0
    for (let i = 0; i < TOOL_COUNT; i++) {
      const ix = i * 3
      const hb = i * N * 3
      const ib = i * N
      if (!c.started) {
        for (let k = 0; k < N; k++) { hist[hb + k * 3] = pos[ix]; hist[hb + k * 3 + 1] = pos[ix + 1]; hist[hb + k * 3 + 2] = pos[ix + 2] }
      }
      for (let s = 0; s < shifts; s++) {
        hist.copyWithin(hb + 3, hb, hb + (N - 1) * 3)
        histI.copyWithin(ib + 1, ib, ib + N - 1)
        histR.copyWithin(ib + 1, ib, ib + N - 1)
      }
      // The head is always the live position.
      hist[hb] = pos[ix]; hist[hb + 1] = pos[ix + 1]; hist[hb + 2] = pos[ix + 2]
      histI[ib] = glowIn[i]
      // Width is remembered too, so a trail keeps its body after its sphere shrinks away.
      histR[ib] = Math.max(radius[i], histR[ib + 1] * 0.97)
      anyGlow = Math.max(anyGlow, glowIn[i])

      const r = radius[i]
      for (let k = 0; k < N; k++) {
        const a = hb + Math.max(0, k - 1) * 3
        const b = hb + Math.min(N - 1, k + 1) * 3
        const o = hb + k * 3
        const tx = hist[a] - hist[b], ty = hist[a + 1] - hist[b + 1], tz = hist[a + 2] - hist[b + 2]
        const spacing = Math.hypot(tx, ty, tz) * 0.5
        const vx = cam.x - hist[o], vy = cam.y - hist[o + 1], vz = cam.z - hist[o + 2]
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx
        const sl = Math.hypot(sx, sy, sz)
        // A stretch of trail seen end-on (travelling along the line of sight)
        // has no stable width direction; let it thin and fade instead of fanning.
        const edgeOn = sl / (Math.hypot(tx, ty, tz) * Math.hypot(vx, vy, vz) + 1e-6)
        const open = Math.min(1, Math.max(0, (edgeOn - 0.06) / 0.26))
        if (sl > 1e-5) {
          sx /= sl; sy /= sl; sz /= sl
          // Keep the ribbon from flipping over on itself between neighbours.
          if (k > 0 && sx * side[ix] + sy * side[ix + 1] + sz * side[ix + 2] < 0) { sx = -sx; sy = -sy; sz = -sz }
          side[ix] = sx; side[ix + 1] = sy; side[ix + 2] = sz
        } else { sx = side[ix]; sy = side[ix + 1]; sz = side[ix + 2] }
        const u = k / (N - 1)
        // Never wider than the path can carry: a slow or tightly curling trail
        // thins out instead of folding over itself.
        const w = Math.min(Math.min(histR[ib + k], 0.5) * (0.08 + 0.8 * Math.pow(1 - u, 0.8)), spacing * 5 + 0.012) * (0.25 + 0.75 * open)
        const v = (i * N + k) * 2
        P[v * 3] = hist[o] - sx * w; P[v * 3 + 1] = hist[o + 1] - sy * w; P[v * 3 + 2] = hist[o + 2] - sz * w
        P[v * 3 + 3] = hist[o] + sx * w; P[v * 3 + 4] = hist[o + 1] + sy * w; P[v * 3 + 5] = hist[o + 2] + sz * w
        I[v] = histI[ib + k] * open; I[v + 1] = I[v]
      }

      // Embers shed in proportion to speed, thrown backwards off the sphere.
      if (embers > 0 && r > 0.05) {
        ember.debt[i] += Math.max(0, glowIn[i] - 0.3) * 95 * dt
        while (ember.debt[i] >= 1) {
          ember.debt[i] -= 1
          const e = ember.next
          ember.next = (ember.next + 1) % ember.count
          const sp = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) || 1
          const ep = ember.position.array as Float32Array
          ep[e * 3] = pos[ix] - (vel[ix] / sp) * r * 0.7 + (Math.random() - 0.5) * r
          ep[e * 3 + 1] = pos[ix + 1] - (vel[ix + 1] / sp) * r * 0.7 + (Math.random() - 0.5) * r
          ep[e * 3 + 2] = pos[ix + 2] - (vel[ix + 2] / sp) * r * 0.7 + (Math.random() - 0.5) * r
          ember.vel[e * 3] = vel[ix] * 0.12 + (Math.random() - 0.5) * 0.5
          ember.vel[e * 3 + 1] = vel[ix + 1] * 0.12 + (Math.random() - 0.5) * 0.5 + 0.12
          ember.vel[e * 3 + 2] = vel[ix + 2] * 0.12 + (Math.random() - 0.5) * 0.5
          ;(ember.life.array as Float32Array)[e] = 1
          ;(ember.size.array as Float32Array)[e] = 0.03 + Math.random() * 0.05
          ember.decay[e] = 1 / (0.22 + Math.random() * 0.4)
        }
      }
    }
    c.started = true
    trail.position.needsUpdate = true
    trail.intensity.needsUpdate = true

    if (embers > 0) {
      const ep = ember.position.array as Float32Array
      const el = ember.life.array as Float32Array
      let alive = false
      for (let e = 0; e < ember.count; e++) {
        if (el[e] <= 0) continue
        el[e] = Math.max(0, el[e] - ember.decay[e] * dt)
        ep[e * 3] += ember.vel[e * 3] * dt
        ep[e * 3 + 1] += ember.vel[e * 3 + 1] * dt
        ep[e * 3 + 2] += ember.vel[e * 3 + 2] * dt
        alive = true
      }
      ember.position.needsUpdate = true
      ember.life.needsUpdate = true
      ember.material.uniforms.uScale.value = frame.size.height * frame.viewport.dpr * 1.43 // ~1/tan(fov/2) / 2
      emberMesh.current!.visible = alive || c.frames < 6
    }
    trailMesh.current!.visible = anyGlow > 0.002 || c.frames++ < 6
  })

  const trailMesh = useRef<THREE.Mesh>(null)
  const emberMesh = useRef<THREE.Points>(null)
  useEffect(() => {
    trailMesh.current?.layers.enable(GLOW_LAYER)
    emberMesh.current?.layers.enable(GLOW_LAYER)
  }, [])

  return (
    <>
      <mesh ref={trailMesh} geometry={trail.geometry} material={trail.material} frustumCulled={false} renderOrder={2} />
      <points ref={emberMesh} geometry={ember.geometry} material={ember.material} frustumCulled={false} renderOrder={3} visible={false} />
    </>
  )
}
