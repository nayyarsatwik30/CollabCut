import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'
import { Reveal } from './Reveal'
import { ABOUT, BRAND, FOOTER, PLANS, PRICING } from './content'

// Plans: specs only, no prices. CTAs are the ones the agency page has always had.
export function Pricing() {
  return (
    <section className="lp-section lp-pricing" id="pricing" aria-labelledby="lp-pricing-title">
      <div className="lp-container">
        <Reveal>
          <p className="lp-kicker">{PRICING.kicker}</p>
          <h2 className="lp-h2" id="lp-pricing-title">{PRICING.title[0]}<br /><span>{PRICING.title[1]}</span></h2>
          <p className="lp-copy lp-copy-narrow">{PRICING.copy}</p>
        </Reveal>
        <Reveal className="lp-plans" delay={90}>
          {PLANS.map((plan) => (
            <article className="lp-plan" key={plan.name} aria-label={plan.name}>
              <h3 className="lp-plan-name">{plan.name}</h3>
              <p className="lp-plan-storage">{plan.storage} <span>workspace storage</span></p>
              <p className="lp-plan-desc">{plan.description}</p>
              <ul className="lp-plan-specs">
                <li><Check size={14} aria-hidden="true" /> {plan.admins} admins</li>
                <li><Check size={14} aria-hidden="true" /> {plan.editors} editors</li>
                <li><Check size={14} aria-hidden="true" /> {plan.storage} shared across every project</li>
              </ul>
              <div className="lp-plan-actions">
                <Link className="lp-btn" href={PRICING.primary.href}>{PRICING.primary.label} <ArrowUpRight size={15} aria-hidden="true" /></Link>
                <Link className="lp-link" href={PRICING.secondary.href}>{PRICING.secondary.label}</Link>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// The two paragraphs from /about, unchanged.
export function About() {
  return (
    <section className="lp-section lp-about" id="about" aria-labelledby="lp-about-title">
      <div className="lp-container lp-about-grid">
        <Reveal>
          <h2 className="lp-h2" id="lp-about-title">{ABOUT.title}</h2>
        </Reveal>
        <Reveal className="lp-about-body" delay={90}>
          {ABOUT.paragraphs.map((p) => <p key={p}>{p}</p>)}
          <Link className="lp-link" href={ABOUT.link.href}>{ABOUT.link.label} <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </Reveal>
      </div>
    </section>
  )
}

// Same links as the existing footer. Social links are intentionally absent
// until real URLs exist; add them as another group in FOOTER.groups.
export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-main">
          <div>
            <Link className="lp-footer-brand" href="/" aria-label={`${BRAND} home`}>{BRAND}</Link>
            <p className="lp-footer-tagline">{FOOTER.tagline[0]}<br />{FOOTER.tagline[1]}</p>
          </div>
          <div className="lp-footer-links">
            {FOOTER.groups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2>{group.title}</h2>
                {group.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
              </nav>
            ))}
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>{FOOTER.bottom[0]}</span>
          <span>{FOOTER.bottom[1]}</span>
        </div>
      </div>
    </footer>
  )
}
