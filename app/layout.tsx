import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/layout/AuthProvider'

export const metadata: Metadata = {
  title: 'CollabCut — Frame-accurate video review',
  description: 'Upload a cut, drop notes on the exact frame, share one link.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

