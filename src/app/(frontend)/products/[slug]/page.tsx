import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
    })
    const product = docs[0] as unknown as Record<string, unknown> | undefined
    if (!product) return { title: '商品不存在' }

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
  } catch {
    return { title: slug }
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  let product: Record<string, unknown> | null = null
  let relatedProducts: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 2,
      })
      product = (docs[0] as unknown as Record<string, unknown>) || null

      if (product) {
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
      }
    } catch {
      // DB not ready
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
