'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.email || !form.password) {
      setError('Email and password are required')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email:    form.email,
      password: form.password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="page-scroll bg-th-bg flex flex-col min-h-screen font-display">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </Link>
        <ThemePicker />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Welcome back</h1>
          <p className="text-th-muted text-[13px] mb-8">
            No account?{' '}
            <Link href="/auth/signup" className="text-th-accent hover:underline">Sign up free</Link>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@studio.in"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-semibold text-th-muted font-mono uppercase tracking-wide">Password</label>
                <Link href="/auth/forgot" className="text-[11px] text-th-accent hover:underline">Forgot password?</Link>
              </div>
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

            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Logging in…' : <><span>Log in</span> <ArrowRight size={14} /></>}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-th-border text-center">
            <p className="text-[11px] text-th-faint font-mono">
              By continuing you agree to our Terms & Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}