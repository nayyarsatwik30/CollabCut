'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { ArrowUpRight, Check, ChevronRight, CirclePlay, Clock3, Layers3, MessageSquare, ShieldCheck, Users2 } from 'lucide-react'
import Link from 'next/link'
import { LandingScrollUnlock } from './collabcut-landing-scroll-unlock'

const ease = [0.22, 1, 0.36, 1] as const

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px' }} transition={{ duration: 0.75, delay, ease }}>
      {children}
    </motion.div>
  )
}

function ParallaxMockup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [54, -12, -48])
  const rotate = useTransform(scrollYProgress, [0, 0.5, 1], [1.2, 0, -1.2])
  return <motion.div ref={ref} className={`parallax-mockup ${className}`} style={{ y, rotate }}>{children}</motion.div>
}

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element -- 28px static mark, nothing for next/image to optimise
  return <Link href="/" className="cc-logo" aria-label="CollabCut home"><img className="cc-logo-mark" src="/collabcut-mark.png" alt="" width={28} height={28} /><span>collabcut</span></Link>
}

function Header({ agency = false }: { agency?: boolean }) {
  return <header className="cc-header"><Logo /><nav className="cc-nav" aria-label="Main navigation">{agency ? <Link href="/auth/login">Sign in</Link> : <Link href="/agencies">For agencies</Link>}<a href="#workflow">How it works</a><a href="#pricing">Plans</a></nav><Link className="cc-header-cta" href={agency ? '#start' : '/auth/signup'}>{agency ? 'Talk to us' : 'Start free trial'} <ArrowUpRight size={15} /></Link></header>
}

function ProductChrome({ children, label = 'CollabCut workspace' }: { children: React.ReactNode; label?: string }) {
  return <div className="product-window"><div className="window-bar"><div className="window-dots"><i /><i /><i /></div><span>{label}</span><span className="window-status">● live</span></div>{children}</div>
}

function ReviewMockup() {
  return <ProductChrome label="Review link · cut_014.mp4"><div className="review-layout"><div className="video-panel"><div className="video-image"><span className="play-button"><CirclePlay size={28} fill="currentColor" /></span><span className="video-time">00:05 / 00:42</span></div><div className="timeline"><span className="timeline-progress" /><span className="timeline-pin">05</span></div><div className="video-controls"><span>1×</span><span>□ fullscreen</span><span>Share review link</span></div></div><div className="comment-panel"><div className="comment-head"><strong>Review notes</strong><span>2 open</span></div><div className="comment active"><b>00:05</b><p>Stretch this beat +0.5s, feels rushed.</p><small><span className="avatar avatar-amber">M</span> Maya · client <Check size={13} /></small></div><div className="comment"><b>00:18</b><p>Can we soften the transition here?</p><small><span className="avatar avatar-blue">J</span> Jay · editor</small></div><button className="comment-add"><MessageSquare size={14} /> Add comment at 00:05</button></div></div></ProductChrome>
}

function BoardMockup() {
  const columns = [['Cut', [['launch_teaser_v3', 'Maya'], ['brand_film_selects', 'Unassigned']]], ['Editing', [['product_story_04', 'Jay']]], ['Review', [['founder_reel_final', 'Maya']]], ['Revision', [['social_cut_09', 'Alex']]], ['Approved', [['case-study-cut', 'Maya']]]]
  return <ProductChrome label="Acme Studio / Projects"><div className="board-top"><div><small>PROJECT BOARD</small><strong>March campaign <span>⌄</span></strong></div><div className="board-tabs"><span className="active">Board</span><span>Raw footage</span><span>Members</span></div><div className="storage">8.4 GB / 2 TB</div></div><div className="board-grid">{columns.map(([title, cards]) => <div className="board-column" key={title as string}><div className="column-title"><span>{title as string}</span><em>{(cards as string[][]).length}</em></div>{(cards as string[][]).map(([name, person], i) => <div className="board-card" key={name}><div className={`thumb thumb-${i + 1}`} /><strong>{name}.mp4</strong><small><span className="tiny-avatar">{person === 'Unassigned' ? '?' : person[0]}</span>{person}</small><span className="card-menu">•••</span></div>)}</div>)}</div></ProductChrome>
}

function SplitMockup() {
  return <ProductChrome label="March campaign / cut_014"><div className="split-header"><div><small>ASSET LIBRARY</small><strong>cut_014.mp4</strong></div><span className="version-pill">v3 latest</span></div><div className="split-tabs"><span className="active">Custom Cut</span><span>Board Cut</span><span>Versions <b>3</b></span></div><div className="split-body"><div className="asset-card internal"><div className="file-icon">◈</div><div><b>cut_014_custom_v3.mp4</b><span>Editor workspace · 384 MB</span></div><span className="lock">Internal</span></div><div className="asset-arrow">→</div><div className="asset-card client"><div className="file-icon">▶</div><div><b>cut_014_board_v3.mp4</b><span>Submitted for review · 384 MB</span></div><span className="share">Client link</span></div></div><div className="versions"><span>v1</span><span>v2</span><span className="selected">v3</span><i>Compare versions side by side</i></div></ProductChrome>
}

function Footer() {
  return <footer className="cc-footer"><div className="footer-main"><div><Logo /><p>The clear path from first cut<br />to final approval.</p></div><div className="footer-links"><div><b>Product</b><Link href="#workflow">How it works</Link><Link href="#features">Features</Link><Link href="#pricing">Plans</Link></div><div><b>Company</b><Link href="#about">About</Link><Link href="mailto:hello@collabcut.in">Contact</Link></div><div><b>Legal</b><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link></div></div></div><div className="footer-bottom"><span>© 2026 CollabCut. Built for better cuts.</span><span>Made for the people behind the timeline.</span></div></footer>
}

// The reel shown full-frame in stage 2 and inside the review mockup's player
// in stage 3. The gradient on its container stays as the backdrop until the
// first frame loads.
function HeroVideo() {
  return <video className="opening-hero-video" src="/hero.mp4" muted autoPlay loop playsInline preload="auto" />
}

function OpeningSequence() {
  // 0 -> 1 across the sequence's own sticky range (its height minus one
  // viewport), whatever the screen height.
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Every range spans the full 0 -> 1: framer-motion runs these as native
  // scroll-driven animations, and a range that stops short of 1 interpolates
  // back to the element's base style after its last keyframe (the logo faded
  // back in over the review screen).
  const titleOpacity = useTransform(scrollYProgress, [0, 0.16, 1], [1, 0, 0])
  const placeholderOpacity = useTransform(scrollYProgress, [0, 0.08, 0.22, 0.55, 1], [0, 0, 1, 0, 0])
  const reviewOpacity = useTransform(scrollYProgress, [0, 0.26, 0.55, 0.82, 1], [0, 0, 1, 0.56, 0])
  const reviewScale = useTransform(scrollYProgress, [0, 0.26, 0.55, 0.82, 1], [0.72, 0.72, 1, 0.92, 0.76])
  const sceneBlur = useTransform(scrollYProgress, [0, 0.68, 0.9, 1], [0, 0, 0, 12])
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.72, 1], [1, 1, 0.2])

  return <section ref={ref} className="opening-sequence" aria-label="CollabCut product introduction">
    <div className="opening-sticky">
      <motion.div className="opening-title" style={{ opacity: titleOpacity }}>{/* eslint-disable-next-line @next/next/no-img-element -- small static mark, same as Logo */}<img className="opening-mark" src="/collabcut-mark.png" alt="" width={44} height={44} /><span>collabcut</span></motion.div>
      <motion.div className="opening-scene" style={{ opacity: sceneOpacity, filter: useTransform(sceneBlur, (value) => `blur(${value}px)`) }}>
        <motion.div className="opening-placeholder" style={{ opacity: placeholderOpacity }}>
          <HeroVideo />
        </motion.div>
        <motion.div className="opening-review" style={{ opacity: reviewOpacity, scale: reviewScale }}>
          <div className="opening-window-bar"><span>●</span><span>●</span><span>●</span><b>Review link · cut_014.mp4</b></div>
          <div className="opening-review-body"><div className="opening-video">
            <div className="opening-video-placeholder"><HeroVideo /></div>
            <div className="opening-timeline"><i /><b>00:14</b></div>
          </div><div className="opening-comments"><strong>Review notes</strong><span className="opening-comment-count">1 open</span><div className="opening-typed-comment"><b>00:14</b><p>Push the color grade warmer here</p><small><span className="avatar avatar-amber">M</span> Maya · client</small></div></div></div>
          <div className="opening-cursor" aria-hidden="true" />
        </motion.div>
      </motion.div>
    </div>
  </section>
}

export function GeneralLanding() {
  return <main className="cc-site"><LandingScrollUnlock /><OpeningSequence /><div className="opening-content"><Header /><section className="cc-hero general-hero"><div className="eyebrow"><span className="eyebrow-dot" /> Review, without the relay race.</div><h1>The note lands<br /><em>on the frame.</em></h1><p className="hero-copy">A calmer way to get video feedback. Send one link, collect timecoded notes, and keep every version moving toward done.</p><div className="hero-actions"><Link className="cc-button primary" href="#start">Try CollabCut <ArrowUpRight size={16} /></Link><Link className="text-link" href="#workflow">See how it works <ChevronRight size={15} /></Link></div><ParallaxMockup className="hero-product"><ReviewMockup /></ParallaxMockup></section><section className="statement-section" id="workflow"><Reveal><p className="section-kicker">THE FIRST MOMENT</p><h2>Feedback that knows<br /><span>exactly where it belongs.</span></h2><p className="section-copy">No screenshots. No “which version?” No hunting through a chat thread. Reviewers click the frame, write the note, and move on.</p></Reveal><Reveal delay={0.15} className="statement-detail"><div><Clock3 size={18} /><b>Frame-accurate</b><span>Every note carries its own timecode.</span></div><div><MessageSquare size={18} /><b>One share link</b><span>Clients review without an account.</span></div><div><Check size={18} /><b>Resolve as you go</b><span>Turn conversation into a clear finish line.</span></div></Reveal></section><section className="product-section motion-stage" id="features"><div className="section-intro"><Reveal><p className="section-kicker">THEN THE REST OF THE PIPELINE</p><h2>Once feedback is clear,<br /><span>the work gets clear.</span></h2></Reveal><Reveal delay={0.15}><p className="section-copy">CollabCut grows with the job. Stack versions automatically, keep working files private, and see what needs attention without opening six tabs.</p></Reveal></div><ParallaxMockup className="board-product"><BoardMockup /></ParallaxMockup></section><section className="split-section"><ParallaxMockup><SplitMockup /></ParallaxMockup><Reveal delay={0.15} className="split-copy"><p className="section-kicker">NO MORE FINAL_FINAL_2</p><h2>Private work-in-progress.<br /><span>Confident client review.</span></h2><p className="section-copy">Custom Cut is where the edit happens. Board Cut is what the client sees. Separate by design, connected when you are ready.</p><Link className="text-link" href="#start">Explore the workflow <ChevronRight size={15} /></Link></Reveal></section><Pricing agency={false} /><CTA agency={false} /><Footer /></div></main>
}

export function AgencyLanding() {
  return <main className="cc-site"><LandingScrollUnlock /><OpeningSequence /><div className="opening-content"><Header agency /><section className="cc-hero agency-hero"><div className="eyebrow"><span className="eyebrow-dot" /> For teams who ship more than one cut</div><h1>Your agency,<br /><em>in one frame.</em></h1><p className="hero-copy">Stop managing production through scattered messages, mystery files, and status meetings. Give every client, editor, and cut a place to move forward.</p><div className="hero-actions"><Link className="cc-button primary" href="#start">Talk to our team <ArrowUpRight size={16} /></Link><Link className="text-link" href="#workflow">See the agency workflow <ChevronRight size={15} /></Link></div><Reveal className="hero-product workflow-strip-wrap"><ol className="workflow-strip" aria-label="How a cut moves through CollabCut"><li><span>01</span><b>Cut</b><em>Brief, raw footage link and deadline</em></li><li><span>02</span><b>Editing</b><em>The assigned editor works from the brief</em></li><li><span>03</span><b>Review</b><em>Timecoded notes, right on the frame</em></li><li><span>04</span><b>Revision</b><em>New versions stack on the last</em></li><li><span>05</span><b>Approved</b><em>Admin signs off the final cut</em></li></ol></Reveal></section><section className="statement-section agency-statement" id="workflow"><Reveal><p className="section-kicker">THE OPERATIONAL GAP</p><h2>When the work lives<br /><span>in five different places.</span></h2><p className="section-copy">WhatsApp for notes. Drive for files. Email for approvals. A spreadsheet for ownership. Your team spends more time finding the latest truth than making the next cut.</p></Reveal><Reveal delay={0.15} className="pain-row"><span>01 <b>Scattered feedback</b></span><span>02 <b>Invisible ownership</b></span><span>03 <b>Drafts mixed with delivery</b></span></Reveal></section><section className="product-section agency-product" id="features"><div className="section-intro"><Reveal><p className="section-kicker">ONE BOARD. EVERY CLIENT.</p><h2>See the whole operation<br /><span>without the overhead.</span></h2></Reveal><Reveal delay={0.15}><p className="section-copy">Admins see every project. Editors see what is assigned. Five stages make the status of every cut legible from across the room.</p></Reveal></div><ParallaxMockup className="board-product"><BoardMockup /></ParallaxMockup></section><section className="split-section"><ParallaxMockup><SplitMockup /></ParallaxMockup><Reveal delay={0.15} className="split-copy"><p className="section-kicker">CONTROL THE HANDOFF</p><h2>Internal drafts stay internal.<br /><span>Clients see the right cut.</span></h2><p className="section-copy">Give editors room to work with Custom Cut. Submit a deliberate Board Cut for review. Version stacking keeps the history intact, without making the client navigate it.</p><Link className="text-link" href="#start">See what your team can ship <ChevronRight size={15} /></Link></Reveal></section><section className="agency-proof"><Reveal><p className="section-kicker">START SMALL. SCALE WITH THE WORK.</p><h2>The full workflow,<br /><span>without enterprise pricing.</span></h2><p className="section-copy">Start with one editor or bring the whole studio in. Agency plans are shaped around your clients, editors, and storage — not arbitrary seat math.</p></Reveal><Reveal delay={0.15} className="proof-list"><div><ShieldCheck size={18} /><b>Role-based access</b><span>Every person sees the right work.</span></div><div><Users2 size={18} /><b>Multi-client workspaces</b><span>Projects stay clean and separate.</span></div><div><Layers3 size={18} /><b>Versions that stack</b><span>A visible history, every time.</span></div></Reveal></section><Pricing agency /><CTA agency /><Footer /></div></main>
}

// Both landing pages show the two real workspace plans (workspace_plans
// tier_1 / tier_2). No prices yet - agency CTAs are "Talk to CollabCut" (mailto).
const PLANS = [
  { name: 'Tier 1', storage: '2 TB', admins: 2, editors: 3, description: 'For a small team getting production out of the group chat.' },
  { name: 'Tier 2', storage: '4 TB', admins: 3, editors: 4, description: 'For studios running several clients and cuts at once.' },
]

function Pricing({ agency }: { agency: boolean }) { return <section className={`pricing-section ${agency ? 'agency-pricing' : 'individual-pricing'}`} id="pricing"><Reveal><p className="section-kicker">{agency ? 'BUILT AROUND YOUR OPERATION' : 'PLANS FOR THE PEOPLE MAKING THE CUT'}</p><h2>{agency ? <>A workspace that fits<br /><span>the way you work.</span></> : <>Pick your pace.<br /><span>Keep the notes moving.</span></>}</h2><p className="section-copy">Every workspace starts on Tier 1 with shared storage for the whole team. Move up to Tier 2 when the footage or the team outgrows it.</p></Reveal><Reveal delay={0.15} className="price-plans">{PLANS.map((plan) => <div className="plan-card" key={plan.name}><small>{plan.name}</small><strong>{plan.storage} <i>workspace storage</i></strong><span>{plan.description}</span><p><Check size={14} /> {plan.admins} admins</p><p><Check size={14} /> {plan.editors} editors</p><p><Check size={14} /> {plan.storage} shared across every project</p>{agency ? <><a className="cc-button dark" href="mailto:hello@collabcut.in">Talk to CollabCut <ArrowUpRight size={15} /></a><Link className="text-link" href="/auth/signup/agency">Already onboarding? Create your workspace</Link></> : <Link className="cc-button dark" href="/auth/signup">Start free trial <ArrowUpRight size={15} /></Link>}</div>)}</Reveal></section> }
function CTA({ agency }: { agency: boolean }) { return <section className="final-cta" id="start"><Reveal><p className="section-kicker">{agency ? 'READY WHEN YOU ARE' : 'THE NEXT CUT STARTS HERE'}</p><h2>{agency ? <>Make the work<br /><em>legible.</em></> : <>Make feedback<br /><em>feel finished.</em></>}</h2><p>{agency ? 'A clearer production system for the team you already have.' : 'One link is enough to get the right note, on the right frame.'}</p>{agency ? <><a className="cc-button primary" href="mailto:hello@collabcut.in">Talk to CollabCut <ArrowUpRight size={16} /></a><Link className="text-link" href="/auth/signup/agency">Already onboarding? Create your workspace</Link></> : <Link className="cc-button primary" href="/auth/signup">Try CollabCut <ArrowUpRight size={16} /></Link>}</Reveal></section> }

export { ReviewMockup, BoardMockup, SplitMockup, Footer }

