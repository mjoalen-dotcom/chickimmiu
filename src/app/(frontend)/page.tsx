import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { HeroVideo } from '@/components/home/HeroVideo'
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
    newProducts,
    hotProducts,
    heroBanners,
    blogPosts,
    blogCategoryLabels,
    ugcDocs,
  } = await fetchHomeData()

  // ── Quick Menu ──
  // chuu 化改版：icon/color 欄位不再渲染（保留在 CMS schema 不動），
  // 首頁改為極簡文字捷徑列 — 大量 icon 圓圈是「功能牆」感的主因之一。
  const cmsQuickMenu = homepage?.quickMenu as Array<Record<string, unknown>> | undefined
  const quickMenuItems = cmsQuickMenu?.length
    ? cmsQuickMenu.map((item) => ({
        label: item.label as string,
        href: item.href as string,
      }))
    : [
        { label: '新品現貨', href: '/products?tag=new' },
        { label: '正式洋裝', href: '/category/formal-dresses' },
        { label: '熱銷推薦', href: '/products?tag=hot' },
        { label: 'LINE 尺寸', href: 'https://page.line.me/nqo0262k' },
      ]

  // ── Service Highlights ──（同上：icon 欄位不再渲染，移至頁尾前細帶）
  const cmsHighlights = homepage?.serviceHighlights as Array<Record<string, unknown>> | undefined
  const serviceItems = cmsHighlights?.length
    ? cmsHighlights.map((item) => ({
        label: item.label as string,
        desc: item.desc as string || '',
      }))
    : [
        { label: '滿額免運', desc: '依物流方式自動顯示門檻' },
        { label: '現貨快出', desc: '現貨付款後 1-3 個工作天出貨' },
        { label: '安全付款', desc: '信用卡、LINE Pay、貨到付款' },
        { label: '尺寸協助', desc: 'LINE 提供身高體重可協助抓版' },
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

  // 展示牆（v2）：首頁只留大圖入口，不擺價格商品格 — 新品前 2 件做
  // 2 欄 LOOK 大卡，熱銷前 6 件做 six-grid 圖牆，其餘點 VIEW ALL 進列表
  const lookProducts = newProducts.slice(0, 2)
  const showcaseProducts = hotProducts.slice(0, 6)

  return (
    <main className="bg-white">
      {/* Campaign Engine：活動主張 + server 倒數（promotion-settings.storefrontEnabled 開才顯示） */}
      <CampaignBanner surface="home" />
      {/* ── Hero 影片（cn.chuu 式：整塊可點，直接進新品購物頁） ──
          素材：.minimax-agent/projects/ckmu-new-hero-video（15.5s montage，
          桌機 16:9 / 手機 9:16，重製跑該包 compose.py 後換 public/media 檔案） */}
      <HeroVideo
        desktopSrc="/videos/home-hero-16x9.mp4"
        mobileSrc="/videos/home-hero-9x16.mp4"
        desktopPoster="/videos/home-hero-16x9-poster.jpg"
        mobilePoster="/videos/home-hero-9x16-poster.jpg"
        href="/products?tag=new"
        tag="NEW IN · 2026"
        ctaText="SHOP NEW ARRIVALS"
      />

      {/* ── 極簡文字捷徑列（原 icon 快速選單 chuu 化） ── */}
      <nav className="bg-white border-b border-cream-200">
        <div className="container py-4 flex items-center justify-center gap-7 md:gap-12 overflow-x-auto">
          {quickMenuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="shrink-0 text-xs md:text-[13px] tracking-[0.22em] text-neutral-600 hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── 新品上市：LOOK 2 欄大圖 + 扁平商品格 ── */}
      {(newSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <SectionHeader
              tag={(newSection.tag as string) || 'NEW IN'}
              title={(newSection.title as string) || '新品上市'}
              href={(newSection.href as string) || '/products?tag=new'}
            />

            {lookProducts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lookProducts.map((product, i) => {
                  const slug = product.slug as string
                  const name = product.name as string
                  const price = product.price as number
                  const image = getProductImage(product)
                  return (
                    <Link key={slug} href={`/products/${slug}`} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                      {Boolean(image) && (
                        <Image
                          src={image!}
                          alt={name}
                          fill
                          className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent pt-20 pb-6 px-6">
                        <p className="text-[10px] tracking-[0.3em] text-white/85 mb-2">
                          NEW IN · LOOK {String(i + 1).padStart(2, '0')}
                        </p>
                        <p className="text-sm md:text-base text-white font-medium truncate">{name}</p>
                        <p className="text-sm text-white/85 mt-1"><Price twd={price} /></p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── 形象 Banner：全幅出血編輯圖（原圓角容器 chuu 化） ── */}
      {(brandBanner.visible !== false) && (
        <section className="relative h-[55vh] md:h-[78vh] overflow-hidden bg-cream-100">
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 pb-12 md:pb-20">
            <div className="container">
              <p className="text-[11px] tracking-[0.35em] text-white/80 mb-4">
                {(brandBanner.tagline as string) || 'SPECIAL EVENT'}
              </p>
              <h2 className="text-3xl md:text-5xl font-serif mb-5 text-white whitespace-pre-line leading-tight">
                {(brandBanner.title as string) || '專屬你美好的\n時尚優雅'}
              </h2>
              <p className="text-sm text-white/80 mb-8 max-w-md">
                {(brandBanner.subtitle as string) || '精選百件春夏商品限時特惠，搶購你的命定單品！'}
              </p>
              <Link
                href={(brandBanner.ctaLink as string) || '/products?tag=sale'}
                className="inline-flex items-center gap-2 border border-white/70 px-8 py-3.5 text-xs tracking-[0.3em] uppercase text-white hover:bg-white hover:text-neutral-900 transition-colors"
              >
                {(brandBanner.ctaText as string) || '立即搶購'} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 熱銷推薦：扁平商品格 ── */}
      {(hotSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <SectionHeader
              tag={(hotSection.tag as string) || 'BEST SELLERS'}
              title={(hotSection.title as string) || '熱銷推薦'}
              href={(hotSection.href as string) || '/products?tag=hot'}
            />
            {/* six-grid 圖牆（cn.chuu 手法）：純影像 + LOOK 編號，資訊 hover 才浮出 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {showcaseProducts.map((product, i) => {
                const slug = product.slug as string
                const name = product.name as string
                const price = product.price as number
                const salePrice = product.salePrice as number | null | undefined
                const image = getProductImage(product)
                return (
                  <Link key={slug} href={`/products/${slug}`} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                    {Boolean(image) && (
                      <Image
                        src={image!}
                        alt={name}
                        fill
                        className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    )}
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 text-neutral-900 text-[10px] tracking-[0.18em]">
                      {Boolean(salePrice)
                        ? `-${Math.round(((price - salePrice!) / price) * 100)}%`
                        : `LOOK ${String(i + 1).padStart(2, '0')}`}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent pt-14 pb-4 px-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-xs md:text-sm text-white font-medium truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/90"><Price twd={salePrice ?? price} /></span>
                        {Boolean(salePrice) && (
                          <span className="text-[11px] text-white/60 line-through"><Price twd={price} /></span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 品牌故事（cn.chuu editorial-text 手法：純文字編輯塊） ── */}
      <section className="py-16 md:py-24 border-t border-cream-200">
        <div className="container max-w-3xl text-center">
          <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-4 uppercase">Brand Introduction</p>
          <h2 className="text-2xl md:text-3xl font-serif leading-snug mb-6">
            CHIC KIM &amp; MIU — 優雅，是妳本來的樣子。
          </h2>
          <p className="text-sm leading-7 text-neutral-500 mb-3">
            首爾東大門直送，金老佛爺與 MIU 親自選版。從日常通勤到正式場合，
            每一件都以韓國當季版型與包容性尺碼，讓妳穿出自己的風格。
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 mt-4 text-[11px] tracking-[0.25em] uppercase text-neutral-500 hover:text-foreground pb-0.5 border-b border-transparent hover:border-foreground transition-colors"
          >
            About Us <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      <ConversionRescueBand />

      {/* ── 穿搭誌：扁平編輯卡 ── */}
      {(journalSection.visible !== false) && (
        <section className="py-16 md:py-24">
          <div className="container">
            <SectionHeader
              tag={(journalSection.tag as string) || 'STYLE JOURNAL'}
              title={(journalSection.title as string) || '穿搭誌'}
              href={(journalSection.href as string) || '/blog'}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-10">
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
                    <Link key={slug} href={`/blog/${slug}`} className="group">
                      <div className="aspect-[16/10] relative overflow-hidden bg-cream-100 mb-4">
                        {featuredImage && (
                          <Image
                            src={featuredImage}
                            alt={title}
                            fill
                            className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </div>
                      {categoryValue && (
                        <p className="text-[10px] tracking-[0.3em] text-neutral-400 mb-2 uppercase">
                          {categoryName}
                        </p>
                      )}
                      <h3 className="text-sm font-medium mb-1.5 group-hover:text-neutral-500 transition-colors">
                        {title}
                      </h3>
                      <p className="text-xs text-neutral-400">{date}</p>
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
                    <Link key={i} href="/blog" className="group">
                      <div className="aspect-[16/10] relative overflow-hidden bg-cream-100 mb-4">
                        {fallbackImage && (
                          <Image
                            src={fallbackImage}
                            alt={post.title}
                            fill
                            className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized
                          />
                        )}
                      </div>
                      <p className="text-[10px] tracking-[0.3em] text-neutral-400 mb-2 uppercase">{post.category}</p>
                      <h3 className="text-sm font-medium mb-1.5 group-hover:text-neutral-500 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-neutral-400">{post.date}</p>
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
        <section className="py-16 md:py-24 border-t border-cream-200">
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
        <section className="py-16 md:py-24 border-t border-cream-200">
          <div className="container max-w-2xl text-center">
            <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-3 uppercase">
              {(newsletterSection.tag as string) || 'STAY CONNECTED'}
            </p>
            <h2 className="text-2xl md:text-3xl font-serif mb-4">
              {(newsletterSection.title as string) || '訂閱最新消息'}
            </h2>
            <p className="text-sm text-neutral-500 mb-8">
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

      {/* ── 服務亮點細帶（原 icon 亮點列 chuu 化，移到頁尾前） ── */}
      <section className="border-t border-cream-200">
        <div className="container py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {serviceItems.map((feat) => (
            <div key={feat.label}>
              <p className="text-xs tracking-[0.18em] font-medium">{feat.label}</p>
              {feat.desc && <p className="text-xs text-neutral-400 mt-1.5 hidden md:block">{feat.desc}</p>}
            </div>
          ))}
        </div>
      </section>
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
    <section className="border-y border-cream-200 bg-white">
      <div className="container py-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-[0.85fr_2fr] md:items-center">
          <div>
            <p className="text-[11px] tracking-[0.32em] text-neutral-400 mb-3">STYLE EDIT</p>
            <h2 className="text-2xl md:text-3xl font-serif">今天先從好下手的款開始</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">
              現貨、正式場合、熱銷款先整理好；尺寸不確定可直接找 LINE 客服。
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {entries.map((entry) => (
              <Link
                key={entry.title}
                href={entry.href}
                className="group border-l border-cream-200 pl-5 transition-colors hover:border-neutral-400"
              >
                <p className="text-[10px] tracking-[0.24em] text-neutral-400 mb-2">{entry.eyebrow}</p>
                <h3 className="text-sm font-medium">{entry.title}</h3>
                <p className="mt-2 min-h-10 text-xs leading-5 text-neutral-500">{entry.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase text-neutral-600 group-hover:text-foreground transition-colors">
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
        <p className="text-[11px] tracking-[0.35em] text-neutral-400 mb-3 uppercase">{tag}</p>
        <h2 className="text-3xl md:text-4xl font-serif leading-tight">{title}</h2>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.25em] uppercase text-neutral-500 hover:text-foreground pb-0.5 border-b border-transparent hover:border-foreground transition-colors"
      >
        VIEW ALL <ArrowRight size={12} />
      </Link>
    </div>
  )
}
