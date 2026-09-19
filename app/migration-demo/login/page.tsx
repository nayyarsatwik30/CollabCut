'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { redirect: false, email, password })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password')
      return
    }
    router.push('/migration-demo/dashboard')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CollabCut" className="w-6 h-6 rounded-md" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Welcome back</h1>
          <p className="text-th-muted text-[13px] mb-8">
            No account?{' '}
            <a href="/migration-demo/signup" className="text-th-accent hover:underline">Sign up free</a>
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@studio.in"
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>

            <button type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Logging in…' : <><span>Log in</span> <ArrowRight size={14} /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-th-border text-center">
            <a href="/migration-demo/join" className="text-[12px] text-th-accent hover:underline">Have an invite code? Join a workspace</a>
          </div>
        </div>
      </div>
    </div>
  )
}
