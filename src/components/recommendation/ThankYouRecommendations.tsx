'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Gift, Sparkles, Timer, ArrowRight } from 'lucide-react'
import { getThankYouRecommendations } from '@/lib/recommendationEngine'

interface Props {
  purchasedProductIds?: string[]
}

export function ThankYouRecommendations({ purchasedProductIds = [] }: Props) {
  const recommendations = getThankYouRecommendations(purchasedProductIds)
  const [timeLeft, setTimeLeft] = useState(48 * 60 * 60) // 48 hours in seconds

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  if (recommendations.length === 0) return null

  return (
    <section className="mt-10">
      {/* Limited-time offer banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gold-500/10 to-gold-500/5 border border-gold-500/20 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Gift size={18} className="text-gold-500" />
            <span className="text-sm font-medium">限時回購優惠 10% OFF</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Timer size={14} className="text-gold-600" />
            <span className="text-xs font-mono font-medium text-gold-600">
              {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">限時優惠倒數中</span>
        </div>
      </motion.div>

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">JUST FOR YOU</p>
          <h2 className="text-lg md:text-xl font-serif">猜你也會喜歡</h2>
        </div>
        <Link
          href="/products"
          className="text-xs text-foreground/60 hover:text-gold-600 transition-colors flex items-center gap-1"
        >
          探索更多
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {recommendations.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <Link
              href={`/products/${item.slug}`}
              className="group block bg-white rounded-2xl border border-cream-200 overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              <div className="relative aspect-[3/4] bg-cream-100 overflow-hidden">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                    圖片
                  </div>
                )}
                {/* 10% off badge */}
                <div className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-[10px] font-medium rounded-full">
                  -10%
                </div>
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px]">
                  <Sparkles size={10} className="text-gold-500" />
                  {item.reason}
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium truncate group-hover:text-gold-600 transition-colors">
                  {item.name}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs font-medium text-gold-600">
                    NT$ {Math.round((item.salePrice || item.price) * 0.9).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-through">
                    NT$ {(item.salePrice || item.price).toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
