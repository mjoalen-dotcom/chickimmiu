'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Sparkles, Gift, Tag, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { getCartRecommendations } from '@/lib/recommendationEngine'

export function CartCrossSell() {
  const { items } = useCartStore()
  const cartProductIds = items.map((i) => i.productId)
  const cartTotal = items.reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.quantity, 0)
  const { bundle, addon } = getCartRecommendations(cartProductIds, cartTotal)

  if (bundle.length === 0 && addon.length === 0) return null

  return (
    <div className="space-y-8 mt-8">
      {/* ── Bundle: 搭配加購 ── */}
      {bundle.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Gift size={16} className="text-gold-500" />
            <h3 className="text-sm font-medium">搭配加購，享組合優惠</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bundle.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <BundleCard item={item} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── Addon: 小額加購 ── */}
      {addon.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Tag size={16} className="text-gold-500" />
            <h3 className="text-sm font-medium">小額加購品</h3>
            <span className="text-[10px] text-muted-foreground">順手帶走，超划算</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {addon.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className="shrink-0 w-40"
              >
                <AddonCard item={item} />
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BundleCard({ item }: { item: ReturnType<typeof getCartRecommendations>['bundle'][0] }) {
  const effectivePrice = item.salePrice || item.price
  const discountedPrice = item.bundleDiscount
    ? effectivePrice - item.bundleDiscount
    : effectivePrice

  return (
    <Link
      href={`/products/${item.slug}`}
      className="group flex gap-3 p-3 bg-white rounded-xl border border-cream-200 hover:border-gold-400 hover:shadow-sm transition-all"
    >
      <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-cream-100 shrink-0">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[8px] text-muted-foreground">
            圖
          </div>
        )}
        {/* Score badge */}
        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gold-500 rounded-full flex items-center justify-center text-[8px] text-white font-medium">
          {item.matchScore}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <Sparkles size={10} className="text-gold-500 shrink-0" />
          <span className="text-[10px] text-gold-600 truncate">{item.reason}</span>
        </div>
        <p className="text-xs font-medium truncate group-hover:text-gold-600 transition-colors">
          {item.name}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xs font-medium text-gold-600">
            NT$ {discountedPrice.toLocaleString()}
          </span>
          {Boolean(item.bundleDiscount) && (
            <span className="text-[10px] text-muted-foreground line-through">
              NT$ {effectivePrice.toLocaleString()}
            </span>
          )}
        </div>
        {Boolean(item.bundleDiscount) && (
          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
            組合省 NT$ {item.bundleDiscount?.toLocaleString()}
          </span>
        )}
      </div>
    </Link>
  )
}

function AddonCard({ item }: { item: ReturnType<typeof getCartRecommendations>['addon'][0] }) {
  return (
    <Link
      href={`/products/${item.slug}`}
      className="group block bg-white rounded-xl border border-cream-200 overflow-hidden hover:border-gold-400 hover:shadow-sm transition-all"
    >
      <div className="relative aspect-square bg-cream-100 overflow-hidden">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[8px] text-muted-foreground">
            圖
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[9px]">
          <Plus size={8} className="text-gold-500" />
          加購
        </div>
      </div>
      <div className="p-2">
        <p className="text-[11px] font-medium truncate">{item.name}</p>
        <p className="text-[11px] font-medium text-gold-600 mt-0.5">
          NT$ {(item.salePrice || item.price).toLocaleString()}
        </p>
      </div>
    </Link>
  )
}
