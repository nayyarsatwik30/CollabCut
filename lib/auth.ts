import { supabase } from './supabase'

// Shared by every Logout button (Projects, Board, Settings) so there's one
// place that actually signs the user out, instead of each page re-writing
// the same two lines.
export async function performLogout(router: { push: (href: string) => void }) {
  await supabase.auth.signOut()
  router.push('/')
}
