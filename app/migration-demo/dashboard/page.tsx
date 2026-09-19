'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface Project {
  id: string
  name: string
  client: string | null
  status: string
  emoji: string
  created_at: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/migration-demo/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/auth-migration/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : [])
        setLoaded(true)
      })
  }, [status])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth-migration/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, client: client || undefined }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to create project')
      return
    }
    const project = await res.json()
    setProjects((prev) => [project, ...prev])
    setName('')
    setClient('')
  }

  if (status === 'loading' || !loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
      </div>
    )
  }
  if (status !== 'authenticated') return null

  return (
    <div>
      <header className="h-14 border-b border-th-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CollabCut" className="w-6 h-6 rounded-md" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-th-muted">{session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: '/migration-demo/login' })}
            className="h-8 px-3 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-muted btn-press hover:text-th-text transition-colors">
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-extrabold">Projects</h1>
          <a href="/migration-demo/join" className="text-[12px] text-th-accent hover:underline">Join another workspace</a>
        </div>

        {projects.length === 0 && (
          <p className="text-th-muted text-[13px] mb-6">No projects yet — create your first one below.</p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-8">
          {projects.map((p) => (
            <a key={p.id} href={`/migration-demo/project/${p.id}`}
              className="flex flex-col bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover p-4">
              <div className="text-2xl mb-2">{p.emoji}</div>
              <div className="font-semibold text-[14px] truncate">{p.name}</div>
              {p.client && <div className="text-[12px] text-th-muted truncate">{p.client}</div>}
              <div className="mt-2 text-[11px] font-mono uppercase tracking-wide text-th-faint">{p.status}</div>
            </a>
          ))}
        </div>

        <div className="bg-th-surface border border-th-border rounded-th-lg p-5 max-w-sm">
          <h2 className="text-[14px] font-bold mb-4">New project</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-th-muted mb-1.5 font-mono uppercase tracking-wide">Client (optional)</label>
              <input value={client} onChange={(e) => setClient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors" />
            </div>
            <button type="submit"
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-bold btn-press hover:opacity-90 transition-opacity">
              <Plus size={14} /> Create project
            </button>
          </form>
          {error && <p className="mt-3 text-[13px] text-th-changes">{error}</p>}
        </div>
      </div>
    </div>
  )
}
