import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Instagram,
  Youtube,
  Facebook,
  MessageCircle,
  Globe,
  Music2,
  ChevronLeft,
} from 'lucide-react'
import type { Metadata } from 'next'

import { normalizeMediaUrl } from '@/lib/media-url'
import { ProductCard } from '@/components/product/ProductCard'

interface Props {
  params: Promise<{ slug: string }>
}

type MediaDoc = { id?: string | number; url?: string; alt?: string } | null | undefined
type ProductDoc = Record<string, unknown> & { id: number | string; slug: string }

type SocialLink = {
  platform: 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'threads' | 'line' | 'website'
  url: string
  handle?: string | null
}

type GalleryItem = {
  id?: string
  image?: MediaDoc
  caption?: string | null
  linkedProduct?: ProductDoc | string | number | null
}

type CelebrityDoc = {
  id: number | string
  slug: string
  name: string
  program: string
  photo?: MediaDoc
  tagline?: string | null
  bio?: string | null
  brandQuote?: string | null
  linkType?: 'pdp' | 'url' | 'none'
  linkedProduct?: ProductDoc | string | number | null
  linkUrl?: string | null
  socialLinks?: SocialLink[] | null
  galleryImages?: GalleryItem[] | null
  sortOrder?: number
}

const SOCIAL_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
  threads: MessageCircle,
  line: MessageCircle,
  website: Globe,
}

const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  threads: 'Threads',
  line: 'LINE',
  website: '個人網站',
}

async function fetchCelebrity(slug: string): Promise<CelebrityDoc | null> {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'celebrity-features',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
      depth: 2,
    })
    return (docs[0] as unknown as CelebrityDoc) || null
  } catch {
    return null
  }
}

async function fetchRecommendations(currentId: number | string): Promise<CelebrityDoc[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'celebrity-features',
      where: {
        status: { equals: 'published' },
        id: { not_equals: currentId },
      },
      sort: 'sortOrder',
      limit: 6,
      depth: 1,
    })
    return docs as unknown as CelebrityDoc[]
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const c = await fetchCelebrity(slug)
  if (!c) return { title: 'CKMU ON SHOW' }
  return {
    title: `${c.name} × CKMU｜《${c.program}》同款穿搭 | CKMU ON SHOW`,
    description:
      c.bio ||
      `${c.name} 於《${c.program}》節目穿著 CKMU 的形象。點圖直接購買同款 — 台灣設計、韓國工藝、現貨速到。`,
  }
}

function productHref(c: CelebrityDoc): string | null {
  if (c.linkType === 'none') return null
  if (c.linkType === 'url' && c.linkUrl) return c.linkUrl
  if (c.linkType === 'pdp' && c.linkedProduct && typeof c.linkedProduct === 'object') {
    const p = c.linkedProduct as ProductDoc
    if (p.slug) return `/products/${p.slug}`
  }
  return null
}

export default async function CelebrityDetailPage({ params }: Props) {
  const { slug } = await params
  const c = await fetchCelebrity(slug)
  if (!c) notFound()

  const photo = c.photo
  const linkedProduct =
    c.linkedProduct && typeof c.linkedProduct === 'object' ? (c.linkedProduct as ProductDoc) : null
  const social = (c.socialLinks || []).filter((s) => s.url && s.url.trim())
  const purchaseHref = productHref(c)
  const recommendations = await fetchRecommendations(c.id)

  // 為 product-showcase 準備卡片資料
  const productCard = linkedProduct
    ? {
        id: String(linkedProduct.id),
        slug: linkedProduct.slug,
        name: (linkedProduct.name as string) || '',
        price: (linkedProduct.price as number) || 0,
        salePrice: (linkedProduct.salePrice as number) || null,
        image: (() => {
          const images = linkedProduct.images as
            | Array<{ image?: { url?: string; alt?: string } }>
            | undefined
          const firstImage = images?.[0]?.image
          return firstImage?.url
            ? { url: normalizeMediaUrl(firstImage.url) || firstImage.url, alt: firstImage.alt }
            : null
        })(),
        colors: (() => {
          const variants = linkedProduct.variants as
            | Array<{ colorName?: string; colorCode?: string }>
            | undefined
          return variants
            ?.filter((v) => v.colorName && v.colorCode)
            .map((v) => ({ name: v.colorName as string, code: v.colorCode as string }))
        })(),
        isNew: linkedProduct.isNew as boolean | undefined,
        isHot: linkedProduct.isHot as boolean | undefined,
      }
    : null

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── 上方麵包屑 + 返回 ─────────────────────────────────── */}
      <div className="container pt-8 pb-2">
        <Link
          href="/pages/ckmu-on-show"
          className="inline-flex items-center gap-1.5 text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          CKMU ON SHOW
        </Link>
      </div>

      {/* ── HERO: 大圖 + 標題 ──────────────────────────────────── */}
      <section className="container py-8 md:py-12">
        <div className="grid md:grid-cols-[5fr_4fr] gap-8 md:gap-12 items-start">
          {/* 左：大圖 */}
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-cream-100 border border-cream-200 shadow-xl">
            {photo?.url ? (
              <Image
                src={normalizeMediaUrl(photo.url) || photo.url}
                alt={photo.alt || `${c.name} ${c.program}`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                （未上傳形象照）
              </div>
            )}
            {/* 編號徽章 */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm text-[10px] tracking-[0.25em] font-medium text-foreground shadow-md">
              CKMU ON SHOW · #{String(c.sortOrder || 0).padStart(2, '0')}
            </div>
          </div>

          {/* 右：文案區 */}
          <div className="flex flex-col gap-5 md:pt-4">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-gold-600 mb-2">
                《{c.program}》
              </p>
              <h1 className="text-4xl md:text-5xl font-serif leading-tight mb-3">{c.name}</h1>
              {c.tagline && (
                <p className="text-base md:text-lg text-muted-foreground italic">{c.tagline}</p>
              )}
            </div>

            {/* brandQuote — 大引言 */}
            {c.brandQuote && (
              <blockquote className="border-l-2 border-gold-500 pl-5 py-1 my-2">
                <p className="font-serif text-lg md:text-xl italic leading-relaxed text-foreground/85">
                  &ldquo;{c.brandQuote}&rdquo;
                </p>
                <footer className="mt-2 text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                  — CKMU × {c.name}
                </footer>
              </blockquote>
            )}

            {/* bio 內文 */}
            {c.bio && (
              <p className="text-sm md:text-base leading-relaxed text-foreground/75">{c.bio}</p>
            )}

            {/* CTA: 立即購買同款 */}
            {purchaseHref && (
              <Link
                href={purchaseHref}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-foreground text-cream-50 rounded-full text-sm tracking-[0.2em] uppercase hover:bg-gold-600 transition-colors mt-2 self-start"
              >
                {c.linkType === 'pdp' ? '購買同款穿搭' : '探索相關商品'}
                <ArrowRight size={16} />
              </Link>
            )}

            {/* 社群連結 — 互惠導流 */}
            {social.length > 0 && (
              <div className="pt-4 border-t border-cream-200">
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
                  追蹤 {c.name}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {social.map((s, i) => {
                    const Icon = SOCIAL_ICON[s.platform] || Globe
                    const label = s.handle || SOCIAL_LABEL[s.platform] || s.platform
                    return (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cream-300 hover:border-gold-500 hover:bg-gold-500/5 transition-colors text-xs text-foreground/80 hover:text-foreground"
                      >
                        <Icon size={14} />
                        <span>{label}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 整輯穿搭照片 Gallery (Stage 2 — 從原 Shopline 子頁搬遷) ─ */}
      {(c.galleryImages || []).filter((g) => g.image).length > 0 && (
        <section className="py-12 md:py-16 bg-white">
          <div className="container">
            <div className="text-center mb-8 md:mb-10">
              <p className="text-[10px] tracking-[0.3em] uppercase text-gold-600 mb-2">
                ON SHOW · GALLERY
              </p>
              <h2 className="text-2xl md:text-3xl font-serif">
                《{c.program}》節目穿搭整輯
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-2">
                {(c.galleryImages || []).length} 張照片 — 點圖看大圖或跳商品頁
              </p>
              <div className="mt-5 flex items-center justify-center gap-3 text-gold-500/50 text-xs tracking-[0.5em] uppercase">
                <span className="w-12 h-px bg-gold-500/30" />
                <span>✦</span>
                <span className="w-12 h-px bg-gold-500/30" />
              </div>
            </div>

            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {(c.galleryImages || [])
                .filter((g) => g.image && typeof g.image === 'object' && (g.image as { url?: string }).url)
                .map((g, i) => {
                  const img = g.image as { url?: string; alt?: string }
                  const linkedP =
                    g.linkedProduct && typeof g.linkedProduct === 'object'
                      ? (g.linkedProduct as ProductDoc)
                      : null
                  const linkHref = linkedP?.slug ? `/products/${linkedP.slug}` : null
                  const inner = (
                    <div className="group relative overflow-hidden rounded-xl bg-cream-100 border border-cream-200 hover:shadow-xl transition-shadow">
                      <Image
                        src={normalizeMediaUrl(img.url) || img.url || ''}
                        alt={img.alt || `${c.name} 穿搭 ${i + 1}`}
                        width={750}
                        height={1000}
                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                      {Boolean(g.caption) && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          {g.caption}
                        </div>
                      )}
                      {linkHref && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-gold-500/95 text-white text-[10px] tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                          → 同款
                        </div>
                      )}
                    </div>
                  )
                  return linkHref ? (
                    <Link key={i} href={linkHref} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <div key={i}>{inner}</div>
                  )
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── 主打同款穿搭 ──────────────────────────────────────── */}
      {productCard && (
        <section className="py-12 md:py-16 bg-white">
          <div className="container">
            <div className="text-center mb-8">
              <p className="text-[10px] tracking-[0.3em] uppercase text-gold-600 mb-2">
                {c.name} ON SHOW · 同款穿搭
              </p>
              <h2 className="text-2xl md:text-3xl font-serif">節目同款立即購入</h2>
            </div>
            <div className="max-w-xs mx-auto">
              <ProductCard {...productCard} />
            </div>
          </div>
        </section>
      )}

      {/* ── 探索其他藝人 ─────────────────────────────────────── */}
      {recommendations.length > 0 && (
        <section className="py-16 md:py-20 bg-gradient-to-b from-cream-50 via-white to-cream-50">
          <div className="container">
            <div className="text-center mb-10">
              <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                CONTINUE EXPLORING
              </p>
              <h2 className="text-2xl md:text-3xl font-serif">看看其他藝人怎麼穿</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recommendations.map((r) => {
                const rPhoto = r.photo
                return (
                  <Link
                    key={r.id}
                    href={`/celebrity/${r.slug}`}
                    className="group block"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 border border-cream-200 mb-2">
                      {rPhoto?.url ? (
                        <Image
                          src={normalizeMediaUrl(rPhoto.url) || rPhoto.url}
                          alt={rPhoto.alt || r.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 16vw"
                        />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                        <p className="text-sm font-serif text-white">{r.name}</p>
                        <p className="text-[10px] text-white/70 tracking-wider">
                          {r.program}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/pages/ckmu-on-show"
                className="inline-flex items-center gap-2 text-sm tracking-[0.2em] uppercase text-foreground/70 hover:text-foreground transition-colors"
              >
                查看全部 18 位藝人
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 底部 CTA ──────────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="container max-w-3xl text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            CKMU × CELEBRITIES
          </p>
          <h2 className="text-2xl md:text-3xl font-serif mb-4">
            節目造型贊助 · 媒體合作邀請
          </h2>
          <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
            CKMU 期待與每一位媒體工作者、藝人、KOL 合作，把好衣服送上電視螢幕。
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gold-500 text-white hover:bg-gold-600 transition-colors text-sm tracking-[0.2em] uppercase"
          >
            聯絡我們
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  )
}
