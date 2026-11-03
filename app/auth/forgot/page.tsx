'use client'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button, ButtonIcon } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    setLoading(true)
    // The API answers the same for every address, so the UI does too. A
    // network failure is the only case surfaced differently.
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Could not reach the server. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="page-scroll bg-th-bg flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/collabcut-mark.png" alt="CollabCut" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Reset your password</h1>
          <p className="text-th-muted text-[13px] mb-8">Enter your email and we'll send you a link to choose a new password.</p>

          {sent ? (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-surface border border-th-border text-th-text text-[13px]">
              If an account exists for this email, a reset link has been sent.
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">{error}</div>
              )}
              <div>
                <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Enter your email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.in"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
              </div>
              <Button onClick={handleSubmit} loading={loading} size="lg" className="w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </div>
          )}

          <Button asChild variant="secondary" size="lg" className="w-full mt-4">
            <Link href="/auth/login">
              <ButtonIcon className="group-hover:-translate-x-0.5 group-hover:translate-y-0 group-active:-translate-x-1">
                <ArrowLeft size={14} />
              </ButtonIcon> Back to login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
