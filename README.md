# CollabCut
 
A Frame.io-inspired video review and agency workflow platform. CollabCut lets video editing agencies and freelance editors upload cuts, collect timecoded client feedback, manage versions, and run their production pipeline end-to-end — all in one place.
 
**Live:** [collabcut.in](https://collabcut.in) ([www.collabcut.in](https://www.collabcut.in))
 
---
 
## What it does
 
- **Review & feedback** — Upload a cut, get timecoded comments and threaded replies from clients or teammates, resolve/reopen discussion, approve the final version.
- **Version control** — Every re-upload is tracked as part of a real lineage (not filename matching), with version-locking and a persistent content brief (notes, reference, deadline) that follows the asset across versions.
- **Kanban production board** — Track projects through Cut → Editing → Review → Revision → Approved. Admins see the whole workspace; editors see only what's assigned to them.
- **Workspaces & teams** — Multi-tenant workspaces with admin/editor roles, join-by-code invites, and per-editor project assignment.
- **Client share links** — Password-protected, expiring, comments-only, no-login review links for external clients.
- **Notifications** — Triggered on assignment, comments, replies, and approvals.
- **Recycle bin** — Soft-delete and restore for both projects and assets.
- **Pricing tiers** — Self-serve individual plans (Basic / Pro / Master) alongside private agency onboarding.
## Tech stack
 
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Database | Self-hosted CloudClusters PostgreSQL |
| Auth | NextAuth (Credentials provider) |
| Video | Mux (upload, transcoding, HLS streaming, webhooks) + HLS.js for playback |
| Deployment | Vercel |
| Domain | collabcut.in (GoDaddy DNS → Vercel) |
| Planned | Backblaze B2 (raw footage archival), Razorpay (payments) |
 
> **Note:** CollabCut originally ran on Supabase (Postgres + Auth) and was migrated to a self-hosted CloudClusters Postgres instance with NextAuth. A small amount of legacy Supabase code (password reset flow, a few routes) is still being cleaned up.
 
## Getting started
 
```bash
git clone https://github.com/nayyarsatwik30/CollabCut.git
cd CollabCut
npm install
```
 
Create a `.env.local` with the required environment variables (database connection, NextAuth secret, Mux credentials, app URL). See `.env.migration` / project config for reference — do not commit real secrets.
 
```bash
npm run dev
```
 
The app will be available at `http://localhost:3000`.
 
### Production build
 
```bash
npm run build
npm start
```
 
## Project structure
 
Built on the Next.js App Router. Key workflows:
 
- `/auth/signup` — individual self-serve signup (pricing shown)
- `/auth/signup/agency` — private agency signup (invite/workspace-based)
- `/board` — Kanban production board
- `/r/[token]` — public, no-login client share link review page
- `lib/api-auth.ts` — shared auth/authorization helpers (`requireAuth`, `hasWorkspaceRole`, `isAssignedEditor`)
- `lib/asset-lineage.ts` — version lineage logic (`asset_group_id`-based, not filename-based)
## Known issues / in progress
 
CollabCut is under active solo development. Current known gaps include:
 
- Multi-tenant data isolation has not yet been formally tested
- Real-time updates across users are not yet implemented (manual refresh required)
- A few live bugs from the most recent production test (share-link password verification, editor folder access, storage usage bar, some notification triggers) are being worked through
- Backblaze B2 and Razorpay integrations are planned but not yet live
- Terms of Service / Privacy Policy pages are pending
## License
 
Proprietary — all rights reserved.
 
## Contact
 
Built by [Satwik Nayyar](https://github.com/nayyarsatwik30). Business/client relationships handled by Kunal Gupta.
 
