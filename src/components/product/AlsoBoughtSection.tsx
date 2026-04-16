'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Users, TrendingUp } from 'lucide-react'
import { normalizeMediaUrl } from '@/lib/media-url'

/**
 * 「同樣的人也買了」推薦區塊
 * 從 server 取得真實 Payload 商品（而非 hardcode demo），
 * 由父層傳入 `products` 陣列。當沒有資料時不渲染。
 */

export interface AlsoBoughtProduct {
  slug: string
  name: string
  price: number
  salePrice?: number
  image: string
  reason?: string
}

interface Props {
  title?: string
  context?: 'product_page' | 'cart' | 'thank_you' | 'email'
  maxItems?: number
  /** Real Payload product docs (depth ≥ 1 so images are populated) */
  products?: Record<string, unknown>[]
}

/* ── Reasons we cycle through, purely cosmetic ── */
const REASONS = [
  '身形相似買家最愛',
  '經常一起購買',
  '熱銷搭配',
  '完美搭配單品',
]

function payloadToCard(
  product: Record<string, unknown>,
  index: number,
): AlsoBoughtProduct | null {
  const slug = product.slug as string | undefined
  const name = product.name as string | undefined
  const price = product.price as number | undefined
  if (!slug || !name || typeof price !== 'number') return null

  const images = product.images as
    | { image?: { url?: string } | number }[]
    | undefined
  const firstImg = images?.[0]?.image
  const rawUrl =
    firstImg && typeof firstImg === 'object' ? firstImg.url : undefined
  const image = normalizeMediaUrl(rawUrl) || ''
  if (!image) return null

  return {
    slug,
    name,
    price,
    salePrice: (product.salePrice as number | undefined) ?? undefined,
    image,
    reason: REASONS[index % REASONS.length],
  }
}

export function AlsoBoughtSection({
  title = '同樣的人也買了',
  context = 'product_page',
  maxItems = 4,
  products,
}: Props) {
  const items: AlsoBoughtProduct[] = (products || [])
    .map((p, i) => payloadToCard(p, i))
    .filter((p): p is AlsoBoughtProduct => p !== null)
    .slice(0, maxItems)

  // No real recommendations to show — render nothing instead of broken demo links
  if (items.length === 0) return null

  return (
    <section className={context === 'cart' ? 'py-6' : 'py-12 md:py-16'}>
      <div className="flex items-center gap-2 mb-6">
        <Users size={18} className="text-gold-500" />
        <h3 className="text-lg font-serif">{title}</h3>
        <span className="text-[10px] px-2 py-0.5 bg-gold-500/10 text-gold-600 rounded-full flex items-center gap-1">
          <TrendingUp size={10} />
          AI 推薦
        </span>
      </div>

      <div
        className={`grid gap-4 ${
          context === 'cart'
            ? 'grid-cols-2 md:grid-cols-4'
            : 'grid-cols-2 md:grid-cols-4'
        }`}
      >
        {items.map((product) => (
          <Link
            key={product.slug}
            href={`/products/${product.slug}`}
            className="group"
          >
            <div className="aspect-[3/4] rounded-xl mb-2 overflow-hidden relative border border-cream-200">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 50vw, 25vw"
                unoptimized
              />
              {product.reason && (
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] text-gold-600 rounded-full">
                  {product.reason}
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
              {product.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {product.salePrice ? (
                <>
                  <span className="text-sm text-gold-600">
                    NT$ {product.salePrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    NT$ {product.price.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gold-600">
                  NT$ {product.price.toLocaleString()}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
