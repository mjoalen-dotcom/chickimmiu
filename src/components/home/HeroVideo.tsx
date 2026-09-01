'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * HeroVideo — 首頁影片 hero（cn.chuu.co.kr 式展示牆入口）
 * ────────────────────────────────────────────────────────
 * - 桌機 16:9 / 手機 9:16 兩支檔案（md breakpoint 切換，皆 preload=metadata）
 * - 整塊包 <Link>：點任何地方直接進購物頁（chuu 的 q-hero-cover 同手法）
 * - muted 用 ref 強制設（React 的 muted prop 不會寫進 SSR HTML 屬性，
 *   缺 muted 屬性時瀏覽器 autoplay 政策會擋 hydration 前的自動播放）
 * - BrandAnthemPlayer 的「video 讓位」listener 會跳過 muted video，BGM 不受影響
 * - 影片本體 w-full h-auto（跟著內建長寬比），不依賴 CSS aspect-ratio
 *   （老智慧電視 Chromium 63 不支援 aspect-ratio，見 smart-tv 相容備忘）
 */

interface HeroVideoProps {
  desktopSrc: string
  mobileSrc: string
  desktopPoster?: string
  mobilePoster?: string
  href: string
  tag?: string
  title?: string
  ctaText?: string
}

export function HeroVideo({
  desktopSrc,
  mobileSrc,
  desktopPoster,
  mobilePoster,
  href,
  tag,
  title,
  ctaText,
}: HeroVideoProps) {
  const desktopRef = useRef<HTMLVideoElement>(null)
  const mobileRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    for (const ref of [desktopRef, mobileRef]) {
      const v = ref.current
      if (!v) continue
      v.muted = true
      v.play().catch(() => {
        /* autoplay 被擋就停在 poster，仍可點擊進入 */
      })
    }
  }, [])

  return (
    <Link href={href} className="group relative block w-full overflow-hidden bg-neutral-950">
      <video
        ref={desktopRef}
        className="hidden md:block w-full h-auto max-h-[94vh] object-cover"
        src={desktopSrc}
        poster={desktopPoster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title || 'CHIC KIM & MIU'}
      />
      <video
        ref={mobileRef}
        className="md:hidden w-full h-auto max-h-[94vh] object-cover"
        src={mobileSrc}
        poster={mobilePoster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={title || 'CHIC KIM & MIU'}
      />

      {/* 左下極簡 lockup — 提示可點擊，不搶影片 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent pt-24 pb-8 md:pb-12 pointer-events-none">
        <div className="container">
          {tag && (
            <p className="text-[10px] tracking-[0.5em] text-white/80 mb-3.5 uppercase">{tag}</p>
          )}
          {title && (
            <h1 className="text-3xl md:text-5xl font-serif text-white leading-tight mb-4 whitespace-pre-line">
              {title}
            </h1>
          )}
          {ctaText && (
            <span className="inline-flex items-center gap-2 text-[11px] tracking-[0.35em] uppercase text-white/95 border-b border-white/60 pb-1.5 group-hover:border-white transition-colors">
              {ctaText} <ArrowRight size={12} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
