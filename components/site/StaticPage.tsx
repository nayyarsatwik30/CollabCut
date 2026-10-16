import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo, Footer } from '../collabcut-landing'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LandingScrollUnlock } from '../collabcut-landing-scroll-unlock'

export function StaticPage({ children }: { children: ReactNode }) {
  return (
    <div className="static-page">
      <LandingScrollUnlock />
      <header className="cc-header">
        <Logo />
        <div className="cc-header-actions"><ThemeToggle /><Link className="text-link" href="/">← Back to home</Link></div>
      </header>
      <main className="static-content">{children}</main>
      <Footer />
    </div>
  )
}
