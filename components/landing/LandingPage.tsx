'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Check, ArrowRight, Play, Upload, MessageSquare,
  Layers, CheckCircle, Zap, Users, Lock, Sparkles
} from 'lucide-react'

/* ── Data ── */

const STEPS = [
  { n: '01', title: 'Upload your cut', body: 'Drag a file in — any format. We handle transcoding. Reviewers open it in seconds, not hours.', icon: Upload, color: '#d946ef' },
  { n: '02', title: 'Drop frame-accurate notes', body: 'Click any frame in the player, type your note. It\'s pinned to that exact timecode, forever.', icon: MessageSquare, color: '#f472b6' },
  { n: '03', title: 'Stack new versions', body: 'Upload a revised cut on top of the old one. Compare v1 and v3 side by side in one click.', icon: Layers, color: '#60a5fa' },
  { n: '04', title: 'Reach picture lock', body: 'Client clicks Approve. Everyone sees the same status. No buried email thread, no missing feedback.', icon: CheckCircle, color: '#34d399' },
]

const FEATURES = [
  { title: 'Organize and prioritize', body: 'Tag, sort, and group assets into Collections your way — out-of-the-box and custom metadata fields.', icon: Zap, color: '#d946ef' },
  { title: 'Work without the wait', body: 'Stream files directly into creative apps and work as if they were stored locally.', icon: Users, color: '#f472b6' },
  { title: 'Navigate easily', body: 'Panel-based workspaces and nested folder trees make finding everything easier. No more screen hopping.', icon: Lock, color: '#60a5fa' },
]

const PLAN_FEATURES = [
  'Unlimited reviewers — no per-seat charge',
  'Frame-accurate timecoded notes',
  'Version stacking with side-by-side compare',
  'Shareable links — no reviewer account needed',
  'Drawing and annotation tools',
  '200 GB storage included',
  'Password-protected share links',
  'Razorpay / UPI billing',
]

const STUDIOS = ['Odyssey', 'Kinetic', 'Northlight', 'Mirage', 'Studio 47', 'Halcyon']

const MOCK_COMMENTS = [
  { time: '00:05', author: 'Maya', text: 'Stretch this beat +0.5s — feels rushed.', color: '#d946ef' },
  { time: '00:14', author: 'Eric', text: 'Color: push shadows cooler here?', color: '#60a5fa' },
  { time: '00:21', author: 'Sam', text: 'Approved on my end ✅', color: '#34d399' },
]

/* ── Component ── */

export function LandingPage() {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll reveal: elements with class "reveal" rise into view
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
          }
        })
      },
      { root: container, threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    container.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={scrollRef} className="page-scroll">

      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--gradient-brand)' }}
            >
              C
            </div>
            <span className="text-[16px] font-bold tracking-tight">CollabCut</span>
          </div>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-th-muted">
            <a href="#how" className="hover:text-th-text transition-colors">How it works</a>
            <a href="#features" className="hover:text-th-text transition-colors">Features</a>
            <a href="#pricing" className="hover:text-th-text transition-colors">Pricing</a>
            <Link href="/auth/login" className="hover:text-th-text transition-colors">Log in</Link>
          </nav>

          {/* CTA */}
          <Link
            href="/auth/signup"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-th-full bg-gradient-cta text-white text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
          >
            Start free <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center reveal">
          {/* Badge */}
          <div className="flex justify-center">
            <span className="hero-badge">
              <Sparkles size={14} className="text-th-accent" />
              Frame-accurate video review
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.08] tracking-tight max-w-3xl mx-auto mb-6">
            From rough cut to<br />
            <span className="font-display text-gradient">picture lock</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-[17px] text-th-muted max-w-xl mx-auto leading-relaxed mb-10">
            Upload a cut, drop notes on the exact frame, and send one link.
            Reviewers open it without an account. You never pay per reviewer.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full bg-gradient-cta text-white font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
            >
              Start free — 14 days <ArrowRight size={14} />
            </Link>
            <Link
              href="/review/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full border border-th-border text-th-text font-semibold text-[14px] btn-press hover:bg-th-surface-alt transition-colors"
            >
              <Play size={13} className="text-th-accent" /> See a live review
            </Link>
          </div>
        </div>

        {/* ── Mock Video Player ── */}
        <div className="mt-16 reveal" style={{ transitionDelay: '0.15s' }}>
          <div className="mock-player max-w-4xl mx-auto">
            {/* Toolbar */}
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

            {/* Main area: viewport + comments */}
            <div className="flex">
              {/* Viewport */}
              <div className="flex-1 relative">
                <div className="mock-viewport">
                  {/* Annotation marker */}
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

                {/* Playback controls */}
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

              {/* Comments sidebar */}
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
        </div>
      </section>

      {/* ═══════════════ TRUSTED BY ═══════════════ */}
      <section className="trusted-strip reveal" style={{ transitionDelay: '0.1s' }}>
        <p className="trusted-strip-label">
          Trusted by indie studios shipping picture lock on time
        </p>
        <div className="trusted-logos">
          {STUDIOS.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <div className="reveal">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gradient mb-4">
            How it works
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold mb-14">
            The review loop, <span className="font-display text-gradient">simplified</span>.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="step-card reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
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
          ))}
        </div>
      </section>

      {/* ═══════════════ FILE MANAGEMENT ═══════════════ */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 border-t border-th-border">
        <div className="reveal">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gradient mb-4">
            File Management
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold mb-4 max-w-2xl leading-tight">
            Upload, organize, and <span className="font-display text-gradient">share</span> with ease.
          </h2>
          <div className="mb-14 flex justify-end">
            <button className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-th border border-th-border text-[13px] font-semibold text-th-text bg-th-surface-alt hover:bg-th-surface-hov transition-colors btn-press">
              Manage files effortlessly <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature-card reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div
                className="feature-icon"
                style={{ background: `${f.color}15` }}
              >
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-[16px] mb-2">{f.title}</h3>
              <p className="text-[13px] text-th-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24 border-t border-th-border">
        <div className="text-center reveal">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gradient mb-4">
            Pricing
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-extrabold mb-3">
            One plan. <span className="font-display text-gradient">No surprises</span>.
          </h2>
          <p className="text-th-muted mb-12 text-[15px]">
            Everything included. No per-seat fees. No storage upsells.
          </p>
        </div>

        <div className="pricing-card reveal" style={{ transitionDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider px-3 py-1 rounded-th-full bg-th-surface-alt border border-th-border text-th-text">
              Monthly
            </span>
            <span className="text-[12px] text-th-muted">14-day free trial</span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-extrabold">₹499</span>
            <span className="text-th-muted text-[14px]">/ month</span>
          </div>
          <p className="text-[12px] text-th-muted mb-8">Cancel anytime.</p>

          <Link href="/auth/signup" className="pricing-cta mb-8 block text-center no-underline">
            Start 14-day free trial <ArrowRight size={14} />
          </Link>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {PLAN_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2.5 text-[13px]">
                <Check size={14} className="text-th-accent mt-0.5 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-th-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: 'var(--gradient-brand)' }}
            >
              C
            </div>
            <span className="text-[13px] font-bold">CollabCut</span>
          </div>
          <p className="font-mono text-[11px] text-th-faint">Built for the loop between a cut and a lock.</p>
        </div>
      </footer>
    </div>
  )
}
