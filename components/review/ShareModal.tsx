'use client'

import { useEffect, useState } from 'react'
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
  const [error, setError]     = useState('')
  // True whenever the displayed link no longer reflects the current
  // toggle/password/expiry state - forces an explicit Regenerate instead
  // of ever silently showing a link that doesn't match its own settings.
  const [stale, setStale] = useState(false)

  const generateLink = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asset_id: assetId,
          downloads_disabled: noDownload,
          comments_only: commentsOnly,
          expires_at: expiry && expiryValue ? new Date(expiryValue).toISOString() : null,
          password: password && passwordValue ? passwordValue : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to generate link'); return }
      setLink(data.url)
      setStale(false)
    } catch {
      setError('Failed to generate link')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      if (!link && !loading) generateLink()
    } else {
      setLink(null)
      setStale(false)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markStale = () => { if (link || loading) setStale(true) }

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

        {/* Link copy */}
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted truncate">
            {loading ? 'Generating link…' : link ?? '—'}
          </div>
          {stale ? (
            <button
              onClick={generateLink}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-th-sm text-[12px] font-semibold btn-press transition-all bg-th-accent text-th-accent-fg disabled:opacity-50"
            >
              <RefreshCw size={13} /> Regenerate
            </button>
          ) : (
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
          )}
        </div>

        {stale && (
          <p className="text-[11px] text-th-changes -mt-2">
            Settings changed — regenerate to update the link.
          </p>
        )}
        {error && <p className="text-[11px] text-th-changes -mt-2">{error}</p>}

        {/* Options */}
        <div className="space-y-0 border border-th-border rounded-th overflow-hidden">
          {[
            { icon: Lock,          label: 'Password protect', checked: password,     set: (v: boolean) => { setPassword(v); markStale() } },
            { icon: Clock,         label: 'Set expiry date',  checked: expiry,       set: (v: boolean) => { setExpiry(v); markStale() } },
            { icon: Download,      label: 'Disable download', checked: noDownload,   set: (v: boolean) => { setNoDownload(v); markStale() } },
            { icon: MessageSquare, label: 'Comments only',    checked: commentsOnly, set: (v: boolean) => { setCommentsOnly(v); markStale() } },
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
                    onChange={(e) => { setPasswordValue(e.target.value); markStale() }}
                    placeholder="Set a password"
                    className="w-full px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                  />
                </div>
              )}

              {label === 'Set expiry date' && checked && (
                <div className="px-4 pb-3">
                  <input
                    type="datetime-local"
                    value={expiryValue}
                    onChange={(e) => { setExpiryValue(e.target.value); markStale() }}
                    className="w-full px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text outline-none focus:border-th-accent transition-colors"
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
