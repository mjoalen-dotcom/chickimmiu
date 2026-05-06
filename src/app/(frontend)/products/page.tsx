import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductListClient } from './ProductListClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '全部商品',
  description: '探索 CHIC KIM & MIU 全系列商品，找到屬於你的優雅與可愛。',
}

const DEFAULT_PAGE_SIZE = 24
const DEFAULT_SORT = 'newest'
const DEFAULT_MAX_PRICE = 10000

type PLSettings = {
  pageSize?: number | null
  defaultSort?: string | null
  maxPriceCap?: number | null
  hideOutOfStock?: boolean | null
}

const SORT_MAP: Record<string, string> = {
  newest: '-createdAt',
  'price-asc': 'price',
  'price-desc': '-price',
  popular: '-totalSold',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  let products: Record<string, unknown>[] = []
  let categories: Record<string, unknown>[] = []
  let totalDocs = 0
  let totalPages = 1
  let pageSize = DEFAULT_PAGE_SIZE
  let defaultSort = DEFAULT_SORT
  let maxPriceCap = DEFAULT_MAX_PRICE

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // Read ProductListSettings global (Wave 2 PR-κ)
      try {
        const settings = (await payload.findGlobal({
          slug: 'product-list-settings',
          depth: 0,
        })) as PLSettings | null
        if (typeof settings?.pageSize === 'number' && settings.pageSize > 0) {
          pageSize = settings.pageSize
        }
        if (settings?.defaultSort) defaultSort = settings.defaultSort
        if (typeof settings?.maxPriceCap === 'number') maxPriceCap = settings.maxPriceCap
      } catch {
        // use defaults
      }

      // Query params
      const tag = typeof params.tag === 'string' ? params.tag : undefined
      const category = typeof params.category === 'string' ? params.category : undefined
      const sortParam = typeof params.sort === 'string' ? params.sort : defaultSort
      const page = Math.max(1, parseInt((params.page as string) || '1', 10) || 1)
      const payloadSort = SORT_MAP[sortParam] || SORT_MAP[defaultSort]

      // Categories (sorted by sortOrder from DB — replaces hardcoded displayOrder)
      const catResult = await payload.find({
        collection: 'categories',
        where: { isActive: { not_equals: false } },
        limit: 100,
        sort: 'sortOrder',
        depth: 1,
      })
      categories = catResult.docs as unknown as Record<string, unknown>[]

      // Build where clause
      const where: Where = { status: { equals: 'published' } }
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

      const result = await payload.find({
        collection: 'products',
        where,
        limit: pageSize,
        page,
        sort: payloadSort,
        depth: 2,
      })
      products = result.docs as unknown as Record<string, unknown>[]
      totalDocs = result.totalDocs
      totalPages = result.totalPages
    } catch {
      // DB not ready
    }
  }

  const sortParam = typeof params.sort === 'string' ? params.sort : defaultSort
  const currentPage = Math.max(1, parseInt((params.page as string) || '1', 10) || 1)

  return (
    <ProductListClient
      initialProducts={products}
      categories={categories}
      initialTag={typeof params.tag === 'string' ? params.tag : undefined}
      initialCategory={typeof params.category === 'string' ? params.category : undefined}
      totalDocs={totalDocs}
      totalPages={totalPages}
      currentPage={currentPage}
      pageSize={pageSize}
      maxPriceCap={maxPriceCap}
      initialSort={sortParam}
    />
  )
}
