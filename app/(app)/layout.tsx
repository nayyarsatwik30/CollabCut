import { Sidebar } from '@/components/layout/Sidebar'

// One persistent shell for every signed-in page: the sidebar mounts once and
// survives navigation (so its collapsed state, unread count and storage meter
// don't reset or refetch on each route change). Pages render only their own
// content column. Sidebar-less pages (review player, public share) live in
// the (bare) group instead.
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      {children}
    </div>
  )
}
