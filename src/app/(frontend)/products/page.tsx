import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductListClient } from './ProductListClient'

/**
 * 強制每次 request 都重新 render，讓後台編輯可以立刻在前台看到。
 * 配合 Products collection 的 afterChange/afterDelete hooks，這頁會一直
 * 吃到最新資料。未來若改用 ISR + revalidateTag 快取，可改成 revalidate = 60。
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '全部商品',
  description: '探索 CHIC KIM & MIU 全系列商品，找到屬於你的優雅與可愛。',
}

type PLSDoc = {
  pageSize?: number
  pageSizeOptions?: { value: number }[]
  defaultSort?: string
  maxPriceCap?: number
  showSizeFilter?: boolean
  hideOutOfStock?: boolean
}

const DEFAULT_SETTINGS: PLSDoc = {
  pageSize: 24,
  pageSizeOptions: [{ value: 12 }, { value: 24 }, { value: 48 }],
  defaultSort: 'newest',
  maxPriceCap: 10000,
  showSizeFilter: true,
  hideOutOfStock: false,
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  let products: Record<string, unknown>[] = []
  let categories: Record<string, unknown>[] = []
  let settings: PLSDoc = DEFAULT_SETTINGS

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // Fetch ProductListSettings global (PR-α) for pagination/filter config
      try {
        const pls = await payload.findGlobal({ slug: 'product-list-settings' })
        settings = (pls as unknown as PLSDoc) ?? DEFAULT_SETTINGS
      } catch {
        // global may not be initialised yet
      }

      // Fetch categories sorted by sortOrder (from DB), parent populated.
      // isActive:not_equals:false keeps null/undefined rows too.
      const catResult = await payload.find({
        collection: 'categories',
        where: { isActive: { not_equals: false } },
        limit: 100,
        sort: 'sortOrder',
        depth: 1,
      })
      categories = catResult.docs as unknown as Record<string, unknown>[]

      // Build where clause
      const where: Where = {}

      const tag = typeof params.tag === 'string' ? params.tag : undefined
      const category = typeof params.category === 'string' ? params.category : undefined

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
      if (settings.hideOutOfStock) {
        where.or = [{ stock: { greater_than: 0 } }]
      }

      const result = await payload.find({
        collection: 'products',
        where,
        limit: 500,
        sort: '-createdAt',
        depth: 2,
      })
      products = result.docs as unknown as Record<string, unknown>[]
    } catch {
      // DB not ready
    }
  }

  const pageSizeOptions = (settings.pageSizeOptions ?? DEFAULT_SETTINGS.pageSizeOptions)!.map(
    (o) => o.value,
  )

  return (
    <ProductListClient
      initialProducts={products}
      categories={categories}
      initialTag={typeof params.tag === 'string' ? params.tag : undefined}
      initialCategory={typeof params.category === 'string' ? params.category : undefined}
      defaultPageSize={settings.pageSize ?? 24}
      pageSizeOptions={pageSizeOptions}
      defaultSort={settings.defaultSort ?? 'newest'}
      maxPriceCap={settings.maxPriceCap ?? 10000}
      showSizeFilter={settings.showSizeFilter ?? true}
    />
  )
}
