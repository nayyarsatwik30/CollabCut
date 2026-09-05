'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { supabase } from '@/lib/supabase'

interface EditorRow {
  id: string
  name: string
  email: string
  assetCount: number
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editors, setEditors] = useState<EditorRow[]>([])

  useEffect(() => {
    loadEditors()
  }, [])

  const loadEditors = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    try {
      const res = await fetch('/api/admin/editors', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      const data = await res.json()
      if (!res.ok) {
        // Never redirect on a failed role check (e.g. 403) - that's what caused
        // the /admin <-> /dashboard bounce. Show the error in place instead.
        setError(data.error ?? 'Failed to load team')
      } else {
        setEditors(data.editors ?? [])
      }
    } catch (err) {
      setError('Failed to load team')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Admin</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-[16px] font-bold mb-1">Editors</h2>
              <p className="text-[13px] text-th-muted">Everyone with editor access in your workspace.</p>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                {error}
              </div>
            )}

            {!error && editors.length === 0 && (
              <p className="text-[13px] text-th-muted">No editors in your workspace yet.</p>
            )}

            {editors.length > 0 && (
              <div className="rounded-th-lg border border-th-border bg-th-surface overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_110px] gap-4 px-5 py-2.5 border-b border-th-border font-mono text-[10px] uppercase tracking-wider text-th-muted">
                  <span>Name</span>
                  <span>Email</span>
                  <span className="text-right">Assigned assets</span>
                </div>
                {editors.map((editor) => (
                  <button
                    key={editor.id}
                    onClick={() => router.push(`/admin/editor/${editor.id}`)}
                    className="w-full grid grid-cols-[1fr_1fr_110px] gap-4 px-5 py-3 items-center text-left border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors"
                  >
                    <span className="text-[13px] font-semibold truncate">{editor.name}</span>
                    <span className="text-[13px] text-th-muted truncate">{editor.email}</span>
                    <span className="text-[13px] font-mono text-right">{editor.assetCount}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
