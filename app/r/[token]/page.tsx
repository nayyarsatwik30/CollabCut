import type { Metadata } from 'next'
import { getPublicShareLink } from '@/lib/share-access'
import PublicReviewClient from './PublicReviewClient'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await getPublicShareLink(params.token)

  if (result.status !== 'ok') {
    return { title: "Link not found — CollabCut" }
  }

  const { shareLink } = result

  // Password-protected links must never leak the real title/thumbnail into
  // a chat/link preview - that would let anyone with the link see what's
  // being shared without ever unlocking it, defeating the password.
  if (shareLink.password_protected) {
    return {
      title: 'A private video is shared with you — CollabCut',
      description: 'This review link is password-protected. Open it to enter the password.',
      openGraph: {
        title: 'A private video is shared with you',
        description: 'This review link is password-protected. Open it to enter the password.',
        siteName: 'CollabCut',
      },
      twitter: {
        card: 'summary',
        title: 'A private video is shared with you',
        description: 'This review link is password-protected. Open it to enter the password.',
      },
    }
  }

  const { asset } = shareLink
  const thumbnail = asset.mux_playback_id
    ? `https://image.mux.com/${asset.mux_playback_id}/thumbnail.jpg?time=1`
    : undefined

  return {
    title: `${asset.name} — CollabCut`,
    openGraph: {
      title: asset.name,
      siteName: 'CollabCut',
      images: thumbnail ? [{ url: thumbnail, width: 1200, height: 675 }] : undefined,
    },
    twitter: {
      card: thumbnail ? 'summary_large_image' : 'summary',
      title: asset.name,
      images: thumbnail ? [thumbnail] : undefined,
    },
  }
}

export default function Page({ params }: Props) {
  return <PublicReviewClient params={params} />
}
