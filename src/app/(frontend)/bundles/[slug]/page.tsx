import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { normalizeMediaUrl } from '@/lib/media-url'
import { BundleClient } from './BundleClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }

  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'bundles',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
    })
    const b = docs[0] as unknown as Record<string, unknown> | undefined
    if (!b) return { title: '套組不存在' }
    return {
      title: `${String(b.name)} ｜ 組合商品`,
      description: `套組價 NT$ ${Number(b.bundlePrice ?? 0)}，省下 NT$ ${Number(b.savings ?? 0)}`,
    }
  } catch {
    return { title: slug }
  }
}

export default async function BundlePage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'bundles',
    where: { slug: { equals: slug }, isActive: { equals: true } },
    limit: 1,
    depth: 2,
  })
  const bundle = docs[0] as unknown as Record<string, unknown> | undefined
  if (!bundle) notFound()

  const now = Date.now()
  const expires = bundle.expiresAt ? new Date(bundle.expiresAt as string).getTime() : 0
  if (expires && expires < now) notFound()

  const image = bundle.image as Record<string, unknown> | undefined
  const imageUrl = image ? normalizeMediaUrl(String(image.url ?? '')) : ''
  const items = (bundle.items as Array<Record<string, unknown>> | undefined) ?? []

  const clientItems = items.map((row) => {
    const p = row.product as Record<string, unknown> | undefined
    const pImages = (p?.images as Array<{ image?: { url?: string; alt?: string } }> | undefined) ?? []
    const firstImg = pImages[0]?.image?.url ?? ''
    return {
      product: {
        id: String(p?.id ?? ''),
        slug: String(p?.slug ?? ''),
        name: String(p?.name ?? ''),
        price: Number(p?.salePrice ?? 0) || Number(p?.price ?? 0),
        salePrice: typeof p?.salePrice === 'number' ? (p.salePrice as number) : undefined,
        image: normalizeMediaUrl(firstImg) ?? '',
      },
      quantity: Number(row.quantity ?? 1) || 1,
    }
  })

  return (
    <main className="min-h-screen bg-cream-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
          <Link href="/" className="hover:underline">
            首頁
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:underline">
            商品
          </Link>
          <span>/</span>
          <span className="text-foreground">套組 · {String(bundle.name)}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-12">
          {imageUrl && (
            <div className="aspect-square relative rounded-2xl overflow-hidden bg-white border border-cream-200">
              <Image src={imageUrl} alt={String(bundle.name)} fill className="object-cover" />
            </div>
          )}

          <div className="space-y-6">
            <div>
              <p className="text-xs text-gold-700 uppercase tracking-widest">組合商品</p>
              <h1 className="text-3xl font-light mt-2">{String(bundle.name)}</h1>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl text-gold-600 font-light">
                NT$ {Number(bundle.bundlePrice ?? 0).toLocaleString()}
              </span>
              {Number(bundle.originalPrice ?? 0) > Number(bundle.bundlePrice ?? 0) && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    NT$ {Number(bundle.originalPrice ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                    省 NT$ {Number(bundle.savings ?? 0).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            <div className="border border-cream-200 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-medium mb-3">套組內容（{items.length} 件）</h3>
              <ul className="space-y-3">
                {clientItems.map((row, i) => (
                  <li key={i} className="flex items-center gap-3">
                    {row.product.image && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-cream-100">
                        <Image src={row.product.image} alt={row.product.name} fill className="object-cover" />
                      </div>
                    )}
                    <div className="flex-1 text-sm">
                      <p>{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">× {row.quantity}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <BundleClient
              bundle={{
                id: String(bundle.id ?? ''),
                name: String(bundle.name),
                slug: String(bundle.slug),
                bundlePrice: Number(bundle.bundlePrice ?? 0),
                image: imageUrl,
                items: clientItems,
              }}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
