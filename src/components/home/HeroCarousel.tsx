'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { HeroSlide, HeroVariant } from './hero/types'
import { HeroSplit } from './hero/HeroSplit'
import { HeroEditorial } from './hero/HeroEditorial'
import { HeroCinematic } from './hero/HeroCinematic'
import { HeroMagazine } from './hero/HeroMagazine'

export type { HeroSlide, HeroVariant } from './hero/types'

const DEFAULT_SLIDE_TEXTS: Array<{ tag: string; title: string; subtitle: string; ctaText: string; link: string }> = [
  {
    tag: '2026 春夏新品上市',
    title: '優雅與可愛\n完美融合',
    subtitle: '從日常通勤到約會穿搭，CHIC KIM & MIU 讓每一位女性都能找到屬於自己的風格。',
    ctaText: '探索全部商品',
    link: '/products',
  },
  {
    tag: '限時優惠',
    title: '專屬你美好的\n時尚優雅',
    subtitle: '精選百件春夏商品限時特惠，搶購你的命定單品！',
    ctaText: '立即搶購',
    link: '/products?tag=sale',
  },
  {
    tag: '會員獨享',
    title: '訂閱即享\n專屬禮遇',
    subtitle: '全站折扣、每月購物金、專屬抽獎與更多驚喜好禮等你來！',
    ctaText: '了解訂閱方案',
    link: '/account/subscription',
  },
]

interface HeroCarouselProps {
  banners: string[]
  slides?: HeroSlide[]
  variant?: HeroVariant
  minHeightDesktop?: number
  minHeightMobile?: number
}

export function HeroCarousel({
  banners,
  slides,
  variant = 'split',
  minHeightDesktop,
  minHeightMobile,
}: HeroCarouselProps) {
  // 把 CMS slides 跟 legacy banners 統一成 HeroSlide[]
  const normalized: HeroSlide[] = useMemo(() => {
    if (slides && slides.length > 0) return slides
    return banners.slice(0, 3).map((image, i) => {
      const t = DEFAULT_SLIDE_TEXTS[i] || DEFAULT_SLIDE_TEXTS[0]
      return {
        image,
        title: t.title,
        subtitle: t.subtitle,
        link: t.link,
        ctaText: t.ctaText,
        tag: t.tag,
      }
    })
  }, [banners, slides])

  const total = normalized.length
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % Math.max(total, 1)), [total])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + Math.max(total, 1)) % Math.max(total, 1)), [total])

  useEffect(() => {
    if (total <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next, total])

  // 切版型時 reset index 避免越界
  useEffect(() => {
    if (current >= total) setCurrent(0)
  }, [current, total])

  if (total === 0) return null

  const sharedProps = {
    slides: normalized,
    current,
    total,
    setCurrent,
    next,
    prev,
    minHeightDesktop,
    minHeightMobile,
  }

  switch (variant) {
    case 'editorial':
      return <HeroEditorial {...sharedProps} />
    case 'cinematic':
      return <HeroCinematic {...sharedProps} />
    case 'magazine':
      return <HeroMagazine {...sharedProps} />
    case 'split':
    default:
      return <HeroSplit {...sharedProps} />
  }
}
