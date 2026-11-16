'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { morphAt, smoothstep } from '../story'
import { PUFFS, SPHERES, TOOL_COUNT, puffRadius, type ProgressRef, type SceneState } from './state'

// Dandelion seed heads, one per tool sphere, standing on the right of the hero.
//
// A head is a few hundred real seeds: each seed is a hair-thin stalk running
// out from the core and opening into a small parachute of filaments, with a
// bright speck at the end of every filament. All seeds of all heads are one
// instanced line draw plus one instanced point draw; no textures.
//
// As the story starts, each head turns into its sphere: the seeds draw back
// into the core while the sphere grows out of it, and a few seeds let go and
// drift off. Everything is a function of scroll progress, so it runs backwards
// exactly the same way.

const STEM_SEGMENTS = 14
const STEM_FOOT_Y = -3.6

// Shared by the seed lines and the seed tips: places one vertex of one seed.
const SEED_COMMON = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aSeed; // x: release lottery, y z: per-seed randoms, w: which head
uniform vec3 uCenter[${TOOL_COUNT}];
uniform float uRadius[${TOOL_COUNT}];
uniform float uDraw[${TOOL_COUNT}];
uniform float uRelease[${TOOL_COUNT}];
uniform float uTime;
uniform float uLoose; // share of seeds that let go
varying float vAlpha;
varying float vDepth;

vec3 seedPosition(vec3 local, out float alpha) {
  int head = int(aSeed.w + 0.5);
  vec3 center = uCenter[head];
  float R = uRadius[head];
  float draw = uDraw[head];
  float rel = uRelease[head];
  float loose = step(aSeed.x, uLoose);

  // A light breeze: every seed trembles on its own, and the whole head leans together.
  vec3 dir = aDir;
  dir += 0.03 * vec3(sin(uTime * 1.3 + aSeed.y * 40.0), sin(uTime * 1.7 + aSeed.z * 40.0), sin(uTime * 1.1 + aSeed.x * 40.0));
  dir.x += 0.05 * sin(uTime * 0.55 + center.x * 1.7 + dir.y * 1.5);
  dir = normalize(dir);
  vec3 ref = abs(dir.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tx = normalize(cross(dir, ref));
  vec3 tz = cross(dir, tx);
  // Every parachute is turned its own way.
  float turn = aSeed.z * 6.2832;
  vec3 sx = tx * cos(turn) + tz * sin(turn);
  tz = tz * cos(turn) - tx * sin(turn);
  tx = sx;

  // Seeds are not all the same length, so the outline is soft, not a perfect ball.
  float len = R * (0.8 + 0.2 * aSeed.y);
  float core = R * 0.13;
  // Drawing in: a seed that stays shortens back into the core.
  float keep = 1.0 - draw * (1.0 - loose);
  vec3 p = dir * (core * keep + (len - core) * local.y * keep) + (tx * local.x + tz * local.z) * R * keep;

  // Letting go: a loose seed lifts off outward, then rides the breeze up and away.
  float drift = rel * loose;
  vec3 away = dir * 0.5 + vec3(1.5 + 2.2 * aSeed.y, 0.7 + 1.1 * aSeed.z, 0.6 * (aSeed.y - 0.5));
  p += away * drift * (0.4 + drift) + vec3(0.0, sin(drift * 6.0 + aSeed.z * 20.0) * 0.08 * drift, 0.0);

  alpha = mix(1.0 - smoothstep(0.8, 1.0, draw), 1.0 - smoothstep(0.3, 0.95, rel), loose);
  return center + p;
}
`

const LINE_VERT = /* glsl */ `
attribute float aT;
${SEED_COMMON}
void main() {
  float alpha;
  vec3 wp = seedPosition(position, alpha);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDepth = -mv.z;
  // The stalk is faint; the parachute filaments carry the light.
  vAlpha = alpha * mix(0.06, 0.3, aT);
  gl_Position = projectionMatrix * mv;
}
`

const TIP_VERT = /* glsl */ `
uniform float uScale;
${SEED_COMMON}
void main() {
  float alpha;
  vec3 wp = seedPosition(position, alpha);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vDepth = -mv.z;
  vAlpha = alpha;
  gl_PointSize = clamp(uScale * 0.008 / -mv.z, 1.3, 3.5);
  gl_Position = projectionMatrix * mv;
}
`

const FOG = /* glsl */ `
  float fog = smoothstep(6.5, 12.5, vDepth);
`

const LINE_FRAG = /* glsl */ `
uniform vec3 uFg;
varying float vAlpha;
varying float vDepth;
void main() {
  ${FOG}
  gl_FragColor = vec4(uFg, vAlpha * (1.0 - fog * 0.75));
  #include <colorspace_fragment>
}
`

const TIP_FRAG = /* glsl */ `
uniform vec3 uGlow;
varying float vAlpha;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.75, 1.0, d));
  ${FOG}
  gl_FragColor = vec4(uGlow, a * vAlpha * 0.8 * (1.0 - fog * 0.7));
  #include <colorspace_fragment>
}
`

// Core (the receptacle the seeds sit on) and a soft halo, as round sprites.
const ORB_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aKind; // 0 = halo, 1 = core
uniform float uScale;
varying float vAlpha;
varying float vKind;
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  vAlpha = aAlpha * (1.0 - 0.75 * smoothstep(6.5, 12.5, -mv.z));
  vKind = aKind;
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`

const ORB_FRAG = /* glsl */ `
uniform vec3 uFg;
uniform vec3 uGlow;
varying float vAlpha;
varying float vKind;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  float d = length(q);
  if (d > 1.0) discard;
  if (vKind > 0.5) {
    // A small matte bead, lit from above.
    float light = 0.16 + 0.34 * clamp(0.5 - 0.6 * q.y - 0.3 * q.x, 0.0, 1.0);
    gl_FragColor = vec4(uFg * light, vAlpha * (1.0 - smoothstep(0.8, 1.0, d)));
  } else {
    float a = exp(-d * d * 3.2) * (1.0 - smoothstep(0.6, 1.0, d));
    gl_FragColor = vec4(uGlow, a * vAlpha);
  }
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

const blend = { transparent: true, depthWrite: false, toneMapped: false } as const

function buildSeeds(seedsPerHead: number, filaments: number) {
  // One seed in its own frame: y runs from the core (0) to the outer shell (1);
  // x and z are sideways, in head radii.
  // The stalk runs most of the way out; the parachute opens wide and shallow
  // at its end, so neighbouring parachutes overlap into one soft shell.
  const stalkEnd = 0.8
  const line: number[] = []
  const lineT: number[] = []
  const tip: number[] = []
  line.push(0, 0, 0, 0, stalkEnd, 0)
  lineT.push(0, 0.3)
  for (let f = 0; f < filaments; f++) {
    const a = (f / filaments) * Math.PI * 2
    const spread = 0.2
    const x = Math.cos(a) * spread, z = Math.sin(a) * spread
    // Each filament is two short pieces, so the parachute cups outward slightly.
    line.push(0, stalkEnd, 0, x * 0.55, stalkEnd + 0.12, z * 0.55)
    lineT.push(0.6, 0.85)
    line.push(x * 0.55, stalkEnd + 0.12, z * 0.55, x, stalkEnd + 0.18, z)
    lineT.push(0.85, 1)
    tip.push(x, stalkEnd + 0.18, z)
  }

  const count = seedsPerHead * TOOL_COUNT
  const dir = new Float32Array(count * 3)
  const seed = new Float32Array(count * 4)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let h = 0; h < TOOL_COUNT; h++) {
    for (let i = 0; i < seedsPerHead; i++) {
      const k = h * seedsPerHead + i
      // Even coverage of the ball (a spiral), nudged so no two heads match.
      const y = 1 - ((i + 0.5) / seedsPerHead) * 2
      const r = Math.sqrt(1 - y * y)
      const a = i * golden + h * 1.3
      const j = 0.09
      const dx = Math.cos(a) * r + (Math.random() - 0.5) * j
      const dy = y + (Math.random() - 0.5) * j
      const dz = Math.sin(a) * r + (Math.random() - 0.5) * j
      const l = Math.hypot(dx, dy, dz)
      dir[k * 3] = dx / l; dir[k * 3 + 1] = dy / l; dir[k * 3 + 2] = dz / l
      seed[k * 4] = Math.random(); seed[k * 4 + 1] = Math.random(); seed[k * 4 + 2] = Math.random(); seed[k * 4 + 3] = h
    }
  }
  const make = (positions: number[]) => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dir, 3))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
    g.instanceCount = count
    return g
  }
  const lines = make(line)
  lines.setAttribute('aT', new THREE.Float32BufferAttribute(lineT, 1))
  return { lines, tips: make(tip) }
}

export function Dandelions({ state, progress, seeds, filaments, fg, glow }: { state: SceneState; progress: ProgressRef; seeds: number; filaments: number; fg: string; glow: string }) {
  const built = useMemo(() => {
    const { lines, tips } = buildSeeds(seeds, filaments)
    const shared = {
      uCenter: { value: Array.from({ length: TOOL_COUNT }, () => new THREE.Vector3()) },
      uRadius: { value: new Float32Array(TOOL_COUNT) },
      uDraw: { value: new Float32Array(TOOL_COUNT) },
      uRelease: { value: new Float32Array(TOOL_COUNT) },
      uTime: { value: 0 },
      uLoose: { value: 0.11 },
    }
    const cFg = new THREE.Color(fg)
    const cGlow = new THREE.Color(glow)
    const lineMaterial = new THREE.ShaderMaterial({ vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, uniforms: { ...shared, uFg: { value: cFg } }, ...blend })
    const tipMaterial = new THREE.ShaderMaterial({ vertexShader: TIP_VERT, fragmentShader: TIP_FRAG, uniforms: { ...shared, uGlow: { value: cGlow }, uScale: { value: 1 } }, ...blend })

    // Halo + core sprites: two points per head.
    const orbs = new THREE.BufferGeometry()
    const orbPos = new THREE.BufferAttribute(new Float32Array(TOOL_COUNT * 2 * 3), 3)
    const orbSize = new THREE.BufferAttribute(new Float32Array(TOOL_COUNT * 2), 1)
    const orbAlpha = new THREE.BufferAttribute(new Float32Array(TOOL_COUNT * 2), 1)
    const orbKind = new Float32Array(TOOL_COUNT * 2)
    for (let h = 0; h < TOOL_COUNT; h++) orbKind[h * 2 + 1] = 1
    orbPos.setUsage(THREE.DynamicDrawUsage); orbSize.setUsage(THREE.DynamicDrawUsage); orbAlpha.setUsage(THREE.DynamicDrawUsage)
    orbs.setAttribute('position', orbPos)
    orbs.setAttribute('aSize', orbSize)
    orbs.setAttribute('aAlpha', orbAlpha)
    orbs.setAttribute('aKind', new THREE.BufferAttribute(orbKind, 1))
    const orbMaterial = new THREE.ShaderMaterial({ vertexShader: ORB_VERT, fragmentShader: ORB_FRAG, uniforms: { uFg: { value: cFg }, uGlow: { value: cGlow }, uScale: { value: 1 } }, ...blend })

    // Stems: a thin curved line from below the frame up to each head.
    const stems = new THREE.BufferGeometry()
    const stemPos = new THREE.BufferAttribute(new Float32Array(TOOL_COUNT * STEM_SEGMENTS * 2 * 3), 3)
    const stemAlpha = new THREE.BufferAttribute(new Float32Array(TOOL_COUNT * STEM_SEGMENTS * 2), 1)
    stemPos.setUsage(THREE.DynamicDrawUsage); stemAlpha.setUsage(THREE.DynamicDrawUsage)
    stems.setAttribute('position', stemPos)
    stems.setAttribute('aAlpha', stemAlpha)
    const stemMaterial = new THREE.ShaderMaterial({ vertexShader: STEM_VERT, fragmentShader: LINE_FRAG, uniforms: { uFg: { value: cFg } }, ...blend })

    return { lines, tips, shared, lineMaterial, tipMaterial, orbs, orbPos, orbSize, orbAlpha, orbMaterial, stems, stemPos, stemAlpha, stemMaterial }
  }, [seeds, filaments, fg, glow])

  useEffect(() => () => {
    built.lines.dispose(); built.tips.dispose(); built.orbs.dispose(); built.stems.dispose()
    built.lineMaterial.dispose(); built.tipMaterial.dispose(); built.orbMaterial.dispose(); built.stemMaterial.dispose()
  }, [built])

  const group = useRef<THREE.Group>(null)
  const frames = useRef(0)

  useFrame((frame) => {
    const t = frame.clock.elapsedTime
    const p = progress.current
    const xs = Math.max(0.55, Math.min(1.2, frame.viewport.width / 8.06))
    const { shared, orbPos, orbSize, orbAlpha, stemPos, stemAlpha } = built
    const OP = orbPos.array as Float32Array, OS = orbSize.array as Float32Array, OA = orbAlpha.array as Float32Array
    const SP = stemPos.array as Float32Array, SA = stemAlpha.array as Float32Array
    shared.uTime.value = t
    let any = 0

    for (let h = 0; h < TOOL_COUNT; h++) {
      const home = PUFFS[h]
      const R = puffRadius(SPHERES[h].r)
      // The head rides the top of its stem: a slow sway, different for each.
      const sway = Math.sin(t * 0.47 + h * 1.9) * 0.07 + Math.sin(t * 1.07 + h * 0.7) * 0.025
      const nod = Math.sin(t * 0.39 + h * 2.6) * 0.035
      const x = home[0] * xs + sway
      const y = home[1] - Math.abs(sway) * 0.12
      const z = home[2] + nod
      state.puff[h * 3] = x; state.puff[h * 3 + 1] = y; state.puff[h * 3 + 2] = z
      state.puffR[h] = R

      // Where this head is in its change into a sphere (0 = dandelion, 1 = sphere formed).
      const u = morphAt(p, SPHERES[h].start)
      const draw = smoothstep(0.1, 0.62, u)
      const present = 1 - smoothstep(0.5, 0.66, u)
      ;(shared.uCenter.value[h] as THREE.Vector3).set(x, y, z)
      shared.uRadius.value[h] = R
      shared.uDraw.value[h] = draw
      shared.uRelease.value[h] = smoothstep(0.08, 1.9, u)
      any = Math.max(any, 1 - smoothstep(1.7, 1.9, u))

      // Halo swells a little as the seeds gather, then hands over to the sphere.
      const o = h * 2
      OP[o * 3] = x; OP[o * 3 + 1] = y; OP[o * 3 + 2] = z
      OS[o] = R * 2.9 * (1 - 0.45 * draw)
      OA[o] = (0.13 + 0.16 * Math.sin(Math.PI * draw)) * present
      OP[o * 3 + 3] = x; OP[o * 3 + 4] = y; OP[o * 3 + 5] = z
      OS[o + 1] = R * 0.3
      OA[o + 1] = present

      // Stem: a gentle arc whose top follows the head.
      const footX = home[0] * xs + (h % 2 === 0 ? -0.18 : 0.14)
      const stemA = (1 - smoothstep(0.05, 0.5, u)) * 0.24
      for (let s = 0; s < STEM_SEGMENTS; s++) {
        for (let e = 0; e < 2; e++) {
          const k = (s + e) / STEM_SEGMENTS
          const v = (h * STEM_SEGMENTS + s) * 2 + e
          const bend = k * k
          SP[v * 3] = footX + (x - footX) * bend
          SP[v * 3 + 1] = STEM_FOOT_Y + (y - R * 0.12 - STEM_FOOT_Y) * k
          SP[v * 3 + 2] = home[2] + (z - home[2]) * bend
          SA[v] = stemA * (0.25 + 0.75 * k)
        }
      }
    }

    orbPos.needsUpdate = true; orbSize.needsUpdate = true; orbAlpha.needsUpdate = true
    stemPos.needsUpdate = true; stemAlpha.needsUpdate = true
    const scale = frame.size.height * frame.viewport.dpr * 1.586 // 1 / (2 tan(fov / 2)) at fov 35
    built.tipMaterial.uniforms.uScale.value = scale
    built.orbMaterial.uniforms.uScale.value = scale
    // Nothing left to draw once the last loose seed has gone (first frames always draw, to compile).
    if (group.current) group.current.visible = any > 0.001 || frames.current++ < 6
  })

  return (
    <group ref={group}>
      <points geometry={built.orbs} material={built.orbMaterial} frustumCulled={false} renderOrder={1} />
      <lineSegments geometry={built.stems} material={built.stemMaterial} frustumCulled={false} renderOrder={1} />
      <lineSegments geometry={built.lines} material={built.lineMaterial} frustumCulled={false} renderOrder={2} />
      <points geometry={built.tips} material={built.tipMaterial} frustumCulled={false} renderOrder={3} />
    </group>
  )
}
