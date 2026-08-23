import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { HeroVideo } from '@/components/home/HeroVideo'
import { AutoplayVideo } from '@/components/home/AutoplayVideo'
import { getPayload } from 'payload'
import { getMediaUrl } from '@/lib/media-url'
import config from '@payload-config'

/**
 * `/` 歡迎頁（展示封面）v5 — 2026-08-23 Alan 二修
 * ────────────────────────────────────────────────
 * - Header 極簡（Navbar 在 / 收掉公告帶+導覽列，見 Navbar.tsx）
 * - 主視覺：大影片或大圖，後台「首頁設定 → 歡迎頁」自選
 * - 中段：LV collection 式「展示媒體牆」— 後台逐列設定（整幅或左右雙欄，
 *   每格圖片/影片自動判別）。沒設定列時走精簡預設（雙欄照片|影片 + 形象大圖）。
 * - 自動商品 LOOK 卡已移除（Alan：「目前有很多LOOK」→ 封面內容全由後台策展）
 * - 點任何區域 → /home（原完整首頁）
 */

export const revalidate = 300

const ENTER = '/home'

type MediaRef = { url: string; isVideo: boolean }

function resolveMedia(val: unknown): MediaRef | null {
  if (!val || typeof val !== 'object') return null
  const url = getMediaUrl(val)
  if (!url) return null
  const mime = String((val as Record<string, unknown>).mimeType ?? '')
  return { url, isVideo: mime.startsWith('video/') || /\.(mp4|webm)$/i.test(url) }
}

type WallRow = {
  layout: 'full' | 'split'
  media: MediaRef
  mediaRight: MediaRef | null
  caption: string | null
}

async function fetchCoverData() {
  const defaults = {
    coverPage: {} as Record<string, unknown>,
    wallRows: [] as WallRow[],
    heroImages: [] as string[],
    bannerImage: null as string | null,
    fallbackProductImage: null as string | null,
  }
  if (!process.env.DATABASE_URI) return defaults

  try {
    const payload = await getPayload({ config })

    const [homepage, newDocs] = await Promise.all([
      payload
        .findGlobal({ slug: 'homepage-settings', depth: 2 })
        .then((r) => r as unknown as Record<string, unknown>)
        .catch(() => null as Record<string, unknown> | null),
      payload
        .find({ collection: 'products', sort: '-createdAt', limit: 1, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
    ])

    const coverPage = (homepage?.coverPage as Record<string, unknown>) || {}

    const rawSections = (coverPage.sections as Array<Record<string, unknown>> | undefined) || []
    const wallRows: WallRow[] = rawSections
      .map((row) => {
        const media = resolveMedia(row.media)
        if (!media) return null
        return {
          layout: row.layout === 'split' ? ('split' as const) : ('full' as const),
          media,
          mediaRight: resolveMedia(row.mediaRight),
          caption: (row.caption as string | null) || null,
        }
      })
      .filter((r): r is WallRow => r !== null)

    const cmsBanners = (homepage?.heroBanners as Array<Record<string, unknown>> | undefined) || []
    const heroImages = cmsBanners
      .map((b) => getMediaUrl(b.image))
      .filter((u): u is string => Boolean(u))
    const brandBanner = (homepage?.brandBanner as Record<string, unknown>) || {}

    const firstProduct = newDocs[0]
    const productImages = firstProduct?.images as { image?: { url?: string } | number }[] | undefined
    const firstImg = productImages?.[0]?.image
    const fallbackProductImage =
      typeof firstImg === 'object' && firstImg !== null ? getMediaUrl(firstImg) || null : null

    return {
      coverPage,
      wallRows,
      heroImages,
      bannerImage: getMediaUrl(brandBanner.image) || null,
      fallbackProductImage,
    }
  } catch {
    return defaults
  }
}

/* ── 媒體牆單格（圖片或影片） ── */
function WallCell({
  media,
  variant,
  priorityImage = false,
}: {
  media: MediaRef
  variant: 'full' | 'cell'
  priorityImage?: boolean
}) {
  if (media.isVideo) {
    return variant === 'full' ? (
      <AutoplayVideo src={media.url} className="w-full h-auto max-h-[94vh] object-cover" />
    ) : (
      <AutoplayVideo src={media.url} className="absolute inset-0 w-full h-full object-cover" />
    )
  }
  return (
    <Image
      src={media.url}
      alt="CHIC KIM & MIU"
      fill
      className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-700"
      sizes={variant === 'full' ? '100vw' : '(max-width: 768px) 100vw, 50vw'}
      priority={priorityImage}
      unoptimized
    />
  )
}

function Caption({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent pt-16 pb-5 px-6 pointer-events-none">
      <p className="text-[11px] tracking-[0.3em] text-white/90 uppercase">{text}</p>
    </div>
  )
}

export default async function CoverPage() {
  const { coverPage, wallRows, heroImages, bannerImage, fallbackProductImage } =
    await fetchCoverData()

  // ── 主視覺設定解析（未設定全走 fallback） ──
  const heroMode = (coverPage.heroMode as string) === 'image' ? 'image' : 'video'
  const heroVideoDesktop = getMediaUrl(coverPage.heroVideo) || '/videos/home-hero-16x9.mp4'
  const heroVideoMobile = getMediaUrl(coverPage.heroVideoMobile) || '/videos/home-hero-9x16.mp4'
  const heroImageUrl = getMediaUrl(coverPage.heroImage) || heroImages[0] || null

  // ── 預設精簡版素材（媒體牆沒設定列時用） ──
  const sideImageUrl =
    getMediaUrl(coverPage.sideImage) || heroImages[1] || fallbackProductImage || null
  const sideVideoUrl = getMediaUrl(coverPage.sideVideo) || '/videos/ckmu-hero-v4.mp4'
  const editorialImageUrl = bannerImage || heroImages[2] || heroImages[0] || null

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

      {/* ── 2. 展示媒體牆（後台逐列策展；LV collection 式） ── */}
      {wallRows.length > 0 ? (
        wallRows.map((row, ri) =>
          row.layout === 'split' ? (
            <div key={ri} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Link href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                <WallCell media={row.media} variant="cell" />
                <Caption text={row.caption} />
              </Link>
              {row.mediaRight && (
                <Link href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                  <WallCell media={row.mediaRight} variant="cell" />
                </Link>
              )}
            </div>
          ) : (
            <Link
              key={ri}
              href={ENTER}
              className={`group relative block overflow-hidden bg-cream-100 mt-3 ${
                row.media.isVideo ? '' : 'h-[70vh] md:h-[92vh]'
              }`}
            >
              <WallCell media={row.media} variant="full" />
              <Caption text={row.caption} />
            </Link>
          ),
        )
      ) : (
        <>
          {/* ── 預設精簡版：一邊照片一邊影片 + 形象大圖 ── */}
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
          {editorialImageUrl && (
            <Link href={ENTER} className="group relative block h-[70vh] md:h-[92vh] overflow-hidden bg-cream-100 mt-3">
              <Image
                src={editorialImageUrl}
                alt="CHIC KIM & MIU EDITORIAL"
                fill
                className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-700"
                sizes="100vw"
                unoptimized
              />
            </Link>
          )}
        </>
      )}

      {/* ── 3. End card：品牌一句話 + 進入賣場 ── */}
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
