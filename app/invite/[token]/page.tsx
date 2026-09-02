'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface InviteDetails {
  workspace_id: string
  workspace_name: string
  email: string
  role: string
  expired: boolean
  used: boolean
  valid: boolean
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params.token

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', password: '' })

  useEffect(() => {
    if (!token) return
    fetch(`/api/invites?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error ?? 'Invalid invite link')
          return
        }
        setInvite(data.invite)
      })
      .catch(() => setLoadError('Failed to load invite'))
      .finally(() => setLoading(false))
  }, [token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!invite) return
    if (!form.firstName || !form.password) {
      setFormError('All fields are required')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password: form.password,
      options: { data: { name: `${form.firstName} ${form.lastName}`.trim() } },
    })

    if (error) {
      setFormError(error.message)
      setSubmitting(false)
      return
    }

    const accessToken = data.session?.access_token
    if (!accessToken) {
      setFormError('Check your inbox to confirm your email, then log in to finish joining the workspace.')
      setSubmitting(false)
      return
    }

    const acceptRes = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }),
    })
    const acceptData = await acceptRes.json()

    if (!acceptRes.ok) {
      setFormError(acceptData.error ?? 'Failed to join workspace')
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="page-scroll bg-th-bg font-display min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  const errorMessage =
    loadError || (invite?.used ? 'This invite has already been used.' : invite?.expired ? 'This invite has expired.' : '')

  return (
    <div className="page-scroll bg-th-bg font-display">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
      </header>

      <div className="flex items-start justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          {errorMessage ? (
            <div className="text-center">
              <h1 className="text-2xl font-extrabold mb-3">Invite unavailable</h1>
              <p className="text-th-muted text-[14px] mb-8">{errorMessage}</p>
              <Link href="/auth/login" className="text-th-accent hover:underline text-[13px]">
                Go to login
              </Link>
            </div>
          ) : invite ? (
            <>
              <h1 className="text-2xl font-extrabold mb-1">Join {invite.workspace_name}</h1>
              <p className="text-th-muted text-[13px] mb-8">
                You&apos;ve been invited to join <span className="text-th-text font-semibold">{invite.workspace_name}</span> as{' '}
                {invite.role === 'admin' ? 'an Admin' : 'an Editor'}. Create your account to get started.
              </p>

              {formError && (
                <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">
                      First name
                    </label>
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="Satwik"
                      className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">
                      Last name
                    </label>
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Nayyar"
                      className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Email</label>
                  <input
                    value={invite.email}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-muted outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors"
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Creating account…' : (
                    <>
                      <span>Join workspace</span> <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
