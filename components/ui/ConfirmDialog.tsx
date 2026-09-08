'use client'

import { useCallback, useState } from 'react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

const INITIAL_STATE: ConfirmState = { open: false, title: '' }

// Mirrors the Toast/useToast pairing: one hook owns the pending-confirmation
// state and resolves a promise with the user's choice, one component renders
// whatever is currently pending. Callers just `await confirm({...})`.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(INITIAL_STATE)
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(INITIAL_STATE)
  }, [state])

  return { confirmState: state, confirm, handleConfirm, handleCancel }
}

interface ConfirmDialogProps {
  state: ConfirmState
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ state, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!state.open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-th-surface border border-th-border rounded-th-lg max-w-sm w-full shadow-2xl p-5 animate-slide-up">
        <h2 className="text-[15px] font-bold mb-1.5">{state.title}</h2>
        {state.message && <p className="text-[13px] text-th-muted mb-5">{state.message}</p>}
        <div className="flex items-center justify-end gap-2.5 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-th text-[13px] font-semibold bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov transition-colors btn-press"
          >
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-th text-[13px] font-bold bg-th-changes text-white hover:opacity-90 transition-opacity btn-press"
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
