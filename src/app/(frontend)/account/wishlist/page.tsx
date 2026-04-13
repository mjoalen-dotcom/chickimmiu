'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react'
import { useWishlistStore } from '@/stores/wishlistStore'
import { useCartStore } from '@/stores/cartStore'

export default function AccountWishlistPage() {
  const { items, removeItem } = useWishlistStore()
  const addToCart = useCartStore((s) => s.addItem)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">收藏清單</h2>
        <span className="text-xs text-muted-foreground">{items.length} 件商品</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
          <Heart size={48} className="mx-auto text-cream-200 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">還沒有收藏任何商品</p>
          <Link href="/products" className="text-sm text-gold-600 hover:underline">
            去逛逛 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.productId} className="group bg-white rounded-2xl border border-cream-200 overflow-hidden">
              <Link href={`/products/${item.slug}`} className="block">
                <div className="relative aspect-[3/4] bg-cream-100">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-cover" sizes="33vw" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{item.name}</div>
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); removeItem(item.productId) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label="移除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </Link>
              <div className="p-3">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-xs text-gold-600 mt-1">
                  NT$ {(item.salePrice ?? item.price).toLocaleString()}
                </p>
                <button
                  onClick={() => addToCart({ productId: item.productId, slug: item.slug, name: item.name, image: item.image, price: item.price, salePrice: item.salePrice })}
                  className="mt-2 w-full flex items-center justify-center gap-1 py-2 bg-foreground text-cream-50 text-[10px] rounded-lg hover:bg-foreground/90 transition-colors"
                >
                  <ShoppingBag size={12} />
                  加入購物車
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
