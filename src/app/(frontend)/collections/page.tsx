import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { normalizeMediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '主題精選',
  description: '探索 CHIC KIM & MIU 主題精選系列 — 金老佛爺 Live、品牌自訂款、婚禮洋裝、現貨速到等。',
}

type SpanValue = 'normal' | 'wide' | 'tall' | 'large'

const SPAN_CLASS: Record<SpanValue, string> = {
  normal: '',
  wide: 'md:col-span-2',
  tall: 'md:row-span-2',
  large: 'md:col-span-2 md:row-span-2',
}

interface CMSCard {
  image?: { url?: string } | null
  title: string
  slug: string
  span?: SpanValue | null
  sortOrder?: number | null
  isActive?: boolean | null
}

interface CollectionsSettings {
  hero?: {
    overline?: string | null
    title?: string | null
    description?: string | null
  } | null
  cards?: CMSCard[] | null
}

export default async function CollectionsPage() {
  let settings: CollectionsSettings = {}

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const raw = await payload.findGlobal({
        slug: 'collections-page-settings',
        depth: 2,
      })
      settings = raw as CollectionsSettings
    } catch {
      // DB not ready — fall through to empty state
    }
  }

  const hero = settings.hero
  const cards = (settings.cards ?? [])
    .filter((c) => c.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero ── */}
      <section className="py-12 md:py-16 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-widest">
          {hero?.title ?? '主題精選'}
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
        <p className="mt-4 text-[#2C2C2C]/60 text-sm max-w-md mx-auto">
          {hero?.description ?? '依風格、場合、主題瀏覽我們為您精心策劃的系列'}
        </p>
      </section>

      {/* ── Bento Grid ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        {cards.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#2C2C2C]/40 text-lg">主題系列整備中，敬請期待</p>
            <Link
              href="/products"
              className="mt-6 inline-block bg-[#C19A5B] text-white px-6 py-2.5 rounded-full text-sm hover:bg-[#A8843F] transition-colors"
            >
              瀏覽全部商品
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 auto-rows-[260px] md:auto-rows-[280px]">
            {cards.map((card) => {
              const imgSrc = normalizeMediaUrl(card.image?.url)
              const spanClass = SPAN_CLASS[card.span ?? 'normal'] ?? ''
              return (
                <Link
                  key={card.slug}
                  href={`/collections/${card.slug}`}
                  className={`group relative rounded-2xl overflow-hidden ${spanClass}`}
                >
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={card.title}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#2C2C2C]" />
                  )}
                  {/* Default overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity duration-500" />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#C19A5B]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  {/* Title */}
                  <div className="absolute inset-0 flex items-end p-6 md:p-8">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md transition-transform duration-500 group-hover:-translate-y-1">
                        {card.title}
                      </h2>
                      <div className="mt-2 w-0 group-hover:w-12 h-[2px] bg-[#C19A5B] transition-all duration-500" />
                      <p className="mt-2 text-white/80 text-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                        瀏覽系列 →
                      </p>
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
