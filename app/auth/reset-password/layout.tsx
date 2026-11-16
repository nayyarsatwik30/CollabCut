import type { Metadata } from 'next'

// The reset token is in this page's URL: never leak it to third parties via
// the Referer header (fonts, images, outbound links).
export const metadata: Metadata = {
  referrer: 'no-referrer',
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
