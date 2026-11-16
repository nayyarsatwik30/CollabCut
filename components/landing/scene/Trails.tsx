'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOW_LAYER } from './Glow'
import { palette } from './palette'
import { TOOL_COUNT, type SceneState } from './state'

// Each sphere drags a ribbon built from where it has actually been over the
// last ~0.6s. Because the ribbon is the recorded path, it is longer when the
// sphere is fast, shorter when slow, and bends when the sphere turns.
//
// The path is recorded as control points with their real timestamps, then a
// Catmull-Rom spline (knots = recorded time, so uneven frame pacing cannot
// bunch or stretch it) is drawn through them and resampled densely at even
// ages. Width, brightness and the fold limits are all continuous functions
// evaluated per dense sample, so nothing changes in steps along the length.
const TRAIL_SECONDS = 0.62
// A trail is never wider than its own speed can carry (width per unit/s).
const WIDTH_PER_SPEED = 0.1
const MIN_WIDTH = 0.012
// Shortest stretch of path (world units) a direction is measured across, and
// how many samples either side it may reach to find it.
const DIRECTION_BASELINE = 0.09
const DIRECTION_REACH = 14
// How strongly stored points settle toward their neighbours, per frame at 60 Hz.
const SETTLE_PER_FRAME = 0.3

// Smooth minimum: follows `w` while it is well under `limit`, eases onto `limit` above it.
function softMin(w: number, limit: number) {
  const w2 = w * w, l2 = limit * limit
  return (w * limit) / Math.sqrt(Math.sqrt(w2 * w2 + l2 * l2) + 1e-12)
}

const TRAIL_VERT = /* glsl */ `
attribute vec2 aUv;
attribute float aI;
attribute float aSeed;
attribute float aOff;
varying vec2 vUv;
varying float vOff;
varying float vHalf;
varying float vI;
varying float vSeed;
void main() {
  vUv = aUv;
  vI = aI;
  vSeed = aSeed;
  vOff = aOff;
  vHalf = abs(aOff);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// The tail is one solid body, like a snake: a clean accent fill with a crisp
// edge that tapers to a point (the taper is in the geometry). No noise, no
// wisps. It is drawn over the frame rather than added to it, so it is just
// as solid on a pale page, and it does not brighten where it crosses itself.
const TRAIL_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uInk;
uniform float uLight;
varying vec2 vUv;
varying float vI;
varying float vOff;
varying float vHalf;
void main() {
  // Position across the ribbon, -1..1. Dividing two interpolated values keeps
  // it exact where the ribbon tapers or bends; interpolating it directly makes
  // each little quad shear along its diagonal, which shows up as ribbing.
  float y = clamp(vOff / max(vHalf, 1e-5), -1.0, 1.0);
  float across = abs(y);
  float along = 1.0 - vUv.x;
  // One screen pixel, measured in the same units as 'across'.
  float px = max(fwidth(across), 1e-4);
  float a = 1.0 - smoothstep(1.0 - px * 1.5, 1.0, across);
  // The body is there or not: it comes in as the sphere picks up speed
  // instead of getting brighter with it.
  a *= smoothstep(0.08, 0.3, vI);
  a *= smoothstep(0.0, 0.06, along);
  // Soft start: normally hidden behind the sphere, but a sphere that has
  // shrunk away must not leave a hard-edged trail head.
  a *= smoothstep(0.0, 0.12, vUv.x + 0.02);
  // Dark: a hotter spine just behind the sphere (above 1.0) feeds the bloom.
  float hot = exp(-across * across * 5.0) * pow(along, 2.2);
  vec3 dark = uAccent * (1.0 + 0.9 * hot);
  // Light: the accent has almost no edge against a pale page, so the body
  // gets a thin ink outline.
  float rim = smoothstep(1.0 - px * 4.0, 1.0 - px * 2.5, across);
  vec3 pale = mix(uAccent, uInk, rim);
  gl_FragColor = vec4(mix(dark, pale, uLight), a);
  #include <colorspace_fragment>
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
uniform vec3 uAccent;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 4.0) * (1.0 - smoothstep(0.8, 1.0, d)) * vLife * vLife;
  gl_FragColor = vec4(uAccent * (1.0 + a), a * 0.9);
  #include <colorspace_fragment>
}
`

const layered = { transparent: true, depthWrite: false, toneMapped: false } as const

export function Trails({ state, segments, embers }: { state: SceneState; segments: number; embers: number }) {
  // The path is recorded at up to one control point per frame on every tier
  // (cheap: a few numbers per sphere). `segments` is the quality knob for how
  // many points the smoothed ribbon is drawn with. The pixels covered, which
  // is the real GPU cost, are the same either way.
  const C = 48
  const M = Math.max(64, Math.round(segments * 3.2))
  const minInterval = TRAIL_SECONDS / (C - 3)

  const trail = useMemo(() => {
    const verts = TOOL_COUNT * M * 2
    const position = new THREE.BufferAttribute(new Float32Array(verts * 3), 3)
    const intensity = new THREE.BufferAttribute(new Float32Array(verts), 1)
    const offset = new THREE.BufferAttribute(new Float32Array(verts), 1)
    position.setUsage(THREE.DynamicDrawUsage)
    intensity.setUsage(THREE.DynamicDrawUsage)
    offset.setUsage(THREE.DynamicDrawUsage)
    const uv = new Float32Array(verts * 2)
    const seed = new Float32Array(verts)
    const index: number[] = []
    for (let i = 0; i < TOOL_COUNT; i++) {
      for (let k = 0; k < M; k++) {
        const v = (i * M + k) * 2
        uv[v * 2] = k / (M - 1); uv[v * 2 + 1] = -1
        uv[v * 2 + 2] = k / (M - 1); uv[v * 2 + 3] = 1
        seed[v] = i * 0.37; seed[v + 1] = i * 0.37
        if (k < M - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', position)
    geometry.setAttribute('aI', intensity)
    geometry.setAttribute('aOff', offset)
    geometry.setAttribute('aUv', new THREE.BufferAttribute(uv, 2))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geometry.setIndex(index)
    const material = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: { uAccent: { value: palette.accent }, uInk: { value: palette.ink }, uLight: palette.light },
      side: THREE.DoubleSide,
      ...layered,
    })
    return {
      geometry, material, position, intensity, offset,
      // Control points per trail, newest first: position, time recorded, glow, radius.
      hist: new Float32Array(TOOL_COUNT * C * 3), histT: new Float64Array(TOOL_COUNT * C), histI: new Float32Array(TOOL_COUNT * C), histR: new Float32Array(TOOL_COUNT * C),
      // Per-frame scratch for one trail: control ages and tangents, then the dense samples.
      age: new Float32Array(C), tan: new Float32Array(C * 3), relaxed: new Float32Array(C * 3),
      dp: new Float32Array(M * 3), dt: new Float32Array(M * 3), dSpeed: new Float32Array(M), dI: new Float32Array(M), dR: new Float32Array(M), dK: new Float32Array(M), dSide: new Float32Array(M * 3), dOpen: new Float32Array(M), dW: new Float32Array(M), dMin: new Float32Array(M),
    }
  }, [C, M])

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
      uniforms: { uAccent: { value: palette.accent }, uScale: { value: 1 } },
      ...layered,
    })
    return { count, geometry, material, position, life, size, vel: new Float32Array(count * 3), decay: new Float32Array(count), next: 0, debt: new Float32Array(TOOL_COUNT) }
  }, [embers])

  useEffect(() => () => { trail.geometry.dispose(); trail.material.dispose() }, [trail])
  useEffect(() => () => { ember.geometry.dispose(); ember.material.dispose() }, [ember])

  const clock = useRef({ now: 0, started: false, frames: 0 })

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const { pos, vel, radius, glow: glowIn } = state
    const cam = frame.camera.position
    const { hist, histT, histI, histR, age, tan, relaxed, dp, dt: dtan, dSpeed, dI, dR, dK, dSide, dOpen, dW, dMin } = trail
    const P = trail.position.array as Float32Array
    const I = trail.intensity.array as Float32Array
    const O = trail.offset.array as Float32Array
    const c = clock.current
    c.now += dt
    const now = c.now

    // Frame-rate independent: the same settling per second at 60 or 144 Hz.
    const settle = 1 - Math.pow(1 - SETTLE_PER_FRAME, dt * 60)
    let anyGlow = 0
    for (let i = 0; i < TOOL_COUNT; i++) {
      const ix = i * 3
      const hb = i * C * 3
      const ib = i * C
      if (!c.started) {
        for (let k = 0; k < C; k++) {
          hist[hb + k * 3] = pos[ix]; hist[hb + k * 3 + 1] = pos[ix + 1]; hist[hb + k * 3 + 2] = pos[ix + 2]
          histT[ib + k] = now - k * minInterval
          histR[ib + k] = radius[i]
        }
      }
      // Slot 0 is the live head. Once last frame's head is far enough (in time)
      // from the newest stored point, it becomes a stored point itself, keeping
      // the time it was really captured at.
      if (histT[ib] - histT[ib + 1] >= minInterval) {
        hist.copyWithin(hb + 3, hb, hb + (C - 1) * 3)
        histT.copyWithin(ib + 1, ib, ib + C - 1)
        histI.copyWithin(ib + 1, ib, ib + C - 1)
        histR.copyWithin(ib + 1, ib, ib + C - 1)
      }
      hist[hb] = pos[ix]; hist[hb + 1] = pos[ix + 1]; hist[hb + 2] = pos[ix + 2]
      histT[ib] = now
      histI[ib] = glowIn[i]
      // Width is remembered too, so a trail keeps its body after its sphere shrinks away.
      histR[ib] = Math.max(radius[i], histR[ib + 1] * Math.pow(0.97, (now - histT[ib + 1]) / 0.0207))
      anyGlow = Math.max(anyGlow, glowIn[i])

      const r = radius[i]

      // The air settles: every stored point drifts a little toward the middle
      // of its neighbours each frame, so a jolt in the sphere's motion (a
      // collision shove, a spring snapping back) is rounded off within a few
      // frames instead of staying in the trail as a corner. The head stays
      // pinned to the sphere.
      for (let k = 1; k < C - 1; k++) {
        const o = hb + k * 3
        for (let d = 0; d < 3; d++) relaxed[k * 3 + d] = hist[o + d] + ((hist[o - 3 + d] + hist[o + 3 + d]) * 0.5 - hist[o + d]) * settle
      }
      for (let k = 1; k < C - 1; k++) {
        const o = hb + k * 3
        hist[o] = relaxed[k * 3]; hist[o + 1] = relaxed[k * 3 + 1]; hist[o + 2] = relaxed[k * 3 + 2]
      }

      // Control ages (seconds behind the head) and Catmull-Rom tangents dP/d(age).
      for (let k = 0; k < C; k++) age[k] = Math.max(now - histT[ib + k], k * 1e-4)
      for (let k = 0; k < C; k++) {
        const o = hb + k * 3
        const hPrev = k > 0 ? Math.max(age[k] - age[k - 1], 1e-4) : 0
        const hNext = k < C - 1 ? Math.max(age[k + 1] - age[k], 1e-4) : 0
        for (let d = 0; d < 3; d++) {
          const sPrev = k > 0 ? (hist[o + d] - hist[o - 3 + d]) / hPrev : 0
          const sNext = k < C - 1 ? (hist[o + 3 + d] - hist[o + d]) / hNext : 0
          tan[k * 3 + d] = k === 0 ? sNext : k === C - 1 ? sPrev : (sPrev * hNext + sNext * hPrev) / (hPrev + hNext)
        }
      }

      // Resample the spline at even ages.
      let j = 0
      const lastAge = age[C - 1]
      for (let m = 0; m < M; m++) {
        const a = Math.min((m / (M - 1)) * TRAIL_SECONDS, lastAge)
        while (j < C - 2 && age[j + 1] < a) j++
        const h = Math.max(age[j + 1] - age[j], 1e-4)
        const t = Math.min(1, Math.max(0, (a - age[j]) / h))
        const t2 = t * t, t3 = t2 * t
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2
        const g00 = (6 * t2 - 6 * t) / h, g10 = 3 * t2 - 4 * t + 1, g01 = -g00, g11 = 3 * t2 - 2 * t
        const o0 = hb + j * 3, o1 = o0 + 3, k0 = j * 3, k1 = k0 + 3
        let sp2 = 0
        for (let d = 0; d < 3; d++) {
          dp[m * 3 + d] = h00 * hist[o0 + d] + h10 * h * tan[k0 + d] + h01 * hist[o1 + d] + h11 * h * tan[k1 + d]
          const v = g00 * hist[o0 + d] + g10 * tan[k0 + d] + g01 * hist[o1 + d] + g11 * tan[k1 + d]
          dtan[m * 3 + d] = v
          sp2 += v * v
        }
        const sp = Math.sqrt(sp2)
        dSpeed[m] = sp
        // Unit tangent; where the path is momentarily still, carry the previous direction.
        if (sp > 1e-4) { dtan[m * 3] /= sp; dtan[m * 3 + 1] /= sp; dtan[m * 3 + 2] /= sp }
        else if (m > 0) { dtan[m * 3] = dtan[m * 3 - 3]; dtan[m * 3 + 1] = dtan[m * 3 - 2]; dtan[m * 3 + 2] = dtan[m * 3 - 1] }
        else { dtan[0] = 1; dtan[1] = 0; dtan[2] = 0 }
        const ease = t * t * (3 - 2 * t)
        dI[m] = histI[ib + j] + (histI[ib + j + 1] - histI[ib + j]) * ease
        dR[m] = histR[ib + j] + (histR[ib + j + 1] - histR[ib + j]) * ease
      }

      // Width direction for every sample: across the path, facing the camera.
      let psx = 0, psy = 0, psz = 0
      for (let m = 0; m < M; m++) {
        const o = m * 3
        // Direction of travel here, measured across a stretch of path at least
        // DIRECTION_BASELINE long. Where the sphere is fast that is the
        // neighbouring samples; where it is slow the samples sit almost on top
        // of each other and their individual directions are noise, so a longer
        // stretch is used and the ribbon's edges stay calm.
        let tx = dtan[o], ty = dtan[o + 1], tz = dtan[o + 2]
        for (let reach = 1; reach <= DIRECTION_REACH; reach++) {
          const a = Math.max(0, m - reach) * 3, b = Math.min(M - 1, m + reach) * 3
          const bx = dp[b] - dp[a], by = dp[b + 1] - dp[a + 1], bz = dp[b + 2] - dp[a + 2]
          const bl = Math.hypot(bx, by, bz)
          if (bl >= DIRECTION_BASELINE || reach === DIRECTION_REACH) {
            if (bl > 1e-4) { tx = bx / bl; ty = by / bl; tz = bz / bl }
            break
          }
        }
        const vx = cam.x - dp[o], vy = cam.y - dp[o + 1], vz = cam.z - dp[o + 2]
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx
        const sl = Math.hypot(sx, sy, sz)
        // A stretch of trail seen end-on (travelling along the line of sight)
        // has no width direction of its own. There the ribbon carries on with
        // the direction it had just before, so the streak passes through as
        // one body instead of pinching into a knot, and it dims a little
        // because the path is stacked up along the line of sight.
        const edgeOn = sl / (Math.hypot(vx, vy, vz) + 1e-6)
        let open = Math.min(1, Math.max(0, (edgeOn - 0.06) / 0.3))
        open = open * open * (3 - 2 * open)
        dOpen[m] = open
        if (sl > 1e-5) {
          sx /= sl; sy /= sl; sz /= sl
          // Keep the ribbon from flipping over on itself between neighbours.
          if (m > 0 && sx * psx + sy * psy + sz * psz < 0) { sx = -sx; sy = -sy; sz = -sz }
          if (m > 0 && open < 1) {
            sx = psx + (sx - psx) * open; sy = psy + (sy - psy) * open; sz = psz + (sz - psz) * open
            const bl = Math.hypot(sx, sy, sz)
            if (bl > 1e-5) { sx /= bl; sy /= bl; sz /= bl } else { sx = psx; sy = psy; sz = psz }
          }
        } else { sx = psx; sy = psy; sz = psz }
        psx = sx; psy = sy; psz = sz
        dSide[o] = sx; dSide[o + 1] = sy; dSide[o + 2] = sz
      }

      // Fold limit. Between two neighbouring samples the ribbon's inner edge
      // crosses over itself exactly when width x (swing of the width direction
      // per unit of path) exceeds 1, so the width is held under that everywhere.
      for (let m = 0; m < M; m++) dK[m] = 0
      for (let m = 0; m < M - 1; m++) {
        const a = m * 3, b = a + 3
        const swing = Math.hypot(dSide[b] - dSide[a], dSide[b + 1] - dSide[a + 1], dSide[b + 2] - dSide[a + 2])
        const dist = Math.hypot(dp[b] - dp[a], dp[b + 1] - dp[a + 1], dp[b + 2] - dp[a + 2])
        const k = swing / (dist + 1e-5)
        if (k > dK[m]) dK[m] = k
        if (k > dK[m + 1]) dK[m + 1] = k
      }
      for (let m = 0; m < M; m++) {
        const u = m / (M - 1)
        // Tapers to nothing at the tail. Never wider than the path can carry:
        // a slow trail thins out, and a tight turn pinches the ribbon.
        let w = Math.min(dR[m], 0.5) * 0.88 * Math.pow(1 - u, 0.8)
        w = softMin(w, dSpeed[m] * WIDTH_PER_SPEED + MIN_WIDTH)
        if (dK[m] > 1e-3) w = softMin(w, 0.6 / dK[m])
        dW[m] = w * (0.7 + 0.3 * dOpen[m])
      }
      // The limits above can differ from one sample to the next; take the
      // smallest nearby width, then blur, so the outline stays one smooth curve
      // that is still inside every limit.
      for (let m = 0; m < M; m++) {
        let lo = dW[m]
        for (let k = Math.max(0, m - 2); k <= Math.min(M - 1, m + 2); k++) if (dW[k] < lo) lo = dW[k]
        dMin[m] = lo
      }
      for (let m = 0; m < M; m++) {
        let sum = 0, n = 0
        for (let k = Math.max(0, m - 2); k <= Math.min(M - 1, m + 2); k++) { sum += dMin[k]; n++ }
        const w = m === M - 1 ? 1e-4 : sum / n
        const o = m * 3
        const sx = dSide[o], sy = dSide[o + 1], sz = dSide[o + 2]
        const v = (i * M + m) * 2
        P[v * 3] = dp[o] - sx * w; P[v * 3 + 1] = dp[o + 1] - sy * w; P[v * 3 + 2] = dp[o + 2] - sz * w
        P[v * 3 + 3] = dp[o] + sx * w; P[v * 3 + 4] = dp[o + 1] + sy * w; P[v * 3 + 5] = dp[o + 2] + sz * w
        I[v] = dI[m] * (0.4 + 0.6 * dOpen[m]); I[v + 1] = I[v]
        O[v] = -w; O[v + 1] = w
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
    trail.offset.needsUpdate = true

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
      // Embers are sparks of light; a pale page cannot show them, so Light leaves them out.
      emberMesh.current!.visible = (alive && palette.light.value < 0.5) || c.frames < 6
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
