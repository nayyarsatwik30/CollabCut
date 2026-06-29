
"use client";

import { useState } from "react";
import { COLORS } from "../lib/constants";
import LandingScreen from "./LandingScreen";
import ReviewScreen from "./ReviewScreen";

export default function App() {
  const [screen, setScreen] = useState<"landing" | "review">("landing");

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'IBM Plex Sans', sans-serif", color: COLORS.text }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <div
        className="fixed top-3 right-3 z-50 flex gap-1 p-1 rounded-full text-xs"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <button
          onClick={() => setScreen("landing")}
          className="px-3 py-1 rounded-full"
          style={{ background: screen === "landing" ? COLORS.amber : "transparent", color: screen === "landing" ? COLORS.bg : COLORS.textMuted }}
        >
          Landing
        </button>
        <button
          onClick={() => setScreen("review")}
          className="px-3 py-1 rounded-full"
          style={{ background: screen === "review" ? COLORS.amber : "transparent", color: screen === "review" ? COLORS.bg : COLORS.textMuted }}
        >
          Review
        </button>
      </div>
      {screen === "landing" ? <LandingScreen onTryReview={() => setScreen("review")} /> : <ReviewScreen onBack={() => setScreen("landing")} />}
    </div>
  );
}
