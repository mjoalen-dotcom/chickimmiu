'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore, type BundleLike } from '@/stores/cartStore'
import { ShoppingBag } from 'lucide-react'

export function BundleClient({ bundle }: { bundle: BundleLike }) {
  const router = useRouter()
  const addBundle = useCartStore((s) => s.addBundle)
  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">數量</label>
        <div className="flex items-center border border-cream-200 rounded-lg">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-1 hover:bg-cream-100"
            aria-label="減少"
          >
            −
          </button>
          <span className="px-3 min-w-8 text-center">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-1 hover:bg-cream-100"
            aria-label="增加"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          addBundle(bundle, qty)
          setJustAdded(true)
          setTimeout(() => setJustAdded(false), 2000)
        }}
        className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
      >
        <ShoppingBag size={14} />
        加入購物車
      </button>

      {justAdded && (
        <p className="text-center text-xs text-green-600">已加入！整組 {bundle.items.length} 件商品合併收進購物車</p>
      )}

      <button
        type="button"
        onClick={() => router.push('/checkout')}
        className="w-full text-sm text-gold-700 hover:underline"
      >
        立即結帳 →
      </button>
    </div>
  )
}
