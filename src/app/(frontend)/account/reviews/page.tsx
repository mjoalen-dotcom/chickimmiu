import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeMediaUrl } from '@/lib/media-url'

import ReviewsClient, { type AccountReviewLite, type PurchasableProduct } from './ReviewsClient'

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
    const productImage = rawImageUrl ? (normalizeMediaUrl(rawImageUrl) ?? null) : null

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

  // 已購商品（撰寫評價下拉用）— 從訂單 items 收集 distinct product，排除已評價過的
  const orderResult = await payload.find({
    collection: 'orders',
    where: { customer: { equals: sessionUser.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
  })
  const reviewedProductIds = new Set(
    (result.docs as unknown as LooseRecord[]).map((d) => {
      const p = d.product as LooseRecord | string | null
      return typeof p === 'object' && p ? String(p.id) : String(p ?? '')
    }),
  )
  const purchasedMap = new Map<string, PurchasableProduct>()
  for (const order of orderResult.docs as unknown as LooseRecord[]) {
    const items = (order.items as LooseRecord[] | undefined) ?? []
    for (const it of items) {
      const prod = it.product as LooseRecord | string | null
      const pid = typeof prod === 'object' && prod ? String(prod.id) : typeof prod === 'string' ? prod : ''
      if (!pid || reviewedProductIds.has(pid)) continue
      const pname =
        (typeof prod === 'object' && prod ? (prod.name as string) : undefined) ||
        (it.productName as string) ||
        '商品'
      if (!purchasedMap.has(pid)) purchasedMap.set(pid, { id: pid, name: pname })
    }
  }
  const purchasable = [...purchasedMap.values()]

  return <ReviewsClient reviews={reviews} purchasable={purchasable} />
}
