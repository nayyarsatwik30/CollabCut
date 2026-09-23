# CollabCut roadmap

Planned work that isn't urgent but is committed to. Newest decisions at the top of each section.

## Planned (near term, weeks)

### Upgrade Next.js 14.2.35 → 15.5.x

- **Why:** 14.2.35 is the last 14.x release. `npm audit` still reports 27 advisories against it (23 in `next`, 4 in the `postcss` bundled with it) that are fixed only in Next 15.5.24+.
- **Applies to us:** the Server Components denial-of-service (high) and RSC cache-poisoning advisories — CollabCut uses the App Router with server-rendered pages and layouts.
- **Not urgent — verified not exploitable in production (23 Sep 2026):**
  - GHSA-p293-qw3h-jr36 (path-traversal RCE on Windows-hosted servers): production runs on Vercel's Linux functions. Windows dev machines are covered by binding `next dev` to `127.0.0.1` (commit `64a894a`).
  - GHSA-2xp9-vwfh-vxw4 (AVIF / `libheif` RCE in image optimization): `sharp` isn't installed, Vercel serves `/_next/image` on its own infrastructure, nothing uses `next/image`, and the remote image allowlist was removed (commit `93baf3d`).
- **Scope to expect:** async request APIs (`cookies()`, `headers()`, `params`), React 19, changed `fetch`/route-handler caching defaults, NextAuth 4 compatibility, `eslint-config-next` in lockstep.
- **Done when:** `npm audit --omit=dev` shows no `next`/`postcss` advisories, typecheck and production build are clean, and the authorization and soft-delete test suites pass against the upgraded build.
