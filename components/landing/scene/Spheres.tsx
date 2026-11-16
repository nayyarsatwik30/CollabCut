'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TL, clamp01, easeOutBack, lerp, morphAt, smoothstep } from '../story'
import { GLOW_LAYER, glowPass } from './Glow'
import { makeLabelTexture } from './labels'
import { palette } from './palette'
import { CENTER, MERGED, SPHERES, TOOL_COUNT, type Finish, type ProgressRef, type SceneState } from './state'

interface SphereUniforms {
  uLabel: { value: THREE.Texture }
  uInk: { value: THREE.Color }
  uRim: { value: number }
  uVelDir: { value: THREE.Vector3 }
  uGlowCol: { value: THREE.Color }
}

// Physically based finishes. The bodies are greys between Ink and Cream in
// both themes (they do not invert with the page); only the speed glow on the
// leading edge is the accent.
function makeMaterial(finish: Finish, blank: THREE.Texture) {
  const fg = palette.cream
  const glow = palette.accent
  const mix = (t: number) => palette.ink.clone().lerp(fg, t)
  let material: THREE.MeshPhysicalMaterial
  let ink: THREE.Color
  if (finish === 'obsidian') {
    material = new THREE.MeshPhysicalMaterial({ color: mix(0.012), roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.25 })
    ink = mix(0.9)
  } else if (finish === 'chrome') {
    material = new THREE.MeshPhysicalMaterial({ color: mix(0.82), roughness: 0.3, metalness: 1, envMapIntensity: 1.1 })
    ink = mix(0.0)
  } else {
    material = new THREE.MeshPhysicalMaterial({ color: mix(0.8), roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, sheen: 0.4, sheenRoughness: 0.5, sheenColor: fg.clone(), envMapIntensity: 0.8 })
    ink = mix(0.0)
  }
  const uniforms: SphereUniforms = { uLabel: { value: blank }, uInk: { value: ink }, uRim: { value: 0 }, uVelDir: { value: new THREE.Vector3(0, 0, 1) }, uGlowCol: { value: glow } }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uGlowPass: glowPass })
    shader.vertexShader = 'varying vec3 vCamDir;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vCamDir = normalize(-(modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);',
    )
    shader.fragmentShader = 'uniform float uGlowPass;\nuniform sampler2D uLabel;\nuniform vec3 uInk;\nuniform float uRim;\nuniform vec3 uVelDir;\nuniform vec3 uGlowCol;\nvarying vec3 vCamDir;\n' + shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      /* glsl */ `#include <clipping_planes_fragment>
      // Glow buffer: the sphere is a black occluder carrying only its hot
      // leading edge. Returns before any lighting is evaluated.
      if (uGlowPass > 0.5) {
        vec3 gn = normalize(vNormal);
        float gFres = pow(1.0 - clamp(dot(gn, normalize(vCamDir)), 0.0, 1.0), 3.4);
        float gLead = smoothstep(-0.1, 0.95, dot(gn, uVelDir));
        gl_FragColor = vec4(uGlowCol * gFres * gLead * uRim, 1.0);
        return;
      }`,
    ).replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      {
        // The label is projected from the camera's side of the sphere, so it
        // wraps over the curvature and always reads straight on.
        vec3 lz = normalize(vCamDir);
        vec3 lx = normalize(cross(vec3(0.0, 1.0, 0.0), lz));
        vec3 ly = cross(lz, lx);
        vec3 nn = normalize(vNormal);
        float facing = dot(nn, lz);
        vec2 luv = vec2(dot(nn, lx), dot(nn, ly)) / 1.5 + 0.5;
        float inside = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0) * step(0.0, facing);
        float la = texture2D(uLabel, luv).a * inside;
        outgoingLight = mix(outgoingLight, uInk * (0.82 + 0.18 * facing), la * 0.95);
        // Heat on the leading edge only, scaled by real speed: the side the
        // sphere is travelling toward glows, the rest stays plain material.
        // HDR, so this (and nothing else on the sphere) can bloom.
        float fres = pow(1.0 - clamp(facing, 0.0, 1.0), 3.4);
        float lead = smoothstep(-0.1, 0.95, dot(nn, uVelDir));
        outgoingLight += uGlowCol * fres * lead * uRim;
      }
      #include <opaque_fragment>`,
    )
  }
  material.customProgramCacheKey = () => 'lp-sphere'
  return { material, uniforms }
}

export function Spheres({ state, progress }: { state: SceneState; progress: ProgressRef }) {
  const built = useMemo(() => {
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
    blank.needsUpdate = true
    const geometry = new THREE.SphereGeometry(1, 64, 48)
    const group = new THREE.Group()
    const bodies = [...SPHERES.map((s) => ({ name: s.name, finish: s.finish })), { name: MERGED.name, finish: MERGED.finish }].map((b) => {
      const { material, uniforms } = makeMaterial(b.finish, blank)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.layers.enable(GLOW_LAYER)
      mesh.visible = false
      group.add(mesh)
      return { ...b, mesh, material, uniforms }
    })
    return { blank, geometry, group, bodies }
  }, [])

  // Labels are drawn once the page font is available.
  useEffect(() => {
    let cancelled = false
    const textures: THREE.Texture[] = []
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
    const draw = () => {
      if (cancelled) return
      built.bodies.forEach((b) => {
        const texture = makeLabelTexture(b.name, family)
        textures.push(texture)
        b.uniforms.uLabel.value = texture
      })
    }
    document.fonts.load(`600 64px ${family}`).then(draw, draw)
    return () => {
      cancelled = true
      textures.forEach((t) => t.dispose())
    }
  }, [built])

  useEffect(() => () => {
    built.geometry.dispose()
    built.blank.dispose()
    built.bodies.forEach((b) => b.material.dispose())
  }, [built])

  const sim = useRef({
    started: false,
    frames: 0,
    lastP: 0,
    seeds: SPHERES.map((_, i) => ({
      f1: 0.27 + ((i * 0.137) % 0.3), f2: 0.22 + ((i * 0.211) % 0.33), f3: 0.19 + ((i * 0.173) % 0.27),
      p1: i * 1.7, p2: i * 2.9 + 0.6, p3: i * 0.83 + 2.1,
      amp: 0.24 + ((i * 0.31) % 0.26),
      spin: i % 2 === 0 ? 1 : -1,
    })),
    mergedScale: 0,
    mergedVel: 0,
    push: new Float32Array(TOOL_COUNT * 3),
  })

  useFrame((frame, delta) => {
    const dt = Math.min(delta, 1 / 30)
    // The spring below is integrated in steps of at most 1/60 s. At the
    // stiffest point of the convergence (w x dt > 1 at 30 fps) a single
    // semi-implicit step is unstable and would grow every frame. A normal
    // 60 Hz frame (including its jitter) stays one step, so nothing changes there.
    const steps = Math.max(1, Math.ceil(dt * 60 - 0.05))
    const subDt = dt / steps
    const t = frame.clock.elapsedTime
    const p = progress.current
    const s = sim.current
    const { pos, vel, radius, glow: glowOut } = state
    const xs = Math.max(0.55, Math.min(1.2, frame.viewport.width / 8.06))
    const [cx, cy, cz] = CENTER
    const trailsFade = 1 - smoothstep(TL.trailsOut[0], TL.trailsOut[1], p)
    // For the first few frames everything is drawn at near-zero size, so the
    // materials compile and labels upload now rather than mid-scroll.
    const warm = s.frames++ < 6

    // Spheres are solid: where two would overlap they shoulder each other
    // aside. Released near the end of the convergence so they can become one.
    const solid = 1 - smoothstep(0.745, 0.79, p)
    const push = s.push
    push.fill(0)
    if (solid > 0) {
      for (let i = 0; i < TOOL_COUNT; i++) {
        for (let j = i + 1; j < TOOL_COUNT; j++) {
          const dx = pos[i * 3] - pos[j * 3], dy = pos[i * 3 + 1] - pos[j * 3 + 1], dz = pos[i * 3 + 2] - pos[j * 3 + 2]
          const dist = Math.hypot(dx, dy, dz)
          const min = (radius[i] + radius[j]) * 1.05
          if (dist >= min || dist < 1e-4) continue
          const f = ((min - dist) / dist) * 70 * solid
          push[i * 3] += dx * f; push[i * 3 + 1] += dy * f; push[i * 3 + 2] += dz * f
          push[j * 3] -= dx * f; push[j * 3 + 1] -= dy * f; push[j * 3 + 2] -= dz * f
        }
      }
    }

    for (let i = 0; i < TOOL_COUNT; i++) {
      const d = SPHERES[i]
      const sd = s.seeds[i]
      const ix = i * 3
      // Each sphere grows out of its flower (see morphAt in story.ts).
      const u = morphAt(p, d.start)
      const e = smoothstep(0.42, 1, u)
      const c = smoothstep(TL.converge[0] + d.delay, TL.converge[1], p)

      // Where it wants to be while roaming: an anchor that scrolling swings
      // through the scene and through depth, plus slow drift that never stops.
      const mid = p - 0.45
      const ang = d.swirl * mid * 2.0
      const ox = d.anchor[0] * xs - 1.0 * xs
      const oy = d.anchor[1]
      const ca = Math.cos(ang), sa = Math.sin(ang)
      const ax = 1.0 * xs + ox * ca - oy * sa
      const ay = ox * sa + oy * ca
      const az = d.anchor[2] + d.zDrift * mid * 3.0
      const rx = ax + Math.sin(t * sd.f1 + sd.p1) * sd.amp
      const ry = ay + Math.sin(t * sd.f2 + sd.p2) * sd.amp * 0.8
      const rz = az + Math.sin(t * sd.f3 + sd.p3) * sd.amp * 1.1

      // Emerging: it forms where its flower stood, then leaves for where it roams.
      const k = smoothstep(0.7, 1.6, u)
      let tx = lerp(state.puff[ix], rx, k)
      let ty = lerp(state.puff[ix + 1], ry, k)
      let tz = lerp(state.puff[ix + 2], rz, k)

      // Converging: spiral in, accelerating like a fall toward the centre.
      if (c > 0) {
        const pull = c * c * c
        const twist = c * 1.5 * sd.spin
        const ct = Math.cos(twist), st = Math.sin(twist)
        const dx = tx - cx, dy = ty - cy, dz = tz - cz
        tx = cx + (dx * ct - dy * st) * (1 - pull)
        ty = cy + (dx * st + dy * ct) * (1 - pull)
        tz = cz + dz * (1 - pull)
      }
      const targetR = d.r * Math.max(0, easeOutBack(e)) * (1 - smoothstep(0.72, 1, c))

      if (!s.started) {
        pos[ix] = tx; pos[ix + 1] = ty; pos[ix + 2] = tz
        radius[i] = targetR
      }
      // Spring follower: gives each sphere weight, overshoot and a true velocity.
      const w = d.omega * (1 + 2.6 * c)
      const z = 0.78
      for (let a = 0; a < 3; a++) {
        const target = a === 0 ? tx : a === 1 ? ty : tz
        for (let k = 0; k < steps; k++) {
          const acc = w * w * (target - pos[ix + a]) - 2 * z * w * vel[ix + a] + push[ix + a]
          vel[ix + a] += acc * subDt
          pos[ix + a] += vel[ix + a] * subDt
        }
      }
      radius[i] += (targetR - radius[i]) * (1 - Math.exp(-dt * 14))

      const speed = Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2])
      const present = clamp01(radius[i] / (d.r * 0.5))
      const g = (0.08 + 0.92 * smoothstep(0.25, 3.4, speed)) * trailsFade * present
      glowOut[i] += (g - glowOut[i]) * (1 - Math.exp(-dt * 10))

      const body = built.bodies[i]
      body.mesh.visible = warm || radius[i] > 0.004
      body.mesh.position.set(pos[ix], pos[ix + 1], pos[ix + 2])
      body.mesh.scale.setScalar(Math.max(radius[i], 0.0001))
      body.uniforms.uRim.value = 1.5 * glowOut[i]
      if (speed > 1e-3) body.uniforms.uVelDir.value.set(vel[ix] / speed, vel[ix + 1] / speed, vel[ix + 2] / speed).transformDirection(frame.camera.matrixWorldInverse)
    }

    // The merged sphere pops on an underdamped spring, so it overshoots and settles.
    const m = TOOL_COUNT
    const mx = m * 3
    const popTarget = MERGED.r * smoothstep(TL.pop[0], TL.pop[0] + 0.035, p)
    if (!s.started) s.mergedScale = popTarget
    const mw = 15
    s.mergedVel += (mw * mw * (popTarget - s.mergedScale) - 2 * 0.42 * mw * s.mergedVel) * dt
    s.mergedScale += s.mergedVel * dt
    radius[m] = Math.max(0, s.mergedScale)
    pos[mx] = cx + Math.sin(t * 0.31) * 0.05
    pos[mx + 1] = cy + Math.sin(t * 0.43 + 1.2) * 0.06
    pos[mx + 2] = cz
    glowOut[m] = 0
    const merged = built.bodies[m]
    merged.mesh.visible = warm || radius[m] > 0.004
    merged.mesh.position.set(pos[mx], pos[mx + 1], pos[mx + 2])
    merged.mesh.scale.setScalar(Math.max(radius[m], 0.0001))
    merged.uniforms.uRim.value = 0

    // One-shot flash + shockwave whenever the scroll crosses the merge point.
    if (s.started) {
      if (s.lastP < TL.merge && p >= TL.merge) { state.burstStart = t; state.burstDir = 1 }
      else if (s.lastP >= TL.merge && p < TL.merge) { state.burstStart = t; state.burstDir = -1 }
    }
    s.lastP = p
    s.started = true
    built.group.visible = warm || p > 0.03
  })

  return <primitive object={built.group} />
}
