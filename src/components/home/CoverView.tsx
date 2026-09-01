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
  link: string
}

/** chuu 式區塊大標：編號 eyebrow + serif 大標（時尚編輯級 typography） */
function RowHeading({ text, index }: { text: string | null; index: number }) {
  if (!text) return null
  return (
    <div className="container">
      <p className="text-[10px] tracking-[0.45em] text-neutral-400 mb-2.5">
        {String(index).padStart(2, '0')}
      </p>
      <h2 className="text-[26px] md:text-[34px] font-serif font-normal leading-tight mb-6 md:mb-8">
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
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent pt-16 pb-6 px-6 pointer-events-none">
      <p className="flex items-center gap-3 text-[10px] tracking-[0.35em] text-white/90 uppercase">
        <span className="inline-block w-6 h-px bg-white/70" aria-hidden="true" />
        {text}
      </p>
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
        link: ((row.link as string | null) || '').trim() || ENTER,
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
  // 手機 hero 預設 = 蒙太奇直式版（品牌 Reel 留給媒體牆 FILM 格，
  // 避免手機上同一支直式影片出現兩次 — 2026-09-01 Alan 反映）
  const heroVideoMobile = getMediaUrl(coverPage.heroVideoMobile) || '/videos/home-hero-9x16-montage.mp4'
  const heroImageUrl = getMediaUrl(coverPage.heroImage) || heroImages[0] || null
  const heroLink = ((coverPage.heroLink as string | null) || '').trim() || ENTER

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
          href={heroLink}
          tag="CHIC KIM & MIU"
          ctaText="進入賣場 · ENTER"
        />
      ) : heroImageUrl ? (
        <Link href={heroLink} className="group relative block h-[78vh] md:h-[92vh] overflow-hidden bg-cream-100">
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
        (() => {
          let headingNo = 0
          return wallRows.map((row, ri) => {
            if (row.heading) headingNo += 1
            const currentNo = headingNo
            return (
          // 2026-08-24 Alan 拍板（v4 參考錄影）：格與格、列與列完全貼合零間隙；
          // 只有帶大標的列上方留呼吸空間
          <section key={ri} className={row.heading ? 'pt-12 md:pt-20' : row.layout === 'grid3' ? 'mt-3 md:mt-6' : ''}>
            <RowHeading text={row.heading} index={currentNo} />
            {row.layout === 'grid3' ? (
              // chuu 下方 lookbook 手法：三欄微間距（水平 12px / 垂直 24px）
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-6 px-3">
                {[row.media, row.mediaRight, row.mediaThird]
                  .filter((m): m is MediaRef => m !== null)
                  .map((m, ci) => (
                    <Link key={ci} href={row.link} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                      <WallCell media={m} variant="cell" />
                      {ci === 0 && <Caption text={row.caption} />}
                    </Link>
                  ))}
              </div>
            ) : row.layout === 'split' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <Link href={row.link} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                  <WallCell media={row.media} variant="cell" />
                  <Caption text={row.caption} />
                </Link>
                {row.mediaRight && (
                  <Link href={row.link} className="group relative block aspect-[3/4] overflow-hidden bg-cream-100">
                    <WallCell media={row.mediaRight} variant="cell" />
                  </Link>
                )}
              </div>
            ) : (
              <Link
                href={row.link}
                className={`group relative block overflow-hidden bg-cream-100 ${
                  row.media.isVideo ? '' : 'h-[70vh] md:h-[92vh]'
                }`}
              >
                <WallCell media={row.media} variant="full" />
                <Caption text={row.caption} />
              </Link>
            )}
          </section>
            )
          })
        })()
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
        <div className="container py-24 md:py-32 text-center">
          <p className="text-[10px] tracking-[0.5em] text-white/50 mb-6 uppercase">Chic Kim &amp; Miu</p>
          <h2 className="text-[28px] md:text-[40px] font-serif font-normal leading-snug mb-10">
            優雅，是妳本來的樣子。
          </h2>
          <span className="inline-flex items-center gap-2.5 border border-white/60 px-12 py-4 text-[11px] tracking-[0.35em] uppercase group-hover:bg-white group-hover:text-neutral-900 transition-colors">
            進入賣場 · ENTER <ArrowRight size={13} />
          </span>
        </div>
      </Link>
    </main>
  )
}
