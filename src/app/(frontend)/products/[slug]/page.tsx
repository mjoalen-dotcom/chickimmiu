import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ProductDetailClient } from './ProductDetailClient'
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { normalizeMediaUrl } from '@/lib/media-url'

/**
 * 強制每次 request 都重新 render，讓後台編輯可以立刻在前台看到。
 * Products collection 的 afterChange hook 會觸發 revalidatePath，
 * 所以即使之後改為 ISR (revalidate = 60)，後台編輯也會即時反映。
 */
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * 由 slug 找 Product。同時嘗試 raw 與 decodeURIComponent 後的字串，
 * 修「中文 / URL-encoded slug PDP 全 404」事故（Next.js 15 dynamic
 * params 對 percent-encoded UTF-8 的 decode 行為不一致）。
 *
 * PR-δ 後續會在這個 helper 之外加 aliasSlugs fallback + 301 redirect。
 */
async function findProductBySlug(slug: string): Promise<Record<string, unknown> | null> {
  if (!process.env.DATABASE_URI) {
    console.warn('[PDP] DATABASE_URI not set in Next runtime')
    return null
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    decoded = slug
  }
  const candidates = Array.from(new Set([slug, decoded]))

  try {
    const payload = await getPayload({ config })

    for (const cand of candidates) {
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: cand } },
        limit: 1,
        depth: 2,
      })
      if (docs[0]) {
        return docs[0] as unknown as Record<string, unknown>
      }
    }

    // PR-δ placeholder — aliasSlugs fallback 會由 PR-δ 在 page component
    // 內 notFound() 之前另外加（含 301 redirect 到 canonical slug），
    // 不放這個 helper 內。

    console.log('[PDP] miss', { slug, decoded, candidates })
    return null
  } catch (err) {
    console.error('[PDP] payload.find threw:', err)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await findProductBySlug(slug)
  if (!product) return { title: '商品不存在｜CHIC KIM & MIU' }

  const seo = product.seo as unknown as Record<string, unknown> | undefined
  const images = product.images as { image?: { url?: string } }[] | undefined
  const firstImage = normalizeMediaUrl(images?.[0]?.image?.url)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  return {
    title: (seo?.metaTitle as string) || (product.name as string),
    description: (seo?.metaDescription as string) || undefined,
    alternates: { canonical: `${siteUrl}/products/${slug}` },
    openGraph: {
      title: (seo?.metaTitle as string) || (product.name as string),
      description: (seo?.metaDescription as string) || undefined,
      type: 'website',
      url: `${siteUrl}/products/${slug}`,
      images: firstImage ? [{ url: firstImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: (seo?.metaTitle as string) || (product.name as string),
      images: firstImage ? [firstImage] : undefined,
    },
  }
}

// Shape kept in sync with ProductDetailClient.ReviewLite (client renders review.name).
export type ReviewLite = {
  id: string
  name: string
  rating: number
  date: string
  title: string
  content: string
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await findProductBySlug(slug)
  let relatedProducts: Record<string, unknown>[] = []
  let initialReviews: ReviewLite[] = []

  // Read defaultRelatedCount from ProductListSettings (PR-μ)
  let relatedCount = 4
  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const pls = await payload.findGlobal({ slug: 'product-list-settings', depth: 0 })
      const rc = (pls as unknown as { defaultRelatedCount?: number })?.defaultRelatedCount
      if (typeof rc === 'number' && rc >= 0) relatedCount = rc
    } catch { /* use default */ }
  }

  if (product && process.env.DATABASE_URI && relatedCount > 0) {
    try {
      const payload = await getPayload({ config })
      const cat = product.category as unknown as Record<string, unknown> | string | undefined
      const catId = typeof cat === 'string' ? cat : (cat?.id as unknown as string | undefined)
      if (catId) {
        const related = await payload.find({
          collection: 'products',
          where: {
            category: { equals: catId },
            id: { not_equals: product.id },
          },
          limit: relatedCount,
          depth: 2,
        })
        relatedProducts = related.docs as unknown as Record<string, unknown>[]
      }
      // Fallback: if same-category lookup didn't return enough, top up
      // with the most-recent other products so 「同樣的人也買了」 is always
      // populated instead of disappearing on small categories.
      if (relatedProducts.length < relatedCount) {
        const fallback = await payload.find({
          collection: 'products',
          where: { id: { not_equals: product.id } },
          sort: '-createdAt',
          limit: relatedCount,
          depth: 2,
        })
        const seen = new Set(relatedProducts.map((p) => p.id))
        for (const doc of fallback.docs as unknown as Record<string, unknown>[]) {
          if (relatedProducts.length >= relatedCount) break
          if (!seen.has(doc.id)) {
            relatedProducts.push(doc)
            seen.add(doc.id)
          }
        }
      }
    } catch (err) {
      console.error('[PDP] related products query threw:', err)
    }
  }

  // PR-δ：alias fallback — 找不到 canonical slug 時查 aliasSlugs 子表，命中則 301
  if (!product && process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'products',
        where: { 'aliasSlugs.slug': { equals: slug } },
        limit: 1,
        depth: 0,
      })
      const aliasMatch = docs[0] as unknown as Record<string, unknown> | undefined
      if (aliasMatch?.slug && aliasMatch.slug !== slug) {
        redirect(`/products/${aliasMatch.slug as string}`)
      }
    } catch {
      // ignore — notFound() below handles both DB errors and misses
    }
  }

  if (!product) notFound()

  // 顧客評價（只撈 approved）— product 確定存在後再 fetch；shape 對齊 ProductDetailClient.ReviewLite
  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const rvResult = await payload.find({
        collection: 'product-reviews',
        where: {
          and: [
            { product: { equals: product.id } },
            { status: { equals: 'approved' } },
          ],
        },
        sort: '-createdAt',
        limit: 30,
        depth: 1,
      })
      initialReviews = (rvResult.docs as unknown as Record<string, unknown>[]).map((r) => {
        const reviewer = (r.reviewer as Record<string, unknown> | null) ?? null
        const rawName = typeof reviewer?.name === 'string' ? reviewer.name : '顧客'
        const maskedName = rawName.length > 1 ? rawName[0] + '**' : rawName
        const dateStr = (() => {
          try {
            const d = new Date(r.createdAt as string)
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          } catch { return '' }
        })()
        return {
          id: String(r.id),
          name: maskedName,
          rating: (r.rating as number) ?? 5,
          date: dateStr,
          title: (r.title as string) ?? '',
          content: (r.content as string) ?? '',
        }
      })
    } catch (err) {
      console.error('[PDP] reviews query threw:', err)
    }
  }

  const images = product.images as { image?: { url?: string } }[] | undefined
  const firstImage = normalizeMediaUrl(images?.[0]?.image?.url)

  return (
    <>
      <ProductJsonLd
        name={product.name as string}
        price={product.price as number}
        salePrice={product.salePrice as number | undefined}
        slug={slug}
        image={firstImage}
        sku={(product.sku as string) || undefined}
      />
      <BreadcrumbJsonLd
        items={[
          { name: '首頁', href: '/' },
          { name: '全部商品', href: '/products' },
          { name: product.name as string, href: `/products/${slug}` },
        ]}
      />
      <ProductDetailClient product={product} relatedProducts={relatedProducts} initialReviews={initialReviews} />
    </>
  )
}
