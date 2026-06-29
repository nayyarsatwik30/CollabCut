'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { MOCK_ME } from '@/lib/mock-data'

type Tab = 'profile' | 'plan' | 'notifications' | 'team'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile')
  const [name, setName] = useState(MOCK_ME.name)
  const [email, setEmail] = useState(MOCK_ME.email)

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Settings</h1>
          <ThemePicker />
        </div>
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left nav */}
          <div className="w-48 shrink-0 border-r border-th-border p-3 space-y-0.5">
            {(['profile','plan','notifications','team'] as Tab[]).map((t) => (
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-lg space-y-6">

              {tab === 'profile' && <>
                <div>
                  <h2 className="text-[16px] font-bold mb-1">Profile</h2>
                  <p className="text-[13px] text-th-muted">How you appear to collaborators.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-extrabold"
                    style={{ background: MOCK_ME.avatarColor, color:'#000' }}>
                    {MOCK_ME.initials}
                  </div>
                  <button className="text-[13px] text-th-accent hover:underline">Change avatar</button>
                </div>
                {[['Full name', name, setName], ['Email', email, setEmail]].map(([label, val, setter]) => (
                  <div key={label as string}>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">{label as string}</label>
                    <input value={val as string} onChange={e => (setter as Function)(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-th bg-th-surface border border-th-border text-[14px] text-th-text outline-none focus:border-th-accent transition-colors" />
                  </div>
                ))}
                <button className="px-5 py-2.5 rounded-th text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
                  style={{ background:'var(--th-accent)', color:'var(--th-accent-fg)' }}>
                  Save changes
                </button>
              </>}

              {tab === 'plan' && <>
                <div>
                  <h2 className="text-[16px] font-bold mb-1">Plan & billing</h2>
                  <p className="text-[13px] text-th-muted">Manage your subscription.</p>
                </div>
                <div className="p-5 rounded-th border border-th-border bg-th-surface">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-bold text-[14px]">Pro Plan</p>
                      <p className="text-[12px] text-th-muted">₹499 / month · renews Jul 25, 2026</p>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-th-full"
                      style={{ background:'color-mix(in srgb, var(--th-resolved) 18%, transparent)', color:'var(--th-resolved)' }}>
                      ACTIVE
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-th-sm text-[12px] font-medium bg-th-surface-alt border border-th-border text-th-text btn-press">Update payment</button>
                    <button className="px-4 py-2 rounded-th-sm text-[12px] font-medium text-th-changes border border-th-changes/40 hover:bg-th-changes/10 transition-colors btn-press">Cancel plan</button>
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-th-muted mb-3">Billing history</p>
                  <div className="bg-th-surface rounded-th border border-th-border overflow-hidden">
                    {['Jun 25, 2026','May 25, 2026','Apr 25, 2026'].map((date) => (
                      <div key={date} className="flex items-center px-5 py-3 border-b border-th-border last:border-b-0 text-[13px]">
                        <span className="flex-1 font-mono text-th-muted">{date}</span>
                        <span className="font-semibold mr-6">₹499</span>
                        <span className="text-th-resolved text-[11px] font-bold font-mono">Paid</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>}

              {tab === 'notifications' && <>
                <div>
                  <h2 className="text-[16px] font-bold mb-1">Notifications</h2>
                  <p className="text-[13px] text-th-muted">Choose what sends you an email.</p>
                </div>
                <div className="bg-th-surface rounded-th border border-th-border overflow-hidden">
                  {[
                    { label:'New note on my asset',   on:true  },
                    { label:'Reply to my note',       on:true  },
                    { label:'Asset approved',         on:true  },
                    { label:'New version uploaded',   on:false },
                    { label:'Review link opened',     on:false },
                  ].map((item) => (
                    <label key={item.label} className="flex items-center gap-4 px-5 py-4 border-b border-th-border last:border-b-0 cursor-pointer hover:bg-th-surface-alt transition-colors">
                      <span className="flex-1 text-[13px]">{item.label}</span>
                      <div className="w-9 h-5 rounded-full relative shrink-0" style={{ background: item.on ? 'var(--th-accent)' : 'var(--th-border)' }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                          style={{ transform: item.on ? 'translateX(18px)' : 'translateX(2px)' }} />
                      </div>
                    </label>
                  ))}
                </div>
              </>}

              {tab === 'team' && <>
                <div>
                  <h2 className="text-[16px] font-bold mb-1">Team</h2>
                  <p className="text-[13px] text-th-muted">People with access to your workspace.</p>
                </div>
                <div className="bg-th-surface rounded-th border border-th-border overflow-hidden">
                  {[
                    { name:'You (Satwik)', email:'satwik@dailies.app', role:'Owner',  color:'#4CAF7D', init:'YS' },
                    { name:'Riya S.',      email:'riya@studio.in',     role:'Editor', color:'#E8A33D', init:'RS' },
                  ].map((m) => (
                    <div key={m.email} className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border last:border-b-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                        style={{ background:m.color, color:'#000' }}>{m.init}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold">{m.name}</p>
                        <p className="text-[11px] text-th-muted">{m.email}</p>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-th-full bg-th-surface-alt border border-th-border text-th-muted">{m.role}</span>
                    </div>
                  ))}
                </div>
                <button className="px-4 py-2.5 rounded-th text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
                  style={{ background:'var(--th-accent)', color:'var(--th-accent-fg)' }}>
                  + Invite team member
                </button>
              </>}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}