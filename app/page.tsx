import { AgencyLanding } from '@/components/collabcut-landing'

// Individual landing hidden until agency phase completes; restore by
// rendering <GeneralLanding /> here (still exported from
// components/collabcut-landing) instead of <AgencyLanding />.
export default function Page() {
  return <AgencyLanding />
}

export const metadata = {
  title: 'CollabCut for agencies — Make the work legible',
  description: 'A clear production workspace for agencies managing clients, editors, and every cut.',
  openGraph: {
    title: 'CollabCut for agencies — Make the work legible',
    description: 'A clear production workspace for agencies managing clients, editors, and every cut.',
    url: 'https://collabcut.in',
    siteName: 'CollabCut',
    type: 'website',
  },
}

export const viewport = { themeColor: '#1a1416' }
