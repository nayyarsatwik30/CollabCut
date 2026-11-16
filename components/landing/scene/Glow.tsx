'use client'

import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { palette } from './palette'

// Selective bloom, built small on purpose.
//
// The scene renders normally to the canvas (native MSAA, no full-screen float
// buffers). Then only the things that are allowed to glow, i.e. objects on
// GLOW_LAYER: trails, embers, the merge flash and the speed-driven leading
// edge of each sphere, are drawn again into a half-resolution buffer. The
// spheres appear in that buffer as black silhouettes (plus their hot edge),
// so they still hide the trails behind them. That buffer is thresholded,
// blurred down a small mip chain and added back over the frame.
//
// Nothing else can bloom: the backdrop, the butterflies and the labels are
// never drawn into the glow buffer, and page text is DOM above the canvas.
// A general-purpose post-processing stack was measured at ~30fps on an
// integrated GPU here; this holds 60 because every extra pass is 1/4
// resolution or smaller.
export const GLOW_LAYER = 1

// Shared by every sphere material: 1 while the glow buffer is being drawn.
export const glowPass = { value: 0 }

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// 4 bilinear taps = a 4x4 box. The first step also applies the threshold, so
// dim haze stays as it is and only genuinely hot pixels spread.
const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  // Thresholded on brightness, not per channel, so the glow keeps the hue
  // of what is glowing.
  float peak = max(c.r, max(c.g, c.b));
  c *= max(peak - uThreshold, 0.0) / max(peak, 1e-4);
  gl_FragColor = vec4(c, 1.0);
}
`

// 3x3 tent upsample of the smaller level, added to the level above it.
const UP = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;
void main() {
  vec2 t = uTexel;
  vec3 c = texture2D(tLow, vUv).rgb * 4.0;
  c += (texture2D(tLow, vUv + vec2(t.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(t.x, 0.0)).rgb + texture2D(tLow, vUv + vec2(0.0, t.y)).rgb + texture2D(tLow, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture2D(tLow, vUv + t).rgb + texture2D(tLow, vUv - t).rgb + texture2D(tLow, vUv + vec2(t.x, -t.y)).rgb + texture2D(tLow, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(c / 16.0 * uSpread + texture2D(tHigh, vUv).rgb, 1.0);
}
`

const COMPOSITE = /* glsl */ `
uniform sampler2D tGlow;
uniform float uIntensity;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tGlow, vUv).rgb * uIntensity;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}
`

const LEVELS = 4 // quarter res down to 1/32

export function Glow({ progress, threshold = 0.55, intensity = 0.95 }: { progress: MutableRefObject<number>; threshold?: number; intensity?: number }) {
  const gl = useThree((s) => s.gl)

  const rig = useMemo(() => {
    const options = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false } as const
    const source = new THREE.WebGLRenderTarget(2, 2, { ...options, depthBuffer: true })
    const down = Array.from({ length: LEVELS }, () => new THREE.WebGLRenderTarget(2, 2, options))
    const up = Array.from({ length: LEVELS - 1 }, () => new THREE.WebGLRenderTarget(2, 2, options))
    const base = { vertexShader: VERT, depthTest: false, depthWrite: false, toneMapped: false } as const
    const downMat = new THREE.ShaderMaterial({ ...base, fragmentShader: DOWN, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } } })
    const upMat = new THREE.ShaderMaterial({ ...base, fragmentShader: UP, uniforms: { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 } } })
    const compositeMat = new THREE.ShaderMaterial({ ...base, fragmentShader: COMPOSITE, uniforms: { tGlow: { value: null }, uIntensity: { value: 1 } }, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
    const quad = new THREE.Mesh(geometry, downMat)
    quad.frustumCulled = false
    const scene = new THREE.Scene()
    scene.add(quad)
    return { source, down, up, downMat, upMat, compositeMat, geometry, quad, scene, camera: new THREE.Camera(), size: new THREE.Vector2(), black: new THREE.Color(0, 0, 0), saved: new THREE.Color(), warm: 0 }
  }, [])

  useEffect(() => () => {
    rig.source.dispose()
    rig.down.forEach((t) => t.dispose())
    rig.up.forEach((t) => t.dispose())
    rig.downMat.dispose(); rig.upMat.dispose(); rig.compositeMat.dispose(); rig.geometry.dispose()
  }, [rig])

  // Priority 1: this component owns the frame (R3F stops auto-rendering).
  useFrame((state) => {
    const { scene, camera } = state
    gl.setRenderTarget(null)
    gl.render(scene, camera)

    // Nothing glows during the hero; skip the extra work (after a short
    // warm-up so these shaders are compiled before the first scroll).
    if (progress.current < 0.02 && rig.warm > 6) return
    // Bloom is light added on top of the frame, which a pale page cannot
    // show. In Light the pass is skipped once its shaders are compiled.
    if (palette.light.value > 0.5 && rig.warm > 6) return
    rig.warm++

    gl.getDrawingBufferSize(rig.size)
    const w = Math.max(2, Math.floor(rig.size.x / 2))
    const h = Math.max(2, Math.floor(rig.size.y / 2))
    if (rig.source.width !== w || rig.source.height !== h) {
      rig.source.setSize(w, h)
      rig.down.forEach((t, i) => t.setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1))))
      rig.up.forEach((t, i) => t.setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1))))
    }

    // 1. Glow sources only, with spheres as occluders.
    const mask = camera.layers.mask
    const background = scene.background
    const fog = scene.fog
    const alpha = gl.getClearAlpha()
    gl.getClearColor(rig.saved)
    scene.background = null
    scene.fog = null
    camera.layers.set(GLOW_LAYER)
    glowPass.value = 1
    gl.setRenderTarget(rig.source)
    gl.setClearColor(rig.black, 1)
    gl.clear()
    gl.render(scene, camera)
    glowPass.value = 0
    camera.layers.mask = mask
    scene.background = background
    scene.fog = fog

    // 2. Threshold + blur down.
    rig.quad.material = rig.downMat
    let src: THREE.WebGLRenderTarget = rig.source
    rig.down.forEach((target, i) => {
      rig.downMat.uniforms.tSrc.value = src.texture
      rig.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height)
      rig.downMat.uniforms.uThreshold.value = i === 0 ? threshold : 0
      gl.setRenderTarget(target)
      gl.render(rig.scene, rig.camera)
      src = target
    })

    // 3. Blur back up, accumulating each level.
    rig.quad.material = rig.upMat
    let low: THREE.WebGLRenderTarget = rig.down[LEVELS - 1]
    for (let i = LEVELS - 2; i >= 0; i--) {
      rig.upMat.uniforms.tLow.value = low.texture
      rig.upMat.uniforms.tHigh.value = rig.down[i].texture
      rig.upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height)
      gl.setRenderTarget(rig.up[i])
      gl.render(rig.scene, rig.camera)
      low = rig.up[i]
    }

    // 4. Add it over the finished frame.
    rig.quad.material = rig.compositeMat
    rig.compositeMat.uniforms.tGlow.value = low.texture
    rig.compositeMat.uniforms.uIntensity.value = intensity
    gl.setRenderTarget(null)
    const autoClear = gl.autoClear
    gl.autoClear = false
    gl.render(rig.scene, rig.camera)
    gl.autoClear = autoClear
    gl.setClearColor(rig.saved, alpha)
  }, 1)

  return null
}
