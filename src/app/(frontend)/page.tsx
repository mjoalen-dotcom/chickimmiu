import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { HeroVideo } from '@/components/home/HeroVideo'
import { AutoplayVideo } from '@/components/home/AutoplayVideo'
import { getPayload } from 'payload'
import { getMediaUrl, normalizeMediaUrl } from '@/lib/media-url'
import config from '@payload-config'

/**
 * `/` 歡迎頁（展示封面）v4 — 2026-08-23 Alan 拍板
 * ────────────────────────────────────────────────
 * - Header 極簡（Navbar 在 / 自動收掉公告帶+功能導覽列，見 Navbar.tsx）
 * - 主視覺：大影片或大圖，後台「首頁設定 → 歡迎頁」自選（heroMode）
 * - 往下拉：一邊照片一邊影片（cn.chuu 雙欄 cell 手法），素材同樣後台可換
 * - 點任何區域 → /home（原完整首頁）
 * 素材未設定時全部走內建 fallback（品牌影片 / 輪播圖 / 商品圖），不開天窗。
 */

export const revalidate = 300

const ENTER = '/home'

function getProductImage(product: Record<string, unknown>): string | undefined {
  const images = product.images as { image?: { url?: string } | number }[] | undefined
  if (!images?.length) return undefined
  const img = images[0]?.image
  if (typeof img === 'object' && img !== null) return normalizeMediaUrl(img.url)
  return undefined
}

async function fetchCoverData() {
  const defaults = {
    coverPage: {} as Record<string, unknown>,
    heroImages: [] as string[],
    bannerImage: null as string | null,
    lookProducts: [] as { name: string; price: number; image: string }[],
    gridImages: [] as { name: string; image: string }[],
  }
  if (!process.env.DATABASE_URI) return defaults

  try {
    const payload = await getPayload({ config })

    const [homepage, newDocs, hotDocs] = await Promise.all([
      payload
        .findGlobal({ slug: 'homepage-settings', depth: 2 })
        .then((r) => r as unknown as Record<string, unknown>)
        .catch(() => null as Record<string, unknown> | null),
      payload
        .find({ collection: 'products', sort: '-createdAt', limit: 2, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
      payload
        .find({ collection: 'products', where: { isHot: { equals: true } }, sort: '-createdAt', limit: 6, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
    ])

    // 熱銷不足 6 件用最新品補滿圖牆
    let gridDocs = hotDocs
    if (gridDocs.length < 6) {
      try {
        const fallback = await payload.find({ collection: 'products', sort: '-createdAt', limit: 8, depth: 1 })
        const seen = new Set(gridDocs.map((d) => String(d.id)))
        gridDocs = [
          ...gridDocs,
          ...(fallback.docs as unknown as Record<string, unknown>[]).filter((d) => !seen.has(String(d.id))),
        ].slice(0, 6)
      } catch { /* 有幾張算幾張 */ }
    }

    const cmsBanners = (homepage?.heroBanners as Array<Record<string, unknown>> | undefined) || []
    const heroImages = cmsBanners
      .map((b) => getMediaUrl(b.image))
      .filter((u): u is string => Boolean(u))
    const brandBanner = (homepage?.brandBanner as Record<string, unknown>) || {}
    const bannerImage = getMediaUrl(brandBanner.image)

    const lookProducts = newDocs
      .map((p) => {
        const image = getProductImage(p)
        if (!image) return null
        return { name: p.name as string, price: p.price as number, image }
      })
      .filter((p): p is { name: string; price: number; image: string } => p !== null)

    const gridImages = gridDocs
      .map((p) => {
        const image = getProductImage(p)
        if (!image) return null
        return { name: p.name as string, image }
      })
      .filter((p): p is { name: string; image: string } => p !== null)

    return {
      coverPage: (homepage?.coverPage as Record<string, unknown>) || {},
      heroImages,
      bannerImage: bannerImage || null,
      lookProducts,
      gridImages,
    }
  } catch {
    return defaults
  }
}

export default async function CoverPage() {
  const { coverPage, heroImages, bannerImage, lookProducts, gridImages } = await fetchCoverData()

  // ── 後台歡迎頁設定解析（未設定全走 fallback） ──
  const heroMode = (coverPage.heroMode as string) === 'image' ? 'image' : 'video'
  const heroVideoDesktop = getMediaUrl(coverPage.heroVideo) || '/videos/home-hero-16x9.mp4'
  const heroVideoMobile = getMediaUrl(coverPage.heroVideoMobile) || '/videos/home-hero-9x16.mp4'
  const heroImageUrl = getMediaUrl(coverPage.heroImage) || heroImages[0] || null
  const sideImageUrl =
    getMediaUrl(coverPage.sideImage) || heroImages[1] || lookProducts[0]?.image || null
  const sideVideoUrl = getMediaUrl(coverPage.sideVideo) || '/videos/ckmu-hero-v4.mp4'

  return (
    <main className="bg-white">
      {/* ── 1. 主視覺（大影片或大圖，點擊進 /home） ── */}
      {heroMode === 'video' ? (
        <HeroVideo
          desktopSrc={heroVideoDesktop}
          mobileSrc={heroVideoMobile}
          desktopPoster="/videos/home-hero-16x9-poster.jpg"
          mobilePoster="/videos/home-hero-9x16-poster.jpg"
          href={ENTER}
          tag="CHIC KIM & MIU"
          ctaText="進入賣場 · ENTER"
        />
      ) : heroImageUrl ? (
        <Link href={ENTER} className="group relative block h-[78vh] md:h-[92vh] overflow-hidden bg-cream-100">
          <Image
            src={heroImageUrl}
            alt="CHIC KIM & MIU"
            fill
            className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-700"
            sizes="100vw"
            priority
            unoptimized
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent pt-24 pb-10 pointer-events-none">
            <div className="container">
              <p className="text-[11px] tracking-[0.35em] text-white/85 mb-3 uppercase">Chic Kim &amp; Miu</p>
              <span className="inline-flex items-center gap-2 text-xs tracking-[0.3em] uppercase text-white border-b border-white/70 pb-1">
                進入賣場 · ENTER <ArrowRight size={13} />
              </span>
            </div>
          </div>
        </Link>
      ) : null}

      {/* ── 2. 一邊照片一邊影片（cn.chuu 雙欄 cell） ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {sideImageUrl && (
          <Link href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
            <Image
              src={sideImageUrl}
              alt="CHIC KIM & MIU LOOK"
              fill
              className="object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
            />
          </Link>
        )}
        <Link href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-neutral-950">
          <AutoplayVideo
            src={sideVideoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            label="CHIC KIM & MIU FILM"
          />
        </Link>
      </div>

      {/* ── 3. LOOK 2 欄大卡（新品前 2 件） ── */}
      {lookProducts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {lookProducts.map((p, i) => (
            <Link key={p.name} href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent pt-20 pb-6 px-6 pointer-events-none">
                <p className="text-[10px] tracking-[0.3em] text-white/85 mb-2">
                  NEW IN · LOOK {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-sm md:text-base text-white font-medium truncate">{p.name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── 4. 全幅編輯大圖（形象 banner 圖或輪播第三張） ── */}
      {(bannerImage || heroImages[2] || heroImages[0]) && (
        <Link href={ENTER} className="group relative block h-[70vh] md:h-[92vh] overflow-hidden bg-cream-100 mt-3">
          <Image
            src={(bannerImage || heroImages[2] || heroImages[0])!}
            alt="CHIC KIM & MIU EDITORIAL"
            fill
            className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-700"
            sizes="100vw"
            unoptimized
          />
        </Link>
      )}

      {/* ── 5. six-grid 商品圖牆 ── */}
      {gridImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {gridImages.map((p, i) => (
            <Link key={`${p.name}-${i}`} href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-cover object-top group-hover:scale-[1.04] transition-transform duration-700"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 text-neutral-900 text-[10px] tracking-[0.18em] pointer-events-none">
                LOOK {String(i + 1).padStart(2, '0')}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ── 6. End card：品牌一句話 + 進入賣場 ── */}
      <Link href={ENTER} className="group block bg-neutral-950 text-white mt-3">
        <div className="container py-20 md:py-28 text-center">
          <p className="text-[11px] tracking-[0.35em] text-white/60 mb-5 uppercase">Chic Kim &amp; Miu</p>
          <h2 className="text-2xl md:text-4xl font-serif leading-snug mb-8">
            優雅，是妳本來的樣子。
          </h2>
          <span className="inline-flex items-center gap-2 border border-white/70 px-10 py-4 text-xs tracking-[0.3em] uppercase group-hover:bg-white group-hover:text-neutral-900 transition-colors">
            進入賣場 · ENTER <ArrowRight size={14} />
          </span>
        </div>
      </Link>
    </main>
  )
}
