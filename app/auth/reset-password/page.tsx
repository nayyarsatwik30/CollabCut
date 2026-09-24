'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Landing page for the old Supabase Auth recovery links. Those tokens can't
// be honored anymore (login is NextAuth + auth_credentials in CloudClusters),
// so anyone arriving from an old email gets the same notice as /auth/forgot.
export default function ResetPasswordPage() {
  return (
    <div className="page-scroll bg-th-bg flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/collabcut-mark.png" alt="CollabCut" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Password reset unavailable</h1>
          <p className="text-th-muted text-[13px] mb-8">
            Email password reset is temporarily unavailable, so this link can't be used. Please contact your workspace admin or CollabCut support and we'll help you get back into your account.
          </p>
          <Link href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-surface-alt border border-th-border text-th-text font-semibold text-[14px] btn-press hover:bg-th-surface-hov transition-colors">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
