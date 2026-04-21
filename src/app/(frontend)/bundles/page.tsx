import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Package, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '組合商品 — CHIC KIM & MIU',
  description: '精選套組商品，一次滿足多件穿搭需求，享受組合折扣。',
}

type MediaRef = { url?: string; alt?: string } | string | number | null | undefined

type BundleCard = {
  id: string | number
  name: string
  slug?: string
  bundlePrice?: number
  originalPrice?: number
  savings?: number
  image?: MediaRef
  isActive?: boolean
  startsAt?: string
  expiresAt?: string
}

const ntd = (n: number | undefined) =>
  n != null ? `NT$ ${n.toLocaleString('zh-TW')}` : 'NT$ —'

async function getBundles(): Promise<BundleCard[]> {
  try {
    const payload = await getPayload({ config })
    const now = new Date().toISOString()
    const res = await payload.find({
      collection: 'bundles',
      limit: 48,
      depth: 1,
      sort: '-createdAt',
      where: {
        and: [
          { isActive: { equals: true } },
          {
            or: [
              { startsAt: { exists: false } },
              { startsAt: { less_than_equal: now } },
            ],
          },
          {
            or: [
              { expiresAt: { exists: false } },
              { expiresAt: { greater_than: now } },
            ],
          },
        ],
      },
    })
    return (res.docs as unknown as BundleCard[]) ?? []
  } catch {
    return []
  }
}

function getImageUrl(img: MediaRef): string | null {
  if (!img) return null
  if (typeof img === 'object' && 'url' in img && img.url) return img.url
  return null
}

export default async function BundlesPage() {
  const bundles = await getBundles()

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.3em] text-gold-600 mb-3">BUNDLES</p>
          <h1 className="text-3xl sm:text-4xl font-light text-foreground">組合商品</h1>
          <p className="mt-4 text-sm text-foreground/60 max-w-xl mx-auto leading-relaxed">
            精選搭配套組，一次購足整組穿搭，享組合折扣。<br />
            點選套組查看詳細內容，加入購物車直接獲得全組商品。
          </p>
        </div>

        {bundles.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-cream-100 text-center max-w-md mx-auto">
            <Package size={32} className="mx-auto text-foreground/30 mb-3" />
            <p className="text-sm text-foreground/60">目前沒有進行中的組合商品。</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 mt-4 text-xs text-gold-600 hover:text-gold-700 underline underline-offset-4"
            >
              逛逛所有商品 <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((b) => {
              const imgUrl = getImageUrl(b.image)
              const pct =
                b.originalPrice && b.savings && b.originalPrice > 0
                  ? Math.round((b.savings / b.originalPrice) * 100)
                  : null
              return (
                <Link
                  key={b.id}
                  href={`/bundles/${b.slug}`}
                  className="group block bg-white rounded-xl overflow-hidden shadow-sm border border-cream-100 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[4/5] bg-cream-100 relative overflow-hidden">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={b.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-foreground/20">
                        <Package size={40} />
                      </div>
                    )}
                    {pct && pct > 0 && (
                      <div className="absolute top-3 left-3 bg-gold-500 text-white text-xs px-2.5 py-1 rounded-full">
                        {pct}% OFF
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="text-sm font-medium text-foreground mb-2 line-clamp-2 min-h-[2.5em]">
                      {b.name}
                    </h2>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-semibold text-gold-600">{ntd(b.bundlePrice)}</span>
                      {b.originalPrice && b.originalPrice > (b.bundlePrice ?? 0) && (
                        <span className="text-xs text-foreground/40 line-through">
                          {ntd(b.originalPrice)}
                        </span>
                      )}
                    </div>
                    {b.savings && b.savings > 0 && (
                      <div className="text-xs text-foreground/50 mt-0.5">
                        組合省 {ntd(b.savings)}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
