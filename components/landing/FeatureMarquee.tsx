import { Archive, ArrowDownUp, Check, Clock3, Layers3, Link2, MessagesSquare, ShieldCheck, Users2, type LucideIcon } from 'lucide-react'
import { FEATURES, FEATURES_INTRO, type FeatureIcon } from './content'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  versions: Layers3,
  transfer: ArrowDownUp,
  chat: MessagesSquare,
  link: Link2,
  storage: Archive,
  timecode: Clock3,
  access: ShieldCheck,
  workspaces: Users2,
  resolve: Check,
}

// How many identical groups sit on the track. One is real; the rest are
// aria-hidden copies so the loop never shows a gap, even on very wide screens.
// Must match the -33.333% in the lp-marquee keyframes.
const COPIES = 3

function Group({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="lp-marquee-group" aria-hidden={hidden || undefined}>
      {FEATURES.map((f) => {
        const Icon = ICONS[f.icon]
        return (
          <li className="lp-feature" key={f.title}>
            <Icon size={18} aria-hidden="true" />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </li>
        )
      })}
    </ul>
  )
}

// Pure CSS: the track is translated by exactly one group's width and loops.
// No JavaScript, no measuring, fixed card sizes, so nothing shifts on load.
// Hover or keyboard focus pauses it; reduced motion turns it into a grid.
export function FeatureMarquee() {
  return (
    <section className="lp-section lp-features" id="features" aria-labelledby="lp-features-title">
      <div className="lp-container">
        <p className="lp-kicker">{FEATURES_INTRO.kicker}</p>
        <h2 className="lp-h2" id="lp-features-title">{FEATURES_INTRO.title[0]}<br /><span>{FEATURES_INTRO.title[1]}</span></h2>
        <p className="lp-copy lp-copy-narrow">{FEATURES_INTRO.copy}</p>
      </div>
      <div className="lp-marquee" tabIndex={0} role="group" aria-label={FEATURES_INTRO.listLabel}>
        <div className="lp-marquee-track">
          {Array.from({ length: COPIES }, (_, i) => <Group key={i} hidden={i > 0} />)}
        </div>
      </div>
    </section>
  )
}
