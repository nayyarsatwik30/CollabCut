'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Check, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PERKS = [
  '14-day free trial, no card needed',
  'Unlimited reviewers from day one',
  'Cancel anytime, no questions',
]

type SignupRole = 'admin' | 'editor'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState<SignupRole>('admin')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', inviteCode: '' })
  const [createdInviteCode, setCreatedInviteCode] = useState('')

  const planId = searchParams.get('plan') ?? 'basic'
  const billingCycle = searchParams.get('cycle') ?? 'monthly'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.firstName || !form.email || !form.password) {
      setError('All fields are required')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (role === 'editor' && !form.inviteCode.trim()) {
      setError('Invite code is required to join a workspace')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        password: form.password,
        role,
        inviteCode: form.inviteCode,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to create account')
      setLoading(false)
      return
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (signInData.user) {
      await supabase
        .from('profiles')
        .update({ plan_id: planId, billing_cycle: billingCycle })
        .eq('id', signInData.user.id)
    }

    setLoading(false)

    if (role === 'admin' && data.workspace?.invite_code) {
      setCreatedInviteCode(data.workspace.invite_code)
      return
    }

    router.push('/board')
  }

  if (createdInviteCode) {
    return (
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-extrabold mb-1">Your workspace is ready</h1>
          <p className="text-th-muted text-[13px] mb-8">
            Share this invite code with your editors so they can join.
          </p>
          <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-th-muted">Invite code</span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-extrabold font-mono tracking-widest">{createdInviteCode}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(createdInviteCode)}
                className="p-1.5 rounded-th text-th-muted hover:text-th-text hover:bg-th-surface-alt transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-[11px] text-th-faint">
              You can find this again anytime in Settings &gt; Team.
            </p>
          </div>
          <button
            onClick={() => router.push('/board')}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity"
          >
            <span>Continue to board</span> <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-center px-6 py-20 gap-28">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-extrabold mb-2">Start your free trial</h1>
        <p className="text-th-muted text-[13px] mb-10">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-th-accent hover:underline">Log in</Link>
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Workspace</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole('admin')}
                className={`px-3.5 py-2.5 rounded-th border text-left text-[13px] transition-colors ${
                  role === 'admin' ? 'border-th-accent bg-th-accent/10' : 'border-th-border bg-th-surface'
                }`}>
                <span className="block font-semibold">Create a workspace</span>
                <span className="block text-[11px] text-th-muted mt-0.5">You'll be the admin</span>
              </button>
              <button type="button" onClick={() => setRole('editor')}
                className={`px-3.5 py-2.5 rounded-th border text-left text-[13px] transition-colors ${
                  role === 'editor' ? 'border-th-accent bg-th-accent/10' : 'border-th-border bg-th-surface'
                }`}>
                <span className="block font-semibold">Join a workspace</span>
                <span className="block text-[11px] text-th-muted mt-0.5">You'll be an editor</span>
              </button>
            </div>
          </div>

          {role === 'editor' && (
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Invite code</label>
              <input name="inviteCode" value={form.inviteCode} onChange={handleChange} placeholder="e.g. 4F9B2C1A"
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors font-mono uppercase" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">First name</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Satwik"
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Last name</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Nayyar"
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@studio.in"
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Password</label>
            <div className="relative">
              <input name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min. 8 characters"
                className="w-full px-3.5 py-2.5 pr-10 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted hover:text-th-text transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Creating account…' : <><span>Create free account</span> <ArrowRight size={14} /></>}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-th-faint font-mono">
          No credit card required. 14-day free trial.
          {planId !== 'basic' && (
            <span className="block mt-1 text-th-accent">Selected plan: {planId} ({billingCycle})</span>
          )}
        </p>
      </div>

      <div className="hidden lg:block pt-10">
        <p className="font-mono text-[11px] uppercase tracking-wider text-th-muted mb-7">What you get</p>
        <ul className="space-y-4">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-3 text-[14px]">
              <Check size={14} className="text-th-resolved shrink-0" /> {p}
            </li>
          ))}
        </ul>
        <div className="mt-14 p-6 rounded-th-lg border border-th-border bg-th-surface max-w-xs">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-extrabold">₹499</span>
            <span className="text-th-muted text-[13px]">/ month after trial</span>
          </div>
          <p className="text-[12px] text-th-muted">One plan, everything included.</p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="page-scroll bg-th-bg">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
      </header>

      <Suspense fallback={<div className="p-10 text-center text-th-muted">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </div>
  )
}