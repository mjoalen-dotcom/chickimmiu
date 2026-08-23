'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import { HeroVideo } from './HeroVideo'
import { AutoplayVideo } from './AutoplayVideo'
import { getMediaUrl } from '@/lib/media-url'

/**
 * CoverView — 歡迎頁（/ 封面）渲染 + 後台所改即所見（2026-08-23）
 * ──────────────────────────────────────────────────────────────
 * 公開頁：SSR 用 initialGlobal 渲染（跟原本 server 版一模一樣）。
 * 後台「首頁設定 → 即時預覽」：此頁被載進 admin iframe，useLivePreview
 * 收表單 postMessage → 欄位一改（含上傳素材、增刪媒體牆列）畫面即時更新，
 * upload 關聯由 lib 依 depth 自動補查。不在 iframe 內時 hook 直接回傳
 * initialData，公開訪客零額外開銷。
 */

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
  layout: 'full' | 'split' | 'grid3'
  media: MediaRef
  mediaRight: MediaRef | null
  mediaThird: MediaRef | null
  heading: string | null
  caption: string | null
}

/** chuu 式區塊大標（列上方，字重 400、留白大） */
function RowHeading({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="container">
      <h2 className="text-2xl md:text-[32px] font-serif font-normal leading-tight mb-5 md:mb-7">
        {text}
      </h2>
    </div>
  )
}

function WallCell({ media, variant }: { media: MediaRef; variant: 'full' | 'cell' }) {
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

export function CoverView({
  initialGlobal,
  fallbackProductImage,
  serverURL,
}: {
  initialGlobal: Record<string, unknown>
  fallbackProductImage: string | null
  serverURL: string
}) {
  const { data } = useLivePreview<Record<string, unknown>>({
    initialData: initialGlobal,
    serverURL,
    depth: 2,
  })

  // ── 從（可能是即時的）global 資料推導所有素材 ──
  const coverPage = (data?.coverPage as Record<string, unknown>) || {}

  const rawSections = (coverPage.sections as Array<Record<string, unknown>> | undefined) || []
  const wallRows: WallRow[] = rawSections
    .map((row) => {
      const media = resolveMedia(row.media)
      if (!media) return null
      const layout =
        row.layout === 'split' ? ('split' as const)
        : row.layout === 'grid3' ? ('grid3' as const)
        : ('full' as const)
      return {
        layout,
        media,
        mediaRight: resolveMedia(row.mediaRight),
        mediaThird: resolveMedia(row.mediaThird),
        heading: (row.heading as string | null) || null,
        caption: (row.caption as string | null) || null,
      }
    })
    .filter((r): r is WallRow => r !== null)

  const cmsBanners = (data?.heroBanners as Array<Record<string, unknown>> | undefined) || []
  const heroImages = cmsBanners
    .map((b) => getMediaUrl(b.image))
    .filter((u): u is string => Boolean(u))
  const brandBanner = (data?.brandBanner as Record<string, unknown>) || {}
  const bannerImage = getMediaUrl(brandBanner.image) || null

  const heroMode = (coverPage.heroMode as string) === 'image' ? 'image' : 'video'
  const heroVideoDesktop = getMediaUrl(coverPage.heroVideo) || '/videos/home-hero-16x9.mp4'
  const heroVideoMobile = getMediaUrl(coverPage.heroVideoMobile) || '/videos/home-hero-9x16.mp4'
  const heroImageUrl = getMediaUrl(coverPage.heroImage) || heroImages[0] || null

  const sideImageUrl =
    getMediaUrl(coverPage.sideImage) || heroImages[1] || fallbackProductImage || null
  // ⚠️ 2026-08-23：原內建 ckmu-hero-v4.mp4 實為 chuu 官網螢幕錄影（參考素材，
  // 版權不屬我方）已整檔移除；預設改用品牌直式影片（Alan 指定的自家 Reel）
  const sideVideoUrl = getMediaUrl(coverPage.sideVideo) || '/videos/home-hero-9x16.mp4'
  const editorialImageUrl = bannerImage || heroImages[2] || heroImages[0] || null

  return (
    <main className="bg-white">
      {/* ── 1. 主視覺（大影片或大圖，點擊進 /home） ── */}
      {heroMode === 'video' ? (
        <HeroVideo
          // key：後台換影片時強制 remount，讓新 src 立即生效
          key={`${heroVideoDesktop}|${heroVideoMobile}`}
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
        wallRows.map((row, ri) => (
          // 2026-08-24 Alan 拍板（v4 參考錄影）：格與格、列與列完全貼合零間隙；
          // 只有帶大標的列上方留呼吸空間
          <section key={ri} className={row.heading ? 'pt-12 md:pt-20' : row.layout === 'grid3' ? 'mt-3 md:mt-6' : ''}>
            <RowHeading text={row.heading} />
            {row.layout === 'grid3' ? (
              // chuu 下方 lookbook 手法：三欄微間距（水平 12px / 垂直 24px）
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-6 px-3">
                {[row.media, row.mediaRight, row.mediaThird]
                  .filter((m): m is MediaRef => m !== null)
                  .map((m, ci) => (
                    <Link key={ci} href={ENTER} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                      <WallCell media={m} variant="cell" />
                      {ci === 0 && <Caption text={row.caption} />}
                    </Link>
                  ))}
              </div>
            ) : row.layout === 'split' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
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
                href={ENTER}
                className={`group relative block overflow-hidden bg-cream-100 ${
                  row.media.isVideo ? '' : 'h-[70vh] md:h-[92vh]'
                }`}
              >
                <WallCell media={row.media} variant="full" />
                <Caption text={row.caption} />
              </Link>
            )}
          </section>
        ))
      ) : (
        <>
          {/* ── 預設精簡版：一邊照片一邊影片 + 形象大圖（零間隙貼合） ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
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
                key={sideVideoUrl}
                src={sideVideoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                label="CHIC KIM & MIU FILM"
              />
            </Link>
          </div>
          {editorialImageUrl && (
            <Link href={ENTER} className="group relative block h-[70vh] md:h-[92vh] overflow-hidden bg-cream-100">
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

      {/* ── 3. End card：品牌一句話 + 進入賣場（與牆貼合） ── */}
      <Link href={ENTER} className="group block bg-neutral-950 text-white">
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
