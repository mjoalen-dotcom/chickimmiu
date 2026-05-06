import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeMediaUrl } from '@/lib/media-url'

import { ReviewsClient, type ReviewLite } from './ReviewsClient'

export const metadata: Metadata = {
  title: '我的評價',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

function formatDate(raw: unknown): string {
  if (!raw) return ''
  try {
    const d = new Date(raw as string)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default async function ReviewsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers: headersList })
  if (!sessionUser) redirect('/login?redirect=/account/reviews')

  let reviews: ReviewLite[] = []

  if (process.env.DATABASE_URI) {
    try {
      const result = await payload.find({
        collection: 'product-reviews',
        where: { reviewer: { equals: sessionUser.id } },
        sort: '-createdAt',
        limit: 50,
        depth: 2,
      })

      reviews = (result.docs as unknown as LooseRecord[]).map((doc) => {
        const product = doc.product as LooseRecord | null | undefined
        const photos = doc.photos as LooseRecord[] | null | undefined
        const firstPhoto = photos?.[0]?.image as LooseRecord | null | undefined

        const productImages = product?.images as { image?: { url?: string } }[] | undefined
        const productImg =
          normalizeMediaUrl(firstPhoto?.url as string | undefined) ||
          normalizeMediaUrl(productImages?.[0]?.image?.url) ||
          null

        return {
          id: String(doc.id),
          productName: (product?.name as string) ?? '商品',
          productImage: productImg,
          productSlug: (product?.slug as string) ?? '',
          rating: (doc.rating as number) ?? 0,
          title: (doc.title as string) ?? '',
          content: (doc.content as string) ?? '',
          date: formatDate(doc.createdAt),
          status: ((doc.status as string) ?? 'pending') as ReviewLite['status'],
        }
      })
    } catch {
      // DB not ready — show empty state
    }
  }

  return <ReviewsClient reviews={reviews} />
}
