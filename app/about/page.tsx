import Link from 'next/link'
import { StaticPage } from '@/components/site/StaticPage'

export default function AboutPage() {
  return (
    <StaticPage>
      <h1>About CollabCut</h1>
      <p>
        CollabCut is one board that follows a cut from first pass to final approval. Reviewers drop timecoded notes right on the frame, new versions stack instead of overwriting the last one, share links let clients review without creating an account, and a raw footage archive keeps the source material alongside the edit.
      </p>
      <p>
        It&rsquo;s built for agencies and editing teams who currently coordinate their work over scattered files and messages.
      </p>
      <p><Link className="text-link" href="/contact">Get in touch</Link></p>
    </StaticPage>
  )
}

export const metadata = {
  title: 'About — CollabCut',
  description: 'What CollabCut is and who it is built for.',
}

export const viewport = { themeColor: '#1a1416' }
