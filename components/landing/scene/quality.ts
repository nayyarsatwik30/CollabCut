// Decides how much 3D a device gets. 'none' means no WebGL at all (static
// fallback): small screens, reduced-motion users, or no WebGL2.
export type Tier = 'none' | 'low' | 'high'

export interface Quality {
  tier: Tier
  maxDpr: number
  butterflies: number
  trailSegments: number // points per trail ribbon
  embers: number // particle pool shared by all spheres
  bloom: boolean // selective bloom pass (trails + sphere edges)
  msaa: number
}

export const MOBILE_QUERY = '(max-width: 767px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'none'
  if (window.matchMedia(MOBILE_QUERY).matches) return 'none'
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return 'none'
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return 'none'
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return 'none'
  }
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 8
  const memory = nav.deviceMemory ?? 8
  return cores <= 4 || memory <= 4 ? 'low' : 'high'
}

export function qualityFor(tier: Tier): Quality {
  if (tier === 'high') return { tier, maxDpr: 1.75, butterflies: 26, trailSegments: 30, embers: 150, bloom: true, msaa: 4 }
  if (tier === 'low') return { tier, maxDpr: 1, butterflies: 12, trailSegments: 14, embers: 40, bloom: false, msaa: 0 }
  return { tier, maxDpr: 1, butterflies: 0, trailSegments: 0, embers: 0, bloom: false, msaa: 0 }
}
