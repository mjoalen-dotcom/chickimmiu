import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Instagram, Youtube, Facebook, MessageCircle, Globe, Music2 } from 'lucide-react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { normalizeMediaUrl } from '@/lib/media-url'
import { ProductCard } from '@/components/product/ProductCard'

interface Props {
  params: Promise<{ slug: string }>
}

type Block = Record<string, unknown> & { blockType: string }
type MediaDoc = { id?: string | number; url?: string; alt?: string } | null | undefined
type ProductDoc = Record<string, unknown> & { id: string | number; slug: string }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
    })
    const page = docs[0] as unknown as Record<string, unknown> | undefined
    if (!page) return { title: '頁面不存在' }
    const seo = page.seo as unknown as Record<string, unknown> | undefined
    return {
      title: (seo?.metaTitle as string) || (page.title as string),
      description: (seo?.metaDescription as string) || undefined,
    }
  } catch {
    return { title: slug }
  }
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params
  let page: Record<string, unknown> | null = null

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'pages',
        where: { slug: { equals: slug }, status: { equals: 'published' } },
        limit: 1,
        depth: 3,
      })
      page = (docs[0] as unknown as Record<string, unknown>) || null
    } catch {
      // DB not ready
    }
  }

  if (!page) notFound()

  const sections = (page.layout as unknown as Block[]) || (page.sections as unknown as Block[]) || []

  return (
    <main className="bg-cream-50 min-h-screen">
      {sections.map((section, idx) => (
        <SectionRenderer key={idx} section={section} />
      ))}
    </main>
  )
}

/* ────────────────────────────────────────────────────────────────────
   SectionRenderer — switch over blockType, dispatch to per-block fn
   ──────────────────────────────────────────────────────────────────── */

function SectionRenderer({ section }: { section: Block }) {
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
    case 'kol-persona':
      return <KOLPersona section={section} />
    case 'rich-content':
      return <RichContentBlock section={section} />
    case 'image-gallery':
      return <ImageGallery section={section} />
    case 'product-showcase':
      return <ProductShowcase section={section} />
    case 'cta':
      // F1: 修 PR #134 之前 renderer 寫 'call-to-action' (不符 schema slug 'cta') 永不觸發的 bug
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
   Existing blocks (with bug fixes F1-F5)
   ════════════════════════════════════════════════════════════════════ */

function HeroBanner({ section }: { section: Block }) {
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
   New magazine blocks (PR #136)
   ════════════════════════════════════════════════════════════════════ */

function MagazineCover({ section }: { section: Block }) {
  const image = section.image as MediaDoc
  const layout = (section.layout as 'left' | 'center' | 'bottom') || 'center'
  const theme = (section.theme as 'light' | 'dark' | 'gold') || 'light'
  const cornerLabels = (section.cornerLabels as Array<{ text: string }>) || []

  const themeBg =
    theme === 'dark'
      ? 'bg-foreground'
      : theme === 'gold'
        ? 'bg-gradient-to-br from-cream-100 via-blush-50 to-gold-100'
        : 'bg-cream-50'
  const textColor = theme === 'dark' ? 'text-cream-50' : 'text-foreground'
  const subColor = theme === 'dark' ? 'text-cream-200/70' : 'text-muted-foreground'

  const alignClass =
    layout === 'left'
      ? 'items-start text-left'
      : layout === 'bottom'
        ? 'items-center text-center justify-end'
        : 'items-center text-center justify-center'

  return (
    <section className={`relative min-h-[80vh] flex flex-col ${alignClass} ${themeBg} overflow-hidden`}>
      {image?.url && (
        <Image
          src={normalizeMediaUrl(image.url) || image.url}
          alt={image.alt || (section.heading as string) || ''}
          fill
          priority
          className="object-cover opacity-90"
        />
      )}
      {/* Issue label corner */}
      {Boolean(section.issueLabel) && (
        <div
          className={`absolute top-6 ${layout === 'left' ? 'left-6' : 'right-6'} z-10 text-xs tracking-[0.3em] uppercase ${textColor} ${image?.url ? 'bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm text-white' : ''}`}
        >
          {section.issueLabel as string}
        </div>
      )}
      {/* Corner labels (top-left or distributed) */}
      {cornerLabels.length > 0 && (
        <div className={`absolute ${layout === 'left' ? 'top-6 right-6' : 'top-6 left-6'} z-10 flex flex-col gap-1.5`}>
          {cornerLabels.map((lbl, i) => (
            <span
              key={i}
              className={`text-[10px] tracking-[0.2em] uppercase px-2 py-1 ${image?.url ? 'bg-white/80 text-foreground' : 'bg-foreground/10 text-foreground'} rounded`}
            >
              {lbl.text}
            </span>
          ))}
        </div>
      )}
      <div className={`container relative z-10 py-20 md:py-32 ${layout === 'left' ? 'pl-8 md:pl-16' : ''}`}>
        <h2
          className={`font-serif leading-[0.95] tracking-tight mb-6 ${
            layout === 'left'
              ? 'text-5xl md:text-7xl lg:text-8xl'
              : 'text-5xl md:text-7xl lg:text-9xl'
          } ${image?.url ? 'text-white drop-shadow-md' : textColor}`}
        >
          {section.heading as string}
        </h2>
        {Boolean(section.subheading) && (
          <p
            className={`text-base md:text-lg max-w-xl tracking-wide ${layout === 'center' || layout === 'bottom' ? 'mx-auto' : ''} ${image?.url ? 'text-white/90' : subColor}`}
          >
            {section.subheading as string}
          </p>
        )}
      </div>
    </section>
  )
}

function PullQuote({ section }: { section: Block }) {
  const font = (section.font as 'serif' | 'sans') || 'serif'
  const alignment = (section.alignment as 'left' | 'center' | 'right') || 'center'
  const fontClass = font === 'serif' ? 'font-serif' : 'font-sans'
  const alignClass =
    alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center'

  return (
    <section className="py-16 md:py-24 bg-cream-50">
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

function EditorialSpread({ section }: { section: Block }) {
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

function LookbookGrid({ section }: { section: Block }) {
  const items =
    (section.items as Array<{
      image?: MediaDoc
      name?: string
      tags?: Array<{ text: string }>
      linkedProduct?: ProductDoc | string | number | null
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
            const linkHref = product?.slug ? `/products/${product.slug}` : null
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

const SOCIAL_ICON: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  threads: MessageCircle,
  tiktok: Music2,
  line: MessageCircle,
  website: Globe,
}

function KOLPersona({ section }: { section: Block }) {
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
   Existing blocks (continued — F2/F3/F4/F5 fixes)
   ════════════════════════════════════════════════════════════════════ */

function RichContentBlock({ section }: { section: Block }) {
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

function ImageGallery({ section }: { section: Block }) {
  const layout = (section.layout as 'grid' | 'carousel' | 'masonry') || 'grid'
  const images =
    (section.images as Array<{ image?: MediaDoc; caption?: string; link?: string }>) || []
  if (images.length === 0) return null

  // Carousel: horizontal scroll-snap (CSS-only)
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

  // Masonry: CSS columns
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
                  // Plain img for masonry — natural aspect ratio preserved
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

  // Default grid
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

function ProductShowcase({ section }: { section: Block }) {
  // F4: 原 renderer 沒有此 case，admin 填了不顯示。新增 grid + carousel 兩種 layout，沿用 ProductCard。
  const products = (section.products as Array<ProductDoc | string | number>) || []
  // 過濾出已 hydrate 的 product object（depth:3 應該已展開；如果只有 id 就跳過）
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
    // 客戶端佔位：admin 還沒選任何 product 時不要整段消失（讓 admin 看到區塊存在）
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

function CTA({ section }: { section: Block }) {
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

function FAQ({ section }: { section: Block }) {
  // F3: answer 是 Lexical richText，原 renderer 寫死「由 Payload Rich Text 渲染」placeholder。
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

function Testimonial({ section }: { section: Block }) {
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

function Countdown({ section }: { section: Block }) {
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
        <div className="flex justify-center gap-3 md:gap-4 mb-8">
          {['天', '時', '分', '秒'].map((unit) => (
            <div
              key={unit}
              className={`rounded-xl p-4 w-16 md:w-20 shadow-sm ${bg?.url ? 'bg-white/95 text-foreground backdrop-blur-sm' : 'bg-white'}`}
            >
              <p className="text-2xl md:text-3xl font-medium">00</p>
              <p className="text-[10px] text-muted-foreground tracking-wider">{unit}</p>
            </div>
          ))}
        </div>
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

function VideoEmbed({ section }: { section: Block }) {
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

function Divider({ section }: { section: Block }) {
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
