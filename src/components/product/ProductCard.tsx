'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'
import { Price } from '@/components/common/Price'

export interface ProductCardProps {
  id: string
  slug: string
  name: string
  price: number
  salePrice?: number | null
  image?: { url: string; alt?: string } | null
  colors?: { name: string; code: string }[]
  isNew?: boolean
  isHot?: boolean
  soldCount?: number
  memberPrice?: number | null
  purchaseLimit?: number | null
  onQuickView?: () => void
}

export function ProductCard({
  id,
  slug,
  name,
  price,
  salePrice,
  image,
  colors,
  isNew,
  isHot,
  soldCount,
  memberPrice,
  purchaseLimit,
  onQuickView,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const t = useTranslations('product')
  const tCommon = useTranslations('common')
  const addItem = useCartStore((s) => s.addItem)
  const { toggleItem, isInWishlist } = useWishlistStore()
  const inWishlist = useWishlistStore((s) => s.isInWishlist(id))

  const discountPercent =
    salePrice && salePrice < price
      ? Math.round(((price - salePrice) / price) * 100)
      : null

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem({
      productId: id,
      slug,
      name,
      image: image?.url,
      price,
      salePrice: salePrice ?? undefined,
      purchaseLimit:
        typeof purchaseLimit === 'number' && purchaseLimit > 0
          ? Math.floor(purchaseLimit)
          : undefined,
    })
  }

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleItem({
      productId: id,
      slug,
      name,
      image: image?.url,
      price,
      salePrice: salePrice ?? undefined,
    })
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onQuickView?.()
  }

  return (
    <Link href={`/products/${slug}`} className="group block">
      {/* Image */}
      <div
        className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 mb-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {image?.url ? (
          <Image
            src={image.url}
            alt={image.alt || name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {isNew && (
            <span className="px-2 py-0.5 bg-gold-500 text-white text-[10px] rounded-full tracking-wider font-medium">
              {t('badgeNew')}
            </span>
          )}
          {isHot && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded-full tracking-wider font-medium">
              {t('badgeHot')}
            </span>
          )}
          {discountPercent && (
            <span className="px-2 py-0.5 bg-blush-200 text-red-600 text-[10px] rounded-full tracking-wider font-medium">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center transition-colors hover:bg-white"
          aria-label={inWishlist ? t('removeFromWishlist') : t('addToWishlist')}
        >
          <Heart
            size={16}
            className={inWishlist ? 'fill-red-500 text-red-500' : 'text-foreground/50'}
          />
        </button>

        {/* Hover actions */}
        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
          className="absolute bottom-3 left-3 right-3 flex gap-2"
        >
          <button
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-foreground/90 text-cream-50 text-xs rounded-lg backdrop-blur-sm hover:bg-foreground transition-colors"
          >
            <ShoppingBag size={14} />
            {tCommon('addToCart')}
          </button>
          {onQuickView && (
            <button
              onClick={handleQuickView}
              className="w-10 flex items-center justify-center bg-white/90 text-foreground rounded-lg backdrop-blur-sm hover:bg-white transition-colors"
              aria-label={t('quickView')}
            >
              <Eye size={14} />
            </button>
          )}
        </motion.div>

        {/* Sold count (Hotping style) */}
        {soldCount && soldCount > 0 && (
          <div className="absolute bottom-3 left-3 right-3 text-center pointer-events-none">
            <motion.span
              initial={false}
              animate={{ opacity: isHovered ? 0 : 1 }}
              className="inline-block px-3 py-1 bg-black/50 text-white text-[10px] rounded-full backdrop-blur-sm"
            >
              {t('soldCount', { count: soldCount.toLocaleString() })}
            </motion.span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
          {name}
        </p>

        {/* Color dots */}
        {colors && colors.length > 0 && (
          <div className="flex items-center gap-1.5">
            {colors.slice(0, 5).map((c) => (
              <span
                key={`${c.name}-${c.code}`}
                className="w-3.5 h-3.5 rounded-full border border-cream-200"
                style={{ backgroundColor: c.code }}
                title={c.name}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-[10px] text-muted-foreground">
                {t('moreColors', { count: colors.length - 5 })}
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <Price twd={salePrice ?? price} className="text-sm font-medium text-gold-600" />
          {salePrice && salePrice < price && (
            <Price twd={price} className="text-xs text-muted-foreground line-through" />
          )}
        </div>

        {/* Member price */}
        {memberPrice && memberPrice < (salePrice ?? price) && (
          <p className="text-[10px] text-purple-600 tracking-wide">
            {t('vipPriceLabel')} <Price twd={memberPrice} />
          </p>
        )}
      </div>
    </Link>
  )
}
