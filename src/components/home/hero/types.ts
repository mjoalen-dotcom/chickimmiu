export type HeroVariant = 'split' | 'editorial' | 'cinematic' | 'magazine'

export interface HeroSlide {
  image: string
  title?: string
  subtitle?: string
  link?: string
  ctaText?: string
  tag?: string
}

export interface HeroVariantProps {
  slides: HeroSlide[]
  current: number
  total: number
  setCurrent: (i: number) => void
  next: () => void
  prev: () => void
  minHeightDesktop?: number
  minHeightMobile?: number
}
