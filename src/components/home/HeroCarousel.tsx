'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { HeroSlide, HeroVariant } from './hero/types'
import { HeroSplit } from './hero/HeroSplit'
import { HeroEditorial } from './hero/HeroEditorial'
import { HeroCinematic } from './hero/HeroCinematic'
import { HeroMagazine } from './hero/HeroMagazine'

export type { HeroSlide, HeroVariant } from './hero/types'

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
  const t = useTranslations('hero')

  // 把 CMS slides 跟 legacy banners 統一成 HeroSlide[]
  // CMS slides 有資料時 admin 自管多語；沒設才走 i18n 預設文案。
  const normalized: HeroSlide[] = useMemo(() => {
    if (slides && slides.length > 0) return slides
    const defaultTexts = [
      { tag: t('slide1Tag'), title: t('slide1Title'), subtitle: t('slide1Subtitle'), ctaText: t('slide1Cta'), link: '/products' },
      { tag: t('slide2Tag'), title: t('slide2Title'), subtitle: t('slide2Subtitle'), ctaText: t('slide2Cta'), link: '/products?tag=sale' },
      { tag: t('slide3Tag'), title: t('slide3Title'), subtitle: t('slide3Subtitle'), ctaText: t('slide3Cta'), link: '/account/subscription' },
    ]
    return banners.slice(0, 3).map((image, i) => {
      const txt = defaultTexts[i] || defaultTexts[0]
      return {
        image,
        title: txt.title,
        subtitle: txt.subtitle,
        link: txt.link,
        ctaText: txt.ctaText,
        tag: txt.tag,
      }
    })
  }, [banners, slides, t])

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
