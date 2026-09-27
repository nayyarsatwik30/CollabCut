import Link from 'next/link'
import { StaticPage } from '@/components/site/StaticPage'
import { CopyEmailButton } from '@/components/site/CopyEmailButton'

const CONTACT_EMAIL = 'hello.collabcut@gmail.com'
const EMAIL_TARGET_ID = 'contact-email-address'

export default function ContactPage() {
  return (
    <StaticPage>
      <p className="section-kicker">Ready when you are</p>
      <h1>Bring your team into <em>frame.</em></h1>
      <p>
        CollabCut replaces scattered files, messages and status checks with one board your whole team works from — cut, edit, review, revision, approved. Tell us a bit about your agency and how you review work today, and we&rsquo;ll set up a workspace built around it.
      </p>
      <div className="static-card">
        <h2>Reach us directly</h2>
        <span id={EMAIL_TARGET_ID} className="static-email">{CONTACT_EMAIL}</span>
        <div className="static-email-row">
          <CopyEmailButton email={CONTACT_EMAIL} targetId={EMAIL_TARGET_ID} />
          <Link className="cc-button secondary" href={`mailto:${CONTACT_EMAIL}`}>Open in mail app</Link>
        </div>
      </div>
      <div className="static-card">
        <h2>What to include</h2>
        <ul>
          <li>Agency name and team size</li>
          <li>How you review and approve cuts today</li>
          <li>A link to a sample project, if you have one</li>
        </ul>
      </div>
      <div className="static-footnotes">
        <Link className="text-link" href="/auth/signup/agency">Already onboarding? Create your workspace</Link>
        <Link className="text-link" href="/auth/login">Sign in</Link>
      </div>
    </StaticPage>
  )
}

export const metadata = {
  title: 'Contact — CollabCut',
  description: 'Get in touch with CollabCut to set up a production workspace for your agency.',
}

export const viewport = { themeColor: '#1a1416' }
