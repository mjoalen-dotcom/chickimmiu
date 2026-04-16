'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Sparkles, Tag, ArrowRight } from 'lucide-react'
import { getExitIntentRecommendations } from '@/lib/recommendationEngine'

export function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const hasShownRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recommendations = getExitIntentRecommendations()

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY <= 5 && !hasShownRef.current) {
      hasShownRef.current = true
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave)
    }, 10000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseLeave])

  const handleClose = () => setIsVisible(false)

  if (!isVisible || recommendations.length === 0) return null

  return (
    <>
      <div
        onClick={handleClose}
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
      />

      <div className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-sm z-[9999]">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="relative bg-gradient-to-r from-gold-500/10 to-cream-100 px-6 py-5">
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Tag size={16} className="text-gold-500" />
              <span className="text-xs font-medium text-gold-600">限時 5% OFF</span>
            </div>
            <h3 className="text-lg font-serif">等等！先看看這些精選商品</h3>
            <p className="text-xs text-muted-foreground mt-1">
              專屬優惠，只在今天有效
            </p>
          </div>

          <div className="p-3 space-y-2 max-h-[35vh] overflow-y-auto">
            {recommendations.map((item) => {
              const discountedPrice = Math.round((item.salePrice || item.price) * 0.95)
              return (
                <Link
                  key={item.id}
                  href={`/products/${item.slug}`}
                  onClick={handleClose}
                  className="group flex items-center gap-2.5 p-2 rounded-xl border border-cream-200 hover:border-gold-400 hover:bg-gold-500/5 transition-all"
                >
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                    {item.image ? (
                      <Image src={item.image} alt={item.name} fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[8px] text-muted-foreground">
                        圖
                      </div>
                    )}
                    <div className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-medium rounded-full">
                      -5%
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Sparkles size={10} className="text-gold-500 shrink-0" />
                      <span className="text-[10px] text-gold-600">{item.reason}</span>
                    </div>
                    <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
                      {item.name}
                    </p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-sm font-medium text-gold-600">
                        NT$ {discountedPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-through">
                        NT$ {(item.salePrice || item.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-cream-300 group-hover:text-gold-500 transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>

          <div className="px-6 py-4 border-t border-cream-200 bg-cream-50/50">
            <Link
              href="/products"
              onClick={handleClose}
              className="block w-full py-3 text-center bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
            >
              查看更多商品
            </Link>
            <button
              onClick={handleClose}
              className="block w-full mt-2 text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              不了，謝謝
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
