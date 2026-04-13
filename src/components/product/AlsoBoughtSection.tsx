'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Users, TrendingUp } from 'lucide-react'

/**
 * 「同樣的人也買了」推薦區塊
 * 根據購買紀錄、身形相似度、熱門搭配自動產生
 * 可嵌入：商品頁、購物車、感謝頁
 */

interface RecommendedProduct {
  slug: string
  name: string
  price: number
  salePrice?: number
  image: string
  matchScore: number // 0-100 匹配度
  reason: string     // "身形相似買家最愛" / "經常一起購買" / "熱銷推薦"
}

// Demo data — 正式上線後從 API 取得
const DEMO_RECOMMENDATIONS: RecommendedProduct[] = [
  {
    slug: 'serene-elegant-lace-layered-dress',
    name: 'Serene 名媛蕾絲層次洋裝',
    price: 2980,
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c140b9f04a564933f21f59/1500x.webp?source_format=png',
    matchScore: 95,
    reason: '身形相似買家最愛',
  },
  {
    slug: 'amelia-elegant-tulle-button-dress',
    name: 'Amelia 優雅疊紗包釦洋裝',
    price: 2680,
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69aea7b58f3bc8e1bdf32201/1500x.webp?source_format=png',
    matchScore: 88,
    reason: '經常一起購買',
  },
  {
    slug: 'ant-waist-urban-straight-pants',
    name: '螞蟻腰都會修身直筒褲',
    price: 1480,
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69c1521fa96d6491182ab509/1500x.webp?source_format=png',
    matchScore: 82,
    reason: '熱銷搭配',
  },
  {
    slug: 'y2k-oval-sunglasses',
    name: 'Y2K個性橢圓墨鏡',
    price: 780,
    image: 'https://shoplineimg.com/559df3efe37ec64e9f000092/69bd18487d7f9fb65f0f78b4/1500x.webp?source_format=png',
    matchScore: 75,
    reason: '完美搭配單品',
  },
]

interface Props {
  title?: string
  context?: 'product_page' | 'cart' | 'thank_you' | 'email'
  maxItems?: number
}

export function AlsoBoughtSection({
  title = '同樣的人也買了',
  context = 'product_page',
  maxItems = 4,
}: Props) {
  const items = DEMO_RECOMMENDATIONS.slice(0, maxItems)

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

      <div className={`grid gap-4 ${
        context === 'cart'
          ? 'grid-cols-2 md:grid-cols-4'
          : 'grid-cols-2 md:grid-cols-4'
      }`}>
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
              {/* Match badge */}
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-[10px] text-gold-600 rounded-full">
                {product.reason}
              </span>
            </div>
            <p className="text-sm font-medium truncate group-hover:text-gold-600 transition-colors">
              {product.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {product.salePrice ? (
                <>
                  <span className="text-sm text-gold-600">NT$ {product.salePrice.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground line-through">NT$ {product.price.toLocaleString()}</span>
                </>
              ) : (
                <span className="text-sm text-gold-600">NT$ {product.price.toLocaleString()}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
