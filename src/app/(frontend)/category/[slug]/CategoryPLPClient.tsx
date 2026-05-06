'use client'

import Link from 'next/link'
import { ProductCard } from '@/components/product/ProductCard'
import { normalizeMediaUrl } from '@/lib/media-url'

interface Props {
  products: Record<string, unknown>[]
  totalDocs: number
  totalPages: number
  page: number
  slug: string
  sort: string
}

export function CategoryPLPClient({ products, totalDocs, totalPages, page, slug, sort }: Props) {
  return (
    <div className="container py-8 md:py-12">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">{totalDocs} 件商品</p>
        <select
          value={sort}
          onChange={(e) => {
            const url = new URL(window.location.href)
            url.searchParams.set('sort', e.target.value)
            url.searchParams.set('page', '1')
            window.location.href = url.toString()
          }}
          className="px-3 py-2 bg-white border border-cream-200 rounded-xl text-sm"
        >
          <option value="-createdAt">最新上架</option>
          <option value="price">價格：低到高</option>
          <option value="-price">價格：高到低</option>
          <option value="-soldCount">熱銷優先</option>
        </select>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">此分類目前沒有商品</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => {
            const images = p.images as { image?: { url?: string; alt?: string } }[] | undefined
            const firstImage = images?.[0]?.image
            return (
              <ProductCard
                key={String(p.id)}
                id={String(p.id)}
                slug={p.slug as string}
                name={p.name as string}
                price={p.price as number}
                salePrice={(p.salePrice as number | undefined) ?? null}
                image={
                  firstImage
                    ? { url: normalizeMediaUrl(firstImage.url) || '', alt: firstImage.alt }
                    : null
                }
                isNew={p.isNew as boolean | undefined}
                isHot={p.isHot as boolean | undefined}
              />
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/category/${slug}?page=${n}&sort=${sort}`}
              className={`w-10 h-10 flex items-center justify-center rounded-full text-sm transition-colors ${
                n === page
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 hover:border-[#C19A5B]'
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
