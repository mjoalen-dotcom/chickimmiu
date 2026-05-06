'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HeroVariantProps } from './types'
import { HeroControls } from './Controls'

/**
 * HeroCinematic — 全幅 + Ken Burns slow zoom + 中央置中 lockup + 上下黑色 bar
 *
 * 風格參考：電影預告海報、Apple 產品發表頁。
 * Ken Burns 用 CSS keyframe scale(1 → 1.08) 配 ease-in-out 8s alternate infinite。
 */
export function HeroCinematic({ slides, current, total, setCurrent, prev, next, minHeightDesktop = 100, minHeightMobile = 85 }: HeroVariantProps) {
  if (total === 0) return null
  const slide = slides[current]
  const titleLines = (slide.title || '').split(/\\n|\n/)

  return (
    <section
      className="relative w-full overflow-hidden bg-black"
      style={{ minHeight: `${minHeightMobile}vh` }}
    >
      <style>{`
        @media (min-width: 768px){section[data-hero-variant="cinematic"]{min-height:${minHeightDesktop}vh}}
        @keyframes ckmu-ken-burns { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.08) translate(-1%, 1%); } }
        .ckmu-ken-burns-active { animation: ckmu-ken-burns 9s ease-in-out infinite alternate; }
      `}</style>
      <div data-hero-variant="cinematic" className="absolute inset-0" />

      {/* Ken Burns 圖層 */}
      {slides.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden={i !== current}
        >
          {s.image && (
            <div className={`absolute inset-0 ${i === current ? 'ckmu-ken-burns-active' : ''}`}>
              <Image
                src={s.image}
                alt={s.title || 'CHIC KIM & MIU'}
                fill
                className="object-cover object-center"
                priority={i === 0}
                unoptimized
                sizes="100vw"
              />
            </div>
          )}
        </div>
      ))}

      {/* 全幅遮罩 — 中央偏暗讓置中文字可讀 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgb(var(--theme-overlay-from) / calc(var(--theme-overlay-opacity) * 0.6)) 0%, rgb(var(--theme-overlay-from) / var(--theme-overlay-opacity)) 100%)',
        }}
      />

      {/* 上下黑色色條（letterbox） */}
      <div className="absolute top-0 inset-x-0 h-[6vh] md:h-[10vh] bg-black z-10 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-[6vh] md:h-[10vh] bg-black z-10 pointer-events-none" />

      {/* 中央 lockup */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center space-y-5 md:space-y-8 transition-all duration-700" key={current}>
          {slide.tag && (
            <p className="text-[10px] md:text-xs tracking-[0.5em] text-white/80 uppercase">
              {slide.tag}
            </p>
          )}
          {titleLines.length > 0 && titleLines[0] && (
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-serif leading-[1.1] text-white">
              {titleLines[0]}
              {titleLines[1] && (
                <>
                  <br />
                  <span className="italic">{titleLines[1]}</span>
                </>
              )}
            </h1>
          )}
          {slide.subtitle && (
            <p className="text-sm md:text-base text-white/80 max-w-xl mx-auto leading-relaxed">
              {slide.subtitle}
            </p>
          )}
          {slide.ctaText && slide.link && (
            <div className="pt-2">
              <Link
                href={slide.link}
                className="inline-flex items-center justify-center gap-2 px-9 py-4 border border-white/60 text-white rounded-none text-xs tracking-[0.3em] uppercase hover:bg-white hover:text-brand-ink transition-colors"
              >
                {slide.ctaText}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      <HeroControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} tone="light" />
    </section>
  )
}
