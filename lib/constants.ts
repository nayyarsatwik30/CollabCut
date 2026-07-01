export const COLORS = {
  bg: "#15140F",
  surface: "#1C1A14",
  surfaceAlt: "#242019",
  border: "#332E20",
  text: "#F3F0E8",
  textMuted: "#9C9686",
  amber: "#E8A33D",
  green: "#5FA777",
  coral: "#E1604A",
} as const;

export const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  open: { color: "#E8A33D", label: "Open" },
  resolved: { color: "#5FA777", label: "Resolved" },
  changes: { color: "#E1604A", label: "Needs changes" },
};

export const VIDEO_SRC = "https://www.w3schools.com/html/mov_bbb.mp4";
export const FPS = 24;

export const INITIAL_COMMENTS = [
  { id: 1, time: 2.5, author: "Riya", color: "#E8A33D", status: "open", text: "Can we trim this beat by half a second? Feels a touch slow." },
  // ... rest of items
];

export const STEPS = [
  { n: "01", title: "UploadCOLLABCUT", desc: "Drag in a cut straight from your editor. No transcoding wait before reviewers can open it." },
  { n: "02", title: "Drop timecoded notes", desc: "Click a frame, leave a note. It is pinned to that exact moment, forever." },
  { n: "03", title: "Stack versions", desc: "A new cut goes on top of the old one. Compare side by side in one click." },
  { n: "04", title: "Reach picture lock", desc: "Mark it approved. Everyone sees the same status, no buried email thread." },
] as const;
