import type { Metadata } from 'next'
import { Instrument_Sans, Newsreader, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { THEME_BOOT_SCRIPT } from '@/components/layout/theme-boot'

const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const serif = Newsreader({ subsets: ['latin'], variable: '--font-serif', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'CollabCut — Frame-accurate video review',
  description: 'Upload a cut, drop notes on the exact frame, share one link.',
  icons: {
    icon: '/collabcut-mark.png',
    apple: '/collabcut-mark.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme from localStorage / OS preference before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

