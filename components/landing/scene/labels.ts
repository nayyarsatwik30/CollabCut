import * as THREE from 'three'

// Tool names are drawn as plain text (the page's own font, no logos) into a
// small canvas whose alpha channel the sphere shader wraps onto the surface.
export function makeLabelTexture(text: string, fontFamily: string): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const lines = text.includes(' ') ? text.split(' ') : [text]
  const maxWidth = size * 0.76
  let fontSize = 118
  const font = (px: number) => `600 ${px}px ${fontFamily}`
  ctx.font = font(fontSize)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  if (widest > maxWidth) fontSize = Math.floor((fontSize * maxWidth) / widest)
  ctx.font = font(fontSize)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineHeight = fontSize * 1.04
  lines.forEach((line, i) => ctx.fillText(line, size / 2, size / 2 + (i - (lines.length - 1) / 2) * lineHeight))
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}
