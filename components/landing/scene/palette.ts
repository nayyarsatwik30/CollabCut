import * as THREE from 'three'
import { ACCENT, CREAM, DEFAULT_THEME, INK, THEMES, type ThemeName } from '../theme'

// The scene's colours, shared by every material as uniform values. A theme
// change mutates these objects in place, so nothing is rebuilt or recompiled
// and the simulations carry on undisturbed.
export const palette = {
  bg: new THREE.Color(THEMES[DEFAULT_THEME].bg),
  fg: new THREE.Color(THEMES[DEFAULT_THEME].fg),
  accent: new THREE.Color(ACCENT),
  ink: new THREE.Color(INK),
  cream: new THREE.Color(CREAM),
  // 0 in Dark, 1 in Light. Shaders use it where light-on-dark maths (adding
  // light, bloom) has to become dark-on-light (shadows, edges).
  light: { value: 0 },
}

export function applyPalette(name: ThemeName) {
  palette.bg.set(THEMES[name].bg)
  palette.fg.set(THEMES[name].fg)
  palette.light.value = name === 'light' ? 1 : 0
}
