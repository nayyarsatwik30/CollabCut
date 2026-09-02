'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { supabase } from '@/lib/supabase'

type Tab = 'profile' | 'plan' | 'notifications' | 'team'

interface Plan {
  id: string
  name: string
  storage_gb: number
  recycle_bin_gb: number
  price_monthly: number
  price_yearly: number
  features: string[]
  link_expiration: boolean
  priority_support: boolean
  collaborative_storage: boolean
  sort_order: number
}

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('profile')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  const [userPlanId, setUserPlanId] = useState<string>('basic')
  const [plans, setPlans] = useState<Plan[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [updatingPlan, setUpdatingPlan] = useState(false)
  const [modalBillingCycle, setModalBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const [adminWorkspace, setAdminWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole] = useState<'editor'>('editor')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setName(session.user.user_metadata?.name ?? '')
    setEmail(session.user.email ?? '')

    // Fetch user's plan_id from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_id')
      .eq('id', session.user.id)
      .single()

    if (profile?.plan_id) {
      setUserPlanId(profile.plan_id)
    }

    // Fetch all plans from /api/plans
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      if (data.plans) {
        setPlans(data.plans)
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err)
    }

    // Find a workspace where the user is an admin, so we can offer invites
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (membership) {
      const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces
      setAdminWorkspace({ id: membership.workspace_id, name: workspace?.name ?? 'Workspace' })
    }

    setLoading(false)
  }

  const sendInvite = async () => {
    setInviteError('')
    setInviteLink('')
    if (!adminWorkspace) return
    if (!inviteEmail.trim()) {
      setInviteError('Enter an email address')
      return
    }

    setSendingInvite(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setInviteError('Your session expired. Please log in again.')
      setSendingInvite(false)
      return
    }

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ workspace_id: adminWorkspace.id, email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to send invite')
      } else {
        setInviteLink(data.url)
        setInviteEmail('')
      }
    } catch (err) {
      setInviteError('Failed to send invite')
    }
    setSendingInvite(false)
  }

  const saveChanges = async () => {
    await supabase.auth.updateUser({ data: { name } })
  }

  const handleSelectPlan = async (newPlanId: string) => {
    setUpdatingPlan(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan_id: newPlanId })
        .eq('id', session.user.id)

      if (!error) {
        setUserPlanId(newPlanId)
        setIsModalOpen(false)
      } else {
        console.error('Failed to update plan:', error)
      }
    }
    setUpdatingPlan(false)
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
                    <p className="text-[13px] text-th-muted">Manage your subscription plan and storage limit.</p>
                  </div>

                  {(() => {
                    const currentPlan = plans.find((p) => p.id === userPlanId) || plans[0]
                    const storageText = currentPlan
                      ? currentPlan.storage_gb >= 1000
                        ? `${currentPlan.storage_gb / 1000} TB`
                        : `${currentPlan.storage_gb} GB`
                      : '200 GB'

                    return (
                      <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-th-full bg-th-accent/10 border border-th-accent/30 text-th-accent font-semibold">
                              Current Plan
                            </span>
                            <h3 className="text-xl font-bold mt-2">{currentPlan?.name ?? 'Basic'}</h3>
                          </div>
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 rounded-th text-[13px] font-semibold bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov transition-colors btn-press"
                          >
                            Change plan
                          </button>
                        </div>

                        <div className="pt-3 border-t border-th-border grid grid-cols-2 gap-4 text-[13px]">
                          <div>
                            <span className="text-th-muted block text-[11px] font-mono uppercase">Price</span>
                            <span className="font-bold text-base">
                              ₹{currentPlan?.price_monthly ?? 0}
                              <span className="text-[12px] font-normal text-th-muted">/month</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-th-muted block text-[11px] font-mono uppercase">Storage</span>
                            <span className="font-bold text-base">{storageText}</span>
                          </div>
                        </div>

                        {currentPlan?.features && (
                          <div className="pt-3 border-t border-th-border">
                            <span className="text-th-muted block text-[11px] font-mono uppercase mb-2">Included Features</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {currentPlan.features.map((feat, i) => (
                                <div key={i} className="flex items-center gap-2 text-[12px]">
                                  <Check size={14} className="text-th-accent shrink-0" />
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
                    <p className="text-[13px] text-th-muted">
                      You need to be a workspace admin to invite team members.
                    </p>
                  ) : (
                    <div className="p-6 rounded-th-lg border border-th-border bg-th-surface space-y-4">
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-th-full bg-th-accent/10 border border-th-accent/30 text-th-accent font-semibold">
                          {adminWorkspace.name}
                        </span>
                      </div>

                      {inviteError && (
                        <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                          {inviteError}
                        </div>
                      )}

                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Email</label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="editor@studio.in"
                            className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Role</label>
                          <select
                            value={inviteRole}
                            disabled
                            className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text outline-none cursor-not-allowed"
                          >
                            <option value="editor">Editor</option>
                          </select>
                        </div>
                        <button
                          onClick={sendInvite}
                          disabled={sendingInvite}
                          className="px-5 py-2.5 rounded-th text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
                          style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)' }}
                        >
                          {sendingInvite ? 'Sending…' : 'Send invite'}
                        </button>
                      </div>

                      {inviteLink && (
                        <div className="pt-3 border-t border-th-border">
                          <span className="text-th-muted block text-[11px] font-mono uppercase mb-2">Invite link</span>
                          <div className="flex items-center gap-2">
                            <input
                              readOnly
                              value={inviteLink}
                              onFocus={e => e.target.select()}
                              className="flex-1 px-3.5 py-2 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text outline-none"
                            />
                            <button
                              onClick={() => navigator.clipboard.writeText(inviteLink)}
                              className="px-3.5 py-2 rounded-th text-[12px] font-semibold bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov transition-colors btn-press"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="mt-2 text-[11px] text-th-faint">Share this link with the invitee. It expires in 7 days.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-th-surface border border-th-border rounded-th-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-th-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Choose your plan</h2>
                <p className="text-[13px] text-th-muted">Select a plan to update your workspace storage and features.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-th hover:bg-th-surface-alt text-th-muted hover:text-th-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Toggle Switch */}
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 p-1 rounded-th-full bg-th-surface-alt border border-th-border">
                  <button
                    onClick={() => setModalBillingCycle('monthly')}
                    className={`px-4 py-1.5 rounded-th-full text-[13px] font-semibold transition-all ${
                      modalBillingCycle === 'monthly'
                        ? 'bg-th-surface text-th-text shadow-sm'
                        : 'text-th-muted hover:text-th-text'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setModalBillingCycle('yearly')}
                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-th-full text-[13px] font-semibold transition-all ${
                      modalBillingCycle === 'yearly'
                        ? 'bg-th-surface text-th-text shadow-sm'
                        : 'text-th-muted hover:text-th-text'
                    }`}
                  >
                    Yearly
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-th-full bg-th-accent/20 text-th-accent border border-th-accent/30">
                      Save ~17%
                    </span>
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((plan) => {
                  const isCurrent = plan.id === userPlanId
                  const isPro = plan.id === 'pro'
                  const price = modalBillingCycle === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12)
                  const storageText = plan.storage_gb >= 1000 ? `${plan.storage_gb / 1000} TB storage` : `${plan.storage_gb} GB storage`

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-th-lg p-5 flex flex-col justify-between border transition-all ${
                        isCurrent
                          ? 'border-th-accent bg-th-surface-alt/80 shadow-lg'
                          : isPro
                          ? 'border-th-border bg-th-surface-alt/40 hover:border-th-accent/50'
                          : 'border-th-border bg-th-surface-alt/20 hover:border-th-border/80'
                      }`}
                    >
                      {isPro && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-th-full bg-gradient-cta text-white text-[10px] font-bold tracking-wider uppercase shadow-md">
                          Most Popular
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-th-full bg-th-accent text-white text-[10px] font-bold tracking-wider uppercase shadow-md">
                          Current Plan
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold">{plan.name}</h3>
                          <span className="text-[11px] font-mono text-th-muted px-2 py-0.5 rounded-th-full bg-th-surface border border-th-border">
                            {storageText}
                          </span>
                        </div>

                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-extrabold">₹{price}</span>
                          <span className="text-th-muted text-[12px]">
                            {modalBillingCycle === 'monthly' ? '/month' : '/month billed yearly'}
                          </span>
                        </div>
                        {modalBillingCycle === 'yearly' && (
                          <p className="text-[10px] text-th-muted mb-4">₹{plan.price_yearly} billed annually</p>
                        )}
                        {modalBillingCycle === 'monthly' && (
                          <p className="text-[10px] text-th-muted mb-4">Cancel anytime</p>
                        )}

                        <div className="space-y-2 mb-6">
                          {plan.features?.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-[12px] text-th-text/90">
                              <Check size={14} className="text-th-accent shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        disabled={isCurrent || updatingPlan}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`w-full py-2.5 px-4 rounded-th font-semibold text-[13px] transition-all btn-press ${
                          isCurrent
                            ? 'bg-th-surface border border-th-border text-th-muted cursor-default'
                            : isPro
                            ? 'bg-gradient-cta text-white hover:opacity-95 shadow-md'
                            : 'bg-th-surface border border-th-border text-th-text hover:bg-th-surface-hov'
                        }`}
                      >
                        {isCurrent ? 'Current Plan' : updatingPlan ? 'Updating...' : 'Select Plan'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

