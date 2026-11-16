import { ACCENT, INK, THEMES, THEME_ATTR, THEME_KEY, type ThemeName } from './theme'

// Turns theme.ts into the CSS variables landing.css consumes, and sets the
// saved theme on <html> before any landing content is parsed, so the page
// never paints in the wrong theme. Rendered first inside .lp.
const vars = (name: ThemeName) => {
  const t = THEMES[name]
  return [
    `color-scheme:${name}`,
    `--bg:${t.bg}`,
    `--fg:${t.fg}`,
    `--muted:${t.muted}`,
    `--surface:${t.surface}`,
    `--line:${t.line}`,
    `--line-strong:${t.lineStrong}`,
    `--accent:${ACCENT}`,
    `--accent-fg:${INK}`,
    `--accent-edge:${t.accentEdge}`,
    `--quiet:${t.quiet}`,
    `--glow:${t.fg}`,
  ].join(';')
}

const CSS = `html:root:has(.lp){${vars('dark')}}html:root[${THEME_ATTR}='light']:has(.lp){${vars('light')}}`

const SCRIPT = `(function(){var t='dark';try{if(localStorage.getItem('${THEME_KEY}')==='light')t='light'}catch(e){}document.documentElement.setAttribute('${THEME_ATTR}',t)})()`

export function ThemeBoot() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  )
}
