# Dailies — Frame-accurate video review

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Routes

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/auth/login` | Login |
| `/auth/signup` | Sign up |
| `/dashboard` | Projects dashboard |
| `/project/p1` | Project view (assets, members, activity) |
| `/review/a1` | Full review screen |

## Theme system

Themes are set via `data-theme` on `<html>`. User preference is saved in localStorage.
Five themes: `film`, `arctic`, `noir`, `sunset`, `slate`.

All design tokens are CSS variables prefixed `--th-` defined in `app/globals.css`.
Tailwind classes use `th-` prefix (e.g. `bg-th-surface`, `text-th-accent`).

## Backend next steps

Replace mock data in `lib/mock-data.ts` with real API calls.
Video playback: swap `src` in `VideoPlayer.tsx` with `https://stream.mux.com/{PLAYBACK_ID}.m3u8`

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- lucide-react icons
