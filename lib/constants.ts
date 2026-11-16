// Legacy constants (not referenced by the app), kept on the CollabCut palette.
export const COLORS = {
  bg: "#050505",
  surface: "#0E0E0E",
  surfaceAlt: "#171717",
  border: "#2a2926",
  text: "#ECE6DC",
  textMuted: "#A9A398",
  lime: "#B8E41E",
  danger: "#FF8A7A",
} as const;

export const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  open: { color: "#ECE6DC", label: "Open" },
  resolved: { color: "#B8E41E", label: "Resolved" },
  changes: { color: "#FF8A7A", label: "Needs changes" },
};

export const VIDEO_SRC = "https://www.w3schools.com/html/mov_bbb.mp4";
export const FPS = 24;

export const INITIAL_COMMENTS = [
  { id: 1, time: 2.5, author: "Riya", color: "#ECE6DC", status: "open", text: "Can we trim this beat by half a second? Feels a touch slow." },
  // ... rest of items
];

export const STEPS = [
  { n: "01", title: "UploadCOLLABCUT", desc: "Drag in a cut straight from your editor. No transcoding wait before reviewers can open it." },
  { n: "02", title: "Drop timecoded notes", desc: "Click a frame, leave a note. It is pinned to that exact moment, forever." },
  { n: "03", title: "Stack versions", desc: "A new cut goes on top of the old one. Compare side by side in one click." },
  { n: "04", title: "Reach picture lock", desc: "Mark it approved. Everyone sees the same status, no buried email thread." },
] as const;
