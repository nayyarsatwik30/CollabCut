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

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  storage_gb: number
  features: string[]
}

const STUDIOS = ['Odyssey', 'Kinetic', 'Northlight', 'Mirage', 'Studio 47', 'Halcyon']

const MOCK_COMMENTS = [
  { time: '00:05', author: 'Maya', text: 'Stretch this beat +0.5s — feels rushed.', color: '#d946ef' },
  { time: '00:14', author: 'Eric', text: 'Color: push shadows cooler here?', color: '#60a5fa' },
  { time: '00:21', author: 'Sam', text: 'Approved on my end ✅', color: '#34d399' },
]

/* ── Component ── */

export function LandingPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/plans')
        if (res.ok) {
          const data = await res.json()
          if (data.plans) {
            setPlans(data.plans)
          }
        }
      } catch (err) {
        console.error('Failed to fetch plans:', err)
      }
    }
    fetchPlans()
  }, [])

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
  }, [plans])

  return (
    <div ref={scrollRef} className="page-scroll">

      {/* ═══════════════ NAV ═══════════════ */}
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--gradient-brand)' }}
            >
              C
            </div>
            <span className="text-[16px] font-bold tracking-tight">CollabCut</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[13px] text-th-muted">
            <a href="#how" className="hover:text-th-text transition-colors">How it works</a>
            <a href="#features" className="hover:text-th-text transition-colors">Features</a>
            <a href="#pricing" className="hover:text-th-text transition-colors">Pricing</a>
            <Link href="/auth/login" className="hover:text-th-text transition-colors">Log in</Link>
          </nav>

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
          <div className="flex justify-center">
            <span className="hero-badge">
              <Sparkles size={14} className="text-th-accent" />
              Frame-accurate video review
            </span>
          </div>

          <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.08] tracking-tight max-w-3xl mx-auto mb-6">
            From rough cut to<br />
            <span className="font-display text-gradient">picture lock</span>
          </h1>

          <p className="text-[17px] text-th-muted max-w-xl mx-auto leading-relaxed mb-10">
            Upload a cut, drop notes on the exact frame, and send one link.
            Reviewers open it without an account. You never pay per reviewer.
          </p>

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
            Simple, transparent <span className="font-display text-gradient">pricing</span>.
          </h2>
          <p className="text-th-muted mb-8 text-[15px]">
            Choose the plan that best fits your workflow.
          </p>

          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full glass mb-12 border border-th-border">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${billingCycle === 'monthly'
                ? 'bg-gradient-cta text-white shadow-md'
                : 'text-th-muted hover:text-th-text'
                }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all flex items-center gap-1.5 ${billingCycle === 'yearly'
                ? 'bg-gradient-cta text-white shadow-md'
                : 'text-th-muted hover:text-th-text'
                }`}
            >
              <span>Yearly</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPro = plan.id === 'pro'
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
            return (
              <div
                key={plan.id || index}
                className={`relative flex flex-col justify-between p-8 rounded-2xl transition-all duration-300 reveal ${isPro
                  ? 'card-elevated border-th-accent/50 shadow-xl ring-1 ring-th-accent/40'
                  : 'glass border-th-border'
                  }`}
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                {isPro && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-cta text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                    Recommended
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-[12px] text-th-muted font-mono">{plan.storage_gb} GB storage</p>
                  </div>

                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-4xl font-extrabold tracking-tight">₹{price}</span>
                    <span className="text-[13px] text-th-muted">
                      / {billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-8 border-t border-th-border pt-6">
                    {plan.features?.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-[13px] text-th-text">
                        <Check size={14} className="text-th-accent mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Link
                    href={`/auth/signup?plan=${plan.id}&cycle=${billingCycle}`}
                    className={`w-full py-3 rounded-xl font-semibold text-[13px] transition-all flex items-center justify-center gap-2 btn-press no-underline ${isPro
                      ? 'bg-gradient-cta text-white shadow-lg hover:opacity-90'
                      : 'bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov'
                      }`}
                  >
                    Start free trial <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
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