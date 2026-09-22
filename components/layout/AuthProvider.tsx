'use client'

import { SessionProvider } from 'next-auth/react'

// next-auth v4's SessionProvider predates the 'use client' convention, so
// app/layout.tsx (a Server Component) can't import it directly - Next treats
// the whole module as server code and blows up trying to use React Context.
// This one-line wrapper is the client boundary Next needs.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
