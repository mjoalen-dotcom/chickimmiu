'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HeroVariantProps } from './types'
import { HeroControls } from './Controls'

/**
 * HeroEditorial — 全幅大圖 + 左下小標 + 大 serif title + 漸層遮罩
 *
 * 風格參考：時尚雜誌封面、Vogue homepage。
 * 文字疊在圖片左下，可讀性靠下方漸層遮罩。
 */
export function HeroEditorial({ slides, current, total, setCurrent, prev, next, minHeightDesktop = 90, minHeightMobile = 70 }: HeroVariantProps) {
  if (total === 0) return null
  const slide = slides[current]
  const titleLines = (slide.title || '').split(/\\n|\n/)

  return (
    <section
      className="relative w-full overflow-hidden bg-brand-ink"
      style={{ minHeight: `${minHeightMobile}vh` }}
    >
      <style>{`@media (min-width: 768px){section[data-hero-variant="editorial"]{min-height:${minHeightDesktop}vh}}`}</style>
      <div data-hero-variant="editorial" className="absolute inset-0" />

      {/* 全幅圖（每張切換淡入） */}
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

      {/* 漸層遮罩 — 由 CSS var 控色與透明度，主題可換 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgb(var(--theme-overlay-from) / var(--theme-overlay-opacity)) 0%, rgb(var(--theme-overlay-from) / 0.25) 50%, transparent 100%)',
        }}
      />

      {/* 左下文字區 */}
      <div className="absolute inset-x-0 bottom-0 z-10 pb-20 md:pb-28">
        <div className="container">
          <div className="max-w-2xl space-y-4 md:space-y-6 transition-all duration-500" key={current}>
            {slide.tag && (
              <p className="text-xs md:text-sm tracking-[0.4em] text-white/80 uppercase">
                {slide.tag}
              </p>
            )}
            {titleLines.length > 0 && titleLines[0] && (
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif leading-[1.05] text-white">
                {titleLines[0]}
                {titleLines[1] && (
                  <>
                    <br />
                    {titleLines[1]}
                  </>
                )}
              </h1>
            )}
            {slide.subtitle && (
              <p className="text-base md:text-lg text-white/85 max-w-xl leading-relaxed">
                {slide.subtitle}
              </p>
            )}
            {slide.ctaText && slide.link && (
              <div className="pt-2">
                <Link
                  href={slide.link}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-brand-ink rounded-full text-sm tracking-wide hover:bg-white/90 transition-colors"
                >
                  {slide.ctaText}
                  <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <HeroControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} tone="light" />
    </section>
  )
}
