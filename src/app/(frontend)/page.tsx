import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Sparkles, Truck, RefreshCw, Shield, Crown, Gamepad2, Gift, Users,
  ShoppingBag, Heart, Tag, Flame, Star, Package, Clock, Globe,
} from 'lucide-react'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import type { HeroSlide } from '@/components/home/HeroCarousel'
import { UGCGallery } from '@/components/ugc/UGCGallery'
import { getPayload } from 'payload'
import config from '@payload-config'

/* ── Icon Map ── */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles, Truck, RefreshCw, Shield, Crown, Gamepad2, Gift, Users,
  ShoppingBag, Heart, Tag, Flame, Star, Package, Clock, Globe,
}

/* ── Helper: extract first image URL from a product ── */
function getProductImage(product: Record<string, unknown>): string | undefined {
  const images = product.images as { image?: { url?: string } | number }[] | undefined
  if (!images?.length) return undefined
  const img = images[0]?.image
  if (typeof img === 'object' && img !== null) return img.url ?? undefined
  return undefined
}

/* ── Extract media URL from Payload upload field ── */
function getMediaUrl(field: unknown): string | undefined {
  if (!field) return undefined
  if (typeof field === 'object' && field !== null && 'url' in field) {
    return (field as { url?: string }).url ?? undefined
  }
  return undefined
}

/* ── Fetch homepage settings + products ── */
async function fetchHomeData() {
  const defaults = {
    homepage: null as Record<string, unknown> | null,
    newProducts: [] as Record<string, unknown>[],
    hotProducts: [] as Record<string, unknown>[],
    heroBanners: [] as string[],
    blogPosts: [] as Record<string, unknown>[],
  }

  if (!process.env.DATABASE_URI) return defaults

  try {
    const payload = await getPayload({ config })

    // Fetch homepage settings
    let homepage: Record<string, unknown> | null = null
    try {
      homepage = await payload.findGlobal({ slug: 'homepage-settings', depth: 2 }) as unknown as Record<string, unknown>
    } catch {
      // Global may not exist yet (first run before migration)
    }

    const newLimit = (homepage?.newProductsSection as Record<string, unknown>)?.limit as number || 8
    const hotLimit = (homepage?.hotProductsSection as Record<string, unknown>)?.limit as number || 8

    // Fetch products
    const newResult = await payload.find({ collection: 'products', sort: '-createdAt', limit: newLimit, depth: 1 })
    const hotResult = await payload.find({ collection: 'products', where: { isHot: { equals: true } }, sort: '-createdAt', limit: hotLimit, depth: 1 })

    let hotProducts = hotResult.docs as unknown as Record<string, unknown>[]
    if (hotProducts.length < 4) {
      const fallback = await payload.find({ collection: 'products', sort: '-createdAt', limit: hotLimit, page: 2, depth: 1 })
      hotProducts = fallback.docs as unknown as Record<string, unknown>[]
    }

    const newProducts = newResult.docs as unknown as Record<string, unknown>[]

    // Build hero banners from products as fallback
    const allProducts = [...newProducts, ...hotProducts]
    const heroBanners = allProducts.map(getProductImage).filter(Boolean).slice(0, 3) as string[]

    // Fetch blog posts for style journal
    let blogPosts: Record<string, unknown>[] = []
    const journalSection = homepage?.styleJournalSection as Record<string, unknown> | undefined
    const journalMode = journalSection?.mode as string || 'auto'
    const journalLimit = journalSection?.limit as number || 3

    if (journalMode === 'auto') {
      try {
        const blogResult = await payload.find({
          collection: 'blog-posts',
          where: { status: { equals: 'published' } },
          sort: '-publishedAt',
          limit: journalLimit,
          depth: 1,
        })
        blogPosts = blogResult.docs as unknown as Record<string, unknown>[]
      } catch { /* blog collection may be empty */ }
    }

    return { homepage, newProducts, hotProducts, heroBanners, blogPosts }
  } catch {
    return defaults
  }
}

export default async function HomePage() {
  const { homepage, newProducts, hotProducts, heroBanners, blogPosts } = await fetchHomeData()

  // ── CMS Hero Slides ──
  const cmsBanners = homepage?.heroBanners as Array<Record<string, unknown>> | undefined
  const heroSlides: HeroSlide[] | undefined = cmsBanners?.length
    ? cmsBanners.map((b) => ({
        image: getMediaUrl(b.image) || '',
        title: b.title as string | undefined,
        subtitle: b.subtitle as string | undefined,
        link: b.link as string | undefined,
        ctaText: b.ctaText as string | undefined,
      })).filter((s) => s.image)
    : undefined

  // ── Quick Menu ──
  const cmsQuickMenu = homepage?.quickMenu as Array<Record<string, unknown>> | undefined
  const quickMenuItems = cmsQuickMenu?.length
    ? cmsQuickMenu.map((item) => ({
        label: item.label as string,
        href: item.href as string,
        icon: item.icon as string || 'Sparkles',
        color: item.color as string || 'text-gold-500',
      }))
    : [
        { icon: 'Sparkles', label: '新品上市', href: '/products?tag=new', color: 'text-gold-500' },
        { icon: 'Crown', label: '訂閱方案', href: '/account/subscription', color: 'text-purple-500' },
        { icon: 'Gamepad2', label: '好運遊戲', href: '/games', color: 'text-pink-500' },
        { icon: 'Gift', label: '推薦好友', href: '/account/referrals', color: 'text-green-500' },
      ]

  // ── Service Highlights ──
  const cmsHighlights = homepage?.serviceHighlights as Array<Record<string, unknown>> | undefined
  const serviceItems = cmsHighlights?.length
    ? cmsHighlights.map((item) => ({
        icon: item.icon as string || 'Truck',
        label: item.label as string,
        desc: item.desc as string || '',
      }))
    : [
        { icon: 'Truck', label: '滿額免運', desc: '一般會員滿 $2,000 免運費' },
        { icon: 'RefreshCw', label: '7 天鑑賞期', desc: '不滿意可退換貨' },
        { icon: 'Shield', label: '安全付款', desc: '多元金流加密保護' },
        { icon: 'Sparkles', label: '會員好禮', desc: '註冊即享專屬優惠' },
      ]

  // ── Section configs ──
  const newSection = (homepage?.newProductsSection as Record<string, unknown>) || {}
  const hotSection = (homepage?.hotProductsSection as Record<string, unknown>) || {}
  const brandBanner = (homepage?.brandBanner as Record<string, unknown>) || {}
  const journalSection = (homepage?.styleJournalSection as Record<string, unknown>) || {}
  const ugcSection = (homepage?.ugcSection as Record<string, unknown>) || {}
  const newsletterSection = (homepage?.newsletterSection as Record<string, unknown>) || {}

  return (
    <main>
      {/* ── Hero Carousel ── */}
      <HeroCarousel banners={heroBanners} slides={heroSlides} />

      {/* ── 快速選單 ── */}
      <section className="bg-white border-b border-cream-200">
        <div className="container py-6 grid grid-cols-4 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {quickMenuItems.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Sparkles
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-2 py-3 rounded-xl hover:bg-cream-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full bg-cream-50 flex items-center justify-center ${item.color}`}>
                  <IconComp size={20} />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── 服務亮點 ── */}
      <section className="bg-white border-y border-cream-200">
        <div className="container py-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {serviceItems.map((feat) => {
            const IconComp = ICON_MAP[feat.icon] || Truck
            return (
              <div key={feat.label} className="flex items-center gap-3 justify-center md:justify-start">
                <IconComp size={20} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{feat.label}</p>
                  {feat.desc && <p className="text-xs text-muted-foreground hidden md:block">{feat.desc}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 新品上市 ── */}
      {(newSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <SectionHeader
              tag={(newSection.tag as string) || 'NEW IN'}
              title={(newSection.title as string) || '新品上市'}
              href={(newSection.href as string) || '/products?tag=new'}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {newProducts.map((product) => {
                const slug = product.slug as string
                const name = product.name as string
                const price = product.price as number
                const image = getProductImage(product)
                return (
                  <Link key={slug} href={`/products/${slug}`} className="group">
                    <div className="aspect-[3/4] rounded-2xl mb-3 overflow-hidden relative border border-cream-200">
                      {Boolean(image) && (
                        <Image
                          src={image!}
                          alt={name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-gold-500 text-white text-[10px] rounded-full tracking-wider font-medium">
                        NEW
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
                      {name}
                    </p>
                    <p className="text-sm text-gold-600 mt-1">
                      NT$ {price.toLocaleString()}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 熱銷推薦 ── */}
      {(hotSection.visible !== false) && (
        <section className="py-16 md:py-24 bg-cream-50">
          <div className="container">
            <SectionHeader
              tag={(hotSection.tag as string) || 'BEST SELLERS'}
              title={(hotSection.title as string) || '熱銷推薦'}
              href={(hotSection.href as string) || '/products?tag=hot'}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {hotProducts.map((product) => {
                const slug = product.slug as string
                const name = product.name as string
                const price = product.price as number
                const salePrice = product.salePrice as number | null | undefined
                const image = getProductImage(product)
                return (
                  <Link key={slug} href={`/products/${slug}`} className="group">
                    <div className="aspect-[3/4] rounded-2xl mb-3 overflow-hidden relative border border-cream-200">
                      {Boolean(image) && (
                        <Image
                          src={image!}
                          alt={name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-500 text-white text-[10px] rounded-full tracking-wider font-medium">
                        HOT
                      </span>
                      {Boolean(salePrice) && (
                        <span className="absolute top-3 right-3 px-2.5 py-1 bg-blush-200 text-red-600 text-[10px] rounded-full tracking-wider font-medium">
                          -{Math.round(((price - salePrice!) / price) * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
                      {name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gold-600">
                        NT$ {(salePrice ?? price).toLocaleString()}
                      </span>
                      {Boolean(salePrice) && (
                        <span className="text-xs text-muted-foreground line-through">
                          NT$ {price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 形象 Banner ── */}
      {(brandBanner.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="relative rounded-3xl overflow-hidden h-64 md:h-96 bg-cream-100">
              {(() => {
                const bannerImage = getMediaUrl(brandBanner.image) || heroBanners[2] || heroBanners[0]
                return bannerImage ? (
                  <Image
                    src={bannerImage}
                    alt="CHIC KIM & MIU 品牌形象"
                    fill
                    className="object-cover object-top"
                    unoptimized
                  />
                ) : null
              })()}
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16">
                <p className="text-xs tracking-[0.3em] text-gold-400 mb-3">
                  {(brandBanner.tagline as string) || 'SPECIAL EVENT'}
                </p>
                <h2 className="text-2xl md:text-4xl font-serif mb-4 text-white whitespace-pre-line">
                  {(brandBanner.title as string) || '專屬你美好的\n時尚優雅'}
                </h2>
                <p className="text-sm text-white/80 mb-8 max-w-md">
                  {(brandBanner.subtitle as string) || '精選百件春夏商品限時特惠，搶購你的命定單品！'}
                </p>
                <div>
                  <Link
                    href={(brandBanner.ctaLink as string) || '/products?tag=sale'}
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
                  >
                    {(brandBanner.ctaText as string) || '立即搶購'} <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 穿搭誌 ── */}
      {(journalSection.visible !== false) && (
        <section className="py-16 md:py-24 bg-cream-50">
          <div className="container">
            <SectionHeader
              tag={(journalSection.tag as string) || 'STYLE JOURNAL'}
              title={(journalSection.title as string) || '穿搭誌'}
              href={(journalSection.href as string) || '/blog'}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogPosts.length > 0 ? (
                blogPosts.map((post) => {
                  const slug = post.slug as string
                  const title = post.title as string
                  const publishedAt = post.publishedAt as string
                  const category = post.category as Record<string, unknown> | undefined
                  const featuredImage = getMediaUrl(post.featuredImage)
                  const date = publishedAt ? new Date(publishedAt).toLocaleDateString('zh-TW') : ''
                  return (
                    <Link key={slug} href={`/blog/${slug}`} className="group bg-white rounded-2xl overflow-hidden border border-cream-200">
                      <div className="aspect-[16/10] relative overflow-hidden bg-cream-100">
                        {featuredImage && (
                          <Image
                            src={featuredImage}
                            alt={title}
                            fill
                            className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="p-5">
                        {category && (
                          <p className="text-[10px] tracking-widest text-gold-500 mb-2">
                            {(category.name as string) || '穿搭教學'}
                          </p>
                        )}
                        <h3 className="text-sm font-medium mb-2 group-hover:text-gold-600 transition-colors">
                          {title}
                        </h3>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                    </Link>
                  )
                })
              ) : (
                /* Fallback: hardcoded sample posts when no blog posts exist */
                [
                  { title: '夏日約會穿搭指南：名媛風洋裝這樣搭', category: '穿搭教學', date: '2026.04.01' },
                  { title: '職場穿搭新定義：優雅又專業的通勤造型', category: '時尚趨勢', date: '2026.03.25' },
                  { title: '春夏必備單品：百搭直筒褲的 5 種穿法', category: '穿搭教學', date: '2026.03.18' },
                ].map((post, i) => {
                  const fallbackImage = heroBanners[i] || heroBanners[0] || null
                  return (
                    <Link key={i} href="/blog" className="group bg-white rounded-2xl overflow-hidden border border-cream-200">
                      <div className="aspect-[16/10] relative overflow-hidden bg-cream-100">
                        {fallbackImage && (
                          <Image
                            src={fallbackImage}
                            alt={post.title}
                            fill
                            className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] tracking-widest text-gold-500 mb-2">{post.category}</p>
                        <h3 className="text-sm font-medium mb-2 group-hover:text-gold-600 transition-colors">
                          {post.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">{post.date}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 穿搭靈感（UGC） ── */}
      {(ugcSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <UGCGallery layout="shoppable_gallery" maxItems={(ugcSection.maxItems as number) || 6} />
          </div>
        </section>
      )}

      {/* ── 訂閱電子報 ── */}
      {(newsletterSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container max-w-2xl text-center">
            <p className="text-xs tracking-[0.3em] text-gold-500 mb-3">
              {(newsletterSection.tag as string) || 'STAY CONNECTED'}
            </p>
            <h2 className="text-2xl md:text-3xl font-serif mb-4">
              {(newsletterSection.title as string) || '訂閱最新消息'}
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              {(newsletterSection.subtitle as string) || '搶先收到新品上市、限時優惠與專屬會員好禮通知'}
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder={(newsletterSection.placeholder as string) || 'your@email.com'}
                className="flex-1 px-5 py-3 rounded-full border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40 bg-white"
              />
              <button
                type="button"
                className="px-8 py-3 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
              >
                {(newsletterSection.buttonText as string) || '訂閱'}
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  )
}

/* ── 共用元件 ── */

function SectionHeader({ tag, title, href }: { tag: string; title: string; href: string }) {
  return (
    <div className="flex items-end justify-between mb-8 md:mb-12">
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{tag}</p>
        <h2 className="text-2xl md:text-3xl font-serif">{title}</h2>
      </div>
      <Link
        href={href}
        className="text-sm text-foreground/60 hover:text-gold-600 flex items-center gap-1 transition-colors"
      >
        查看全部 <ArrowRight size={14} />
      </Link>
    </div>
  )
}
