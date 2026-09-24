'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Copy } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'
import { useSession } from 'next-auth/react'
import { performLogout } from '@/lib/auth'
import { useSessionGuard } from '@/lib/useSessionGuard'
import { useStorageUsage } from '@/lib/useStorageUsage'
import type { WorkspaceStoragePlan } from '@/lib/useStorageUsage'
import { StorageUsageBar } from '@/components/storage/StorageUsageBar'
import { Orb } from '@/components/ui/Orb'

// 'plan' (Plan & billing) is deliberately removed for now: it read the
// per-user profiles.plan_id / plans system, which disagrees with the
// per-workspace workspace_plans the storage bar uses. Rebuild it on top of
// workspace_plans once the two plan systems are unified.
type Tab = 'profile' | 'notifications' | 'team'

export default function SettingsPage() {
  const router = useRouter()
  const { session, ready } = useSessionGuard()
  const { update: updateSession } = useSession()
  const { usedBytes, workspacePlan, loading: usageLoading } = useStorageUsage()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [tab, setTab] = useState<Tab>('profile')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  const [adminWorkspace, setAdminWorkspace] = useState<{ id: string; name: string; invite_code: string; workspacePlan: WorkspaceStoragePlan | null } | null>(null)
  const [provisioningWorkspace, setProvisioningWorkspace] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  useEffect(() => {
    if (ready && session) loadUser()
  }, [ready, session])

  useEffect(() => {
    if (tab === 'team' && !loading && !adminWorkspace && !provisioningWorkspace) {
      ensureWorkspace()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loading])

  const loadUser = async () => {
    if (!session) return
    setName(session.user.user_metadata?.name ?? '')
    setEmail(session.user.email ?? '')

    // Find a workspace where the user is an admin, so we can offer invites
    const workspaceRes = await fetch('/api/workspaces')
    if (workspaceRes.ok) {
      const { workspace } = await workspaceRes.json()
      if (workspace) setAdminWorkspace(workspace)
    }

    setLoading(false)
  }

  const ensureWorkspace = async () => {
    if (!session) return
    setProvisioningWorkspace(true)
    setWorkspaceError('')

    try {
      const res = await fetch('/api/workspaces', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setWorkspaceError(data.error ?? 'Failed to set up your workspace')
      } else {
        setAdminWorkspace(data.workspace)
      }
    } catch (err) {
      setWorkspaceError('Failed to set up your workspace')
    }
    setProvisioningWorkspace(false)
  }

  const saveChanges = async () => {
    const res = await fetch('/api/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      // Refreshes the JWT session so every mounted component reading
      // session.user.name (Sidebar, review page) picks up the new name -
      // see the trigger === 'update' branch in authOptions.ts's jwt callback.
      await updateSession({ name })
    }
  }

  const handleLogout = async () => {
    await performLogout(router)
  }

  const handleLogoutClick = async () => {
    const ok = await confirm({ title: 'Log out of CollabCut?', confirmLabel: 'Yes, log out' })
    if (ok) handleLogout()
  }

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Orb state="working" size={20} label="Loading" />
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
          <div className="w-48 shrink-0 border-r border-th-border p-3 space-y-0.5 flex flex-col">
            {(['profile', 'notifications', 'team'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="w-full text-left px-3 py-2 rounded-th-sm text-[13px] transition-colors capitalize"
                style={{
                  background: tab === t ? 'var(--th-surface-alt)' : 'transparent',
                  color: tab === t ? 'var(--th-text)' : 'var(--th-muted)',
                  fontWeight: tab === t ? 600 : 400,
                }}>
                {t}
              </button>
            ))}
            <div className="pt-2 mt-1 border-t border-th-border">
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-th-sm text-[13px] text-th-muted hover:text-th-changes hover:bg-th-surface-alt transition-colors"
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
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
                  <StorageUsageBar usedBytes={usedBytes} loading={usageLoading} variant="full" workspacePlan={workspacePlan} />
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
                    <p className="text-[13px] text-th-muted">Invite editors to collaborate in your workspace.</p>
                  </div>

                  {!adminWorkspace ? (
                    provisioningWorkspace ? (
                      <div className="flex items-center gap-2 text-[13px] text-th-muted">
                        <div className="w-4 h-4 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                        Setting up your workspace…
                      </div>
                    ) : workspaceError ? (
                      <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                        {workspaceError}
                      </div>
                    ) : (
                      <p className="text-[13px] text-th-muted">
                        You need to be a workspace admin to invite team members.
                      </p>
                    )
                  ) : (
                    <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-3">
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-th-full bg-th-accent/10 border border-th-accent/30 text-th-accent-text font-semibold">
                          {adminWorkspace.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-th-muted block text-[11px] font-mono uppercase mb-2">Workspace code</span>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={adminWorkspace.invite_code}
                            onFocus={e => e.target.select()}
                            className="flex-1 px-3.5 py-2 rounded-th bg-th-surface-alt border border-th-border text-[14px] font-mono uppercase tracking-widest text-th-text outline-none"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(adminWorkspace.invite_code)}
                            className="px-3.5 py-2 rounded-th text-[12px] font-semibold bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov transition-colors btn-press flex items-center gap-1.5"
                          >
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-th-faint">
                          Anyone who signs up with this code joins {adminWorkspace.name} as an editor.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  )
}

