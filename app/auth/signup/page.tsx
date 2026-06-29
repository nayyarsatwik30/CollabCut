'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { supabase } from '@/lib/supabase'

const PERKS = [
  '14-day free trial, no card needed',
  'Unlimited reviewers from day one',
  'Cancel anytime, no questions',
]

export default function SignupPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })

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

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  { data: { name: `${form.firstName} ${form.lastName}`.trim() } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="page-scroll bg-th-bg font-display">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">DAILIES</span>
        </Link>
        <ThemePicker />
      </header>

      <div className="flex items-start justify-center px-6 py-16 gap-20">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Start your free trial</h1>
          <p className="text-th-muted text-[13px] mb-8">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-th-accent hover:underline">Log in</Link>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          <div className="space-y-4">
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
          </p>
        </div>

        <div className="hidden lg:block pt-10">
          <p className="font-mono text-[11px] uppercase tracking-wider text-th-muted mb-5">What you get</p>
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[14px]">
                <Check size={14} className="text-th-resolved shrink-0" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-10 p-5 rounded-th-lg border border-th-border bg-th-surface max-w-xs">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-extrabold">₹499</span>
              <span className="text-th-muted text-[13px]">/ month after trial</span>
            </div>
            <p className="text-[12px] text-th-muted">One plan, everything included.</p>
          </div>
        </div>
      </div>
    </div>
  )
}