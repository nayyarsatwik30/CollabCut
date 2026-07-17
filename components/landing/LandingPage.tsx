'use client'

import Link from 'next/link'
import { Check, ArrowRight, Play } from 'lucide-react'

const STEPS = [
  { n: '01', title: 'Upload your cut', body: 'Drag a file in — any format. We handle transcoding. Reviewers can open it in seconds, not hours.' },
  { n: '02', title: 'Drop frame-accurate notes', body: 'Click any frame in the player, type your note. It is pinned to that exact timecode, forever.' },
  { n: '03', title: 'Stack new versions', body: 'Upload a revised cut on top of the old one. Compare v1 and v3 side by side in one click.' },
  { n: '04', title: 'Reach picture lock', body: 'Client clicks Approve. Everyone sees the same status. No buried email thread, no missing feedback.' },
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

export function LandingPage() {
  return (
    <div className="page-scroll bg-th-bg font-display">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-th-bg/90 backdrop-blur-md border-b border-th-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
            <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[13px] text-th-muted">
            <a href="#how" className="hover:text-th-text transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-th-text transition-colors">Pricing</a>
            <Link href="/auth/login" className="hover:text-th-text transition-colors">Log in</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signup"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
            >
              Start free <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-th-accent mb-5">
          Frame-accurate video review
        </p>

        <h1 className="text-[clamp(2.4rem,6vw,4rem)] font-extrabold leading-[1.08] tracking-tight max-w-3xl mb-6">
          From rough cut to{' '}
          <span className="text-th-accent">picture lock</span>
          {' '}— without the seat tax.
        </h1>

        <p className="text-[17px] text-th-muted max-w-xl leading-relaxed mb-10">
          Upload a cut, drop notes on the exact frame, and send one link. Reviewers open it without creating an account. You never pay per reviewer.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
          >
            Start free — 14 days <ArrowRight size={14} />
          </Link>
          <Link
            href="/review/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-th border border-th-border text-th-text font-semibold text-[14px] btn-press hover:bg-th-surface-alt transition-colors"
          >
            <Play size={13} className="text-th-accent" /> See a live review
          </Link>
        </div>

        {/* 3-Block Feature Showcase */}
        <div className="mt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-th-accent mb-4">File Management</p>
          <h2 className="text-3xl font-extrabold mb-4 max-w-2xl leading-tight text-th-text">
            Upload, organize, and share files and projects with ease.
          </h2>
          <div className="mb-14">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-th border border-th-border text-[13px] font-semibold text-th-text bg-th-surface-alt hover:bg-th-surface-hov transition-colors btn-press">
              Manage Files Effortlessly <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="flex flex-col">
              <div className="relative aspect-video rounded-th-lg border border-th-border bg-th-surface overflow-hidden shadow-card mb-5">
                <video
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
              <h3 className="font-bold text-[16px] text-th-text mb-2">Organize and prioritize</h3>
              <p className="text-[13px] text-th-muted leading-relaxed">
                Tag, sort, and group assets into Collections your way, using out-of-the-box and custom metadata fields.
              </p>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col">
              <div className="relative aspect-video rounded-th-lg border border-th-border bg-th-surface overflow-hidden shadow-card mb-5">
                <video
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
              <h3 className="font-bold text-[16px] text-th-text mb-2">Work without the wait</h3>
              <p className="text-[13px] text-th-muted leading-relaxed">
                Stream files directly into creative apps and work as if they are stored locally.
              </p>
            </div>

            {/* Card 3 */}
            <div className="flex flex-col">
              <div className="relative aspect-video rounded-th-lg border border-th-border bg-th-surface overflow-hidden shadow-card mb-5">
                <video
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
              <h3 className="font-bold text-[16px] text-th-text mb-2">Navigate easily</h3>
              <p className="text-[13px] text-th-muted leading-relaxed">
                Panel-based workspaces and nested folder trees make finding everything easier, no more screen hopping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20 border-t border-th-border">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-th-muted mb-4">How it works</p>
        <h2 className="text-3xl font-extrabold mb-14">The review loop, simplified.</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="font-mono text-[11px] text-th-accent mb-3">{s.n}</p>
              <h3 className="font-bold text-[15px] mb-2">{s.title}</h3>
              <p className="text-[13px] text-th-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 border-t border-th-border">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-th-muted mb-4">Pricing</p>
        <h2 className="text-3xl font-extrabold mb-3">One plan. No surprises.</h2>
        <p className="text-th-muted mb-12 text-[15px]">Everything included. No per-seat fees. No storage upsells.</p>

        <div className="max-w-sm bg-th-surface border border-th-border rounded-th-lg p-8 shadow-card">
          <p className="font-mono text-[10px] uppercase tracking-wider text-th-muted mb-4">Monthly</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-extrabold">₹499</span>
            <span className="text-th-muted text-[14px]">/ month</span>
          </div>
          <p className="text-[12px] text-th-muted mb-7">14-day free trial. Cancel anytime.</p>

          <ul className="space-y-2.5 mb-8">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13px]">
                <Check size={14} className="text-th-resolved mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/auth/signup"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
          >
            Start 14-day free trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-th-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-th-accent block" />
            <span className="text-[13px] font-bold">COLLABCUT</span>
          </div>
          <p className="font-mono text-[11px] text-th-faint">Built for the loop between a cut and a lock.</p>
        </div>
      </footer>
    </div>
  )
}
