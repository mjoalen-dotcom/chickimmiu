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

    // aliasSlugs fallback 由 PR-δ 在 generateMetadata 內也試一次 + 在
    // ProductDetailPage 內 notFound() 之前再試一次（雙保險），不放這個 helper。

    console.log('[PDP] miss', { slug, decoded, candidates })
    return null
  } catch (err) {
    console.error('[PDP] payload.find threw:', err)
    return null
  }
}

/**
 * PR-δ — 由 alias slug 查回 canonical slug。
 * 找不到回 null。同時試 raw 與 decodeURIComponent 兩種候選，與
 * findProductBySlug 對 percent-encoded UTF-8 slug 的處理對齊。
 */
async function findCanonicalByAlias(slug: string): Promise<string | null> {
  if (!process.env.DATABASE_URI) return null

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
        where: { 'aliasSlugs.slug': { equals: cand } },
        limit: 1,
        depth: 0,
      })
      const aliasMatch = docs[0] as unknown as Record<string, unknown> | undefined
      if (aliasMatch?.slug && typeof aliasMatch.slug === 'string') {
        return aliasMatch.slug
      }
    }
  } catch (err) {
    console.error('[PDP] aliasSlugs lookup threw:', err)
  }
  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await findProductBySlug(slug)
  if (!product) {
    // PR-δ: alias fallback 也在 metadata 階段試一次。能在這裡 redirect 比在
    // page component 內 redirect 早，可避免 Next.js 因為已經 stream 而退化成
    // <meta http-equiv="refresh"> 的 fallback。
    const canonical = await findCanonicalByAlias(slug)
    if (canonical && canonical !== slug) {
      redirect(`/products/${canonical}`)
    }
    return { title: '商品不存在｜CHIC KIM & MIU' }
  }

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

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await findProductBySlug(slug)

  // PR-δ: aliasSlugs fallback（雙保險）。generateMetadata 應該已經先試過，
  // 但若那邊因 cache / metadata 路徑沒走到，這裡再守一次。命中且其 canonical
  // 不同 → redirect 到 canonical（在 page component 觸發時 Next 可能會退化成
  // meta-refresh，metadata 階段的 redirect 才會是 HTTP 307）。
  if (!product) {
    const canonical = await findCanonicalByAlias(slug)
    if (canonical && canonical !== slug) {
      redirect(`/products/${canonical}`)
    }
  }

  let relatedProducts: Record<string, unknown>[] = []

  if (product && process.env.DATABASE_URI) {
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
          limit: 4,
          depth: 2,
        })
        relatedProducts = related.docs as unknown as Record<string, unknown>[]
      }
      // Fallback: if same-category lookup didn't return enough, top up
      // with the most-recent other products so 「同樣的人也買了」 is always
      // populated instead of disappearing on small categories.
      if (relatedProducts.length < 4) {
        const fallback = await payload.find({
          collection: 'products',
          where: { id: { not_equals: product.id } },
          sort: '-createdAt',
          limit: 4,
          depth: 2,
        })
        const seen = new Set(relatedProducts.map((p) => p.id))
        for (const doc of fallback.docs as unknown as Record<string, unknown>[]) {
          if (relatedProducts.length >= 4) break
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

  if (!product) notFound()

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
      <ProductDetailClient product={product} relatedProducts={relatedProducts} />
    </>
  )
}
