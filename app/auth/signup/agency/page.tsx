'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'

export default function AgencySignupPage() {
  return (
    <div className="page-scroll bg-th-bg">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
      </header>

      <Suspense fallback={<div className="p-10 text-center text-th-muted">Loading…</div>}>
        <SignupForm allowWorkspaceChoice={true} showPricingSidebar={false} />
      </Suspense>
    </div>
  )
}
