import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ProductListClient } from './ProductListClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '全部商品',
  description: '探索 CHIC KIM & MIU 全系列商品，找到屬於你的優雅與可愛。',
}

type PLS = {
  pageSize: number
  defaultSort: string
  hideOutOfStock: boolean
  showSizeFilter: boolean
}

const DEFAULT_PLS: PLS = {
  pageSize: 24,
  defaultSort: 'newest',
  hideOutOfStock: false,
  showSizeFilter: true,
}

function sortParamToPayload(sort: string): string {
  switch (sort) {
    case 'price-asc': return 'price'
    case 'price-desc': return '-price'
    case 'popular': return '-stock'
    default: return '-createdAt'
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations('productList')
  const params = await searchParams
  let products: Record<string, unknown>[] = []
  let categories: Record<string, unknown>[] = []
  let totalPages = 1
  let totalDocs = 0
  let pls: PLS = DEFAULT_PLS

  const tag = typeof params.tag === 'string' ? params.tag : undefined
  const category = typeof params.category === 'string' ? params.category : undefined
  const sort = typeof params.sort === 'string' ? params.sort : undefined
  const page = Math.max(1, parseInt((params.page as string) || '1', 10) || 1)

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // ProductListSettings
      try {
        const settings = (await payload.findGlobal({
          slug: 'product-list-settings',
          depth: 0,
        })) as unknown as Partial<PLS> & { banner?: unknown }
        pls = {
          pageSize: (settings.pageSize as number) || DEFAULT_PLS.pageSize,
          defaultSort: (settings.defaultSort as string) || DEFAULT_PLS.defaultSort,
          hideOutOfStock: Boolean(settings.hideOutOfStock),
          showSizeFilter: settings.showSizeFilter !== false,
        }
      } catch {
        // fallback to defaults
      }

      const activeSort = sort || pls.defaultSort

      // Categories sorted by sortOrder then name
      const catResult = await payload.find({
        collection: 'categories',
        where: { isActive: { not_equals: false } },
        limit: 200,
        sort: 'sortOrder,name',
        depth: 1,
      })
      categories = catResult.docs as unknown as Record<string, unknown>[]

      // Build where clause
      const where: Where = {}
      if (tag === 'new') where.isNew = { equals: true }
      if (tag === 'hot') where.isHot = { equals: true }
      if (tag === 'sale') where.salePrice = { greater_than: 0 }
      if (tag === 'korean-celebrity') {
        where.collectionTags = { in: ['korean-celebrity', 'celebrity-style'] }
      }
      if (tag === 'jin-style') {
        where.collectionTags = { in: ['jin-style', 'jin-live'] }
      }
      if (category) where.category = { equals: category }
      if (pls.hideOutOfStock) where.stock = { greater_than: 0 }

      const result = await payload.find({
        collection: 'products',
        where,
        limit: pls.pageSize,
        page,
        sort: sortParamToPayload(activeSort),
        depth: 2,
      })
      products = result.docs as unknown as Record<string, unknown>[]
      totalPages = result.totalPages
      totalDocs = result.totalDocs
    } catch {
      // DB not ready
    }
  }

  return (
    <ProductListClient
      initialProducts={products}
      categories={categories}
      initialTag={tag}
      initialCategory={category}
      sort={sort || pls.defaultSort}
      page={page}
      totalPages={totalPages}
      totalDocs={totalDocs}
      showSizeFilter={pls.showSizeFilter}
      plsTitle={t('title')}
      plsOverline={t('overline')}
    />
  )
}
