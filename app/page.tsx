import { LandingPage } from '@/components/landing/LandingPage'

// Redesigned landing (components/landing). The previous one is still in
// components/collabcut-landing (AgencyLanding / GeneralLanding) and still
// serves /agencies until the redesign is complete.
export default function Page() {
  return <LandingPage />
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

export const viewport = { themeColor: '#000000' }
