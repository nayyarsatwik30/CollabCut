'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { supabase } from '@/lib/supabase'

type Tab = 'profile' | 'plan' | 'notifications' | 'team'

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('profile')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setName(session.user.user_metadata?.name ?? '')
    setEmail(session.user.email ?? '')
    setLoading(false)
  }

  const saveChanges = async () => {
    await supabase.auth.updateUser({ data: { name } })
  }

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Settings</h1>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-48 shrink-0 border-r border-th-border p-3 space-y-0.5">
            {(['profile', 'plan', 'notifications', 'team'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="w-full text-left px-3 py-2 rounded-th-sm text-[13px] transition-colors capitalize"
                style={{
                  background: tab === t ? 'var(--th-surface-alt)' : 'transparent',
                  color: tab === t ? 'var(--th-text)' : 'var(--th-muted)',
                  fontWeight: tab === t ? 600 : 400,
                }}>
                {t === 'plan' ? 'Plan & billing' : t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-lg space-y-6">
              {tab === 'profile' && (
                <>
                  <div>
                    <h2 className="text-[16px] font-bold mb-1">Profile</h2>
                    <p className="text-[13px] text-th-muted">How you appear to collaborators.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-extrabold"
                      style={{ background: '#4CAF7D', color: '#000' }}>
                      {name?.[0]?.toUpperCase() ?? email[0]?.toUpperCase() ?? 'U'}
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Full name</label>
                    <input value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text outline-none focus:border-th-accent transition-colors" />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Email</label>
                    <input value={email} disabled
                      className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-muted outline-none cursor-not-allowed" />
                  </div>
                  <button onClick={saveChanges}
                    className="px-5 py-2.5 rounded-th text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)' }}>
                    Save changes
                  </button>
                </>
              )}

              {tab === 'plan' && (
                <>
                  <div>
                    <h2 className="text-[16px] font-bold mb-1">Plan & billing</h2>
                    <p className="text-[13px] text-th-muted">Billing integration coming soon.</p>
                  </div>
                  <div className="p-5 rounded-th border border-th-border bg-th-surface">
                    <p className="font-bold text-[14px]">Free trial</p>
                    <p className="text-[12px] text-th-muted mt-1">No payment method on file.</p>
                  </div>
                </>
              )}

              {tab === 'notifications' && (
                <>
                  <div>
                    <h2 className="text-[16px] font-bold mb-1">Notifications</h2>
                    <p className="text-[13px] text-th-muted">Notification preferences coming soon.</p>
                  </div>
                </>
              )}

              {tab === 'team' && (
                <>
                  <div>
                    <h2 className="text-[16px] font-bold mb-1">Team</h2>
                    <p className="text-[13px] text-th-muted">Team invites are managed per-project for now.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
