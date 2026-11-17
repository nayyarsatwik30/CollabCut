'use client'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Check, Minus } from '@/components/ui/icons'
import { PASSWORD_RULES, validatePassword } from '@/lib/password-policy'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Unmet rules as reported by the server (it re-checks the same policy).
  const [serverRules, setServerRules] = useState<string[]>([])
  const [linkInvalid, setLinkInvalid] = useState(false)
  const passwordOk = validatePassword(password).length === 0

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    setReady(true)
    // Keep the token out of the address bar / history once it's in memory.
    if (t) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const handleSubmit = async () => {
    setError('')
    setServerRules([])
    if (!passwordOk) {
      setError('Password does not meet requirements')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (res.ok) {
        router.push('/auth/login?reset=1')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (res.status === 400 && Array.isArray(data.rules)) {
        setError(data.error ?? 'Password does not meet requirements')
        setServerRules(data.rules)
      } else if (res.status === 400) setLinkInvalid(true)
      else setError(data.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Could not reach the server. Please try again.')
    }
    setLoading(false)
  }

  const showInvalid = ready && (!token || linkInvalid)
  const inputClass = 'w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent-line transition-colors'
  const labelClass = 'block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide'

  return (
    <div className="page-scroll bg-th-bg flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <span role="img" aria-label="CollabCut" className="brand-mark" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {showInvalid ? (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Link invalid or expired</h1>
              <p className="text-th-muted text-[13px] mb-8">
                This password reset link is invalid, has expired, or has already been used.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/auth/forgot">Request a new link</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Choose a new password</h1>
              <p className="text-th-muted text-[13px] mb-8">You'll be asked to log in again on all devices.</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                  {error}
                  {serverRules.length > 0 && (
                    <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
                      {serverRules.map((label) => <li key={label}>{label}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>New password</label>
                  <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" className={inputClass} />
                  <ul aria-label="Password requirements" className="mt-2.5 space-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const met = rule.test(password)
                      return (
                        <li key={rule.id} className={`flex items-center gap-2 text-[12px] transition-colors ${met ? 'text-th-text' : 'text-th-faint'}`}>
                          <span className={`shrink-0 ${met ? 'text-th-accent-line' : 'text-th-faint'}`}>
                            {met ? <Check size={12} /> : <Minus size={12} />}
                          </span>
                          {rule.label}
                          <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div>
                  <label className={labelClass}>Confirm new password</label>
                  <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="••••••••" className={inputClass} />
                </div>
                <Button onClick={handleSubmit} loading={loading} disabled={!ready || !passwordOk} size="lg" className="w-full">
                  {loading ? 'Saving…' : 'Set password'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
