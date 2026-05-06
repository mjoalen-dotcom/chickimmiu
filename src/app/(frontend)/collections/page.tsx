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

type RawCard = {
  id: string | number
  title?: string | null
  slug?: string | null
  span?: 'normal' | 'wide' | 'tall' | 'large' | null
  isActive?: boolean | null
  sortOrder?: number | null
  image?: { url?: string } | null
}

type RawHero = {
  overline?: string | null
  title?: string | null
  description?: string | null
}

const SPAN_CLASS: Record<string, string> = {
  normal: '',
  wide: 'md:col-span-2',
  tall: 'md:row-span-2',
  large: 'md:col-span-2 md:row-span-2',
}

// Hardcoded fallback — used only when global has no active cards yet
const FALLBACK_CARDS = [
  { title: '金老佛爺 Live', slug: 'jin-live', span: 'large' },
  { title: '金金同款專區', slug: 'jin-style', span: 'normal' },
  { title: '主播同款專區', slug: 'host-style', span: 'normal' },
  { title: '品牌自訂款', slug: 'brand-custom', span: 'wide' },
  { title: '婚禮洋裝 / 正式洋裝', slug: 'formal-dresses', span: 'normal' },
  { title: '現貨速到專區 Rush', slug: 'rush', span: 'normal' },
  { title: '藝人穿搭', slug: 'celebrity-style', span: 'wide' },
]

async function getSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({
      slug: 'collections-page-settings',
      depth: 1,
    })) as { hero?: RawHero; cards?: RawCard[] } | null
  } catch {
    return null
  }
}

export default async function CollectionsPage() {
  const settings = await getSettings()

  const hero = settings?.hero
  const overline = hero?.overline || 'Collection'
  const heroTitle = hero?.title || '主題精選'
  const heroDesc = hero?.description || '依風格、場合、主題瀏覽我們為您精心策劃的系列'

  const rawCards = settings?.cards ?? []
  const activeCards = rawCards
    .filter((c) => c.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const cards =
    activeCards.length > 0
      ? activeCards.map((c) => ({
          title: c.title || '',
          href: `/collections/${c.slug || ''}`,
          image: normalizeMediaUrl((c.image as { url?: string } | null)?.url) || null,
          span: SPAN_CLASS[c.span || 'normal'] ?? '',
        }))
      : FALLBACK_CARDS.map((c) => ({
          title: c.title,
          href: `/collections/${c.slug}`,
          image: null,
          span: SPAN_CLASS[c.span] ?? '',
        }))

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      <section className="py-12 md:py-16 text-center">
        <p className="text-[#C19A5B] text-xs tracking-[0.3em] uppercase mb-2">{overline}</p>
        <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-widest">
          {heroTitle}
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
        <p className="mt-4 text-[#2C2C2C]/60 text-sm max-w-md mx-auto">{heroDesc}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 auto-rows-[260px] md:auto-rows-[280px]">
          {cards.map((col) => (
            <Link
              key={col.href}
              href={col.href}
              className={`group relative rounded-2xl overflow-hidden bg-[#2C2C2C] ${col.span}`}
            >
              {col.image && (
                <Image
                  src={col.image}
                  alt={col.title}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity duration-500" />
              <div className="absolute inset-0 bg-[#C19A5B]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 flex items-end p-6 md:p-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md transition-transform duration-500 group-hover:-translate-y-1">
                    {col.title}
                  </h2>
                  <div className="mt-2 w-0 group-hover:w-12 h-[2px] bg-[#C19A5B] transition-all duration-500" />
                  <p className="mt-2 text-white/80 text-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                    瀏覽系列 →
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
