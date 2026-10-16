import { AgencyLanding } from '@/components/collabcut-landing'

export default function AgenciesPage() {
  return <AgencyLanding />
}

export const metadata = {
  title: 'CollabCut for agencies — Make the work legible',
  description: 'A clear production workspace for agencies managing clients, editors, and every cut.',
}

export const viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#17191f' }] }
