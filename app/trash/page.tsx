'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Trash2, RotateCcw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Project {
    id: string
    name: string
    client: string
    deleted_at: string
}

export default function TrashPage() {
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState<string | null>(null)

    useEffect(() => {
        load()
    }, [])

    const load = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/auth/login'); return }
        setToken(session.access_token)

        const res = await fetch('/api/projects/trash', {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
            const data = await res.json()
            setProjects(data.projects ?? [])
        }
        setLoading(false)
    }

    const restore = async (id: string) => {
        await fetch('/api/projects/trash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: id }),
        })
        setProjects((prev) => prev.filter((p) => p.id !== id))
    }

    const permanentDelete = async (id: string) => {
        if (!confirm('Permanently delete this project? This cannot be undone.')) return
        await fetch(`/api/projects/trash?project_id=${id}`, { method: 'DELETE' })
        setProjects((prev) => prev.filter((p) => p.id !== id))
    }

    return (
        <div className="flex h-screen overflow-hidden bg-th-bg">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center px-6">
                    <h1 className="text-[15px] font-bold">Recycle Bin</h1>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                            <Trash2 size={28} className="text-th-faint" />
                            <p className="font-semibold">Recycle bin is empty</p>
                            <p className="text-[13px] text-th-muted">Deleted projects will show up here.</p>
                        </div>
                    ) : (
                        <div className="max-w-2xl bg-th-surface rounded-th border border-th-border overflow-hidden">
                            {projects.map((p) => (
                                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold truncate">{p.name}</p>
                                        <p className="text-[11px] text-th-muted">Deleted {new Date(p.deleted_at).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => restore(p.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text btn-press hover:bg-th-surface-hov transition-colors">
                                        <RotateCcw size={12} /> Restore
                                    </button>
                                    <button onClick={() => permanentDelete(p.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-th-sm text-[12px] text-th-changes border border-th-changes/40 hover:bg-th-changes/10 transition-colors btn-press">
                                        <X size={12} /> Delete forever
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}