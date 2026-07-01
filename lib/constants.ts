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

export const STATUS_STYLE = {
  open: { color: COLORS.amber, label: "Open" },
  resolved: { color: COLORS.green, label: "Resolved" },
  changes: { color: COLORS.coral, label: "Needs changes" },
} as const;

export const VIDEO_SRC = "https://www.w3schools.com/html/mov_bbb.mp4";
export const FPS = 24;

export const INITIAL_COMMENTS = [
  { id: 1, time: 2.5, author: "Riya", color: COLORS.amber, status: "open", text: "Can we trim this beat by half a second? Feels a touch slow." },
  { id: 2, time: 5.8, author: "Sam", color: COLORS.green, status: "resolved", text: "Color looks great here, approved." },
  { id: 3, time: 7.6, author: "Riya", color: COLORS.amber, status: "changes", text: "Logo is cut off at the edge, please reframe." },
  { id: 4, time: 9.2, author: "Client", color: COLORS.coral, status: "open", text: "Love this transition, keep it exactly as is." },
] as const;

export const STEPS = [
  { n: "01", title: "UploadCOLLABCUT", desc: "Drag in a cut straight from your editor. No transcoding wait before reviewers can open it." },
  { n: "02", title: "Drop timecoded notes", desc: "Click a frame, leave a note. It is pinned to that exact moment, forever." },
  { n: "03", title: "Stack versions", desc: "A new cut goes on top of the old one. Compare side by side in one click." },
  { n: "04", title: "Reach picture lock", desc: "Mark it approved. Everyone sees the same status, no buried email thread." },
] as const;
