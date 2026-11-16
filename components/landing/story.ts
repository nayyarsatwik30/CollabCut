// The scroll story's timeline, shared by the DOM captions (StoryStage) and
// the WebGL scene. Every value is a fraction of the pinned section's scroll
// range, so retiming the story happens here and nowhere else.
export const STORY_SCROLL_VH = 380 // total height of the pinned section

export const TL = {
  heroOut: [0.02, 0.11],
  // Hero -> story handoff, in order, with no overlap between the stages:
  // butterflies land on the dandelions, fold and sink into them, and only
  // then do the dandelions start turning into spheres.
  land: [0.015, 0.085], // butterflies arrive and settle (each takes landSpan)
  landSpan: 0.045,
  butterfliesAway: [0.085, 0.115], // settled butterflies sink into the seed heads
  reveal: [0.05, 0.2], // backdrop light pool fades up
  morph: [0.12, 0.215], // window in which the dandelions start changing, one after another
  morphSpan: 0.11, // how long one dandelion takes to become its sphere
  captionAIn: [0.26, 0.34],
  captionAOut: [0.58, 0.65],
  converge: [0.62, 0.795],
  merge: 0.8,
  pop: [0.8, 0.9],
  trailsOut: [0.8, 0.86],
  captionBIn: [0.86, 0.93],
} as const

// Local progress of one dandelion's change into its sphere: 0 before it starts,
// 1 when the sphere is formed, and it keeps counting past 1 as the sphere
// travels on. `startFrac` is the sphere's position (0..1) in the morph window.
// Inside that local progress:
//   0.10 - 0.62  seeds draw back into the core
//   0.42 - 1.00  the sphere grows out of the core
//   0.70 - 1.60  the sphere leaves for where it roams
export const morphAt = (p: number, startFrac: number) => Math.max(0, (p - (TL.morph[0] + (TL.morph[1] - TL.morph[0]) * startFrac)) / TL.morphSpan)

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
