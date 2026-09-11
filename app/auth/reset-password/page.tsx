'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ password: '', confirm: '' })

  // The emailed reset link lands here carrying a recovery token that
  // supabase-js (detectSessionInUrl: true) picks up automatically and
  // exchanges for a temporary session, firing PASSWORD_RECOVERY once it
  // does. Fall back to a plain session check in case that event already
  // fired before this listener subscribed, and give up after a few
  // seconds if neither ever resolves (an invalid or expired link).
  useEffect(() => {
    let settled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        settled = true
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !settled) {
        settled = true
        setReady(true)
      }
    })

    const timeout = setTimeout(() => {
      if (!settled) setInvalid(true)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.password || !form.confirm) {
      setError('Please fill in both fields')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/board'), 1500)
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
          {invalid ? (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Link expired</h1>
              <p className="text-th-muted text-[13px] mb-8">
                This password reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Link href="/auth/forgot"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity">
                Request new link
              </Link>
            </>
          ) : success ? (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Password updated</h1>
              <p className="text-th-muted text-[13px] mb-8">Taking you to your board…</p>
              <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin mx-auto" />
            </>
          ) : !ready ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
              <p className="text-[13px] text-th-muted">Verifying your reset link…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Set a new password</h1>
              <p className="text-th-muted text-[13px] mb-8">Choose a new password for your account.</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">New password</label>
                  <div className="relative">
                    <input name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Confirm password</label>
                  <input name="confirm" type={showPass ? 'text' : 'password'} value={form.confirm} onChange={handleChange} placeholder="••••••••"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
                </div>

                <button onClick={handleSubmit} disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading ? 'Updating…' : <><span>Update password</span> <ArrowRight size={14} /></>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
