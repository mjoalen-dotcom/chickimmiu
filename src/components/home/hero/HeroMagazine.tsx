'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HeroVariantProps } from './types'
import { HeroControls } from './Controls'

/**
 * HeroMagazine — 全幅 + 金色細框 + 不對稱排版（右上文字框）
 *
 * 風格參考：高級時尚雜誌內頁、Hermès 廣告。
 * 內框離螢幕邊緣 24-40px，框內全幅圖；文字盒右上方 60% 寬，金色細邊。
 */
export function HeroMagazine({ slides, current, total, setCurrent, prev, next, minHeightDesktop = 95, minHeightMobile = 75 }: HeroVariantProps) {
  if (total === 0) return null
  const slide = slides[current]
  const titleLines = (slide.title || '').split(/\\n|\n/)

  return (
    <section
      className="relative w-full overflow-hidden bg-brand-surface"
      style={{ minHeight: `${minHeightMobile}vh` }}
    >
      <style>{`@media (min-width: 768px){section[data-hero-variant="magazine"]{min-height:${minHeightDesktop}vh}}`}</style>
      <div data-hero-variant="magazine" className="absolute inset-0" />

      {/* 內框 */}
      <div className="absolute inset-4 md:inset-8 lg:inset-10 overflow-hidden">
        {/* 全幅圖 */}
        {slides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={i !== current}
          >
            {s.image && (
              <Image
                src={s.image}
                alt={s.title || 'CHIC KIM & MIU'}
                fill
                className="object-cover object-center"
                priority={i === 0}
                unoptimized
                sizes="100vw"
              />
            )}
          </div>
        ))}

        {/* 微遮罩讓文字盒可讀 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom right, transparent 40%, rgb(var(--theme-overlay-from) / calc(var(--theme-overlay-opacity) * 0.7)) 100%)',
          }}
        />

        {/* 金色細框 */}
        <div
          className="absolute inset-3 md:inset-6 pointer-events-none border"
          style={{ borderColor: 'rgb(var(--theme-primary) / 0.85)' }}
        />

        {/* 右上小簽 */}
        <div className="absolute top-6 md:top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <p
            className="text-[10px] md:text-xs tracking-[0.6em] uppercase text-center"
            style={{ color: 'rgb(var(--theme-on-primary))' }}
          >
            CHIC KIM & MIU
          </p>
        </div>

        {/* 右下不對稱文字盒 */}
        <div className="absolute right-6 md:right-12 lg:right-20 bottom-12 md:bottom-20 z-10 max-w-md md:max-w-lg">
          <div
            className="space-y-4 md:space-y-5 p-6 md:p-8 backdrop-blur-md transition-all duration-500"
            style={{
              background: 'rgb(var(--theme-surface) / 0.92)',
              border: '1px solid rgb(var(--theme-primary) / 0.5)',
            }}
            key={current}
          >
            {slide.tag && (
              <p
                className="text-[10px] md:text-xs tracking-[0.4em] uppercase"
                style={{ color: 'rgb(var(--theme-primary))' }}
              >
                {slide.tag}
              </p>
            )}
            {titleLines.length > 0 && titleLines[0] && (
              <h1
                className="text-3xl md:text-4xl lg:text-5xl font-serif leading-tight"
                style={{ color: 'rgb(var(--theme-ink))' }}
              >
                {titleLines[0]}
                {titleLines[1] && (
                  <>
                    <br />
                    <span style={{ color: 'rgb(var(--theme-primary))' }}>{titleLines[1]}</span>
                  </>
                )}
              </h1>
            )}
            {slide.subtitle && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'rgb(var(--theme-ink) / 0.75)' }}
              >
                {slide.subtitle}
              </p>
            )}
            {slide.ctaText && slide.link && (
              <Link
                href={slide.link}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-xs tracking-[0.3em] uppercase transition-opacity hover:opacity-85"
                style={{
                  background: 'rgb(var(--theme-primary))',
                  color: 'rgb(var(--theme-on-primary))',
                }}
              >
                {slide.ctaText}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <HeroControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} tone="light" />
    </section>
  )
}
