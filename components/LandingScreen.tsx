import { Film } from "lucide-react";
import { COLORS, STEPS } from "../lib/constants";
import Logo from "./Logo";

interface LandingScreenProps {
  onTryReview: () => void;
}

export default function LandingScreen({ onTryReview }: LandingScreenProps) {
  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Logo />
        <div className="hidden sm:flex items-center gap-6 text-sm" style={{ color: COLORS.textMuted }}>
          <span>Pricing</span>
          <span>Log in</span>
        </div>
        <button
          onClick={onTryReview}
          className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
          style={{ background: COLORS.amber, color: COLORS.bg }}
        >
          Start review
        </button>
      </nav>

      <section className="px-6 pt-10 pb-16 max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <p
            className="text-xs uppercase tracking-widest mb-4"
            style={{ color: COLORS.amber, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Frame-accurate review
          </p>
          <h1
            className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            From rough cut to <span style={{ color: COLORS.amber }}>picture lock</span> — without the seat tax.
          </h1>
          <p className="text-base sm:text-lg mb-8" style={{ color: COLORS.textMuted }}>
            Upload a cut, drop notes on the exact frame, and send one link. Reviewers do not need an
            account, and you do not pay per seat.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onTryReview}
              className="px-5 py-3 rounded-full font-semibold text-sm transition-colors"
              style={{ background: COLORS.amber, color: COLORS.bg }}
            >
              See a review in action
            </button>
            <button
              className="px-5 py-3 rounded-full font-semibold text-sm border transition-colors"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            >
              View pricing
            </button>
          </div>
        </div>

        <div className="mt-14 rounded-2xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div
            className="flex items-center gap-2 mb-4 text-xs"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}
          >
            <Film size={14} /> wedding_promo_v3.mp4
          </div>
          <div className="relative h-2 rounded-full" style={{ background: COLORS.surfaceAlt }}>
            <div
              className="absolute h-full rounded-full"
              style={{ width: "38%", background: COLORS.amber, opacity: 0.5 }}
            />
            {[18, 38, 64, 82].map((pos, i) => (
              <div
                key={i}
                className="absolute -top-1.5 w-3 h-3 rounded-full border-2"
                style={{
                  left: `${pos}%`,
                  background: [COLORS.amber, COLORS.green, COLORS.coral, COLORS.amber][i],
                  borderColor: COLORS.bg,
                  transform: "translateX(-50%)",
                }}
              />
            ))}
          </div>
          <div
            className="flex justify-between mt-3 text-xs"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}
          >
            <span>00:00:00:00</span>
            <span>00:02:14:08</span>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto border-t" style={{ borderColor: COLORS.border }}>
        <h2 className="text-2xl font-bold mb-10" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          The loop
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s: { n: string; title: string; desc: string }) => (
            <div key={s.n}>
              <p className="text-xs mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.amber }}>
                {s.n}
              </p>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto border-t" style={{ borderColor: COLORS.border }}>
        <div className="rounded-2xl p-8 sm:p-10 max-w-md" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <p
            className="text-xs uppercase tracking-widest mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}
          >
            One plan
          </p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-5xl font-extrabold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              ₹499
            </span>
            <span style={{ color: COLORS.textMuted }}>/ month</span>
          </div>
          <ul className="space-y-2 text-sm mb-6" style={{ color: COLORS.text }}>
            <li>Unlimited reviewers, no per-seat charge</li>
            <li>Time-coded notes and version stacking</li>
            <li>200 GB storage</li>
          </ul>
          <button
            className="w-full py-3 rounded-full font-semibold text-sm transition-colors"
            style={{ background: COLORS.amber, color: COLORS.bg }}
          >
            Start free for 14 days
          </button>
        </div>
      </section>

      <footer className="px-6 py-10 max-w-6xl mx-auto text-xs" style={{ color: COLORS.textMuted }}>
       COLLABCUT — built for the loop between a cut and a lock.
      </footer>
    </div>
  );
}
