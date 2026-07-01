"use client";

import { useState, useRef } from "react";
import { Play, Pause, Share2, ChevronLeft, Plus } from "lucide-react";
import { COLORS, STATUS_STYLE, VIDEO_SRC, INITIAL_COMMENTS } from "../lib/constants";
import { formatTimecode } from "../lib/utils";

interface ReviewScreenProps {
  onBack: () => void;
}

export default function ReviewScreen({ onBack }: ReviewScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [draftText, setDraftText] = useState("");

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  };

  const addComment = () => {
    if (!draftText.trim()) return;
    setComments((prev) =>
      [...prev, { id: Date.now(), time: currentTime, author: "You", color: COLORS.amber, status: "open", text: draftText.trim() }].sort(
        (a, b) => a.time - b.time
      )
    );
    setDraftText("");
  };

  const sortedComments = [...comments].sort((a, b) => a.time - b.time);

  return (
    <div className="max-w-6xl mx-auto">
      <style>{`
        .notes-panel { max-height: none; }
        @media (min-width: 1024px) { .notes-panel { max-height: 460px; } }
      `}</style>

      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b" style={{ borderColor: COLORS.border }}>
        <button onClick={onBack} className="flex items-center gap-1 text-sm transition-colors" style={{ color: COLORS.textMuted }}>
          <ChevronLeft size={16} /> Projects
        </button>
        <div className="text-sm font-medium text-center">
          Wedding Promo <span style={{ color: COLORS.textMuted }}>/ Client Cut v3</span>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="relative rounded-xl overflow-hidden" style={{ background: "#000" }}>
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "contain" }}
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration)}
              onClick={togglePlay}
            />
            <div
              className="absolute left-3 top-3 px-2 py-1 rounded text-xs"
              style={{ background: "rgba(0,0,0,0.55)", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.amber, letterSpacing: "0.05em" }}
            >
              {formatTimecode(currentTime)}
            </div>
            <button
              onClick={togglePlay}
              className="absolute bottom-3 left-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.55)" }}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} color={COLORS.text} /> : <Play size={16} color={COLORS.text} />}
            </button>
          </div>

          <div className="mt-4 px-1">
            <div
              ref={trackRef}
              onClick={handleTrackClick}
              className="relative h-2 rounded-full cursor-pointer"
              style={{ background: COLORS.surfaceAlt }}
            >
              <div className="absolute inset-0 flex justify-between px-0.5 pointer-events-none">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="w-px h-full" style={{ background: COLORS.border }} />
                ))}
              </div>
              <div
                className="absolute h-full rounded-full pointer-events-none"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%", background: COLORS.amber, opacity: 0.6 }}
              />
              {sortedComments.map((c) =>
                duration ? (
                  <button
                    key={c.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(c.time);
                    }}
                    className="absolute -top-1.5 w-3 h-3 rounded-full border-2"
                    style={{
                      left: `${(c.time / duration) * 100}%`,
                      background: STATUS_STYLE[c.status].color,
                      borderColor: COLORS.bg,
                      transform: "translateX(-50%)",
                    }}
                    title={c.text}
                  />
                ) : null
              )}
              <div
                className="absolute top-1/2 w-0.5 h-4 pointer-events-none"
                style={{ left: duration ? `${(currentTime / duration) * 100}%` : "0%", background: COLORS.text, transform: "translate(-50%, -50%)" }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}>
              <span>{formatTimecode(currentTime)}</span>
              <span>{formatTimecode(duration)}</span>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l flex flex-col" style={{ borderColor: COLORS.border }}>
          <div className="px-4 sm:px-6 py-4 border-b text-sm font-medium" style={{ borderColor: COLORS.border }}>
            Notes ({comments.length})
          </div>
          <div className="notes-panel flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-4">
            {sortedComments.map((c) => (
              <div key={c.id} className="pb-4 border-b" style={{ borderColor: COLORS.border }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: c.color, color: COLORS.bg }}
                  >
                    {c.author[0]}
                  </div>
                  <span className="text-sm font-medium">{c.author}</span>
                  <button
                    onClick={() => seekTo(c.time)}
                    className="text-xs ml-auto"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.textMuted }}
                  >
                    {formatTimecode(c.time)}
                  </button>
                </div>
                <p className="text-sm mb-2" style={{ color: COLORS.text }}>
                  {c.text}
                </p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ color: STATUS_STYLE[c.status].color, border: `1px solid ${STATUS_STYLE[c.status].color}55` }}
                >
                  {STATUS_STYLE[c.status].label}
                </span>
              </div>
            ))}
          </div>
          <div className="p-4 sm:p-6 border-t" style={{ borderColor: COLORS.border }}>
            <div className="text-xs mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.amber }}>
              Note at {formatTimecode(currentTime)}
            </div>
            <div className="flex gap-2">
              <input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Leave a note at this frame..."
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addComment();
                }}
              />
              <button onClick={addComment} className="px-3 rounded-lg" style={{ background: COLORS.amber }} aria-label="Add note">
                <Plus size={16} color={COLORS.bg} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
