import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CollabCut — Frame-accurate video review',
  description: 'Upload a cut, drop notes on the exact frame, share one link.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

