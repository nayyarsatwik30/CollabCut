'use client'

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TL, smoothstep } from '../story'
import { BODY_COUNT, CENTER, PLANE_Z, type ProgressRef, type SceneState } from './state'

// The "page" the spheres come out of: a plane behind the scene carrying a
// faint pool of light, the soft shadow each sphere casts on it (wider and
// fainter the further the sphere is from the page), a little bounce light
// from the glowing trails, and the expanding shockwave ring. It is pure black
// during the hero and fades up with the story.
const VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
uniform vec4 uBodies[${BODY_COUNT}];
uniform float uGlows[${BODY_COUNT}];
uniform float uReveal;
uniform float uFlash;
uniform float uRing;
uniform vec2 uCenter;
uniform vec2 uRes;
uniform vec3 uFg;
uniform vec3 uBg;
uniform vec3 uGlow;
varying vec3 vW;
const float PLANE = ${PLANE_Z.toFixed(1)};
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = vW.xy - vec2(0.8, 0.5);
  vec2 k = vW.xy - vec2(-5.0, 4.5);
  float pool = 0.016 * exp(-dot(q, q) * 0.03) + 0.004 * exp(-dot(k, k) * 0.03);
  float occ = 1.0;
  float bounce = 0.0;
  // Light arrives from the upper left, so shadows fall down and to the right.
  vec2 shift = vec2(0.28, -0.56);
  for (int i = 0; i < ${BODY_COUNT}; i++) {
    vec4 b = uBodies[i];
    if (b.w < 0.01) continue;
    float gap = max(0.0, b.z - b.w - PLANE);
    vec2 c = b.xy + shift * (b.z - PLANE) * 0.4;
    float R = b.w * (1.0 + gap * 0.17);
    float d = length(vW.xy - c);
    float dark = 0.9 / (1.0 + gap * 0.45);
    occ *= 1.0 - dark * (1.0 - smoothstep(R * 0.2, R * 1.3, d));
    float dg = length(vW.xy - b.xy);
    bounce += uGlows[i] * 0.02 * exp(-dg * dg / (R * R * 4.0)) / (1.0 + gap * 0.25);
  }
  // The lit page falls away to pure page colour at the frame edges, so the
  // canvas has no visible boundary against the sections around it.
  vec2 suv = gl_FragCoord.xy / uRes;
  float vig = smoothstep(0.0, 0.3, suv.y) * smoothstep(1.0, 0.72, suv.y) * smoothstep(0.0, 0.2, suv.x) * smoothstep(1.0, 0.8, suv.x);
  float light = (pool * occ + bounce) * uReveal * vig;
  vec2 cq = vW.xy - uCenter;
  float cr = length(cq);
  light += uFlash * 0.022 * exp(-cr * cr * 0.09);
  vec3 col = uBg + uFg * light;
  if (uRing > 0.0 && uRing < 1.0) {
    float e = 1.0 - pow(1.0 - uRing, 3.0);
    float R = mix(1.2, 8.5, e);
    float w = mix(0.07, 0.3, e);
    float band = exp(-pow((cr - R) / w, 2.0));
    col += uGlow * band * pow(1.0 - uRing, 2.2) * 0.085 * vig;
  }
  // Dither: dark gradients band badly at 8 bits.
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.0009;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}
`

export function Backdrop({ state, progress, fg, bg, glow }: { state: SceneState; progress: ProgressRef; fg: string; bg: string; glow: string }) {
  const { geometry, material, bodies } = useMemo(() => {
    const bodies = Array.from({ length: BODY_COUNT }, () => new THREE.Vector4())
    const geometry = new THREE.PlaneGeometry(80, 50)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uBodies: { value: bodies },
        uGlows: { value: new Float32Array(BODY_COUNT) },
        uReveal: { value: 0 },
        uFlash: { value: 0 },
        uRing: { value: 0 },
        uCenter: { value: new THREE.Vector2(CENTER[0], CENTER[1]) },
        uRes: { value: new THREE.Vector2(1, 1) },
        uFg: { value: new THREE.Color(fg) },
        uBg: { value: new THREE.Color(bg) },
        uGlow: { value: new THREE.Color(glow) },
      },
      depthWrite: false,
    })
    return { geometry, material, bodies }
  }, [fg, bg, glow])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useFrame((frame) => {
    const u = material.uniforms
    for (let i = 0; i < BODY_COUNT; i++) {
      bodies[i].set(state.pos[i * 3], state.pos[i * 3 + 1], state.pos[i * 3 + 2], state.radius[i])
      ;(u.uGlows.value as Float32Array)[i] = state.glow[i]
    }
    frame.gl.getDrawingBufferSize(u.uRes.value)
    u.uReveal.value = smoothstep(TL.reveal[0], TL.reveal[1], progress.current)
    const age = state.burstStart < 0 ? 99 : frame.clock.elapsedTime - state.burstStart
    u.uFlash.value = age < 2 ? Math.exp(-age * 3.2) * (state.burstDir > 0 ? 1 : 0.4) : 0
    u.uRing.value = state.burstDir > 0 ? age / 1.5 : 0
  })

  return <mesh geometry={geometry} material={material} position={[0, 0, PLANE_Z]} renderOrder={-1} frustumCulled={false} />
}
