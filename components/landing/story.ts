// The scroll story's timeline, shared by the DOM captions (StoryStage) and
// the WebGL scene. Every value is a fraction of the pinned section's scroll
// range, so retiming the story happens here and nowhere else.
export const STORY_SCROLL_VH = 380 // total height of the pinned section

export const TL = {
  heroOut: [0.02, 0.11],
  butterfliesOut: [0.01, 0.14],
  reveal: [0.05, 0.2], // backdrop light pool fades up
  emerge: [0.07, 0.27], // window in which spheres start emerging
  emergeSpan: 0.12, // how long one sphere takes to emerge
  captionAIn: [0.26, 0.34],
  captionAOut: [0.58, 0.65],
  converge: [0.62, 0.795],
  merge: 0.8,
  pop: [0.8, 0.9],
  trailsOut: [0.8, 0.86],
  captionBIn: [0.86, 0.93],
} as const

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
