/**
 * 🔒 PROTECTED FILE — touches affect /pages/ckmu-on-show user 已抱怨 2 次。
 *
 * 這個檔案含 3 個關鍵設計：
 *   1. MagazineCover 的 'banner' layout（image-only，self-contained 行銷圖用）
 *   2. CelebrityGrid async server component（從 celebrity-features collection 讀）
 *   3. SectionRenderer 的 'celebrity-grid' case
 *
 * 如果這 3 個任一被 wipe 掉（git reset --hard origin/main），CKMU ON SHOW
 * 整頁壞掉。從 hetzner branch `claude/funny-haibt-a3b35a` 還原。
 *
 * 部署這個檔案前必走 `/root/deploy-ckmu-local.sh`（SKIP_GIT_RESET=1）。
 */
import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ArrowRight, Instagram, Youtube, Facebook, MessageCircle, Globe, Music2 } from 'lucide-react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { normalizeMediaUrl } from '@/lib/media-url'
import { ProductCard } from '@/components/product/ProductCard'
import { CountdownTimer } from './CountdownTimer'

/**
 * PageBlocks — shared renderer for the modular Page builder.
 *
 * Used by:
 *   - /pages/[slug]                          (live published page)
 *   - /preview/templates/[id]                (admin preview of a quick-start template)
 *
 * Extracted from src/app/(frontend)/pages/[slug]/page.tsx so that template preview
 * uses the exact same rendering logic as the published view (visual parity).
 */

export type PageBlock = Record<string, unknown> & { blockType: string }
type MediaDoc =
  | { id?: string | number; url?: string; alt?: string; width?: number; height?: number }
  | null
  | undefined
type ProductDoc = Record<string, unknown> & { id: string | number; slug: string }

export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <>
      {blocks.map((section, idx) => (
        <SectionRenderer key={idx} section={section} />
      ))}
    </>
  )
}

function SectionRenderer({ section }: { section: PageBlock }) {
  switch (section.blockType) {
    case 'hero-banner':
      return <HeroBanner section={section} />
    case 'magazine-cover':
      return <MagazineCover section={section} />
    case 'pull-quote':
      return <PullQuote section={section} />
    case 'editorial-spread':
      return <EditorialSpread section={section} />
    case 'lookbook-grid':
      return <LookbookGrid section={section} />
    case 'celebrity-grid':
      return <CelebrityGrid section={section} />
    case 'kol-persona':
      return <KOLPersona section={section} />
    case 'rich-content':
      return <RichContentBlock section={section} />
    case 'image-gallery':
      return <ImageGallery section={section} />
    case 'product-showcase':
      return <ProductShowcase section={section} />
    case 'cta':
      return <CTA section={section} />
    case 'faq':
      return <FAQ section={section} />
    case 'testimonial':
      return <Testimonial section={section} />
    case 'countdown':
      return <Countdown section={section} />
    case 'video':
      return <VideoEmbed section={section} />
    case 'divider':
      return <Divider section={section} />
    default:
      return null
  }
}

/* ════════════════════════════════════════════════════════════════════
   Existing blocks
   ════════════════════════════════════════════════════════════════════ */

function HeroBanner({ section }: { section: PageBlock }) {
  const bg = section.backgroundImage as MediaDoc
  const overlay = (section.overlay as number) ?? 30
  return (
    <section className="relative min-h-[60vh] flex items-center bg-gradient-to-br from-cream-100 to-blush-50 overflow-hidden">
      {bg?.url && (
        <Image
          src={normalizeMediaUrl(bg.url) || bg.url}
          alt={bg.alt || ''}
          fill
          priority
          className="object-cover"
        />
      )}
      {overlay > 0 && bg?.url && (
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay / 100 }} />
      )}
      <div className="container relative z-10 py-20 md:py-28 text-center">
        <h1 className={`text-3xl md:text-5xl font-serif mb-4 ${bg?.url ? 'text-white' : ''}`}>
          {section.heading as string}
        </h1>
        {Boolean(section.subheading) && (
          <p className={`text-base max-w-lg mx-auto mb-8 ${bg?.url ? 'text-white/90' : 'text-muted-foreground'}`}>
            {section.subheading as string}
          </p>
        )}
        {Boolean(section.ctaText) && (
          <Link
            href={(section.ctaLink as string) || '#'}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
          >
            {section.ctaText as string} <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   Magazine blocks (PR #136)
   ════════════════════════════════════════════════════════════════════ */

function MagazineCover({ section }: { section: PageBlock }) {
  const image = section.image as MediaDoc
  const layout =
    (section.layout as
      | 'banner'
      | 'left'
      | 'center'
      | 'bottom'
      | 'split-left'
      | 'split-right') || 'banner'
  const theme = (section.theme as 'light' | 'dark' | 'gold') || 'light'
  const cornerLabels = (section.cornerLabels as Array<{ text: string }>) || []
  const objectPos =
    (section.objectPosition as 'center' | 'top' | 'bottom' | 'left' | 'right') || 'center'

  /* ════════════════════════════════════════════════════════════════
     BANNER layout — 圖即內容（圖本身含品牌+文字+標語）
     圖置中、max-w、保留原 aspect、不疊任何文字
     ════════════════════════════════════════════════════════════════ */
  if (layout === 'banner') {
    const imgW = image?.width || 1296
    const imgH = image?.height || 1620
    return (
      <section className="pt-6 md:pt-10 pb-2 md:pb-4 bg-cream-50">
        <div className="container max-w-3xl">
          {image?.url ? (
            <div className="relative rounded-2xl overflow-hidden shadow-lg border border-cream-200 bg-white">
              <Image
                src={normalizeMediaUrl(image.url) || image.url}
                alt={image.alt || (section.heading as string) || 'CKMU ON SHOW'}
                width={imgW}
                height={imgH}
                priority
                className="w-full h-auto block"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] rounded-2xl bg-cream-100 border border-cream-200 flex items-center justify-center text-sm text-muted-foreground">
              （後台未上傳主圖）
            </div>
          )}
        </div>
      </section>
    )
  }

  const themeBg =
    theme === 'dark'
      ? 'bg-foreground'
      : theme === 'gold'
        ? 'bg-gradient-to-br from-cream-100 via-blush-50 to-gold-100'
        : 'bg-cream-50'
  const textColor = theme === 'dark' ? 'text-cream-50' : 'text-foreground'
  const subColor = theme === 'dark' ? 'text-cream-200/70' : 'text-muted-foreground'

  /* ════════════════════════════════════════════════════════════════
     SPLIT layout — image 完整呈現 + 文字另一側（含人臉建議用此）
     resp: mobile = 圖在上，文 在下；desktop = 左右並排
     ════════════════════════════════════════════════════════════════ */
  if (layout === 'split-left' || layout === 'split-right') {
    const imageOrder = layout === 'split-right' ? 'md:order-2' : ''
    return (
      <section className={`py-10 md:py-14 ${themeBg}`}>
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 items-center">
            {/* Image side — 完整呈現，不裁切焦點 */}
            <div
              className={`relative aspect-[4/5] md:aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 shadow-md ${imageOrder}`}
            >
              {image?.url ? (
                <Image
                  src={normalizeMediaUrl(image.url) || image.url}
                  alt={image.alt || (section.heading as string) || ''}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  （後台未上傳主圖）
                </div>
              )}
            </div>

            {/* Text side — 不疊在圖上 */}
            <div className="px-2 md:px-4">
              {Boolean(section.issueLabel) && (
                <p
                  className={`text-[10px] md:text-xs tracking-[0.4em] uppercase mb-4 ${
                    theme === 'dark' ? 'text-gold-300' : 'text-gold-600'
                  }`}
                >
                  {section.issueLabel as string}
                </p>
              )}
              <h2
                className={`font-serif leading-[1.05] tracking-tight mb-4 md:mb-5 text-3xl md:text-4xl lg:text-5xl ${textColor}`}
              >
                {section.heading as string}
              </h2>
              {Boolean(section.subheading) && (
                <p className={`text-sm md:text-base leading-relaxed ${subColor}`}>
                  {section.subheading as string}
                </p>
              )}
              {cornerLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-5">
                  {cornerLabels.map((lbl, i) => (
                    <span
                      key={i}
                      className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 bg-foreground/5 border border-foreground/10 text-foreground/70 rounded-full"
                    >
                      {lbl.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ════════════════════════════════════════════════════════════════
     COVER layouts — 圖片全寬覆蓋（文字疊在圖上）
     ════════════════════════════════════════════════════════════════ */
  const alignClass =
    layout === 'left'
      ? 'items-start text-left'
      : layout === 'bottom'
        ? 'items-center text-center justify-end'
        : 'items-center text-center justify-center'

  const objectPositionClass = {
    center: 'object-center',
    top: 'object-top',
    bottom: 'object-bottom',
    left: 'object-left',
    right: 'object-right',
  }[objectPos]

  return (
    <section className={`relative min-h-[32vh] md:min-h-[40vh] flex flex-col ${alignClass} ${themeBg} overflow-hidden`}>
      {image?.url && (
        <Image
          src={normalizeMediaUrl(image.url) || image.url}
          alt={image.alt || (section.heading as string) || ''}
          fill
          priority
          className={`object-cover ${objectPositionClass}`}
        />
      )}
      {image?.url && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55 z-[1]" />
      )}
      {Boolean(section.issueLabel) && (
        <div
          className={`absolute top-5 left-1/2 -translate-x-1/2 z-10 text-[10px] tracking-[0.4em] uppercase ${
            image?.url
              ? 'text-white/90 bg-white/10 border border-white/20 px-3 py-1 rounded-full backdrop-blur-md'
              : 'text-foreground/70 bg-foreground/5 border border-foreground/10 px-3 py-1 rounded-full'
          }`}
        >
          {section.issueLabel as string}
        </div>
      )}
      <div className={`container relative z-10 py-8 md:py-12 ${layout === 'left' ? 'pl-8 md:pl-16' : ''}`}>
        <h2
          className={`font-serif leading-[1.05] tracking-tight mb-3 md:mb-4 text-3xl md:text-4xl lg:text-5xl ${image?.url ? 'text-white drop-shadow-lg' : textColor}`}
        >
          {section.heading as string}
        </h2>
        {Boolean(section.subheading) && (
          <p
            className={`text-xs md:text-sm max-w-xl tracking-wide leading-relaxed ${layout === 'center' || layout === 'bottom' ? 'mx-auto' : ''} ${image?.url ? 'text-white/85' : subColor}`}
          >
            {section.subheading as string}
          </p>
        )}
      </div>
    </section>
  )
}

function PullQuote({ section }: { section: PageBlock }) {
  const font = (section.font as 'serif' | 'sans') || 'serif'
  const alignment = (section.alignment as 'left' | 'center' | 'right') || 'center'
  const fontClass = font === 'serif' ? 'font-serif' : 'font-sans'
  const alignClass =
    alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center'

  return (
    <section className="py-10 md:py-14 bg-cream-50">
      <div className="container max-w-4xl">
        <blockquote className={`${alignClass}`}>
          <span
            className={`block text-gold-500/40 text-7xl leading-none mb-2 ${alignment === 'right' ? 'text-right' : alignment === 'left' ? 'text-left' : 'text-center'}`}
            aria-hidden
          >
            “
          </span>
          <p className={`${fontClass} text-2xl md:text-4xl leading-snug tracking-wide italic`}>
            {section.quote as string}
          </p>
          {Boolean(section.source) && (
            <footer className={`mt-6 text-xs tracking-[0.2em] uppercase text-muted-foreground ${alignClass}`}>
              — {section.source as string}
            </footer>
          )}
        </blockquote>
      </div>
    </section>
  )
}

function EditorialSpread({ section }: { section: PageBlock }) {
  const rows =
    (section.rows as Array<{
      image?: MediaDoc
      heading?: string
      body?: SerializedEditorState
      imagePosition?: 'left' | 'right' | 'top' | 'full'
      background?: 'cream' | 'white' | 'dark' | 'blush'
    }>) || []

  if (rows.length === 0) return null

  return (
    <section className="py-12 md:py-16 bg-cream-50">
      {Boolean(section.heading) && (
        <div className="container mb-10 text-center">
          <h2 className="text-2xl md:text-3xl font-serif">{section.heading as string}</h2>
        </div>
      )}
      <div className="space-y-8 md:space-y-12">
        {rows.map((row, i) => {
          const bgClass =
            row.background === 'white'
              ? 'bg-white'
              : row.background === 'dark'
                ? 'bg-foreground text-cream-50'
                : row.background === 'blush'
                  ? 'bg-blush-50'
                  : 'bg-cream-100'
          const isFull = row.imagePosition === 'full'
          const isTop = row.imagePosition === 'top'
          const reverse = row.imagePosition === 'right'

          if (isFull) {
            return (
              <div key={i} className={`relative min-h-[50vh] ${bgClass} overflow-hidden`}>
                {row.image?.url && (
                  <Image
                    src={normalizeMediaUrl(row.image.url) || row.image.url}
                    alt={row.image.alt || row.heading || ''}
                    fill
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <div className="container relative z-10 py-20 text-center text-white">
                  {Boolean(row.heading) && (
                    <h3 className="text-3xl md:text-4xl font-serif mb-6">{row.heading}</h3>
                  )}
                  {row.body && (
                    <div className="prose prose-invert prose-sm md:prose-base max-w-2xl mx-auto">
                      <RichText data={row.body} />
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={i} className={`${bgClass}`}>
              <div
                className={`container py-12 md:py-16 grid ${
                  isTop ? 'grid-cols-1' : 'md:grid-cols-2'
                } gap-8 md:gap-12 items-center`}
              >
                <div className={`${reverse ? 'md:order-2' : ''} relative aspect-[4/5] md:aspect-[3/4] rounded-2xl overflow-hidden bg-cream-200`}>
                  {row.image?.url ? (
                    <Image
                      src={normalizeMediaUrl(row.image.url) || row.image.url}
                      alt={row.image.alt || row.heading || ''}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                      （請上傳圖片）
                    </div>
                  )}
                </div>
                <div>
                  {Boolean(row.heading) && (
                    <h3 className="text-2xl md:text-3xl font-serif mb-4 leading-tight">{row.heading}</h3>
                  )}
                  {row.body && (
                    <div className="prose prose-sm md:prose-base max-w-none prose-p:leading-relaxed">
                      <RichText data={row.body} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LookbookGrid({ section }: { section: PageBlock }) {
  const items =
    (section.items as Array<{
      image?: MediaDoc
      name?: string
      tags?: Array<{ text: string }>
      linkedProduct?: ProductDoc | string | number | null
      linkUrl?: string | null
    }>) || []
  if (items.length === 0) return null

  const cols = (section.columns as '2' | '3' | '4') || '3'
  const colClass = cols === '2' ? 'md:grid-cols-2' : cols === '4' ? 'md:grid-cols-4' : 'md:grid-cols-3'

  return (
    <section className="py-12 md:py-16">
      <div className="container">
        {Boolean(section.heading) && (
          <h2 className="text-2xl md:text-3xl font-serif mb-10 text-center">{section.heading as string}</h2>
        )}
        <div className={`grid grid-cols-2 ${colClass} gap-4 md:gap-6`}>
          {items.map((item, i) => {
            const product =
              item.linkedProduct && typeof item.linkedProduct === 'object'
                ? (item.linkedProduct as ProductDoc)
                : null
            const linkHref =
              (item.linkUrl && item.linkUrl.trim()) ||
              (product?.slug ? `/products/${product.slug}` : null)
            const Wrapper = ({ children }: { children: React.ReactNode }) =>
              linkHref ? (
                <Link href={linkHref} className="group block">
                  {children}
                </Link>
              ) : (
                <div>{children}</div>
              )

            return (
              <Wrapper key={i}>
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 mb-3">
                  {item.image?.url ? (
                    <Image
                      src={normalizeMediaUrl(item.image.url) || item.image.url}
                      alt={item.image.alt || item.name || ''}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                      Look {i + 1}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {Boolean(item.name) && (
                    <p className="text-sm font-medium group-hover:text-gold-600 transition-colors">{item.name}</p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((t, ti) => (
                        <span
                          key={ti}
                          className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-cream-100 text-muted-foreground rounded-full"
                        >
                          {t.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Wrapper>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   CelebrityGrid — async server component
   從 celebrity-features collection 拉 published 藝人，magazine-style 卡片
   ════════════════════════════════════════════════════════════════════ */

type CelebrityDoc = {
  id: number | string
  slug?: string
  name: string
  program: string
  photo?: MediaDoc
  tagline?: string | null
  bio?: string | null
  brandQuote?: string | null
  linkType?: 'pdp' | 'url' | 'none'
  linkedProduct?: ProductDoc | string | number | null
  linkUrl?: string | null
  galleryImages?: Array<{ image?: MediaDoc; caption?: string | null }> | null
}

// 主頁卡片一律連到 /celebrity/{slug} 專屬子頁，再從子頁導購；
// slug 缺失才 fallback 到 linkType 邏輯（早期資料相容）。
function celebrityHref(c: CelebrityDoc): string | null {
  if (c.slug && c.slug.trim()) return `/celebrity/${c.slug.trim()}`
  if (c.linkType === 'none') return null
  if (c.linkType === 'url' && c.linkUrl && c.linkUrl.trim()) return c.linkUrl.trim()
  if (c.linkType === 'pdp' && c.linkedProduct && typeof c.linkedProduct === 'object') {
    const p = c.linkedProduct as ProductDoc
    if (p.slug) return `/products/${p.slug}`
  }
  return null
}

async function CelebrityGrid({ section }: { section: PageBlock }) {
  const cols = (section.columns as '3' | '4' | '5') || '4'
  const showBio = section.showBioOnHover !== false
  const maxItems = (section.maxItems as number) || 0

  let docs: CelebrityDoc[] = []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'celebrity-features',
      where: { status: { equals: 'published' } },
      sort: 'sortOrder',
      limit: maxItems > 0 ? maxItems : 100,
      depth: 2,
    })
    docs = result.docs as unknown as CelebrityDoc[]
  } catch {
    return null
  }
  if (docs.length === 0) return null

  const colClass =
    cols === '3' ? 'md:grid-cols-3' : cols === '5' ? 'md:grid-cols-5' : 'md:grid-cols-4'

  // 計算統計數字（社會證明）
  const totalGalleryImages = docs.reduce(
    (sum, c) => sum + ((c.galleryImages || []).filter((g) => g.image).length),
    0,
  )
  const uniquePrograms = new Set(docs.map((c) => c.program.split(/[\/／]/)[0].trim())).size

  return (
    <section className="pt-2 md:pt-4 pb-12 md:pb-16 bg-gradient-to-b from-cream-50 via-white to-cream-50">
      <div className="container">
        {/* 數字社會證明 strip — 緊貼 hero 下方，當作 banner→grid 的橋樑 */}
        <div className="relative mb-10 md:mb-14 z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-cream-200 overflow-hidden">
            {[
              { value: String(docs.length), label: '電視藝人' },
              { value: String(totalGalleryImages), label: '節目穿搭照' },
              { value: String(uniquePrograms), label: '檔節目曝光' },
              { value: '8', label: '年信任品牌' },
            ].map((s, i) => (
              <div
                key={i}
                className={`text-center py-5 md:py-6 ${
                  i > 0 && i !== 2 ? 'border-l border-cream-200' : ''
                } ${i === 2 ? 'md:border-l border-cream-200' : ''} ${
                  i >= 2 ? 'border-t md:border-t-0 border-cream-200' : ''
                }`}
              >
                <p className="text-2xl md:text-3xl font-serif text-gold-600 leading-none mb-1.5">
                  {s.value}
                </p>
                <p className="text-[10px] md:text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 可選副標 — 給 admin 後台想加文字解釋時用，預設不寫就不顯示 */}
        {(Boolean(section.heading) || Boolean(section.subheading)) && (
          <div className="text-center mb-8 md:mb-10">
            {Boolean(section.heading) && (
              <h3 className="text-xl md:text-2xl font-serif tracking-tight mb-2 text-foreground/80">
                {section.heading as string}
              </h3>
            )}
            {Boolean(section.subheading) && (
              <p className="text-xs md:text-sm text-muted-foreground tracking-wide max-w-2xl mx-auto">
                {section.subheading as string}
              </p>
            )}
          </div>
        )}

        <div className={`grid grid-cols-2 ${colClass} gap-4 md:gap-6`}>
          {docs.map((c, idx) => {
            const href = celebrityHref(c)
            const photo = c.photo
            const num = String(idx + 1).padStart(2, '0')
            const galleryCount = (c.galleryImages || []).filter((g) => g.image).length
            // 第一行 2 位 featured: 桌面寬 col-span-2 (在 4 欄 grid 中佔 2 欄 = 半寬)
            const isFeatured = idx < 2

            const cardInner = (
              <div
                className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 shadow-sm hover:shadow-2xl transition-all duration-500 ${
                  isFeatured ? 'md:shadow-md' : ''
                }`}
              >
                {photo?.url ? (
                  <Image
                    src={normalizeMediaUrl(photo.url) || photo.url}
                    alt={photo.alt || `${c.name} ${c.program}`}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes={
                      isFeatured
                        ? '(max-width: 768px) 50vw, 50vw'
                        : '(max-width: 768px) 50vw, 25vw'
                    }
                    priority={idx < 4}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    {c.name}
                  </div>
                )}

                {/* 編號徽章 — top-right */}
                <div className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center text-[10px] tracking-[0.15em] font-medium text-foreground shadow-md">
                  #{num}
                </div>

                {/* 整輯張數徽章 — top-left（若有 gallery 照片才顯示） */}
                {galleryCount > 0 && (
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-gold-500/95 backdrop-blur-sm text-[9px] md:text-[10px] tracking-[0.15em] font-medium text-white shadow-md flex items-center gap-1">
                    <span>＋</span>
                    <span>{galleryCount} 張整輯</span>
                  </div>
                )}

                {/* Featured 徽章 — featured 卡片左下顯示「焦點藝人」標記 */}
                {isFeatured && (
                  <div className="absolute top-14 left-3 z-10 px-2.5 py-1 rounded-full bg-foreground/85 backdrop-blur-sm text-[9px] tracking-[0.25em] font-medium text-cream-50 shadow-md uppercase">
                    Featured
                  </div>
                )}

                {/* 底部漸層 + 名字 + 節目 + tagline */}
                <div
                  className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 md:p-6 ${
                    isFeatured ? 'pt-16 md:pt-24' : 'pt-12 md:pt-16'
                  }`}
                >
                  <p
                    className={`tracking-[0.25em] uppercase text-white/80 mb-1.5 ${
                      isFeatured ? 'text-xs md:text-[11px]' : 'text-[10px]'
                    }`}
                  >
                    {c.program}
                  </p>
                  <h3
                    className={`font-serif text-white leading-tight mb-1 ${
                      isFeatured
                        ? 'text-2xl md:text-3xl lg:text-4xl'
                        : 'text-xl md:text-2xl'
                    }`}
                  >
                    {c.name}
                  </h3>
                  {Boolean(c.tagline) && (
                    <p
                      className={`text-white/85 leading-snug line-clamp-2 ${
                        isFeatured ? 'text-sm md:text-base' : 'text-xs md:text-sm'
                      }`}
                    >
                      {c.tagline}
                    </p>
                  )}

                  {/* 觸控裝置的替代呈現 —— 平板 / 智能白板沒有 hover，
                      下面那層 hover 浮層在它們身上永遠不會出現。這裡把最有力的
                      一句 brandQuote 直接放進底部漸層，並補一個明確的「還有更多」
                      指示；完整 bio 本來就在 /celebrity/[slug] 詳情頁，點一下就到。
                      刻意不整片蓋住照片 —— 這頁的主角是藝人的穿搭照。
                      只在 md 以上生效：手機卡片只有 50vw 寬，再塞兩行引言會把照片
                      壓掉一大塊，而詳情頁本來就只差一下點擊。 */}
                  {showBio && Boolean(c.brandQuote) && (
                    <p
                      className={`hidden md:[@media(hover:none)]:block mt-2 font-serif italic leading-snug text-white/90 border-l-2 border-gold-400 pl-2.5 line-clamp-2 ${
                        isFeatured ? 'text-sm' : 'text-xs'
                      }`}
                    >
                      &ldquo;{c.brandQuote}&rdquo;
                    </p>
                  )}
                  {showBio && (Boolean(c.brandQuote) || Boolean(c.bio)) && href && (
                    <span className="hidden md:[@media(hover:none)]:inline-flex items-center gap-1 mt-2 text-[10px] tracking-[0.2em] uppercase text-gold-300">
                      同款穿搭 <ArrowRight size={12} />
                    </span>
                  )}
                </div>

                {/* Hover overlay — brandQuote + bio + CTA
                    僅在真的有 hover 的裝置上存在。原本沒有這道 media 條件，
                    iOS 的 sticky hover 會讓它在點擊瞬間閃一下才跳頁。 */}
                {showBio && (Boolean(c.brandQuote) || Boolean(c.bio)) && (
                  <div className="absolute inset-0 z-20 bg-gradient-to-br from-black/85 via-black/75 to-black/85 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden [@media(hover:hover)]:flex flex-col justify-center p-5 md:p-7 text-white">
                    <p className="text-[10px] tracking-[0.25em] uppercase text-gold-300 mb-2">
                      {c.program}
                    </p>
                    <h3 className="text-2xl md:text-3xl font-serif leading-tight mb-3">
                      {c.name}
                    </h3>
                    {Boolean(c.brandQuote) && (
                      <p className="text-sm md:text-base italic font-serif leading-relaxed border-l-2 border-gold-400 pl-3 mb-3 text-white/95">
                        &ldquo;{c.brandQuote}&rdquo;
                      </p>
                    )}
                    {Boolean(c.bio) && (
                      <p className="text-xs md:text-sm text-white/75 leading-relaxed mb-4 line-clamp-4">
                        {c.bio}
                      </p>
                    )}
                    {href && (
                      <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase text-gold-300 mt-auto">
                        同款穿搭 <ArrowRight size={14} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            )

            const colSpanClass = isFeatured ? 'md:col-span-2' : ''
            return href ? (
              <Link
                key={c.id}
                href={href}
                className={`block focus:outline-none focus:ring-2 focus:ring-gold-500 rounded-2xl ${colSpanClass}`}
              >
                {cardInner}
              </Link>
            ) : (
              <div key={c.id} className={colSpanClass}>
                {cardInner}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const SOCIAL_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  threads: MessageCircle,
  tiktok: Music2,
  line: MessageCircle,
  website: Globe,
}

function KOLPersona({ section }: { section: PageBlock }) {
  const avatar = section.avatar as MediaDoc
  const bio = section.bio as SerializedEditorState | undefined
  const socials =
    (section.socialLinks as Array<{ platform: string; url: string }>) || []

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-blush-50 via-cream-50 to-cream-100">
      <div className="container max-w-4xl">
        <div className="grid md:grid-cols-[280px_1fr] gap-8 md:gap-12 items-center">
          <div className="relative aspect-square w-full max-w-[280px] mx-auto md:mx-0 rounded-full overflow-hidden bg-cream-200 border-4 border-white shadow-xl">
            {avatar?.url ? (
              <Image
                src={normalizeMediaUrl(avatar.url) || avatar.url}
                alt={avatar.alt || (section.name as string) || ''}
                fill
                className="object-cover"
                sizes="280px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                （請上傳頭像）
              </div>
            )}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-serif mb-2">{section.name as string}</h2>
            {Boolean(section.title) && (
              <p className="text-sm tracking-[0.2em] uppercase text-muted-foreground mb-4">{section.title as string}</p>
            )}
            {Boolean(section.signatureQuote) && (
              <p className="text-base md:text-lg italic text-foreground/80 border-l-2 border-gold-500 pl-4 my-5 leading-relaxed">
                &ldquo;{section.signatureQuote as string}&rdquo;
              </p>
            )}
            {bio && (
              <div className="prose prose-sm max-w-none prose-p:text-foreground/70 prose-p:leading-relaxed mb-5">
                <RichText data={bio} />
              </div>
            )}
            {socials.length > 0 && (
              <div className="flex gap-3 justify-center md:justify-start">
                {socials.map((s, i) => {
                  const Icon = SOCIAL_ICON[s.platform] || Globe
                  return (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full bg-white border border-cream-200 flex items-center justify-center text-foreground hover:bg-gold-500 hover:text-white hover:border-gold-500 transition-colors"
                      aria-label={s.platform}
                    >
                      <Icon size={16} />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   Existing blocks (continued)
   ════════════════════════════════════════════════════════════════════ */

function RichContentBlock({ section }: { section: PageBlock }) {
  const content = section.content as SerializedEditorState | undefined
  if (!content) return null
  return (
    <section className="py-12 md:py-16">
      <div className="container max-w-3xl">
        <div className="bg-white rounded-2xl border border-cream-200 p-8 md:p-12 prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-p:text-foreground/80 prose-p:leading-relaxed">
          <RichText data={content} />
        </div>
      </div>
    </section>
  )
}

function ImageGallery({ section }: { section: PageBlock }) {
  const layout = (section.layout as 'grid' | 'carousel' | 'masonry') || 'grid'
  const images =
    (section.images as Array<{ image?: MediaDoc; caption?: string; link?: string }>) || []
  if (images.length === 0) return null

  if (layout === 'carousel') {
    return (
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-thin">
            <div className="flex gap-4 snap-x snap-mandatory">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-[80%] md:w-[400px] aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 relative"
                >
                  {img.image?.url ? (
                    <Image
                      src={normalizeMediaUrl(img.image.url) || img.image.url}
                      alt={img.image.alt || img.caption || ''}
                      fill
                      className="object-cover"
                      sizes="400px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                      圖片 {i + 1}
                    </div>
                  )}
                  {Boolean(img.caption) && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 backdrop-blur-sm">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (layout === 'masonry') {
    return (
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="columns-2 md:columns-3 gap-4">
            {images.map((img, i) => (
              <div
                key={i}
                className="mb-4 break-inside-avoid rounded-2xl overflow-hidden bg-cream-100 border border-cream-200"
              >
                {img.image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={normalizeMediaUrl(img.image.url) || img.image.url}
                    alt={img.image.alt || img.caption || ''}
                    loading="lazy"
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground">
                    圖片 {i + 1}
                  </div>
                )}
                {Boolean(img.caption) && (
                  <p className="text-[11px] p-3 text-muted-foreground tracking-wide">{img.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 relative group"
            >
              {img.image?.url ? (
                <Image
                  src={normalizeMediaUrl(img.image.url) || img.image.url}
                  alt={img.image.alt || img.caption || ''}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  圖片 {i + 1}
                </div>
              )}
              {Boolean(img.caption) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProductShowcase({ section }: { section: PageBlock }) {
  const products = (section.products as Array<ProductDoc | string | number>) || []
  const items = products
    .filter((p): p is ProductDoc => typeof p === 'object' && p !== null && Boolean(p.slug))
    .map((p) => {
      const images = p.images as Array<{ image?: { url?: string; alt?: string } }> | undefined
      const firstImage = images?.[0]?.image
      const variants = p.variants as Array<{ colorName?: string; colorCode?: string }> | undefined
      const colors = variants
        ?.filter((v) => v.colorName && v.colorCode)
        .map((v) => ({ name: v.colorName as string, code: v.colorCode as string }))
      return {
        id: String(p.id),
        slug: p.slug,
        name: (p.name as string) || '',
        price: (p.price as number) || 0,
        salePrice: (p.salePrice as number) || null,
        image: firstImage?.url
          ? { url: normalizeMediaUrl(firstImage.url) || firstImage.url, alt: firstImage.alt }
          : null,
        colors,
        isNew: p.isNew as boolean | undefined,
        isHot: p.isHot as boolean | undefined,
      }
    })

  if (items.length === 0) {
    return (
      <section className="py-12 md:py-16 bg-white">
        <div className="container">
          {Boolean(section.heading) && (
            <h2 className="text-2xl md:text-3xl font-serif mb-8 text-center">{section.heading as string}</h2>
          )}
          <p className="text-center text-sm text-muted-foreground">（請至 admin 後台選取要展示的商品）</p>
        </div>
      </section>
    )
  }

  const display = (section.displayStyle as 'grid' | 'carousel') || 'grid'

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container">
        {Boolean(section.heading) && (
          <h2 className="text-2xl md:text-3xl font-serif mb-10 text-center">{section.heading as string}</h2>
        )}
        {display === 'carousel' ? (
          <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-thin">
            <div className="flex gap-4 md:gap-6 snap-x snap-mandatory">
              {items.map((p) => (
                <div key={p.id} className="snap-start shrink-0 w-[60%] sm:w-[40%] md:w-[280px]">
                  <ProductCard {...p} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {items.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CTA({ section }: { section: PageBlock }) {
  const style = (section.style as 'primary' | 'secondary' | 'dark') || 'primary'
  const bg = section.backgroundImage as MediaDoc

  const wrapperClass =
    style === 'dark'
      ? 'bg-foreground text-cream-50'
      : style === 'secondary'
        ? 'bg-gradient-to-r from-cream-100 to-blush-50'
        : 'bg-gradient-to-r from-gold-500/10 to-blush-100'
  const buttonClass =
    style === 'dark'
      ? 'bg-cream-50 text-foreground hover:bg-cream-100'
      : style === 'secondary'
        ? 'bg-foreground text-cream-50 hover:bg-foreground/90'
        : 'bg-gold-500 text-white hover:bg-gold-600'

  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <div className={`relative rounded-3xl overflow-hidden p-10 md:p-16 text-center ${wrapperClass}`}>
          {bg?.url && (
            <>
              <Image src={normalizeMediaUrl(bg.url) || bg.url} alt="" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40" />
            </>
          )}
          <div className="relative z-10">
            <h2 className={`text-2xl md:text-3xl font-serif mb-4 ${bg?.url ? 'text-white' : ''}`}>
              {section.heading as string}
            </h2>
            {Boolean(section.description) && (
              <p
                className={`text-sm mb-8 max-w-md mx-auto leading-relaxed ${
                  bg?.url ? 'text-white/85' : style === 'dark' ? 'text-cream-200' : 'text-muted-foreground'
                }`}
              >
                {section.description as string}
              </p>
            )}
            {Boolean(section.buttonText) && (
              <Link
                href={(section.buttonLink as string) || '#'}
                className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm tracking-wide transition-colors ${buttonClass}`}
              >
                {section.buttonText as string} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQ({ section }: { section: PageBlock }) {
  const questions =
    (section.questions as Array<{ question: string; answer: SerializedEditorState }>) || []
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-serif mb-8 text-center">{section.heading as string}</h2>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <details key={i} className="bg-cream-50 rounded-xl p-5 border border-cream-200 group">
              <summary className="cursor-pointer text-sm md:text-base font-medium list-none flex items-center justify-between">
                {q.question}
                <span className="text-gold-500 group-open:rotate-45 transition-transform text-lg">+</span>
              </summary>
              <div className="prose prose-sm max-w-none mt-4 prose-p:text-muted-foreground prose-p:leading-relaxed">
                <RichText data={q.answer} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonial({ section }: { section: PageBlock }) {
  const items =
    (section.testimonials as Array<{
      name: string
      content: string
      avatar?: MediaDoc
      rating?: number
    }>) || []
  return (
    <section className="py-12 md:py-16">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-serif mb-10 text-center">{section.heading as string}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl border border-cream-200 p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-cream-100 mx-auto mb-4 overflow-hidden relative">
                {t.avatar?.url && (
                  <Image
                    src={normalizeMediaUrl(t.avatar.url) || t.avatar.url}
                    alt={t.avatar.alt || t.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground italic mb-3 leading-relaxed">&ldquo;{t.content}&rdquo;</p>
              <p className="text-xs font-medium">{t.name}</p>
              {Boolean(t.rating) && (
                <p className="text-gold-500 text-xs mt-1">
                  {'★'.repeat(t.rating!)}
                  {'☆'.repeat(5 - (t.rating || 0))}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Countdown({ section }: { section: PageBlock }) {
  const bg = section.backgroundImage as MediaDoc
  return (
    <section
      className={`py-16 md:py-20 relative overflow-hidden ${bg?.url ? '' : 'bg-gradient-to-r from-blush-100 to-cream-100'}`}
    >
      {bg?.url && (
        <>
          <Image src={normalizeMediaUrl(bg.url) || bg.url} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}
      <div className={`container relative z-10 text-center ${bg?.url ? 'text-white' : ''}`}>
        <h2 className="text-2xl md:text-3xl font-serif mb-3">{section.heading as string}</h2>
        {Boolean(section.description) && (
          <p className={`text-sm mb-6 ${bg?.url ? 'text-white/85' : 'text-muted-foreground'}`}>
            {section.description as string}
          </p>
        )}
        <CountdownTimer endDate={section.endDate as string} onBg={Boolean(bg?.url)} />
        {Boolean(section.ctaText) && (
          <Link
            href={(section.ctaLink as string) || '#'}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
          >
            {section.ctaText as string} <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </section>
  )
}

function VideoEmbed({ section }: { section: PageBlock }) {
  const url = (section.url as string) || ''
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/)
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  const embedSrc = ytMatch
    ? `https://www.youtube.com/embed/${ytMatch[1]}`
    : vimeoMatch
      ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
      : null

  return (
    <section className="py-12 md:py-16">
      <div className="container max-w-3xl">
        <div className="aspect-video bg-cream-100 rounded-2xl border border-cream-200 overflow-hidden relative">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={section.caption as string || ''}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
              影片網址無效或為佔位字串：
              <br />
              <span className="text-xs font-mono">{url || '（請於後台填入 YouTube / Vimeo 網址）'}</span>
            </div>
          )}
        </div>
        {Boolean(section.caption) && (
          <p className="text-xs text-center text-muted-foreground mt-3">{section.caption as string}</p>
        )}
      </div>
    </section>
  )
}

function Divider({ section }: { section: PageBlock }) {
  const style = (section.style as 'line' | 'space' | 'ornament') || 'line'
  const height = (section.height as number) || 40
  if (style === 'space') {
    return <div style={{ height: `${height}px` }} />
  }
  if (style === 'ornament') {
    return (
      <div className="container py-8 flex justify-center" style={{ minHeight: height }}>
        <div className="flex items-center gap-3 text-gold-500/50 text-xs tracking-[0.5em] uppercase">
          <span className="w-12 h-px bg-gold-500/30" />
          <span>✦</span>
          <span className="w-12 h-px bg-gold-500/30" />
        </div>
      </div>
    )
  }
  return (
    <div className="container py-4">
      <hr className="border-cream-200" style={{ marginTop: height / 2, marginBottom: height / 2 }} />
    </div>
  )
}
