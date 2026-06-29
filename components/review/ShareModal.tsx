'use client'

import { useState } from 'react'
import { Copy, Lock, Clock, Download, MessageSquare, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  onCopied: () => void
}

export function ShareModal({ open, onClose, onCopied }: ShareModalProps) {
  const [password,     setPassword]     = useState(false)
  const [expiry,       setExpiry]       = useState(false)
  const [noDownload,   setNoDownload]   = useState(false)
  const [commentsOnly, setCommentsOnly] = useState(false)
  const [copied,       setCopied]       = useState(false)

  const link = 'dailies.app/r/singh-mehta-v3-xk9p'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`https://${link}`).catch(() => {})
    setCopied(true)
    onCopied()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Share review link" width="340px">
      <div className="space-y-4">
        <p className="text-[12px] text-th-muted leading-relaxed">
          Anyone with this link can view and leave notes — no Dailies account required.
        </p>

        {/* Link copy */}
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted truncate">
            {link}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-th-sm text-[12px] font-semibold btn-press transition-all"
            style={{
              background: copied ? 'var(--th-resolved)' : 'var(--th-accent)',
              color: copied ? '#fff' : 'var(--th-accent-fg)',
            }}
          >
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>

        {/* Options */}
        <div className="space-y-0 border border-th-border rounded-th overflow-hidden">
          {[
            { icon: Lock,          label: 'Password protect', checked: password,     set: setPassword     },
            { icon: Clock,         label: 'Set expiry date',  checked: expiry,       set: setExpiry       },
            { icon: Download,      label: 'Disable download', checked: noDownload,   set: setNoDownload   },
            { icon: MessageSquare, label: 'Comments only',    checked: commentsOnly, set: setCommentsOnly },
          ].map(({ icon: Icon, label, checked, set }) => (
            <label
              key={label}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors"
            >
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
          ))}
        </div>

        <p className="text-[11px] text-th-faint font-mono text-center">
          Link revokes automatically when subscription lapses.
        </p>
      </div>
    </Modal>
  )
}
