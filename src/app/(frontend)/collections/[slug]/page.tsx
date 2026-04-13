import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  params: Promise<{ slug: string }>
}

const COLLECTION_META: Record<
  string,
  { title: string; description: string }
> = {
  'jin-live': {
    title: '金老佛爺 Live',
    description: '金老佛爺直播精選好物，限量搶購中！',
  },
  'jin-style': {
    title: '金金同款專區',
    description: '金金親自挑選穿搭，一秒 Get 她的時尚風格',
  },
  'host-style': {
    title: '主播同款專區',
    description: '人氣主播推薦款式，時尚跟著穿就對了',
  },
  'brand-custom': {
    title: '品牌自訂款',
    description: 'CHIC KIM & MIU 獨家設計，專屬妳的時尚',
  },
  'formal-dresses': {
    title: '婚禮洋裝 / 正式洋裝',
    description: '出席重要場合的完美選擇，優雅又大方',
  },
  rush: {
    title: '現貨速到專區 Rush',
    description: '急需美麗？現貨商品火速到貨！',
  },
  'celebrity-style': {
    title: '藝人穿搭',
    description: '明星同款穿搭靈感，輕鬆擁有名人風範',
  },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const meta = COLLECTION_META[slug]
  if (!meta) return { title: '找不到此系列' }

  return {
    title: meta.title,
    description: meta.description,
  }
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params
  const meta = COLLECTION_META[slug]
  if (!meta) notFound()

  let products: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      const where: Where = {
        status: { equals: 'published' },
      }

      // 使用 collectionTags 欄位篩選主題專區
      if (slug === 'rush') {
        where.or = [
          { collectionTags: { contains: 'rush' } },
          { 'tags.tag': { equals: 'rush' } },
        ]
      } else {
        where.collectionTags = { contains: slug }
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
      {/* ── Hero Banner ── */}
      <section className="relative bg-[#2C2C2C] py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#C19A5B]/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <p className="text-[#C19A5B] text-sm tracking-[0.3em] uppercase mb-3">
            Collection
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-wider">
            {meta.title}
          </h1>
          <div className="mt-4 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-white/60 text-sm md:text-base max-w-lg mx-auto">
            {meta.description}
          </p>
        </div>
      </section>

      {/* ── Products Grid ── */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#2C2C2C]/40 text-lg">
              此系列目前尚無商品，敬請期待
            </p>
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
              const name = product.name as string
              const productSlug = product.slug as string
              const price = product.price as number
              const salePrice = product.salePrice as number | undefined
              const images = product.images as
                | { image?: { url?: string } }[]
                | undefined
              const firstImage = images?.[0]?.image?.url
              const isNew = Boolean(product.isNew)
              const isHot = Boolean(product.isHot)

              return (
                <Link
                  key={productSlug}
                  href={`/products/${productSlug}`}
                  className="group"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                    {Boolean(firstImage) && (
                      <Image
                        src={firstImage as string}
                        alt={name}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    {/* Tags */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {isNew && (
                        <span className="bg-[#C19A5B] text-white text-xs px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                      {isHot && (
                        <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">
                          HOT
                        </span>
                      )}
                      {Boolean(salePrice) && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          SALE
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 px-1">
                    <h3 className="text-sm text-[#2C2C2C] font-medium truncate group-hover:text-[#C19A5B] transition-colors">
                      {name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      {Boolean(salePrice) ? (
                        <>
                          <span className="text-sm font-bold text-red-500">
                            NT${salePrice?.toLocaleString()}
                          </span>
                          <span className="text-xs text-[#2C2C2C]/40 line-through">
                            NT${price?.toLocaleString()}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-[#2C2C2C]">
                          NT${price?.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
