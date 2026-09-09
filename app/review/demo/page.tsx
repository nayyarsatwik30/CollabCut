'use client'

import Link from 'next/link'
import { ChevronLeft, Play, ArrowRight, MessageSquare } from 'lucide-react'
import { StatusBadge, Avatar } from '@/components/ui/Badge'

// A fully static stand-in for the review experience, so the landing page's
// "See a live review" link never depends on a real database asset existing.
// Account/project/asset data gets wiped for testing (see the account-reset
// work elsewhere in this repo's history) - a link into /review/[id] would
// break every time that happens. Next.js resolves this literal route ahead
// of the [id] dynamic segment, so /review/demo always renders this page
// instead of hitting the live review page's data fetches.
const MOCK_COMMENTS = [
  {
    id: '1',
    author: 'Priya',
    color: '#d946ef',
    time: '00:12',
    status: 'open' as const,
    text: 'Can we hold on this frame a beat longer before the cut? Feels rushed.',
  },
  {
    id: '2',
    author: 'Sam',
    color: '#34d399',
    time: '00:47',
    status: 'changes' as const,
    text: 'Color grade looks a bit warm here compared to the rest of the sequence.',
  },
  {
    id: '3',
    author: 'Priya',
    color: '#d946ef',
    time: '01:23',
    status: 'resolved' as const,
    text: 'Approved on my end ✅',
  },
]

const MARKER_POSITIONS = [12, 47, 82]

export default function DemoReviewPage() {
  return (
    <div className="page-scroll bg-th-bg min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-th-muted hover:text-th-text transition-colors text-[13px]">
            <ChevronLeft size={16} /> Home
          </Link>
          <span className="w-px h-5 bg-th-border" />
          <span className="text-[13px] font-semibold">Trailer_Cut_v4.mp4</span>
          <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-th-full bg-th-accent/10 border border-th-accent/30 text-th-accent">
            Sample review — no sign-in needed
          </span>
        </div>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-th-full bg-gradient-cta text-white text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
        >
          Start free trial <ArrowRight size={13} />
        </Link>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <div
            className="relative aspect-video rounded-th-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--gradient-brand)' }}
          >
            <button className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center hover:bg-black/40 transition-colors">
              <Play size={26} className="text-white ml-1" fill="white" />
            </button>

            {MARKER_POSITIONS.map((pos, i) => (
              <div
                key={i}
                className="absolute bottom-4 w-2.5 h-2.5 rounded-full border-2 border-white/80"
                style={{ left: `${pos}%`, background: MOCK_COMMENTS[i].color }}
              />
            ))}
          </div>

          <div className="mt-3 h-1.5 rounded-full bg-th-surface-alt relative">
            <div className="absolute inset-y-0 left-0 w-[35%] rounded-full bg-th-accent" />
          </div>
          <p className="mt-3 text-[12px] text-th-faint font-mono">
            This is a static preview — the video and comments here are illustrative, not a live review.
          </p>
        </div>

        <div className="border border-th-border rounded-th-lg bg-th-surface p-4">
          <div className="flex items-center gap-2 mb-4 text-[13px] font-semibold">
            <MessageSquare size={15} className="text-th-muted" /> Comments ({MOCK_COMMENTS.length})
          </div>

          <div className="space-y-4">
            {MOCK_COMMENTS.map((c) => (
              <div key={c.id} className="pb-4 border-b border-th-border-lt last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar initials={c.author[0]} color={c.color} size="sm" />
                  <span className="text-[13px] font-semibold">{c.author}</span>
                  <span className="text-[11px] text-th-faint font-mono">{c.time}</span>
                  <StatusBadge status={c.status} className="ml-auto" />
                </div>
                <p className="text-[13px] text-th-text pl-9">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-th-lg border border-th-border bg-th-surface p-8 text-center">
          <h2 className="text-xl font-extrabold mb-2">Like what you see?</h2>
          <p className="text-th-muted text-[13px] mb-5">
            Upload a cut, drop notes on the exact frame, share one link — free for 14 days.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-th-full bg-gradient-cta text-white font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
          >
            Start your free trial <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
