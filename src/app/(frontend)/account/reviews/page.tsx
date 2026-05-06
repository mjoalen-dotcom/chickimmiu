import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeMediaUrl } from '@/lib/media-url'

import ReviewsClient, { type AccountReviewLite } from './ReviewsClient'

export const metadata: Metadata = {
  title: '我的評價',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function formatDate(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

export default async function ReviewsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/reviews')

  const result = await payload.find({
    collection: 'product-reviews',
    where: { reviewer: { equals: sessionUser.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 2,
  })

  const reviews: AccountReviewLite[] = (result.docs as unknown as LooseRecord[]).map((doc) => {
    const product = (doc.product as LooseRecord | null) ?? null
    const productName = (product?.name as string) ?? '—'

    const images = (product?.images as { image?: { url?: string } }[] | undefined) ?? []
    const rawImageUrl = images[0]?.image?.url ?? null
    const productImage = rawImageUrl ? normalizeMediaUrl(rawImageUrl) : null

    return {
      id: String(doc.id),
      productName,
      productImage,
      rating: (doc.rating as number) ?? 5,
      title: (doc.title as string) ?? '',
      content: (doc.content as string) ?? '',
      date: formatDate(doc.createdAt),
      status: (doc.status as string) ?? 'pending',
    }
  })

  return <ReviewsClient reviews={reviews} />
}
