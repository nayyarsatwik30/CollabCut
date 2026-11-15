import { LandingPage } from '@/components/landing/LandingPage'

// Same page as `/`: the agency landing is the landing.
export default function AgenciesPage() {
  return <LandingPage />
}

export const metadata = {
  title: 'CollabCut for agencies — Make the work legible',
  description: 'A clear production workspace for agencies managing clients, editors, and every cut.',
}

export const viewport = { themeColor: '#000000' }
