'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Play, Sparkles, Zap, Users, Lock, Layers, CheckCircle
} from 'lucide-react'
import { Reveal, Stagger, RevealItem } from './motion'

/* ── Data ── */

const STEPS = [
  { n: '01', title: 'Create your workspace', body: 'One shared workspace for your whole team — admins, editors, and every client project in one place.', icon: Zap, color: '#d946ef' },
  { n: '02', title: 'Invite your editors', body: 'Add editors and assign them directly to specific cuts. Role-based access keeps admin controls with you.', icon: Users, color: '#f472b6' },
  { n: '03', title: 'Run Custom Cut & Board Cut', body: 'Every project gets a structured pipeline — freeform Custom Cuts and a Kanban-style Board Cut workflow from idea to approved.', icon: Layers, color: '#60a5fa' },
  { n: '04', title: 'Clients approve, you stay in control', body: 'Share a review link per project. Clients comment and approve; only admins can move a cut to Approved.', icon: CheckCircle, color: '#34d399' },
]

const FEATURES = [
  { title: 'Workspace & role-based access', body: 'Admins and editors see different views. Editors only see what\'s assigned to them; admins see every project across every client.', icon: Lock, color: '#d946ef' },
  { title: 'Multi-editor collaboration', body: 'Assign multiple editors across multiple client projects, reassign work in a click, and track who owns what on one Board.', icon: Users, color: '#f472b6' },
  { title: 'Custom Cut / Board Cut workflow', body: 'Separate freeform client cuts from your structured internal pipeline, without juggling two tools.', icon: Layers, color: '#60a5fa' },
]

const STUDIOS = ['Odyssey', 'Kinetic', 'Northlight', 'Mirage', 'Studio 47', 'Halcyon']

const MOCK_COMMENTS = [
  { time: '00:05', author: 'Maya', text: 'Stretch this beat +0.5s — feels rushed.', color: '#d946ef' },
  { time: '00:14', author: 'Eric', text: 'Color: push shadows cooler here?', color: '#60a5fa' },
  { time: '00:21', author: 'Sam', text: 'Approved on my end ✅', color: '#34d399' },
]

/* ── Component ── */

export function AgencyLandingPage() {
  const scrollRef = useRef<HTMLDivElement>(null)

  /* ── Cursor-follow glow dot ── */
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return

    const dot = document.createElement('div')
    dot.className = 'cursor-glow-dot'
    document.body.appendChild(dot)

    let mouseX = -100
    let mouseY = -100
    let dotX = -100
    let dotY = -100
    let rafId: number

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const animate = () => {
      dotX += (mouseX - dotX) * 0.15
      dotY += (mouseY - dotY) * 0.15
      dot.style.left = `${dotX}px`
      dot.style.top = `${dotY}px`
      rafId = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMouseMove)
    rafId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
      dot.remove()
    }
  }, [])

  return (
    <div ref={scrollRef} className="page-scroll">

      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CollabCut" className="w-7 h-7 rounded-lg" />
            <span className="text-[16px] font-bold tracking-tight">CollabCut</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[13px] text-th-muted">
            <a href="#how" className="hover:text-th-text transition-colors">How it works</a>
            <a href="#features" className="hover:text-th-text transition-colors">Why agencies</a>
            <Link href="/auth/login" className="hover:text-th-text transition-colors">Log in</Link>
          </nav>

          <Link
            href="/auth/signup/agency"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-th-full bg-gradient-cta text-white text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
          >
            Request access <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <Stagger trigger="mount" staggerChildren={0.06} className="text-center">
          <RevealItem>
            <div className="flex justify-center">
              <span className="hero-badge">
                <Sparkles size={14} className="text-th-accent" />
                Built for creative agencies
              </span>
            </div>
          </RevealItem>

          <RevealItem>
            <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.08] tracking-tight max-w-3xl mx-auto mb-6">
              Every editor, every client,<br />
              <span className="font-display text-gradient">one workspace</span>
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="text-[17px] text-th-muted max-w-xl mx-auto leading-relaxed mb-10">
              Run your whole editing team out of one workspace. Assign editors to
              specific cuts, keep every client project organized, and let clients
              review and approve without ever needing an account.
            </p>
          </RevealItem>

          <RevealItem>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/signup/agency"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full bg-gradient-cta text-white font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
              >
                Request access <ArrowRight size={14} />
              </Link>
              <Link
                href="/review/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full border border-th-border text-th-text font-semibold text-[14px] btn-press hover:bg-th-surface-alt transition-colors"
              >
                <Play size={13} className="text-th-accent" /> See a live review
              </Link>
            </div>
          </RevealItem>
        </Stagger>

        {/* ── Mock Video Player ── */}
        <Reveal trigger="mount" delay={0.35} className="mt-16">
          <div className="mock-player max-w-4xl mx-auto">
            <div className="mock-player-toolbar">
              <div className="flex items-center gap-1.5 mr-3">
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-dot" />
              </div>
              <span className="text-[12px] text-th-muted font-mono flex-1">
                teaser_v3_final_v2.mov · 00:24
              </span>
              <span className="font-mono text-[11px] text-th-faint mr-2">v3</span>
              <span className="live-badge">Live</span>
            </div>

            <div className="flex">
              <div className="flex-1 relative">
                <div className="mock-viewport">
                  <div className="absolute z-10 flex items-center gap-2" style={{ top: '45%', left: '30%' }}>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: '#d946ef' }}
                    >
                      1
                    </span>
                    <span className="px-3 py-1.5 rounded-th-full bg-th-surface text-[12px] font-medium text-th-text shadow-lg">
                      Stretch this beat +0.5s
                    </span>
                  </div>
                </div>

                <div className="mock-controls">
                  <div className="w-8 h-8 rounded-full bg-th-text flex items-center justify-center">
                    <Play size={14} className="text-th-bg ml-0.5" fill="var(--th-bg)" />
                  </div>
                  <div className="mock-progress">
                    <div className="mock-progress-filled" style={{ width: '35%' }} />
                    <div className="mock-progress-dot" style={{ left: '35%' }} />
                    <div className="mock-comment-dot" style={{ left: '55%' }} />
                  </div>
                  <span className="font-mono text-[11px] text-th-muted whitespace-nowrap">00:08 / 00:24</span>
                </div>
              </div>

              <div className="w-[220px] shrink-0 border-l border-th-border hidden md:block">
                <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
                  <span className="text-[13px] font-semibold">Comments</span>
                  <span className="text-[11px] text-th-muted">3 open</span>
                </div>
                {MOCK_COMMENTS.map((c, i) => (
                  <div key={i} className="mock-comment">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="mock-comment-badge"
                        style={{ background: `${c.color}22`, color: c.color }}
                      >
                        {c.time}
                      </span>
                      <span className="text-[12px] font-semibold">{c.author}</span>
                    </div>
                    <p className="text-[12px] text-th-muted leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════ TRUSTED BY ═══════════════ */}
      <Reveal trigger="inView" root={scrollRef} className="trusted-strip">
        <p className="trusted-strip-label">
          Trusted by agencies coordinating teams of editors across dozens of clients
        </p>
        <div className="trusted-logos">
          {STUDIOS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </Reveal>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <Stagger trigger="inView" root={scrollRef} staggerChildren={0.05}>
          <RevealItem>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gradient mb-4">
              How it works
            </p>
          </RevealItem>
          <RevealItem>
            <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold mb-14">
              Set up once, <span className="font-display text-gradient">run every client</span> through it.
            </h2>
          </RevealItem>
        </Stagger>

        <Stagger trigger="inView" root={scrollRef} staggerChildren={0.07} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <RevealItem key={s.n} className="h-full">
              <div className="step-card h-full">
                <div
                  className="step-icon"
                  style={{ background: `${s.color}15` }}
                >
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <p className="font-mono text-[11px] mb-2" style={{ color: s.color }}>{s.n}</p>
                <h3 className="font-bold text-[15px] mb-2">{s.title}</h3>
                <p className="text-[13px] text-th-muted leading-relaxed">{s.body}</p>
              </div>
            </RevealItem>
          ))}
        </Stagger>
      </section>

      {/* ═══════════════ WHY AGENCIES ═══════════════ */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 border-t border-th-border">
        <Stagger trigger="inView" root={scrollRef} staggerChildren={0.05}>
          <RevealItem>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gradient mb-4">
              Why agencies
            </p>
          </RevealItem>
          <RevealItem>
            <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold mb-14 max-w-2xl leading-tight">
              Built for teams, <span className="font-display text-gradient">not just solo edits</span>.
            </h2>
          </RevealItem>
        </Stagger>

        <Stagger trigger="inView" root={scrollRef} staggerChildren={0.07} className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <RevealItem key={f.title} className="h-full">
              <div className="feature-card h-full">
                <div
                  className="feature-icon"
                  style={{ background: `${f.color}15` }}
                >
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-[16px] mb-2">{f.title}</h3>
                <p className="text-[13px] text-th-muted leading-relaxed">{f.body}</p>
              </div>
            </RevealItem>
          ))}
        </Stagger>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-th-border text-center">
        <Stagger trigger="inView" root={scrollRef} staggerChildren={0.06}>
          <RevealItem>
            <h2 className="text-[clamp(1.6rem,3.6vw,2.2rem)] font-extrabold mb-4">
              Ready to bring your team on board?
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="text-th-muted mb-8 text-[15px] max-w-md mx-auto">
              Set up your agency workspace and start assigning editors to client work today.
            </p>
          </RevealItem>
          <RevealItem>
            <Link
              href="/auth/signup/agency"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full bg-gradient-cta text-white font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
            >
              Request access <ArrowRight size={14} />
            </Link>
          </RevealItem>
        </Stagger>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-th-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CollabCut" className="w-5 h-5 rounded-md" />
            <span className="text-[13px] font-bold">CollabCut</span>
          </div>
          <p className="font-mono text-[11px] text-th-faint">Built for the loop between a cut and a lock.</p>
        </div>
      </footer>
    </div>
  )
}
