import type { Metadata } from 'next'
import { AgencyLandingPage } from '@/components/landing/AgencyLandingPage'

export const metadata: Metadata = {
  title: 'CollabCut for Agencies',
  description: 'Run your whole editing team out of one workspace — assign editors, manage every client project, and keep review approvals in one place.',
}

export default function AgenciesPage() {
  return <AgencyLandingPage />
}
