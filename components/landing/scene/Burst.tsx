'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GLOW_LAYER } from './Glow'
import { palette } from './palette'
import { CENTER, type SceneState } from './state'

// The soft flash at the moment everything becomes one sphere. A one-shot in
// real time (about half a second), fired when the scroll crosses the merge
// point in either direction; the shockwave ring itself travels across the
// page plane (see Backdrop).
const FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform float uFlash;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 9.0;
  float r2 = dot(q, q);
  float a = uFlash * (exp(-r2 * 1.9) * 1.15 + exp(-r2 * 0.3) * 0.06);
  // Accent, whitening at its hot centre. Drawn over the frame rather than
  // added to it, so it shows on a pale page as well as a dark one.
  vec3 col = mix(uAccent, vec3(1.0), clamp(a, 0.0, 1.0) * 0.35) * (1.0 + a);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`

export function Burst({ state }: { state: SceneState }) {
  const mesh = useRef<THREE.Mesh>(null)
  const warm = useRef(0)
  const { geometry, material } = useMemo(() => ({
    geometry: new THREE.PlaneGeometry(9, 9),
    material: new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FRAG,
      uniforms: { uAccent: { value: palette.accent }, uFlash: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }),
  }), [])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useEffect(() => { mesh.current?.layers.enable(GLOW_LAYER) }, [])

  useFrame((frame) => {
    const m = mesh.current
    if (!m) return
    const age = state.burstStart < 0 ? 99 : frame.clock.elapsedTime - state.burstStart
    const rise = Math.min(1, age / 0.06)
    const flash = age < 1.5 ? rise * Math.exp(-age * 6.5) * (state.burstDir > 0 ? 1 : 0.45) : 0
    material.uniforms.uFlash.value = flash
    m.visible = flash > 0.002 || warm.current++ < 6
    m.quaternion.copy(frame.camera.quaternion)
  })

  return <mesh ref={mesh} geometry={geometry} material={material} position={[CENTER[0], CENTER[1], CENTER[2] + 1.3]} renderOrder={10} visible={false} />
}
