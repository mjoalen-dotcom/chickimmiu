import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductListClient } from './ProductListClient'

export const metadata: Metadata = {
  title: '全部商品',
  description: '探索 CHIC KIM & MIU 全系列商品，找到屬於你的優雅與可愛。',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  let products: Record<string, unknown>[] = []
  let categories: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // Fetch categories with parent populated
      const catResult = await payload.find({
        collection: 'categories',
        limit: 100,
        sort: 'name',
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
      if (category) where.category = { equals: category }

      const result = await payload.find({
        collection: 'products',
        where,
        limit: 200,
        sort: '-createdAt',
        depth: 2,
      })
      products = result.docs as unknown as Record<string, unknown>[]
    } catch {
      // DB not ready
    }
  }

  return (
    <ProductListClient
      initialProducts={products}
      categories={categories}
      initialTag={typeof params.tag === 'string' ? params.tag : undefined}
      initialCategory={typeof params.category === 'string' ? params.category : undefined}
    />
  )
}
