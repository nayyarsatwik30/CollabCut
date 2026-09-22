'use client'

import { SessionProvider } from 'next-auth/react'

export default function MigrationDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth-migration">
      <div className="page-scroll bg-th-bg text-th-text min-h-screen">{children}</div>
    </SessionProvider>
  )
}
