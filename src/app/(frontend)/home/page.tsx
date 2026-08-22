import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Sparkles, Truck, RefreshCw, Shield, Crown, Gamepad2, Gift, Users,
  ShoppingBag, Heart, Tag, Flame, Star, Package, Clock, Globe, MessageCircle,
} from 'lucide-react'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { WelcomeTour } from '@/components/home/WelcomeTour'
import type { HeroSlide, HeroVariant } from '@/components/home/HeroCarousel'
import { CampaignBanner } from '@/components/campaign/CampaignBanner'
import { UGCGallery } from '@/components/ugc/UGCGallery'
import { Price } from '@/components/common/Price'
import { NewsletterForm } from '@/components/home/NewsletterForm'
import { getPayload } from 'payload'
import { getMediaUrl, normalizeMediaUrl } from '@/lib/media-url'
import { blogCategoryLabel } from '@/lib/blog/categoryTaxonomy'
import config from '@payload-config'

// 步驟09（FE-QA Prompt H）：首頁屬行銷內容不需即時，改用 ISR 而非每次
// request 都重新查 9 個 collection。300 秒＝後台改商品/活動後最多 5
// 分鐘內在首頁反映，換來絕大多數請求直接吃快取、不再等資料庫。
export const revalidate = 300

/* ── Icon Map ── */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles, Truck, RefreshCw, Shield, Crown, Gamepad2, Gift, Users,
  ShoppingBag, Heart, Tag, Flame, Star, Package, Clock, Globe, MessageCircle,
}

/* ── Helper: extract first image URL from a product ── */
function getProductImage(product: Record<string, unknown>): string | undefined {
  const images = product.images as { image?: { url?: string } | number }[] | undefined
  if (!images?.length) return undefined
  const img = images[0]?.image
  if (typeof img === 'object' && img !== null) return normalizeMediaUrl(img.url)
  return undefined
}

/* getMediaUrl imported from @/lib/media-url */

/* ── Fetch homepage settings + products ──
 * 步驟09效能優化（FE-QA Prompt H）：原本 9 個 payload 查詢完全依序
 * await，互相阻塞，是首頁 TTFB 11 秒+的主因（見 lighthouse-before/）。
 * 改為兩批平行：第一批（homepage settings + 站台主題）彼此不相依；
 * 第二批（新品/熱銷/部落格/分類標籤/UGC）都只依賴第一批算出的
 * limit/mode，彼此也不相依。熱銷不足4件時的補位查詢仍保持依序（需要
 * 先看到 hotResult 結果才知道要不要補），屬低頻例外情況不影響主線。
 * 每個查詢各自保留原本的 try/catch fallback，行為與修改前完全一致，
 * 只是不再互相排隊等待。
 */
async function fetchHomeData() {
  const defaults = {
    homepage: null as Record<string, unknown> | null,
    activeTheme: null as Record<string, unknown> | null,
    newProducts: [] as Record<string, unknown>[],
    hotProducts: [] as Record<string, unknown>[],
    heroBanners: [] as string[],
    blogPosts: [] as Record<string, unknown>[],
    blogCategoryLabels: {} as Record<string, string>,
    ugcDocs: [] as Record<string, unknown>[],
  }

  if (!process.env.DATABASE_URI) return defaults

  try {
    const payload = await getPayload({ config })

    // ── 第一批：彼此不相依，平行查 ──
    const [homepage, activeTheme] = await Promise.all([
      payload
        .findGlobal({ slug: 'homepage-settings', depth: 2 })
        .then((r) => r as unknown as Record<string, unknown>)
        .catch(() => null as Record<string, unknown> | null),
      payload
        .find({ collection: 'site-themes', where: { isActive: { equals: true } }, limit: 1, depth: 0 })
        .then((r) => (r.docs[0] as unknown as Record<string, unknown>) || null)
        .catch(() => null as Record<string, unknown> | null),
    ])

    const newLimit = (homepage?.newProductsSection as Record<string, unknown>)?.limit as number || 8
    const hotLimit = (homepage?.hotProductsSection as Record<string, unknown>)?.limit as number || 8
    const journalSection = homepage?.styleJournalSection as Record<string, unknown> | undefined
    const journalMode = journalSection?.mode as string || 'auto'
    const journalLimit = journalSection?.limit as number || 3
    const ugcSection = homepage?.ugcSection as Record<string, unknown> | undefined
    const ugcLimit = (ugcSection?.maxItems as number) || 6

    // ── 第二批：都只依賴上面算出的 limit/mode，彼此不相依，平行查 ──
    const [newProducts, hotResultDocs, blogPosts, blogCategoryLabels, ugcDocs] = await Promise.all([
      payload
        .find({ collection: 'products', sort: '-createdAt', limit: newLimit, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
      payload
        .find({ collection: 'products', where: { isHot: { equals: true } }, sort: '-createdAt', limit: hotLimit, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
      journalMode === 'auto'
        ? payload
            .find({
              collection: 'blog-posts',
              // publishToKimLafayette 不再排除購物網站顯示（2026-08-15 Alan
              // 決策：文章可同時出現在兩站，該欄位只控制是否額外同步進
              // blog.kimlafayette.com 的 feed）。
              where: {
                status: { equals: 'published' },
                visibility: { equals: 'public' },
              },
              sort: '-publishedAt',
              limit: journalLimit,
              depth: 1,
            })
            .then((r) => r.docs as unknown as Record<string, unknown>[])
            .catch(() => [] as Record<string, unknown>[])
        : Promise.resolve([] as Record<string, unknown>[]),
      // 不再只抓 site:'store' 分類——首頁「穿搭誌」現在也可能混入
      // publishToKimLafayette 文章（見上方註解），只抓 store 分類會讓那些
      // 文章的分類標籤找不到對應值。
      payload
        .find({ collection: 'blog-categories', sort: 'displayOrder', limit: 100, depth: 0 })
        .then((r) => Object.fromEntries(r.docs.map((category) => [String(category.value), String(category.name)])))
        .catch(() => ({}) as Record<string, string>),
      payload
        .find({ collection: 'ugc-posts', where: { status: { equals: 'approved' } }, sort: '-isPinned,-createdAt', limit: ugcLimit, depth: 2 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
    ])

    // 熱銷不足 4 件才補位查詢——需要先看到上面的結果，維持依序（低頻例外）
    let hotProducts = hotResultDocs
    if (hotProducts.length < 4) {
      try {
        const fallback = await payload.find({ collection: 'products', sort: '-createdAt', limit: hotLimit, page: 2, depth: 1 })
        hotProducts = fallback.docs as unknown as Record<string, unknown>[]
      } catch { /* 保留原本 hotResultDocs（可能是空陣列）*/ }
    }

    // Build hero banners from products as fallback
    const allProducts = [...newProducts, ...hotProducts]
    const heroBanners = allProducts.map(getProductImage).filter(Boolean).slice(0, 3) as string[]

    return {
      homepage,
      activeTheme,
      newProducts,
      hotProducts,
      heroBanners,
      blogPosts,
      blogCategoryLabels,
      ugcDocs,
    }
  } catch {
    return defaults
  }
}

export default async function HomePage() {
  const {
    homepage,
    activeTheme,
    newProducts,
    hotProducts,
    heroBanners,
    blogPosts,
    blogCategoryLabels,
    ugcDocs,
  } = await fetchHomeData()

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

  // ── Hero variant resolution ──
  // 優先序：HomepageSettings.heroLayoutOverride > activeTheme.heroLayout > 'split'
  const validVariants: HeroVariant[] = ['split', 'editorial', 'cinematic', 'magazine']
  const overrideRaw = homepage?.heroLayoutOverride as string | undefined
  const themeLayout = activeTheme?.heroLayout as string | undefined
  const heroVariant: HeroVariant =
    overrideRaw && overrideRaw !== 'inherit' && validVariants.includes(overrideRaw as HeroVariant)
      ? (overrideRaw as HeroVariant)
      : themeLayout && validVariants.includes(themeLayout as HeroVariant)
        ? (themeLayout as HeroVariant)
        : 'split'

  const heroMinDesktop = (activeTheme?.heroMinHeightDesktop as number | undefined)
  const heroMinMobile = (activeTheme?.heroMinHeightMobile as number | undefined)

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
        { icon: 'Clock', label: '新品現貨', href: '/products?tag=new', color: 'text-gold-500' },
        { icon: 'Sparkles', label: '正式洋裝', href: '/category/formal-dresses', color: 'text-rose-500' },
        { icon: 'Flame', label: '熱銷推薦', href: '/products?tag=hot', color: 'text-red-500' },
        { icon: 'MessageCircle', label: 'LINE 尺寸', href: 'https://page.line.me/nqo0262k', color: 'text-green-600' },
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
        { icon: 'Truck', label: '滿額免運', desc: '依物流方式自動顯示門檻' },
        { icon: 'Clock', label: '現貨快出', desc: '現貨付款後 1-3 個工作天出貨' },
        { icon: 'Shield', label: '安全付款', desc: '信用卡、LINE Pay、貨到付款' },
        { icon: 'MessageCircle', label: '尺寸協助', desc: 'LINE 提供身高體重可協助抓版' },
      ]

  // ── Real UGC posts from Payload ──
  // （LB-07：demo fallback 已移除，UGC 區塊只吃真實 ugc-posts）
  type UGCProductRef = { slug: string; name: string; price: number; image: string }
  type UGCItemProp = {
    id: string; authorName: string; authorHandle: string; authorAvatar?: string
    platform: 'instagram' | 'facebook' | 'tiktok'; contentType: 'image' | 'video' | 'carousel' | 'reel'
    image: string; caption?: string; likes: number; comments: number
    externalUrl?: string; taggedProducts?: UGCProductRef[]
  }
  const ugcPosts = ugcDocs.map<UGCItemProp | null>((d) => {
    const mediaItems = d.mediaItems as Array<Record<string, unknown>> | null
    const firstMedia = mediaItems?.[0]
    const fileDoc = firstMedia?.file as Record<string, unknown> | null
    const image = normalizeMediaUrl(fileDoc?.url as string | undefined)
      ?? (firstMedia?.thumbnailUrl as string | null)
      ?? null
    if (!image) return null

    const rawPlatform = (d.platform as string) ?? 'instagram'
    const platform = (['instagram', 'facebook', 'tiktok'].includes(rawPlatform)
      ? rawPlatform : 'instagram') as UGCItemProp['platform']

    const rawContent = (d.contentType as string) ?? 'image'
    const contentType = (['image', 'video', 'carousel', 'reel'].includes(rawContent)
      ? rawContent : 'image') as UGCItemProp['contentType']

    const taggedProductDocs = d.taggedProducts as Array<Record<string, unknown>> | null
    const taggedProducts: UGCProductRef[] = (taggedProductDocs ?? [])
      .map((p) => {
        const slug = p.slug as string | undefined
        const name = p.name as string | undefined
        const price = p.price as number | undefined
        const imgs = p.images as { image?: { url?: string } }[] | undefined
        const img = normalizeMediaUrl(imgs?.[0]?.image?.url)
        if (!slug || !name || typeof price !== 'number' || !img) return null
        return { slug, name, price, image: img }
      })
      .filter((p): p is UGCProductRef => p !== null)

    return {
      id: String(d.id),
      authorName: (d.authorName as string) || '會員',
      authorHandle: (d.authorHandle as string) || '',
      platform,
      contentType,
      image,
      caption: (d.caption as string | null) ?? undefined,
      likes: (d.likes as number) ?? 0,
      comments: (d.comments as number) ?? 0,
      externalUrl: (d.externalUrl as string | null) ?? undefined,
      taggedProducts: taggedProducts.length > 0 ? taggedProducts : undefined,
    }
  }).filter((p): p is UGCItemProp => p !== null)

  // ── Section configs ──
  const newSection = (homepage?.newProductsSection as Record<string, unknown>) || {}
  const hotSection = (homepage?.hotProductsSection as Record<string, unknown>) || {}
  const brandBanner = (homepage?.brandBanner as Record<string, unknown>) || {}
  const journalSection = (homepage?.styleJournalSection as Record<string, unknown>) || {}
  const ugcSection = (homepage?.ugcSection as Record<string, unknown>) || {}
  const newsletterSection = (homepage?.newsletterSection as Record<string, unknown>) || {}

  return (
    <main>
      {/* 首訪任務式導覽（拿點數→測驗個性→升等→兌換，localStorage 一次性） */}
      <WelcomeTour />
      {/* Campaign Engine：活動主張 + server 倒數（promotion-settings.storefrontEnabled 開才顯示） */}
      <CampaignBanner surface="home" />
      {/* ── Hero Carousel ── */}
      <HeroCarousel
        banners={heroBanners}
        slides={heroSlides}
        variant={heroVariant}
        minHeightDesktop={heroMinDesktop}
        minHeightMobile={heroMinMobile}
      />

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

      <ConversionRescueBand />

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
                      <Price twd={price} />
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
                        <Price twd={salePrice ?? price} />
                      </span>
                      {Boolean(salePrice) && (
                        <span className="text-xs text-muted-foreground line-through">
                          <Price twd={price} />
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
                  const rawCategory = post.category
                  const categoryValue =
                    typeof rawCategory === 'string'
                      ? rawCategory
                      : rawCategory && typeof rawCategory === 'object'
                        ? String((rawCategory as Record<string, unknown>).value || '')
                        : ''
                  const categoryName =
                    blogCategoryLabels[categoryValue] || blogCategoryLabel(categoryValue)
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
                        {categoryValue && (
                          <p className="text-[10px] tracking-widest text-gold-500 mb-2">
                            {categoryName}
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

      {/* ── 穿搭靈感（UGC） ──
          LB-07：只在有「真實」ugc-posts 時渲染。空集合不再 fallback 到
          內建 demo 假網紅/假讚數（公平交易法不實廣告曝險）。 */}
      {(ugcSection.visible !== false) && ugcPosts.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="container">
            <UGCGallery
              layout="shoppable_gallery"
              maxItems={(ugcSection.maxItems as number) || 6}
              ugcPosts={ugcPosts}
            />
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
            <NewsletterForm
              placeholder={(newsletterSection.placeholder as string) || 'your@email.com'}
              buttonText={(newsletterSection.buttonText as string) || '訂閱'}
              source="homepage"
            />
          </div>
        </section>
      )}
    </main>
  )
}

/* ── 共用元件 ── */

function ConversionRescueBand() {
  const entries = [
    {
      eyebrow: 'FAST PICK',
      title: '現貨快出',
      desc: '先看近期可快速出貨的新品與熱銷款。',
      href: '/products?tag=new',
      cta: '看新品',
    },
    {
      eyebrow: 'OCCASION',
      title: '婚禮正式洋裝',
      desc: '聚餐、婚禮、正式場合先從這區選。',
      href: '/category/formal-dresses',
      cta: '看洋裝',
    },
    {
      eyebrow: 'BEST MATCH',
      title: '熱銷不失手',
      desc: '從顧客最常下手的款式開始挑。',
      href: '/products?tag=hot',
      cta: '看熱銷',
    },
  ]

  return (
    <section className="bg-foreground text-cream-50">
      <div className="container py-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-[0.85fr_2fr] md:items-center">
          <div>
            <p className="text-[11px] tracking-[0.32em] text-gold-300 mb-2">72H STYLE EDIT</p>
            <h2 className="text-2xl md:text-3xl font-serif">今天先從好下手的款開始</h2>
            <p className="mt-3 text-sm leading-6 text-cream-50/70">
              現貨、正式場合、熱銷款先整理好；尺寸不確定可直接找 LINE 客服。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.title}
                href={entry.href}
                className="group rounded-lg border border-cream-50/15 bg-white/[0.06] p-4 transition-colors hover:border-gold-300/70 hover:bg-white/[0.1]"
              >
                <p className="text-[10px] tracking-[0.24em] text-gold-300 mb-2">{entry.eyebrow}</p>
                <h3 className="text-sm font-medium">{entry.title}</h3>
                <p className="mt-2 min-h-10 text-xs leading-5 text-cream-50/65">{entry.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs text-gold-200 group-hover:text-gold-100">
                  {entry.cta} <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

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
