'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TL, morphAt, smoothstep } from '../story'
import { palette } from './palette'
import { MAX_FLOWERS, PUFFS, SPHERES, TOOL_COUNT, puffRadius, type ProgressRef, type SceneState } from './state'

// Reel flowers, one per tool sphere, standing on the right of the hero.
//
// The drawing comes from the design board (viewBox 0 0 64 128, head centred
// on 32,32). Everything here is measured in that drawing's units, with
// UNIT of them to one head radius:
//   head   a solid accent disc (r 22.5) inside a text-colour outline (to r
//          25.5), four holes (r 5.5, 11 out from the hub) cut right through,
//          and a hub dot (r 1.6). It turns slowly.
//   stem   a text-colour ribbon 2.2 wide from the bottom of the head down
//          out of frame, with one leaf.
//
// The head is one camera-facing quad per flower with the shape worked out
// per pixel (signed distances), so it stays crisp at any size and its colours
// are just uniforms. Stems and leaves are a small mesh rebuilt each frame,
// since they follow the swaying heads.
//
// As the story starts, each head turns into its sphere: the disc shrinks into
// its hub dot while the sphere grows out of the same point. Everything is a
// function of scroll progress, so it runs backwards exactly the same way.
const UNIT = 24
const STEM_SEGMENTS = 14
const STEM_FOOT_Y = -3.6
const STEM_HALF_WIDTH = 1.1 / UNIT // in head radii
const HUB = 1.6 / UNIT // what the disc shrinks down to
const LEAF_DROP = (100 - 56) / UNIT // how far below the head's bottom edge the leaf joins the stem
const LEAF_STEPS = 12
const LEAF_POINTS = LEAF_STEPS * 2

// The leaf outline, M35 100 C46 92 54 92 58 86 C52 100 44 104 35 100z, as
// points relative to where it joins the stem, in head radii, y up. The first
// entry is a point inside it, for the triangle fan.
function leafOutline() {
  const cubic = (a: number, b: number, c: number, d: number, t: number) => {
    const m = 1 - t
    return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d
  }
  const pts: [number, number][] = [[47, 96]]
  for (let i = 0; i < LEAF_STEPS; i++) {
    const t = i / LEAF_STEPS
    pts.push([cubic(35, 46, 54, 58, t), cubic(100, 92, 92, 86, t)])
  }
  for (let i = 0; i < LEAF_STEPS; i++) {
    const t = i / LEAF_STEPS
    pts.push([cubic(58, 52, 44, 35, t), cubic(86, 100, 104, 100, t)])
  }
  return pts.map(([x, y]) => [(x - 35) / UNIT, -(y - 100) / UNIT] as const)
}

interface Flower {
  home: readonly [number, number, number]
  R: number // head radius
  swayA: number; swayB: number; nod: number // phases of its sway
  foot: number // how far the stem's foot sits to one side of the head
  spin: number; turn: number // where the reel starts and which way it turns
  late: number // 0..1: scenery flowers fade out one after another
}

// Small seeded generator, so the meadow is the same on every visit.
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// How much bigger something at depth z looks than at z = 0 (the camera is at z = 8).
const nearness = (z: number) => 8 / (8 - z)

// The meadow. The first TOOL_COUNT flowers are the ones that become the tool
// spheres and stand exactly where they always have. The rest are scenery:
// scattered over the right-hand side, many of them smaller and further back,
// each tried in a few places and kept where it overlaps its neighbours least.
// Scenery stays right of x = 1 on screen (in world units at z = 0), clear of
// the hero text, and below the nav.
function plantMeadow(count: number, size: number): Flower[] {
  const rand = seeded(11)
  const flowers: Flower[] = SPHERES.map((s, h) => ({
    home: PUFFS[h], R: puffRadius(s.r) * size,
    swayA: h * 1.9, swayB: h * 0.7, nod: h * 2.6,
    foot: h % 2 === 0 ? -0.18 : 0.14,
    spin: h * 1.3, turn: h % 2 === 0 ? 1 : -1, late: 0,
  }))
  while (flowers.length < count) {
    let best: { x: number; y: number; z: number; R: number } | null = null
    let bestGap = -Infinity
    for (let tries = 0; tries < 40; tries++) {
      const back = Math.pow(rand(), 0.7) // most stand toward the back
      const z = 1 - back * 3.8
      const k = nearness(z)
      const R = (0.2 + rand() * 0.17) * (1 - 0.3 * back) * size
      const sx = 1 + rand() * 2.75 // where it lands on screen; stays inside the frame on wide windows too
      const sy = -1.75 + rand() * 3.5
      let gap = Infinity
      for (const f of flowers) {
        const kf = nearness(f.home[2])
        gap = Math.min(gap, Math.hypot(f.home[0] * kf - sx, f.home[1] * kf - sy) - (f.R * kf + R * k) * 1.25)
      }
      if (gap > bestGap) { bestGap = gap; best = { x: sx / k, y: sy / k, z, R } }
      if (gap > 0) break
    }
    const b = best!
    flowers.push({
      home: [b.x, b.y, b.z], R: b.R,
      swayA: rand() * 6.28, swayB: rand() * 6.28, nod: rand() * 6.28,
      foot: (rand() - 0.5) * 0.4,
      spin: rand() * 6.28, turn: rand() < 0.5 ? 1 : -1, late: rand(),
    })
  }
  return flowers
}

// A camera-facing quad per head. `attr` carries (radius, opacity, spin).
const headVert = (attr: string) => /* glsl */ `
attribute vec3 aCenter;
attribute vec3 ${attr};
uniform float uGrow; // quad half-size, in radii
varying vec2 vUv;
varying float vAlpha;
varying float vSpin;
varying float vDepth;
void main() {
  vec4 mv = viewMatrix * vec4(aCenter, 1.0);
  mv.xy += position.xy * ${attr}.x * uGrow;
  vUv = position.xy * uGrow;
  vAlpha = ${attr}.y;
  vSpin = ${attr}.z;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const FOG = /* glsl */ `
  float fog = smoothstep(6.5, 12.5, vDepth);
`

const DISC_FRAG = /* glsl */ `
uniform vec3 uFg;
uniform vec3 uAccent;
uniform vec3 uInk;
uniform float uLight;
varying vec2 vUv;
varying float vAlpha;
varying float vSpin;
varying float vDepth;
void main() {
  vec2 q = vUv * ${UNIT.toFixed(1)}; // drawing units from the hub
  float r = length(q);
  float px = max(fwidth(r), 1e-3);
  float a = 1.0 - smoothstep(25.5 - px, 25.5 + px, r);
  // The four holes turn with the reel. Folding the plane into one eighth
  // leaves a single hole to measure.
  float c = cos(vSpin);
  float s = sin(vSpin);
  vec2 h = abs(vec2(q.x * c + q.y * s, -q.x * s + q.y * c));
  if (h.y > h.x) h = h.yx;
  float hole = length(h - vec2(11.0, 0.0)) - 5.5;
  a *= smoothstep(-px, px, hole);
  vec3 col = uAccent;
  // Light: the accent barely differs from the page showing through the
  // holes, so each hole gets a thin ink rim.
  col = mix(col, uInk, uLight * (1.0 - smoothstep(0.9 - px, 0.9 + px, hole)));
  col = mix(col, uInk, 1.0 - smoothstep(1.6 - px, 1.6 + px, r));
  col = mix(col, uFg, smoothstep(22.5 - px, 22.5 + px, r));
  a *= vAlpha;
  if (a < 0.02) discard;
  ${FOG}
  gl_FragColor = vec4(col, a * (1.0 - fog * 0.75));
  #include <colorspace_fragment>
}
`

// The soft accent glow behind each head. Light added to the page, so Dark only.
const GLOW_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform float uLight;
varying vec2 vUv;
varying float vAlpha;
varying float vDepth;
void main() {
  float d = length(vUv);
  float a = exp(-d * d * 3.2) * (1.0 - smoothstep(0.6, 1.0, d)) * vAlpha * (1.0 - uLight);
  if (a < 0.002) discard;
  ${FOG}
  gl_FragColor = vec4(uAccent, a * (1.0 - fog * 0.75));
  #include <colorspace_fragment>
}
`

const STEM_VERT = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying float vDepth;
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * mv;
}
`

const STEM_FRAG = /* glsl */ `
uniform vec3 uFg;
varying float vAlpha;
varying float vDepth;
void main() {
  ${FOG}
  gl_FragColor = vec4(uFg, vAlpha * (1.0 - fog * 0.75));
  #include <colorspace_fragment>
}
`

export function ReelFlowers({ state, progress, count, size }: { state: SceneState; progress: ProgressRef; count: number; size: number }) {
  const built = useMemo(() => {
    const N = Math.min(MAX_FLOWERS, Math.max(TOOL_COUNT, count))
    const flowers = plantMeadow(N, size)
    // Heads: one quad, drawn once per flower.
    const heads = new THREE.InstancedBufferGeometry()
    heads.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3))
    heads.setIndex([0, 1, 2, 2, 1, 3])
    const center = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    const head = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    const glow = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    center.setUsage(THREE.DynamicDrawUsage); head.setUsage(THREE.DynamicDrawUsage); glow.setUsage(THREE.DynamicDrawUsage)
    heads.setAttribute('aCenter', center)
    heads.setAttribute('aHead', head)
    heads.setAttribute('aGlow', glow)
    heads.instanceCount = N

    // Heads and stems write depth, so a nearer flower hides a farther one
    // whatever order they are drawn in.
    const discMaterial = new THREE.ShaderMaterial({
      vertexShader: headVert('aHead'),
      fragmentShader: DISC_FRAG,
      uniforms: { uFg: { value: palette.fg }, uAccent: { value: palette.accent }, uInk: { value: palette.ink }, uLight: palette.light, uGrow: { value: 1.1 } },
      transparent: true,
      toneMapped: false,
    })
    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader: headVert('aGlow'),
      fragmentShader: GLOW_FRAG,
      uniforms: { uAccent: { value: palette.accent }, uLight: palette.light, uGrow: { value: 1 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })

    // Stems (a ribbon each) and leaves (a triangle fan each), in one mesh.
    const outline = leafOutline()
    const stemVerts = (STEM_SEGMENTS + 1) * 2
    const perFlower = stemVerts + outline.length
    const stems = new THREE.BufferGeometry()
    const stemPos = new THREE.BufferAttribute(new Float32Array(N * perFlower * 3), 3)
    const stemAlpha = new THREE.BufferAttribute(new Float32Array(N * perFlower), 1)
    stemPos.setUsage(THREE.DynamicDrawUsage); stemAlpha.setUsage(THREE.DynamicDrawUsage)
    const index: number[] = []
    for (let h = 0; h < N; h++) {
      const base = h * perFlower
      for (let s = 0; s < STEM_SEGMENTS; s++) {
        const v = base + s * 2
        index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
      const leaf = base + stemVerts
      for (let i = 0; i < LEAF_POINTS; i++) index.push(leaf, leaf + 1 + i, leaf + 1 + ((i + 1) % LEAF_POINTS))
    }
    stems.setAttribute('position', stemPos)
    stems.setAttribute('aAlpha', stemAlpha)
    stems.setIndex(index)
    const stemMaterial = new THREE.ShaderMaterial({
      vertexShader: STEM_VERT,
      fragmentShader: STEM_FRAG,
      uniforms: { uFg: { value: palette.fg } },
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    })

    return {
      N, flowers, heads, center, head, glow, discMaterial, glowMaterial,
      stems, stemPos, stemAlpha, stemMaterial, outline, stemVerts, perFlower,
      line: new Float32Array((STEM_SEGMENTS + 1) * 3), // one stem's centre line, per-frame scratch
    }
  }, [count, size])

  useEffect(() => () => {
    built.heads.dispose(); built.stems.dispose()
    built.discMaterial.dispose(); built.glowMaterial.dispose(); built.stemMaterial.dispose()
  }, [built])

  const group = useRef<THREE.Group>(null)
  const frames = useRef(0)

  useFrame((frame) => {
    const t = frame.clock.elapsedTime
    const p = progress.current
    const xs = Math.max(0.55, Math.min(1.2, frame.viewport.width / 8.06))
    const { N, flowers, center, head, glow, stemPos, stemAlpha, outline, stemVerts, perFlower, line } = built
    const C = center.array as Float32Array, H = head.array as Float32Array, G = glow.array as Float32Array
    const SP = stemPos.array as Float32Array, SA = stemAlpha.array as Float32Array
    let any = 0
    state.flowers = N

    for (let h = 0; h < N; h++) {
      const f = flowers[h]
      const home = f.home
      const R = f.R
      // The head rides the top of its stem: a slow sway, different for each.
      const sway = Math.sin(t * 0.47 + f.swayA) * 0.07 + Math.sin(t * 1.07 + f.swayB) * 0.025
      const nod = Math.sin(t * 0.39 + f.nod) * 0.035
      const x = home[0] * xs + sway
      const y = home[1] - Math.abs(sway) * 0.12
      const z = home[2] + nod
      state.puff[h * 3] = x; state.puff[h * 3 + 1] = y; state.puff[h * 3 + 2] = z
      state.puffR[h] = R

      let draw = 0
      let present: number
      let stemA: number
      if (h < TOOL_COUNT) {
        // Where this head is in its change into a sphere (0 = flower, 1 = sphere formed).
        const u = morphAt(p, SPHERES[h].start)
        draw = smoothstep(0.1, 0.62, u)
        present = 1 - smoothstep(0.5, 0.66, u)
        stemA = 1 - smoothstep(0.05, 0.5, u)
      } else {
        // Scenery: no sphere. It simply fades away as the story starts.
        const span = (TL.scenery[1] - TL.scenery[0]) * 0.6
        const start = TL.scenery[0] + (TL.scenery[1] - TL.scenery[0] - span) * f.late
        present = 1 - smoothstep(start, start + span, p)
        stemA = present
      }
      any = Math.max(any, present, stemA)

      // The disc shrinks into its hub dot, turning faster as it goes, and
      // hands over to the sphere growing out of the same point.
      const shrink = 1 - draw * (1 - HUB)
      C[h * 3] = x; C[h * 3 + 1] = y; C[h * 3 + 2] = z
      H[h * 3] = R * shrink
      H[h * 3 + 1] = present
      H[h * 3 + 2] = f.turn * t * 0.35 + f.spin + draw * 5
      // The glow swells a little as the disc gathers, then goes with it.
      G[h * 3] = R * 1.45 * (1 - 0.45 * draw)
      G[h * 3 + 1] = (0.13 + 0.16 * Math.sin(Math.PI * draw)) * present

      // Stem: a gentle arc from below the frame to the bottom of the head.
      const footX = home[0] * xs + f.foot
      const topY = y - R * shrink * (25.5 / UNIT)
      const at = (k: number, out: Float32Array, o: number) => {
        const bend = k * k
        out[o] = footX + (x - footX) * bend + 0.05 * Math.sin((1 - k) * 5)
        out[o + 1] = STEM_FOOT_Y + (topY - STEM_FOOT_Y) * k
        out[o + 2] = home[2] + (z - home[2]) * bend
      }
      for (let s = 0; s <= STEM_SEGMENTS; s++) at(s / STEM_SEGMENTS, line, s * 3)
      const base = h * perFlower
      const hw = R * STEM_HALF_WIDTH
      for (let s = 0; s <= STEM_SEGMENTS; s++) {
        const a = Math.max(0, s - 1) * 3, b = Math.min(STEM_SEGMENTS, s + 1) * 3
        // Width runs across the stem, in the plane facing the camera.
        let nx = -(line[b + 1] - line[a + 1]), ny = line[b] - line[a]
        const nl = Math.hypot(nx, ny) || 1
        nx = (nx / nl) * hw; ny = (ny / nl) * hw
        const o = s * 3
        const v = base + s * 2
        SP[v * 3] = line[o] - nx; SP[v * 3 + 1] = line[o + 1] - ny; SP[v * 3 + 2] = line[o + 2]
        SP[v * 3 + 3] = line[o] + nx; SP[v * 3 + 4] = line[o + 1] + ny; SP[v * 3 + 5] = line[o + 2]
        // Solid near the head, easing out toward the foot.
        const fade = stemA * smoothstep(0, 0.35, s / STEM_SEGMENTS)
        SA[v] = fade; SA[v + 1] = fade
      }

      // Leaf: joined to the stem a fixed way below the head.
      const kLeaf = Math.max(0, 1 - (LEAF_DROP * R) / (topY - STEM_FOOT_Y))
      at(kLeaf, line, 0)
      const lx = line[0], ly = line[1], lz = line[2]
      for (let i = 0; i < outline.length; i++) {
        const v = base + stemVerts + i
        SP[v * 3] = lx + outline[i][0] * R
        SP[v * 3 + 1] = ly + outline[i][1] * R
        SP[v * 3 + 2] = lz
        SA[v] = stemA * 0.7
      }
    }

    center.needsUpdate = true; head.needsUpdate = true; glow.needsUpdate = true
    stemPos.needsUpdate = true; stemAlpha.needsUpdate = true
    // Nothing left to draw once every head has become its sphere (first frames always draw, to compile).
    if (group.current) group.current.visible = any > 0.001 || frames.current++ < 6
  })

  return (
    <group ref={group}>
      <mesh geometry={built.heads} material={built.glowMaterial} frustumCulled={false} renderOrder={1} />
      <mesh geometry={built.stems} material={built.stemMaterial} frustumCulled={false} renderOrder={2} />
      <mesh geometry={built.heads} material={built.discMaterial} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
