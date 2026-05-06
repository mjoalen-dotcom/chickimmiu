'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { HeroVariantProps } from './types'
import { HeroControls } from './Controls'

/**
 * HeroSplit — 左文右圖，原品牌版型。Hero 常駐版，現有頁面用這個。
 */
export function HeroSplit({ slides, current, total, setCurrent, prev, next, minHeightDesktop = 85, minHeightMobile = 60 }: HeroVariantProps) {
  if (total === 0) return null
  const slide = slides[current]
  const titleLines = (slide.title || '').split(/\\n|\n/)

  return (
    <section
      className="relative flex items-center bg-gradient-to-br from-cream-50 via-cream-100 to-blush-50 overflow-hidden"
      style={{
        minHeight: `${minHeightMobile}vh`,
        // @ts-expect-error - CSS custom property for media query
        '--md-min-h': `${minHeightDesktop}vh`,
      }}
    >
      <style>{`@media (min-width: 768px){section[data-hero-variant="split"]{min-height:${minHeightDesktop}vh}}`}</style>
      <div data-hero-variant="split" className="absolute inset-0" style={{ minHeight: `${minHeightMobile}vh` }} aria-hidden />
      <div className="container grid md:grid-cols-2 gap-8 items-center py-16 md:py-0 relative z-10">
        <div className="space-y-6 md:space-y-8 z-10 transition-opacity duration-500" key={current}>
          {slide.tag && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-xs tracking-widest">
              <Sparkles size={14} />
              {slide.tag}
            </div>
          )}
          {titleLines.length > 0 && titleLines[0] && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">
              {titleLines[0]}
              {titleLines[1] && (
                <>
                  <br />
                  <span className="text-brand-primary">{titleLines[1]}</span>
                </>
              )}
            </h1>
          )}
          {slide.subtitle && (
            <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              {slide.subtitle}
            </p>
          )}
          {slide.ctaText && slide.link && (
            <div>
              <Link
                href={slide.link}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-brand-ink text-brand-on-primary rounded-full text-sm tracking-wide hover:opacity-90 transition-opacity"
              >
                {slide.ctaText}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center order-first md:order-last">
          <div
            key={current}
            className="w-full max-w-[280px] md:max-w-lg aspect-[3/4] rounded-3xl overflow-hidden relative border border-cream-200 shadow-xl transition-opacity duration-500"
          >
            {slide.image && (
              <Image
                src={slide.image}
                alt={slide.title || 'CHIC KIM & MIU'}
                fill
                className="object-cover object-top"
                priority={current === 0}
                unoptimized
                sizes="(max-width: 768px) 80vw, 50vw"
              />
            )}
          </div>
        </div>
      </div>

      <HeroControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} tone="dark" />
    </section>
  )
}
