import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { normalizeMediaUrl } from '@/lib/media-url'
import Image from 'next/image'
import Link from 'next/link'
import { ProductCard } from '@/components/product/ProductCard'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

// Fallback metadata for slugs not yet entered in CollectionsPageSettings global
const COLLECTION_META_FALLBACK: Record<string, { title: string; description: string }> = {
  'jin-live': { title: '金老佛爺 Live', description: '金老佛爺直播精選好物，限量搶購中！' },
  'jin-style': { title: '金金同款專區', description: '金金親自挑選穿搭，一秒 Get 她的時尚風格' },
  'host-style': { title: '主播同款專區', description: '人氣主播推薦款式，時尚跟著穿就對了' },
  'brand-custom': { title: '品牌自訂款', description: 'CHIC KIM & MIU 獨家設計，專屬妳的時尚' },
  'formal-dresses': { title: '婚禮洋裝 / 正式洋裝', description: '出席重要場合的完美選擇，優雅又大方' },
  rush: { title: '現貨速到專區 Rush', description: '急需美麗？現貨商品火速到貨！' },
  'celebrity-style': { title: '藝人穿搭', description: '明星同款穿搭靈感，輕鬆擁有名人風範' },
}

type RawCard = {
  title?: string | null
  slug?: string | null
  description?: string | null
  image?: { url?: string } | null
  isActive?: boolean | null
  seo?: { metaTitle?: string | null; metaDescription?: string | null } | null
  collectionTagsFilter?: string[] | null
}

async function getCardForSlug(slug: string): Promise<RawCard | null> {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    const global = (await payload.findGlobal({
      slug: 'collections-page-settings',
      depth: 1,
    })) as { cards?: RawCard[] } | null
    const cards = global?.cards ?? []
    return cards.find((c) => c.slug === slug && c.isActive !== false) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const card = await getCardForSlug(slug)
  const fallback = COLLECTION_META_FALLBACK[slug]

  const title = card?.seo?.metaTitle || card?.title || fallback?.title
  const description = card?.seo?.metaDescription || card?.description || fallback?.description

  if (!title) return { title: '找不到此系列' }
  return { title, description: description || undefined }
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params
  const card = await getCardForSlug(slug)
  const fallback = COLLECTION_META_FALLBACK[slug]

  const title = card?.title || fallback?.title
  const description = card?.description || fallback?.description

  // 404 if completely unknown slug (not in global and not in fallback)
  if (!title) notFound()

  const heroImage = normalizeMediaUrl((card?.image as { url?: string } | null)?.url)

  let products: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // Determine filter: prefer card.collectionTagsFilter, else slug
      const filterTags: string[] =
        card?.collectionTagsFilter && card.collectionTagsFilter.length > 0
          ? card.collectionTagsFilter
          : [slug]

      const where: Where = { status: { equals: 'published' } }

      if (filterTags.includes('rush')) {
        where.or = [
          { collectionTags: { in: filterTags } },
          { 'tags.tag': { equals: 'rush' } },
        ]
      } else {
        where.collectionTags = { in: filterTags }
      }

      const result = await payload.find({
        collection: 'products',
        where,
        limit: 48,
        sort: '-createdAt',
        depth: 2,
      })
      products = result.docs as unknown as Record<string, unknown>[]
    } catch {
      // DB not ready
    }
  }

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      <section className="relative bg-[#2C2C2C] py-16 md:py-24 overflow-hidden">
        {heroImage && (
          <Image
            src={heroImage}
            alt={title!}
            fill
            unoptimized
            className="object-cover opacity-30"
          />
        )}
        {!heroImage && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#C19A5B]/30 to-transparent opacity-10" />
        )}
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <p className="text-[#C19A5B] text-sm tracking-[0.3em] uppercase mb-3">Collection</p>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-wider">{title}</h1>
          <div className="mt-4 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
          {description && (
            <p className="mt-4 text-white/60 text-sm md:text-base max-w-lg mx-auto">
              {description}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#2C2C2C]/40 text-lg">此系列目前尚無商品，敬請期待</p>
            <Link
              href="/products"
              className="mt-6 inline-block bg-[#C19A5B] text-white px-6 py-2.5 rounded-full text-sm hover:bg-[#A8843F] transition-colors"
            >
              瀏覽全部商品
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => {
              const images = product.images as { image?: { url?: string; alt?: string } }[] | undefined
              const firstImage = images?.[0]?.image
              return (
                <ProductCard
                  key={String(product.id)}
                  id={String(product.id)}
                  slug={product.slug as string}
                  name={product.name as string}
                  price={product.price as number}
                  salePrice={product.salePrice as number | undefined}
                  image={
                    firstImage
                      ? { url: normalizeMediaUrl(firstImage.url) || '', alt: firstImage.alt }
                      : null
                  }
                  isNew={product.isNew as boolean | undefined}
                  isHot={product.isHot as boolean | undefined}
                />
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
