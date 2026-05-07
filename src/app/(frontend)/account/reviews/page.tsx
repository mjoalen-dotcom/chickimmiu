import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
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
  } catch { return '' }
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
    depth: 1,
  })

  const reviews: ReviewLite[] = (result.docs as unknown as LooseRecord[]).map((r) => {
    const product = (r.product as LooseRecord | null) ?? null
    const productName = (product?.name as string) ?? '商品'
    const firstImage = (product?.images as { image?: { url?: string } }[] | undefined)?.[0]?.image?.url
    const productImage = firstImage ? (firstImage.startsWith('/') ? firstImage : `/${firstImage}`) : null
    return {
      id: String(r.id),
      product: productName,
      productImage,
      rating: (r.rating as number) ?? 5,
      title: (r.title as string) ?? '',
      content: (r.content as string) ?? '',
      date: formatDate(r.createdAt),
      status: (r.status as string) ?? 'pending',
    }
  })

  return <ReviewsClient reviews={reviews} />
}
