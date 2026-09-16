'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Lock, Clock, Download, MessageSquare, Check, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface ShareModalProps {
  open: boolean
  assetId: string
  token: string
  onClose: () => void
  onCopied: () => void
}

export function ShareModal({ open, assetId, token, onClose, onCopied }: ShareModalProps) {
  const [password,      setPassword]      = useState(false)
  const [passwordValue, setPasswordValue] = useState('')
  const [expiry,        setExpiry]        = useState(false)
  const [expiryValue,   setExpiryValue]   = useState('')
  const [noDownload,    setNoDownload]    = useState(false)
  const [commentsOnly,  setCommentsOnly]  = useState(false)
  const [copied,        setCopied]        = useState(false)

  const [link, setLink]       = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError]     = useState('')

  // Whether the server currently has a password hash saved for this link -
  // separate from the `password` toggle, since the toggle can be on with the
  // field left blank (meaning "keep the existing one").
  const [serverPasswordProtected, setServerPasswordProtected] = useState(false)

  // Set while hydrating toggle state from the server (on open, or right
  // after Regenerate) so that the write triggers the hydration itself, not a
  // spurious autosave PATCH.
  const suppressAutosave = useRef(false)

  const hydrate = (data: { url: string; expires_at: string | null; downloads_disabled: boolean; comments_only: boolean; password_protected: boolean }) => {
    suppressAutosave.current = true
    setLink(data.url)
    setPassword(data.password_protected)
    setServerPasswordProtected(data.password_protected)
    setPasswordValue('')
    setExpiry(!!data.expires_at)
    setExpiryValue(data.expires_at ? toLocalInputValue(data.expires_at) : '')
    setNoDownload(data.downloads_disabled)
    setCommentsOnly(data.comments_only)
    // Release after this render cycle's state updates have committed, so the
    // autosave effect's dependency change from hydration doesn't fire a PATCH.
    requestAnimationFrame(() => { suppressAutosave.current = false })
  }

  const ensureLink = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ asset_id: assetId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load link'); return }
      hydrate(data)
    } catch {
      setError('Failed to load link')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      if (!link && !loading) ensureLink()
    } else {
      setLink(null)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Auto-save: any toggle/value change debounces into a PATCH against the
  // existing row - same token, never regenerates. Skipped while hydrating.
  useEffect(() => {
    if (!open || !link || suppressAutosave.current) return
    const timeout = setTimeout(() => { saveSettings() }, 500)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, passwordValue, expiry, expiryValue, noDownload, commentsOnly])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        asset_id: assetId,
        downloads_disabled: noDownload,
        comments_only: commentsOnly,
        expires_at: expiry && expiryValue ? new Date(expiryValue).toISOString() : null,
      }
      if (!password) body.password = null
      else if (passwordValue) body.password = passwordValue
      // else: toggle on, field blank -> omit `password` entirely, keep existing hash

      const res = await fetch('/api/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        setServerPasswordProtected(data.password_protected)
      }
    } finally {
      setSaving(false)
    }
  }

  // Blocked when password protection is on but we have no plaintext to carry
  // into the new row (existing protected link, field never retyped) - we can
  // never move a hash forward, only silently drop protection or refuse. We
  // refuse, and ask for the password again.
  const regenerateBlocked = password && serverPasswordProtected && !passwordValue

  const handleRegenerate = async () => {
    if (regenerateBlocked) return
    setRegenerating(true)
    setError('')
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asset_id: assetId,
          regenerate: true,
          downloads_disabled: noDownload,
          comments_only: commentsOnly,
          expires_at: expiry && expiryValue ? new Date(expiryValue).toISOString() : null,
          password: password && passwordValue ? passwordValue : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to regenerate link'); return }
      hydrate(data)
    } catch {
      setError('Failed to regenerate link')
    } finally {
      setRegenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    onCopied()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Share review link" width="340px">
      <div className="space-y-4">
        <p className="text-[12px] text-th-muted leading-relaxed">
          Anyone with this link can view and leave notes — no COLLABCUT account required.
        </p>

        {/* Link copy + regenerate */}
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted truncate">
            {loading ? 'Loading link…' : link ?? '—'}
          </div>
          <button
            onClick={handleCopy}
            disabled={loading || !link}
            className="flex items-center gap-1.5 px-3 py-2 rounded-th-sm text-[12px] font-semibold btn-press transition-all disabled:opacity-50"
            style={{
              background: copied ? 'var(--th-resolved)' : 'var(--th-accent)',
              color: copied ? '#fff' : 'var(--th-accent-fg)',
            }}
          >
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>

        <div className="flex items-center justify-between -mt-2">
          <span className="text-[11px] text-th-faint">
            {saving ? 'Saving…' : 'Settings save automatically'}
          </span>
          <button
            onClick={handleRegenerate}
            disabled={loading || regenerating || !link || regenerateBlocked}
            title={regenerateBlocked ? 'Retype the password to include it in the new link' : undefined}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-th-sm text-[11px] font-semibold btn-press transition-all bg-th-surface-alt border border-th-border text-th-text hover:border-th-accent hover:text-th-accent disabled:opacity-50"
          >
            <RefreshCw size={12} className={regenerating ? 'animate-spin' : undefined} /> Regenerate
          </button>
        </div>

        {regenerateBlocked && (
          <p className="text-[11px] text-th-changes -mt-2">
            Retype the password to include it in the new link.
          </p>
        )}
        {error && <p className="text-[11px] text-th-changes -mt-2">{error}</p>}

        {/* Options */}
        <div className="space-y-0 border border-th-border rounded-th overflow-hidden">
          {[
            { icon: Lock,          label: 'Password protect', checked: password,     set: setPassword },
            { icon: Clock,         label: 'Set expiry date',  checked: expiry,       set: setExpiry },
            { icon: Download,      label: 'Disable download', checked: noDownload,   set: setNoDownload },
            { icon: MessageSquare, label: 'Comments only',    checked: commentsOnly, set: setCommentsOnly },
          ].map(({ icon: Icon, label, checked, set }) => (
            <div key={label} className="border-b border-th-border last:border-b-0">
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-th-surface-alt transition-colors">
                <Icon size={13} className="text-th-muted shrink-0" />
                <span className="flex-1 text-[13px]">{label}</span>
                <div
                  onClick={() => set(!checked)}
                  className="w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0"
                  style={{ background: checked ? 'var(--th-accent)' : 'var(--th-border)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
                  />
                </div>
              </label>

              {label === 'Password protect' && checked && (
                <div className="px-4 pb-3">
                  <input
                    type="password"
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    placeholder={serverPasswordProtected ? 'Leave blank to keep current password' : 'Set a password'}
                    className="w-full px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                  />
                  {serverPasswordProtected && !passwordValue && (
                    <p className="text-[11px] text-th-faint mt-1.5">
                      Password is set — leave blank to keep it, or type a new one to change it.
                    </p>
                  )}
                </div>
              )}

              {label === 'Set expiry date' && checked && (
                <div className="px-4 pb-3">
                  <input
                    type="datetime-local"
                    value={expiryValue}
                    onChange={(e) => setExpiryValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text outline-none focus:border-th-accent transition-colors [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded [&::-webkit-calendar-picker-indicator]:p-1.5 [&::-webkit-calendar-picker-indicator]:scale-125"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-th-faint font-mono text-center">
          Link revokes automatically when subscription lapses.
        </p>
      </div>
    </Modal>
  )
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, not the ISO
// UTC string the server returns.
function toLocalInputValue(isoString: string): string {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
