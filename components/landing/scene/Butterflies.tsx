'use client'

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TL, smoothstep } from '../story'
import { TOOL_COUNT, type SceneState } from './state'

export interface PointerState {
  x: number // NDC, -1..1
  y: number
  lastMove: number // performance.now() of the last real movement
}

// One butterfly = two subdivided wing sheets + a slim body, drawn for every
// instance in a single draw call. The flap is done in the vertex shader from a
// per-instance phase, so the CPU only steers.
function buildGeometry() {
  const position: number[] = []
  const wing: number[] = []
  const side: number[] = []
  const index: number[] = []
  const US = 6
  const VS = 4
  for (const s of [-1, 1]) {
    const base = position.length / 3
    for (let j = 0; j <= VS; j++) {
      for (let i = 0; i <= US; i++) {
        const u = i / US
        const v = (j / VS) * 2 - 1
        position.push(s * u, 0, v * 0.72)
        wing.push(u, v)
        side.push(s)
      }
    }
    for (let j = 0; j < VS; j++) {
      for (let i = 0; i < US; i++) {
        const a = base + j * (US + 1) + i
        const b = a + 1
        const c = a + US + 1
        const d = c + 1
        index.push(a, c, b, b, c, d)
      }
    }
  }
  const b = position.length / 3
  const bw = 0.045
  position.push(-bw, 0.004, -0.55, bw, 0.004, -0.55, -bw, 0.004, 0.62, bw, 0.004, 0.62)
  wing.push(-1, -1, 1, -1, -1, 1, 1, 1)
  side.push(0, 0, 0, 0)
  index.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 2))
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1))
  g.setIndex(index)
  return g
}

const VERT = /* glsl */ `
attribute float aSide;
attribute vec2 aWing;
attribute float aPhase;
attribute float aTone;
attribute float aFold;
varying vec2 vWing;
varying float vSide;
varying vec3 vN;
varying vec3 vViewDir;
varying float vDepth;
varying float vTone;

void main() {
  vec3 p = position;
  vec3 n = vec3(0.0, 1.0, 0.0);
  if (abs(aSide) > 0.5) {
    // Tips and the hindwing trail the root slightly, so the wing bends.
    float lag = aWing.x * 0.6 + max(0.0, -aWing.y) * 0.25;
    // In flight the wings beat; at rest they are held up and nearly closed,
    // opening and closing a touch as the butterfly sits.
    float beat = 0.32 + 0.92 * sin(aPhase - lag);
    float rest = 1.3 + 0.1 * sin(aPhase * 0.35) - aWing.x * 0.06;
    float a = mix(beat, rest, aFold) * aSide;
    float c = cos(a);
    float s = sin(a);
    p = vec3(p.x * c, p.x * s, p.z);
    n = vec3(-s, c, 0.0);
  }
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vViewDir = cameraPosition - wp.xyz;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  vWing = aWing;
  vSide = aSide;
  vTone = aTone;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform vec3 uFg;
uniform vec3 uBg;
varying vec2 vWing;
varying float vSide;
varying vec3 vN;
varying vec3 vViewDir;
varying float vDepth;
varying float vTone;

float lobe(vec2 p, vec2 c, vec2 r, float rot) {
  p -= c;
  float cs = cos(rot);
  float sn = sin(rot);
  p = vec2(p.x * cs + p.y * sn, -p.x * sn + p.y * cs);
  return length(p / r) - 1.0;
}

void main() {
  float alpha;
  vec3 col;
  if (abs(vSide) < 0.5) {
    float d = length(vWing) - 1.0;
    float fw = fwidth(d);
    alpha = 1.0 - smoothstep(-fw, fw, d);
    col = uFg * mix(0.05, 0.2, vTone);
  } else {
    vec2 p = vWing;
    float fore = lobe(p, vec2(0.50, 0.40), vec2(0.54, 0.44), 0.42);
    float hind = lobe(p, vec2(0.36, -0.40), vec2(0.40, 0.50), -0.25);
    float d = min(fore, hind);
    float fw = fwidth(d);
    alpha = 1.0 - smoothstep(-fw, fw, d);

    float base = mix(0.16, 0.95, vTone);
    float root = smoothstep(0.9, 0.0, length(p - vec2(0.0, 0.05)));
    float margin = smoothstep(-0.30, -0.02, d);
    float ang = atan(p.y - 0.02, p.x + 0.06);
    float vein = smoothstep(0.90, 1.0, abs(sin(ang * 8.0))) * smoothstep(0.12, 0.45, length(p));
    float pat = base * (1.0 - 0.28 * vein);
    // Pale wings get a dark margin, dark wings a pale one.
    pat = mix(pat, mix(0.9, 0.04, vTone), margin * 0.75);
    pat += 0.10 * root;

    vec3 N = normalize(vN);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(vec3(-0.35, 0.8, 0.5));
    float light = 0.38 + 0.62 * abs(dot(N, L));
    float sheen = pow(1.0 - abs(dot(N, V)), 3.0) * 0.35 * (0.3 + 0.7 * vTone) * (1.0 - margin);
    col = uFg * (pat * light + sheen);
  }
  if (alpha < 0.01) discard;
  float fog = smoothstep(6.5, 12.5, vDepth);
  col = mix(col, uBg, fog * 0.82);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

interface Agent {
  f1: number; f2: number; f3: number
  p1: number; p2: number; p3: number
  eager: number
  orbitR: number
  orbitSpeed: number
  size: number
  flap: number
  bank: number
  puff: number // which dandelion it lands on
  landAt: number // where in the landing window it sets off
  nx: number; ny: number; nz: number // its spot on the seed head (outward direction)
  hx: number; hy: number; hz: number // which way it faces once landed
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Deals the butterflies out across the dandelions and gives each its own spot
// on the upper, camera-facing part of the seed head, spaced around it so two
// on the same head do not sit on top of each other.
function perch(i: number, count: number) {
  const puff = i % TOOL_COUNT
  const slot = Math.floor(i / TOOL_COUNT)
  const perHead = Math.ceil(count / TOOL_COUNT)
  const az = (slot / perHead) * Math.PI * 1.5 - 0.5 + puff * 0.9 + (Math.random() - 0.5) * 0.4
  const el = 0.5 + Math.random() * 0.55
  const nx = Math.cos(el) * Math.sin(az) * 0.8
  const ny = Math.sin(el)
  const nz = Math.cos(el) * (0.55 + 0.45 * Math.cos(az))
  const nl = Math.hypot(nx, ny, nz)
  const n = [nx / nl, ny / nl, nz / nl]
  // Facing: any direction along the surface.
  const turn = Math.random() * Math.PI * 2
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let ax = n[1] * ref[2] - n[2] * ref[1], ay = n[2] * ref[0] - n[0] * ref[2], az2 = n[0] * ref[1] - n[1] * ref[0]
  const al = Math.hypot(ax, ay, az2)
  ax /= al; ay /= al; az2 /= al
  const bx = n[1] * az2 - n[2] * ay, by = n[2] * ax - n[0] * az2, bz = n[0] * ay - n[1] * ax
  const c = Math.cos(turn), s = Math.sin(turn)
  return {
    puff,
    landAt: Math.random(),
    nx: n[0], ny: n[1], nz: n[2],
    hx: ax * c + bx * s, hy: ay * c + by * s, hz: az2 * c + bz * s,
  }
}

export function Butterflies({ count, pointer, progress, state: scene, fg, bg }: { count: number; pointer: MutableRefObject<PointerState>; progress: MutableRefObject<number>; state: SceneState; fg: string; bg: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null)

  const { geometry, material, phase, fold } = useMemo(() => {
    const geometry = buildGeometry()
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    phase.setUsage(THREE.DynamicDrawUsage)
    const tone = new Float32Array(count)
    for (let i = 0; i < count; i++) tone[i] = Math.random() < 0.3 ? Math.random() * 0.22 : 0.72 + Math.random() * 0.28
    const fold = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    fold.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('aPhase', phase)
    geometry.setAttribute('aFold', fold)
    geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uFg: { value: new THREE.Color(fg) }, uBg: { value: new THREE.Color(bg) } },
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    })
    return { geometry, material, phase, fold }
  }, [count, fg, bg])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  const sim = useMemo(() => {
    const agents: Agent[] = []
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const dir = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      agents.push({
        f1: 0.09 + Math.random() * 0.16, f2: 0.11 + Math.random() * 0.19, f3: 0.07 + Math.random() * 0.13,
        p1: Math.random() * Math.PI * 2, p2: Math.random() * Math.PI * 2, p3: Math.random() * Math.PI * 2,
        eager: 0.45 + Math.random() * 0.55,
        orbitR: 0.14 + Math.random() * 0.86,
        orbitSpeed: (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1),
        size: 0.13 + Math.random() * 0.12,
        flap: 12 + Math.random() * 5,
        bank: 0,
        ...perch(i, count),
      })
      // Start scattered to the right and a little beyond the frame, then drift in.
      pos[i * 3] = 0.8 + Math.random() * 4.7
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4
      pos[i * 3 + 2] = -3 + Math.random() * 4.5
      vel[i * 3] = -0.4
      dir[i * 3] = -1
    }
    return { agents, pos, vel, dir, chase: 0 }
  }, [count])

  const m = useMemo(() => new THREE.Matrix4(), [])
  const warm = useRef(0)

  useFrame((state, delta) => {
    const im = mesh.current
    if (!im) return
    // As the story starts, each butterfly glides to its dandelion, settles
    // with its wings folded, and sinks into the seed head before any sphere
    // exists. All of it follows scroll progress, so scrolling back up plays
    // it in reverse: they come out of the seed heads and lift off again.
    const p = progress.current
    const away = smoothstep(TL.butterfliesAway[0], TL.butterfliesAway[1], p)
    // Hard guarantee: while any sphere is drawn at all, no butterfly is.
    // (Spheres ease in and out over a few frames, so on a fast scroll back up
    // this holds the butterflies until the last sphere has really gone.)
    let sphere = 0
    for (let i = 0; i < TOOL_COUNT; i++) sphere = Math.max(sphere, scene.radius[i])
    const shown = (1 - away) * (1 - smoothstep(0, 0.004, sphere))
    im.visible = shown > 0.002 || warm.current++ < 6
    if (!im.visible) return
    const dt = Math.min(delta, 1 / 30)
    const t = state.clock.elapsedTime
    const vw = state.viewport.width
    const vh = state.viewport.height
    const { agents, pos, vel, dir } = sim

    const since = performance.now() - pointer.current.lastMove
    const chaseGoal = since < 700 ? 1 : Math.max(0, 1 - (since - 700) / 2200)
    sim.chase += (chaseGoal - sim.chase) * (1 - Math.exp(-dt * 3))
    const cx = (pointer.current.x * vw) / 2
    const cy = (pointer.current.y * vh) / 2
    const homeX = vw * 0.22

    for (let i = 0; i < count; i++) {
      const a = agents[i]
      const ix = i * 3
      const x = pos[ix], y = pos[ix + 1], z = pos[ix + 2]

      // Idle: each butterfly follows its own slow, non-repeating loop on the right.
      const land = smoothstep(TL.land[0] + (TL.land[1] - TL.land[0] - TL.landSpan) * a.landAt, TL.land[0] + (TL.land[1] - TL.land[0] - TL.landSpan) * a.landAt + TL.landSpan, p)
      const wx = homeX + Math.sin(t * a.f1 + a.p1) * vw * 0.24
      const wy = vh * 0.04 + Math.sin(t * a.f2 + a.p2) * vh * 0.34
      const wz = -0.6 + Math.sin(t * a.f3 + a.p3) * 2.2
      // Chasing: circle the cursor at a personal distance rather than piling on it.
      const oa = t * a.orbitSpeed + a.p1 * 3
      const tcx = cx + Math.cos(oa) * a.orbitR
      const tcy = cy + Math.sin(oa) * a.orbitR * 0.8
      const tcz = 0.3 + Math.sin(oa * 0.7 + a.p2) * 1.2

      const k = sim.chase * a.eager * (1 - land)
      const dx = lerp(wx, tcx, k) - x
      const dy = lerp(wy, tcy, k) - y
      const dz = lerp(wz, tcz, k) - z
      const dist = Math.hypot(dx, dy, dz) || 1e-4
      const maxSpeed = lerp(0.5 + 0.25 * a.eager, 1.5 + 1.7 * a.eager, k)
      const want = (maxSpeed * Math.min(1, dist / 1.1)) / dist
      let ax = (dx * want - vel[ix]) * 2.4
      let ay = (dy * want - vel[ix + 1]) * 2.4
      let az = (dz * want - vel[ix + 2]) * 2.4
      const maxForce = lerp(1.4, 6, k)
      const al = Math.hypot(ax, ay, az)
      if (al > maxForce) { const s = maxForce / al; ax *= s; ay *= s; az *= s }

      // Keep personal space.
      for (let j = 0; j < count; j++) {
        if (j === i) continue
        const jx = j * 3
        const sx = x - pos[jx], sy = y - pos[jx + 1], sz = z - pos[jx + 2]
        const d2 = sx * sx + sy * sy + sz * sz
        if (d2 < 0.3 && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const push = ((0.548 - d) / d) * 7
          ax += sx * push; ay += sy * push; az += sz * push
        }
      }

      // Erratic flutter.
      ax += Math.sin(t * 2.3 + a.p1 * 7) * 0.5
      ay += Math.cos(t * 3.1 + a.p2 * 5) * 0.8
      az += Math.sin(t * 1.7 + a.p3 * 3) * 0.4

      vel[ix] += ax * dt; vel[ix + 1] += ay * dt; vel[ix + 2] += az * dt
      pos[ix] += vel[ix] * dt; pos[ix + 1] += vel[ix + 1] * dt; pos[ix + 2] += vel[ix + 2] * dt

      const speed = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2])
      if (speed > 0.03) {
        const h = 1 - Math.exp(-dt * 6)
        let fx = lerp(dir[ix], vel[ix] / speed, h)
        let fy = lerp(dir[ix + 1], vel[ix + 1] / speed, h)
        let fz = lerp(dir[ix + 2], vel[ix + 2] / speed, h)
        const fl = Math.hypot(fx, fy, fz) || 1
        fx /= fl; fy /= fl; fz /= fl
        dir[ix] = fx; dir[ix + 1] = fy; dir[ix + 2] = fz
      }
      let fx = dir[ix], fy = dir[ix + 1], fz = dir[ix + 2]

      // Wingbeat quickens with speed.
      // ...and slows right down as it settles.
      const ph = phase.array[i] + dt * (a.flap + 9 * Math.min(1, speed / 2.5)) * (1 - 0.86 * land)
      ;(phase.array as Float32Array)[i] = ph

      // Basis: model x = wingspan, y = up, z = forward. right = up x forward.
      let rx = fz, ry = 0, rz = -fx
      const rl = Math.hypot(rx, rz)
      if (rl < 1e-3) { rx = 1; rz = 0 } else { rx /= rl; rz /= rl }
      let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx
      // Bank into turns.
      const lateral = ax * rx + az * rz
      a.bank += (Math.max(-0.6, Math.min(0.6, lateral * 0.14)) - a.bank) * (1 - Math.exp(-dt * 5))
      const cb = Math.cos(a.bank), sb = Math.sin(a.bank)
      rx = rx * cb + ux * sb; ry = ry * cb + uy * sb; rz = rz * cb + uz * sb
      // Nose up a little, the way butterflies carry themselves.
      ux = fy * rz - fz * ry; uy = fz * rx - fx * rz; uz = fx * ry - fy * rx
      const cp = Math.cos(0.3), sp = Math.sin(0.3)
      fx = fx * cp + ux * sp; fy = fy * cp + uy * sp; fz = fz * cp + uz * sp
      ux = fy * rz - fz * ry; uy = fz * rx - fx * rz; uz = fx * ry - fy * rx

      // Landing: the flight above keeps running underneath, and the drawn
      // butterfly is carried from it onto its spot on the seed head. It comes
      // in from just above the spot and turns to sit along the surface.
      let px = pos[ix], py = pos[ix + 1] + Math.sin(ph) * 0.03 * (1 - land), pz = pos[ix + 2]
      if (land > 0) {
        const hb = a.puff * 3
        const R = scene.puffR[a.puff] * 0.96
        const lift = (1 - land) * 0.35
        px = lerp(px, scene.puff[hb] + a.nx * (R + lift), land)
        py = lerp(py, scene.puff[hb + 1] + a.ny * (R + lift), land)
        pz = lerp(pz, scene.puff[hb + 2] + a.nz * (R + lift), land)
        ux = lerp(ux, a.nx, land); uy = lerp(uy, a.ny, land); uz = lerp(uz, a.nz, land)
        const ul = Math.hypot(ux, uy, uz) || 1
        ux /= ul; uy /= ul; uz /= ul
        fx = lerp(fx, a.hx, land); fy = lerp(fy, a.hy, land); fz = lerp(fz, a.hz, land)
        const along = fx * ux + fy * uy + fz * uz
        fx -= ux * along; fy -= uy * along; fz -= uz * along
        const fl2 = Math.hypot(fx, fy, fz) || 1
        fx /= fl2; fy /= fl2; fz /= fl2
        rx = uy * fz - uz * fy; ry = uz * fx - ux * fz; rz = ux * fy - uy * fx
      }
      ;(fold.array as Float32Array)[i] = land

      // Sinking into the seed head: it draws down into the threads and is gone.
      const s = a.size * shown
      if (away > 0) {
        const hb = a.puff * 3
        px = lerp(px, scene.puff[hb], away * 0.55); py = lerp(py, scene.puff[hb + 1], away * 0.55); pz = lerp(pz, scene.puff[hb + 2], away * 0.55)
      }
      m.set(
        rx * s, ux * s, fx * s, px,
        ry * s, uy * s, fy * s, py,
        rz * s, uz * s, fz * s, pz,
        0, 0, 0, 1,
      )
      im.setMatrixAt(i, m)
    }
    im.instanceMatrix.needsUpdate = true
    phase.needsUpdate = true
    fold.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}
