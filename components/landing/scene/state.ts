import type { MutableRefObject } from 'react'

export type Finish = 'obsidian' | 'chrome' | 'pearl'

export interface SphereDef {
  name: string
  finish: Finish
  r: number
  anchor: [number, number, number] // where it roams, in world units
  start: number // 0..1 position inside the emerge window
  swirl: number // how far scrolling carries it around the scene (signed)
  zDrift: number // how far scrolling pushes it in depth (signed)
  omega: number // spring stiffness: lower = heavier, lazier
  delay: number // late start for the convergence
}

// Deliberately uneven: sizes, depths, spring weights and scroll response all
// differ, so nothing shares an orbit or a rhythm.
export const SPHERES: SphereDef[] = [
  { name: 'WhatsApp', finish: 'pearl', r: 0.5, anchor: [0.55, 1.0, 1.9], start: 0.0, swirl: 0.55, zDrift: 0.5, omega: 7.5, delay: 0.02 },
  { name: 'Notion', finish: 'obsidian', r: 0.68, anchor: [2.9, -0.45, 0.0], start: 0.22, swirl: -0.4, zDrift: -0.35, omega: 5.6, delay: 0.0 },
  { name: 'Slack', finish: 'chrome', r: 0.46, anchor: [-0.95, 1.75, -0.7], start: 0.4, swirl: 0.8, zDrift: 0.9, omega: 8.6, delay: 0.035 },
  { name: 'Frame.io', finish: 'obsidian', r: 0.46, anchor: [1.2, -1.3, 2.4], start: 0.58, swirl: -0.7, zDrift: -0.6, omega: 7.9, delay: 0.015 },
  { name: 'Google Drive', finish: 'pearl', r: 0.74, anchor: [3.9, 0.9, -1.9], start: 0.12, swirl: 0.3, zDrift: 0.75, omega: 5.2, delay: 0.045 },
  { name: 'Gmail', finish: 'chrome', r: 0.42, anchor: [0.15, -0.5, 0.9], start: 0.75, swirl: -0.95, zDrift: 0.4, omega: 9.4, delay: 0.01 },
  { name: 'Dropbox', finish: 'obsidian', r: 0.52, anchor: [-0.9, 0.45, -2.2], start: 0.88, swirl: 0.65, zDrift: 1.2, omega: 8.2, delay: 0.03 },
  { name: 'Telegram', finish: 'chrome', r: 0.54, anchor: [1.9, 1.75, 0.6], start: 1.0, swirl: -0.5, zDrift: -0.8, omega: 6.6, delay: 0.025 },
]

// Where each sphere's dandelion stands in the hero (same order as SPHERES):
// the right-hand side, at uneven heights and depths.
export const PUFFS: [number, number, number][] = [
  [1.15, 0.15, 0.8], // WhatsApp
  [3.25, -0.75, 0.0], // Notion
  [0.6, -1.05, 1.2], // Slack
  [1.6, -1.15, 1.5], // Frame.io
  [3.5, 2.0, -1.8], // Google Drive
  [2.75, 0.45, -1.0], // Gmail
  [0.95, 1.6, -1.5], // Dropbox
  [1.75, 1.5, 0.3], // Telegram
]
// A seed head is a little smaller than the sphere it becomes.
export const puffRadius = (sphereRadius: number) => sphereRadius * 0.5 + 0.07

export const MERGED = { name: 'CollabCut', finish: 'pearl' as Finish, r: 1.15 }
export const CENTER: [number, number, number] = [0, 0.42, 0.5]
export const PLANE_Z = -3
export const TOOL_COUNT = SPHERES.length
export const BODY_COUNT = TOOL_COUNT + 1 // tools + the merged sphere (last index)

// Per-frame simulation output, written by <Dandelions/> and <Spheres/> and
// read by the butterflies, backdrop, trails, embers and burst. Plain typed arrays: no React state in
// the render loop.
export interface SceneState {
  pos: Float32Array // BODY_COUNT * 3
  vel: Float32Array // BODY_COUNT * 3
  radius: Float32Array // rendered radius (0 while hidden)
  glow: Float32Array // 0..1 trail/rim intensity from real speed
  puff: Float32Array // TOOL_COUNT * 3: where each dandelion head is right now (it sways)
  puffR: Float32Array // TOOL_COUNT: its radius
  burstStart: number // clock time of the last merge crossing, or -1
  burstDir: number // +1 scrolling down through the merge, -1 back up
}

export function createSceneState(): SceneState {
  return {
    pos: new Float32Array(BODY_COUNT * 3),
    vel: new Float32Array(BODY_COUNT * 3),
    radius: new Float32Array(BODY_COUNT),
    glow: new Float32Array(BODY_COUNT),
    puff: new Float32Array(TOOL_COUNT * 3),
    puffR: new Float32Array(TOOL_COUNT),
    burstStart: -1,
    burstDir: 1,
  }
}

export type ProgressRef = MutableRefObject<number>
