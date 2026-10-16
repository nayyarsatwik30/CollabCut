import './app-theme.css'
import { THEME_BOOT_SCRIPT } from '@/components/layout/theme-boot'
import { ThemeInit } from '@/components/layout/ThemeToggle'

// Authenticated-app shell. Owns the light/dark `data-theme` root; the
// marketing and auth routes live outside this group and never get it.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root h-full" data-theme="light" suppressHydrationWarning>
      {/* Runs synchronously before the content below is painted. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <ThemeInit />
      {children}
    </div>
  )
}
