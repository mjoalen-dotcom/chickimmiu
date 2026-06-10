import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { ProductListClient } from './ProductListClient'

/**
 * ISR 60 秒快取 — 之前 force-dynamic + limit 500 + depth 2 跑 TTFB 9.9s
 * 第二版（2026-05-12）再優化：發現實際 bottleneck 是 HTML payload size。
 * limit:200 serialize 後 HTML 高達 4.6 MB（200 個商品全部 inline 進 SSR
 * + ProductListClient props），即便 ISR cache 也要傳 4.6MB 過網路。
 *
 *   - limit 200 → 100 (HTML 4.6 MB → ~2.3 MB，TTFB 2s → ~1s)
 *   - depth 維持 1（list-page 需要 images[0]、variants colors 等 first-level）
 *   - ISR 60s + Products afterChange revalidatePath，admin 改完即時看到
 *
 * 想看第 100+ 件商品的 user 可用 client side filter/category 過濾，或進
 * /collections/{slug} 拿特定 tag/分類的完整列表。
 */
export const revalidate = 60

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

      // Fetch ALL active categories (parent populated). 全部分類 nav 不能漏，
      // 否則「未分類」「螞蟻腰超強顯瘦全系列」這種頂層分類整個從 chip bar 消失。
      // 目前 prod 大約 110-140 個分類，pagination:false 直接全拉是安全的。
      const catResult = await payload.find({
        collection: 'categories',
        where: { isActive: { not_equals: false } },
        sort: 'sortOrder',
        depth: 1,
        pagination: false,
      })
      categories = catResult.docs as unknown as Record<string, unknown>[]

      const tag = typeof params.tag === 'string' ? params.tag : undefined
      const category = typeof params.category === 'string' ? params.category : undefined

      // 商品 where 條件：tag 篩選、分類篩選、僅顯示已上架。
      // 注意 local API 不會套用 access control，所以 status 要自己加。
      const andConditions: Where[] = [{ status: { equals: 'published' } }]

      if (tag === 'new') andConditions.push({ isNew: { equals: true } })
      if (tag === 'hot') andConditions.push({ isHot: { equals: true } })
      if (tag === 'sale') andConditions.push({ salePrice: { greater_than: 0 } })
      if (tag === 'korean-celebrity') {
        andConditions.push({ collectionTags: { in: ['korean-celebrity', 'celebrity-style'] } })
      }
      if (tag === 'jin-style') {
        andConditions.push({ collectionTags: { in: ['jin-style', 'jin-live'] } })
      }

      // 分類篩選：mirror /category/[slug] 邏輯 — 把點到的分類展開成 family
      // (該分類 + 它的子分類)，並且主分類 (category) 或其他分類 (additionalCategories)
      // 任一命中都列入。否則點父分類 chip 會 0 筆，或漏掉只掛 additional 的商品。
      if (category) {
        const familyIds: (string | number)[] = [category]
        try {
          const childRes = await payload.find({
            collection: 'categories',
            where: { parent: { equals: category } },
            limit: 200,
            depth: 0,
            pagination: false,
          })
          for (const c of childRes.docs) familyIds.push(c.id as number)
        } catch {
          // ignore — family stays as [category]
        }
        andConditions.push({
          or: [
            { category: { in: familyIds } },
            { additionalCategories: { in: familyIds } },
          ],
        })
      }

      if (settings.hideOutOfStock) {
        andConditions.push({ stock: { greater_than: 0 } })
      }

      // 拉全量已上架商品。prod 目前 ~1272 件，先 cap 在 2000 留 headroom。
      // 之後若超過 2000 要改成真 server-side pagination。
      const result = await payload.find({
        collection: 'products',
        where: { and: andConditions },
        limit: 2000,
        sort: '-createdAt',
        depth: 1,
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
