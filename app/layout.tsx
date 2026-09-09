import type { Metadata } from 'next'
import './globals.css'
import { SessionSync } from '@/components/layout/SessionSync'

export const metadata: Metadata = {
  title: 'CollabCut — Frame-accurate video review',
  description: 'Upload a cut, drop notes on the exact frame, share one link.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionSync />
        {children}
      </body>
    </html>
  )
}

