'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock, Plus, Sparkles } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { getCheckoutRecommendations } from '@/lib/recommendationEngine'

export function CheckoutLastChance() {
  const { items } = useCartStore()
  const cartProductIds = items.map((i) => i.productId)
  const cartTotal = items.reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.quantity, 0)
  const recommendations = getCheckoutRecommendations(cartProductIds, cartTotal)

  if (recommendations.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-gold-500" />
        <h3 className="text-sm font-medium">結帳前最後加購</h3>
        <span className="text-[10px] text-muted-foreground">不超過訂單 30% 的超值推薦</span>
      </div>

      <div className="space-y-3">
        {recommendations.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link
              href={`/products/${item.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl border border-cream-200 hover:border-gold-400 hover:bg-gold-500/5 transition-all"
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[7px] text-muted-foreground">
                    圖
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <Sparkles size={10} className="text-gold-500 shrink-0" />
                  <span className="text-[10px] text-gold-600">{item.reason}</span>
                </div>
                <p className="text-xs font-medium truncate group-hover:text-gold-600 transition-colors">
                  {item.name}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-gold-600">
                  NT$ {(item.salePrice || item.price).toLocaleString()}
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-cream-100 group-hover:bg-gold-500 flex items-center justify-center transition-colors shrink-0">
                <Plus size={14} className="text-muted-foreground group-hover:text-white transition-colors" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
