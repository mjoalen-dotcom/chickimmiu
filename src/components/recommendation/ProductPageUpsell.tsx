'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Sparkles, ChevronRight } from 'lucide-react'
import { getProductPageRecommendations, type RecommendedItem } from '@/lib/recommendationEngine'

interface Props {
  currentProductId?: string
  currentPrice?: number
}

export function ProductPageUpsell({ currentProductId, currentPrice = 0 }: Props) {
  const { crossSell, upsell } = getProductPageRecommendations(currentProductId, currentPrice)
  const [activeTab, setActiveTab] = useState<'crossSell' | 'upsell'>('crossSell')

  if (crossSell.length === 0 && upsell.length === 0) return null

  const items = activeTab === 'crossSell' ? crossSell : upsell

  return (
    <section className="mt-12 md:mt-16">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">AI RECOMMENDATION</p>
          <h2 className="text-xl md:text-2xl font-serif">為你推薦</h2>
        </div>
      </div>

      {/* Tabs */}
      {upsell.length > 0 && crossSell.length > 0 && (
        <div className="flex gap-1 bg-cream-100 rounded-full p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('crossSell')}
            className={`px-4 py-2 rounded-full text-xs transition-all ${
              activeTab === 'crossSell'
                ? 'bg-foreground text-cream-50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            完美搭配
          </button>
          <button
            onClick={() => setActiveTab('upsell')}
            className={`px-4 py-2 rounded-full text-xs transition-all flex items-center gap-1 ${
              activeTab === 'upsell'
                ? 'bg-foreground text-cream-50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowUpRight size={12} />
            升級推薦
          </button>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnimatePresence mode="wait">
          {items.map((item, i) => (
            <motion.div
              key={`${activeTab}-${item.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ delay: i * 0.05 }}
            >
              <RecommendationCard item={item} showUpgrade={activeTab === 'upsell'} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

function RecommendationCard({ item, showUpgrade }: { item: RecommendedItem; showUpgrade?: boolean }) {
  return (
    <Link
      href={`/products/${item.slug}`}
      className="group block bg-white rounded-2xl border border-cream-200 overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
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

        {/* Match badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px]">
          <Sparkles size={10} className="text-gold-500" />
          <span className="text-foreground/70">{item.reason}</span>
        </div>

        {/* Score */}
        <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center text-[10px] font-medium">
          {item.matchScore}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
          {item.name}
        </h3>
        <div className="flex items-baseline gap-2 mt-1">
          {item.salePrice ? (
            <>
              <span className="text-sm font-medium text-gold-600">
                NT$ {item.salePrice.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground line-through">
                NT$ {item.price.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-gold-600">
              NT$ {item.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Upsell upgrade label */}
        {showUpgrade && item.upgradeLabel && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-gold-600 bg-gold-500/10 px-2 py-1 rounded-lg">
            <ArrowUpRight size={10} />
            {item.upgradeLabel}
          </div>
        )}
      </div>
    </Link>
  )
}
