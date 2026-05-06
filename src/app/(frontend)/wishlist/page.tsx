'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWishlistStore } from '@/stores/wishlistStore'
import { useCartStore } from '@/stores/cartStore'
import { Price } from '@/components/common/Price'

export default function WishlistPage() {
  const t = useTranslations('wishlist')
  const { items, removeItem } = useWishlistStore()
  const addToCart = useCartStore((s) => s.addItem)

  const handleAddToCart = (item: typeof items[number]) => {
    addToCart({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      image: item.image,
      price: item.price,
      salePrice: item.salePrice,
    })
  }

  if (items.length === 0) {
    return (
      <main className="bg-cream-50 min-h-screen">
        <div className="container py-16 text-center">
          <Heart size={64} className="mx-auto text-cream-200 mb-6" />
          <h1 className="text-2xl font-serif mb-3">{t('emptyTitle')}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t('emptySubtitle')}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            {t('emptyCta')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-12">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{t('eyebrow')}</p>
          <h1 className="text-2xl md:text-3xl font-serif">
            {t('title')}
            <span className="text-base font-normal text-muted-foreground ml-2">
              ({items.length})
            </span>
          </h1>
        </div>
      </div>

      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {items.map((item) => (
            <div key={item.productId} className="group">
              <Link href={`/products/${item.slug}`} className="block">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 mb-3">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                      {item.name}
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      removeItem(item.productId)
                    }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label={t('removeAria')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Link>

              <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
                {item.name}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <Price twd={item.salePrice ?? item.price} className="text-sm text-gold-600" />
                {item.salePrice && item.salePrice < item.price && (
                  <Price twd={item.price} className="text-xs text-muted-foreground line-through" />
                )}
              </div>

              <button
                onClick={() => handleAddToCart(item)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 bg-foreground text-cream-50 text-xs rounded-lg hover:bg-foreground/90 transition-colors"
              >
                <ShoppingBag size={14} />
                {t('addToCart')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
