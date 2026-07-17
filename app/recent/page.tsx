'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Asset {
  id: string
  name: string
  created_at: string
}

export default function RecentPage() {
  const router = useRouter()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecent()
  }, [])

  const loadRecent = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    const { data, error } = await supabase
      .from('assets')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!error && data) setAssets(data)
    setLoading(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Recent</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Clock size={28} className="text-th-faint" />
              <p className="font-semibold">No recent activity</p>
              <p className="text-[13px] text-th-muted">Assets you view will show up here.</p>
            </div>
          ) : (
            <div className="bg-th-surface rounded-th border border-th-border overflow-hidden max-w-2xl">
              {assets.map((a) => (
                <Link
                  key={a.id}
                  href={`/review/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors"
                >
                  <span className="text-xl">🎞️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate">{a.name}</p>
                    <p className="text-[11px] text-th-muted font-mono">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <Clock size={13} className="text-th-faint" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
