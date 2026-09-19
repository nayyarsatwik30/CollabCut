import { signOut } from 'next-auth/react'

// Shared by every Logout button (Projects, Board, Settings) so there's one
// place that actually signs the user out, instead of each page re-writing
// the same two lines. redirect: false so we control the destination ('/'
// instead of NextAuth's default sign-in page) via the same router every
// caller already has.
export async function performLogout(router: { push: (href: string) => void }) {
  await signOut({ redirect: false })
  router.push('/')
}
