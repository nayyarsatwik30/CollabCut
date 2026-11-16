'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from '@/components/ui/icons'
import { IconButton } from '@/components/ui/IconButton'

export interface ToastData {
  id: string
  message: string
  type?: 'info' | 'success' | 'error'
}

interface ToastProps {
  toast: ToastData | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDismiss, 2800)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  // Palette only: lime for success, the danger colour for errors, muted for info.
  const dotColor = toast.type === 'error' ? 'bg-th-danger' : toast.type === 'success' ? 'bg-th-accent' : 'bg-th-muted'

  return (
    <div
      className={cn(
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-[999]',
        'flex items-center gap-2.5 px-4 py-2.5',
        'bg-th-surface border border-th-border rounded-th-full',
        'text-th-text text-sm font-medium whitespace-nowrap',
        'shadow-panel animate-toast-in',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      {toast.message}
      <IconButton onClick={onDismiss} label="Dismiss" size="sm" className="ml-1">
        <X size={13} />
      </IconButton>
    </div>
  )
}

// Simple hook for toast management
import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null)

  const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
    setToast({ id: Date.now().toString(), message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}
