'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Minus, Plus, Heart, ShoppingBag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'

interface Variant {
  colorName: string
  colorCode?: string
  size: string
  sku: string
  stock: number
  priceOverride?: number
}

export interface QuickViewProduct {
  id: string
  slug: string
  name: string
  price: number
  salePrice?: number | null
  images?: { url: string; alt?: string }[]
  variants?: Variant[]
  description?: string
}

interface ProductQuickViewProps {
  product: QuickViewProduct | null
  open: boolean
  onClose: () => void
}

export function ProductQuickView({ product, open, onClose }: ProductQuickViewProps) {
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)
  const { toggleItem, isInWishlist } = useWishlistStore()

  if (!product) return null

  const colors = product.variants
    ? [...new Map(product.variants.map((v) => [v.colorName, v])).values()]
    : []
  const sizes = product.variants
    ? [
        ...new Set(
          product.variants
            .filter((v) => !selectedColor || v.colorName === selectedColor)
            .map((v) => v.size),
        ),
      ]
    : []

  const selectedVariant = product.variants?.find(
    (v) => v.colorName === selectedColor && v.size === selectedSize,
  )
  const currentPrice =
    selectedVariant?.priceOverride ?? product.salePrice ?? product.price
  const inWishlist = isInWishlist(product.id)

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images?.[0]?.url,
        price: product.price,
        salePrice: currentPrice !== product.price ? currentPrice : undefined,
        variant: selectedVariant
          ? {
              colorName: selectedVariant.colorName,
              colorCode: selectedVariant.colorCode,
              size: selectedVariant.size,
              sku: selectedVariant.sku,
            }
          : undefined,
      },
      quantity,
    )
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-auto z-10"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center hover:bg-cream-200 transition-colors z-10"
              aria-label="關閉"
            >
              <X size={16} />
            </button>

            <div className="grid md:grid-cols-2 gap-0">
              {/* Image */}
              <div className="relative aspect-[3/4] bg-cream-100">
                {product.images?.[0]?.url ? (
                  <Image
                    src={product.images[0].url}
                    alt={product.images[0].alt || product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    {product.name}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-6 flex flex-col">
                <h2 className="text-lg font-serif mb-2">{product.name}</h2>

                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-xl font-medium text-gold-600">
                    NT$ {currentPrice.toLocaleString()}
                  </span>
                  {(product.salePrice ?? product.price) !== product.price && (
                    <span className="text-sm text-muted-foreground line-through">
                      NT$ {product.price.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Colors */}
                {colors.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      顏色{selectedColor && `：${selectedColor}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c) => (
                        <button
                          key={c.colorName}
                          onClick={() => {
                            setSelectedColor(c.colorName)
                            setSelectedSize('')
                          }}
                          className={`w-8 h-8 rounded-full border-2 transition-colors ${
                            selectedColor === c.colorName
                              ? 'border-gold-500 ring-2 ring-gold-500/30'
                              : 'border-cream-200'
                          }`}
                          style={{ backgroundColor: c.colorCode || '#ccc' }}
                          title={c.colorName}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {sizes.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">尺寸</p>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((s) => {
                        const variant = product.variants?.find(
                          (v) =>
                            v.colorName === selectedColor && v.size === s,
                        )
                        const outOfStock = variant && variant.stock === 0
                        return (
                          <button
                            key={s}
                            onClick={() => !outOfStock && setSelectedSize(s)}
                            disabled={outOfStock}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              selectedSize === s
                                ? 'border-gold-500 bg-gold-500/10 text-gold-600'
                                : outOfStock
                                  ? 'border-cream-200 text-muted-foreground/30 line-through cursor-not-allowed'
                                  : 'border-cream-200 hover:border-gold-400'
                            }`}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground mb-2">數量</p>
                  <div className="inline-flex items-center border border-cream-200 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-sm">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={handleAddToCart}
                    disabled={colors.length > 0 && (!selectedColor || !selectedSize)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingBag size={16} />
                    加入購物車
                  </button>
                  <button
                    onClick={() =>
                      toggleItem({
                        productId: product.id,
                        slug: product.slug,
                        name: product.name,
                        image: product.images?.[0]?.url,
                        price: product.price,
                        salePrice: product.salePrice ?? undefined,
                      })
                    }
                    className={`w-12 flex items-center justify-center rounded-xl border transition-colors ${
                      inWishlist
                        ? 'border-red-200 bg-red-50 text-red-500'
                        : 'border-cream-200 text-foreground/50 hover:text-red-500'
                    }`}
                    aria-label={inWishlist ? '取消收藏' : '加入收藏'}
                  >
                    <Heart size={18} className={inWishlist ? 'fill-current' : ''} />
                  </button>
                </div>

                <Link
                  href={`/products/${product.slug}`}
                  onClick={onClose}
                  className="mt-3 text-center text-xs text-gold-600 hover:underline"
                >
                  查看完整商品頁面 →
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
