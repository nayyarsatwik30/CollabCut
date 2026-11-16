import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from '@/components/ui/icons'
import { LandingScrollUnlock } from '@/components/collabcut-landing-scroll-unlock'
import { About, LandingFooter, Pricing } from './Closing'
import { FeatureMarquee } from './FeatureMarquee'
import { MagneticButton } from './MagneticButton'
import { Steps } from './Steps'
import { StoryStage } from './StoryStage'
import { SwayTagline } from './SwayTagline'
import { ThemeBoot } from './ThemeBoot'
import { ThemeToggle } from './ThemeToggle'
import { BRAND, HERO, NAV, STORY } from './content'
import { SPHERES } from './scene/state'
import './landing.css'

// Server component: all landing text renders without JavaScript. The 3D
// scene and the tagline physics hydrate on top of it.
export function LandingPage() {
  return (
    <div className="lp">
      <ThemeBoot />
      <LandingScrollUnlock />
      <main>
        <StoryStage
          hero={
            <>
              <div className="lp-top">
                <div>
                  <h1 className="lp-wordmark">{BRAND}</h1>
                  <p className="lp-tagline-wrap">
                    <SwayTagline className="lp-tagline">{HERO.tagline.lead} <span className="lp-mark">{HERO.tagline.mark}</span></SwayTagline>
                  </p>
                </div>
                <nav className="lp-nav" aria-label="Main navigation">
                  {NAV.links.map((l) => l.quiet
                    ? <MagneticButton key={l.href} variant="reveal" width={96} href={l.href} label={l.label} />
                    : <Link key={l.href} href={l.href}>{l.label}</Link>)}
                  <ThemeToggle />
                  <MagneticButton href={NAV.cta.href} label={NAV.cta.label} />
                </nav>
              </div>
              <div className="lp-hero-body">
                <p className="lp-eyebrow">{HERO.eyebrow}</p>
                <p className="lp-hero-copy">{HERO.copy}</p>
                <div className="lp-hero-actions">
                  <Link className="lp-btn" href={HERO.primary.href}>{HERO.primary.label} <ArrowUpRight tone="inherit" size={16} aria-hidden="true" /></Link>
                  <Link className="lp-link" href={HERO.secondary.href}>{HERO.secondary.label} <ChevronRight tone="inherit" size={15} aria-hidden="true" /></Link>
                </div>
              </div>
            </>
          }
          captionA={
            <>
              <p className="lp-kicker">{STORY.kicker}</p>
              <h2 className="lp-h2">{STORY.gap[0]}<br /><span>{STORY.gap[1]}</span></h2>
              <p className="lp-copy">{STORY.copy}</p>
              {/* The spheres carry these names in the 3D scene; this list is the
                  same information for screen readers and for the static layout. */}
              <ul className="lp-tools" aria-label={STORY.toolsLabel}>
                {SPHERES.map((s) => <li key={s.name}>{s.name}</li>)}
              </ul>
            </>
          }
          captionB={<h2 className="lp-h2 lp-h2-xl">{STORY.resolve[0]}<br /><span>{STORY.resolve[1]}</span></h2>}
        />
        <FeatureMarquee />
        <Steps />
        <Pricing />
        <About />
      </main>
      <LandingFooter />
    </div>
  )
}
