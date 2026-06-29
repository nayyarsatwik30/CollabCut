'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
  className?: string
}

export function Modal({ open, onClose, title, children, width = '360px', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          'relative m-3 mt-14 rounded-th-lg border border-th-border bg-th-surface',
          'shadow-panel animate-slide-up overflow-hidden',
          className,
        )}
        style={{ width }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
            <h3 className="font-semibold text-[15px]">{title}</h3>
            <button onClick={onClose} className="text-th-muted hover:text-th-text transition-colors p-1 rounded-th-sm hover:bg-th-surface-alt">
              <X size={15} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
