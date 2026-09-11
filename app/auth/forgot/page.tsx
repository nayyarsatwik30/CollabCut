'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email) {
      setError('Email is required')
      return
    }

    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    // Always show the same confirmation whether or not this email has an
    // account - resetPasswordForEmail deliberately doesn't reveal that,
    // to avoid leaking which emails are registered.
    setSent(true)
  }

  return (
    <div className="page-scroll bg-th-bg flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {sent ? (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Check your email</h1>
              <p className="text-th-muted text-[13px] mb-8">
                If an account exists for <span className="text-th-text font-medium">{email}</span>, we've sent a link to reset your password.
              </p>
              <Link href="/auth/login"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-surface-alt border border-th-border text-th-text font-semibold text-[14px] btn-press hover:bg-th-surface-hov transition-colors">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Reset your password</h1>
              <p className="text-th-muted text-[13px] mb-8">
                Enter the email on your account and we'll send you a link to reset it.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.in"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
                </div>

                <button onClick={handleSubmit} disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading ? 'Sending…' : <><span>Send reset link</span> <ArrowRight size={14} /></>}
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-th-border text-center">
                <Link href="/auth/login" className="text-[13px] text-th-accent hover:underline">Back to login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
