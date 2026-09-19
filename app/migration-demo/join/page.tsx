'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function JoinPage() {
  const { status } = useSession()
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/migration-demo/login')
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    const res = await fetch('/api/auth-migration/workspaces/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode }),
    })
    const body = await res.json()
    if (!res.ok) {
      setError(body.error ?? 'Failed to join workspace')
      return
    }
    setMessage(`Joined "${body.workspaceName}" as ${body.role}`)
  }

  if (status !== 'authenticated') return null

  return (
    <div>
      <header className="h-14 border-b border-th-border flex items-center px-6 shrink-0">
        <a href="/migration-demo/dashboard" className="flex items-center gap-2 text-[13px] text-th-muted hover:text-th-text transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </a>
      </header>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold mb-1">Join a workspace</h1>
          <p className="text-th-muted text-[13px] mb-8">Enter the invite code someone shared with you.</p>

          {message && (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-resolved/10 border border-th-resolved/40 text-th-resolved text-[13px]">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Invite code</label>
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>

            <button type="submit"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-th bg-th-accent text-th-accent-fg font-bold text-[14px] btn-press hover:opacity-90 transition-opacity">
              <span>Join</span> <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
