'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

export interface HeroSlide {
  image: string
  title?: string
  subtitle?: string
  link?: string
  ctaText?: string
}

const DEFAULT_SLIDES = [
  {
    tag: '2026 春夏新品上市',
    title: ['優雅與可愛', '完美融合'],
    description: '從日常通勤到約會穿搭，CHIC KIM & MIU 讓每一位女性都能找到屬於自己的風格。',
    cta: { label: '探索全部商品', href: '/products' },
    ctaSecondary: { label: '新品搶先看', href: '/products?tag=new' },
  },
  {
    tag: '限時優惠',
    title: ['專屬你美好的', '時尚優雅'],
    description: '精選百件春夏商品限時特惠，搶購你的命定單品！',
    cta: { label: '立即搶購', href: '/products?tag=sale' },
    ctaSecondary: { label: '查看熱銷', href: '/products?tag=hot' },
  },
  {
    tag: '會員獨享',
    title: ['訂閱即享', '專屬禮遇'],
    description: '全站折扣、每月購物金、專屬抽獎與更多驚喜好禮等你來！',
    cta: { label: '了解訂閱方案', href: '/account/subscription' },
    ctaSecondary: { label: '會員權益', href: '/membership-benefits' },
  },
]

interface HeroCarouselProps {
  banners: string[]
  slides?: HeroSlide[]
}

export function HeroCarousel({ banners, slides }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0)

  // If CMS slides provided, use those; otherwise fall back to product banners + default text
  const hasCmsSlides = slides && slides.length > 0
  const total = hasCmsSlides ? slides.length : Math.min(banners.length, DEFAULT_SLIDES.length)

  const next = useCallback(() => setCurrent((c) => (c + 1) % total), [total])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + total) % total), [total])

  // Auto-play
  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next, total])

  if (total === 0) return null

  if (hasCmsSlides) {
    const slide = slides[current]
    const titleLines = (slide.title || '').split('\n')
    return (
      <section className="relative min-h-[60vh] md:min-h-[85vh] flex items-center bg-gradient-to-br from-cream-50 via-cream-100 to-blush-50 overflow-hidden">
        <div className="container grid md:grid-cols-2 gap-8 items-center py-16 md:py-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.5 }}
              className="space-y-6 md:space-y-8 z-10"
            >
              {titleLines.length > 0 && (
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">
                  {titleLines[0]}
                  {titleLines[1] && (
                    <>
                      <br />
                      <span className="text-gold-500">{titleLines[1]}</span>
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
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
                  >
                    {slide.ctaText}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center order-first md:order-last">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[280px] md:max-w-lg aspect-[3/4] rounded-3xl overflow-hidden relative border border-cream-200 shadow-xl"
              >
                <Image
                  src={slide.image}
                  alt={slide.title || 'CHIC KIM & MIU'}
                  fill
                  className="object-cover object-top"
                  priority={current === 0}
                  unoptimized
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <CarouselControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} />
      </section>
    )
  }

  // Legacy mode: use product banners + default slide text
  const slide = DEFAULT_SLIDES[current]
  return (
    <section className="relative min-h-[60vh] md:min-h-[85vh] flex items-center bg-gradient-to-br from-cream-50 via-cream-100 to-blush-50 overflow-hidden">
      <div className="container grid md:grid-cols-2 gap-8 items-center py-16 md:py-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.5 }}
            className="space-y-6 md:space-y-8 z-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 text-gold-600 text-xs tracking-widest">
              <Sparkles size={14} />
              {slide.tag}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight">
              {slide.title[0]}
              <br />
              <span className="text-gold-500">{slide.title[1]}</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
              {slide.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={slide.cta.href}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
              >
                {slide.cta.label}
                <ArrowRight size={16} />
              </Link>
              <Link
                href={slide.ctaSecondary.href}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-foreground/20 text-foreground rounded-full text-sm tracking-wide hover:bg-foreground/5 transition-colors"
              >
                {slide.ctaSecondary.label}
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center order-first md:order-last">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-[280px] md:max-w-lg aspect-[3/4] rounded-3xl overflow-hidden relative border border-cream-200 shadow-xl"
            >
              <Image
                src={banners[current]}
                alt={`CHIC KIM & MIU - ${slide.tag}`}
                fill
                className="object-cover object-top"
                priority={current === 0}
                unoptimized
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <CarouselControls current={current} total={total} setCurrent={setCurrent} prev={prev} next={next} />
    </section>
  )
}

function CarouselControls({ current, total, setCurrent, prev, next }: {
  current: number; total: number; setCurrent: (i: number) => void; prev: () => void; next: () => void
}) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
      <button
        onClick={prev}
        className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
        aria-label="上一張"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${
              i === current ? 'w-6 bg-gold-500' : 'w-2 bg-foreground/20'
            }`}
            aria-label={`第 ${i + 1} 張`}
          />
        ))}
      </div>
      <button
        onClick={next}
        className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
        aria-label="下一張"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
