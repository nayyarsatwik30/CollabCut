# CollabCut roadmap

Planned work that isn't urgent but is committed to. Newest decisions at the top of each section.

## Planned (near term, weeks)

### Chunked / resumable uploads (branch `fix/chunked-uploads`, commit `956723a`)

- **Why:** a real, valuable fix for the upload reliability issues seen on 23 Sep 2026 - a single raw PUT of the whole file dies on any network blip (showing up as a misleading CORS error) and leaves the asset stuck in "processing".
- **State:** implemented with `@mux/upchunk` (8 MB chunks, per-chunk retries, resume from last good chunk, 60s offline give-up) but untested - deliberately not merged to main.
- **Done when:** tested on a calm day against large files and a flaky connection, then merged.

### Upgrade Next.js 14.2.35 → 15.5.x

- **Why:** 14.2.35 is the last 14.x release. `npm audit` still reports 27 advisories against it (23 in `next`, 4 in the `postcss` bundled with it) that are fixed only in Next 15.5.24+.
- **Applies to us:** the Server Components denial-of-service (high) and RSC cache-poisoning advisories — CollabCut uses the App Router with server-rendered pages and layouts.
- **Not urgent — verified not exploitable in production (23 Sep 2026):**
  - GHSA-p293-qw3h-jr36 (path-traversal RCE on Windows-hosted servers): production runs on Vercel's Linux functions. Windows dev machines are covered by binding `next dev` to `127.0.0.1` (commit `64a894a`).
  - GHSA-2xp9-vwfh-vxw4 (AVIF / `libheif` RCE in image optimization): `sharp` isn't installed, Vercel serves `/_next/image` on its own infrastructure, nothing uses `next/image`, and the remote image allowlist was removed (commit `93baf3d`).
- **Scope to expect:** async request APIs (`cookies()`, `headers()`, `params`), React 19, changed `fetch`/route-handler caching defaults, NextAuth 4 compatibility, `eslint-config-next` in lockstep.
- **Done when:** `npm audit --omit=dev` shows no `next`/`postcss` advisories, typecheck and production build are clean, and the authorization and soft-delete test suites pass against the upgraded build.

### Patch `nanoid` (2 high advisories)

- **Why:** transitive dependency below the fixed versions (`<3.3.18`). Not tied to the Next major — `npm audit fix` resolves it without a breaking change.
- **Done when:** `npm audit --omit=dev` no longer lists `nanoid`.
