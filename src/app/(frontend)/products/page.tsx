import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
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

/**
 * 列表頁卡片 + QuickView 實際用到的欄位白名單。
 * 避免把每件商品的 description(richText)、sourcing、ads、seo 等大欄位
 * 全序列化進 SSR — 那是 ~1395 件商品時 TTFB 16s 的主因。
 */
const PRODUCT_LIST_SELECT = {
  slug: true,
  name: true,
  price: true,
  salePrice: true,
  isNew: true,
  isHot: true,
  collectionTags: true,
  category: true,
  additionalCategories: true,
  images: true,
  variants: true,
} as const

/**
 * 全部上架分類（給 nav chip bar）。整站共用一份，60s 快取；
 * 分類/商品變動時由既有 revalidateCategory/revalidateProduct 的 tag 清除。
 */
const getCachedCategories = unstable_cache(
  async (): Promise<Record<string, unknown>[]> => {
    const payload = await getPayload({ config })
    const catResult = await payload.find({
      collection: 'categories',
      where: { isActive: { not_equals: false } },
      sort: 'sortOrder',
      depth: 1,
      pagination: false,
    })
    return catResult.docs as unknown as Record<string, unknown>[]
  },
  ['products-page-categories'],
  { revalidate: 60, tags: ['categories', 'products'] },
)

/**
 * 上架商品列表（依 tag/category/hideOutOfStock 快取分組）。
 * select 只取卡片需要的欄位，depth:1 填 images[0]/category/variants。
 * 60s 快取 + 既有 'products' tag → admin 存檔即時清除。
 */
const getCachedProducts = unstable_cache(
  async (
    tag: string | undefined,
    category: string | undefined,
    hideOutOfStock: boolean,
  ): Promise<Record<string, unknown>[]> => {
    const payload = await getPayload({ config })
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

    // 分類篩選：把點到的分類展開成 family（該分類 + 子分類），
    // 主分類或 additionalCategories 任一命中即列入。
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
        or: [{ category: { in: familyIds } }, { additionalCategories: { in: familyIds } }],
      })
    }

    if (hideOutOfStock) andConditions.push({ stock: { greater_than: 0 } })

    // 拉全量已上架商品（client 端做價格/尺寸/排序篩選）。
    // prod 目前 ~1395 件，cap 2000 留 headroom；超過要改真 server-side pagination。
    const result = await payload.find({
      collection: 'products',
      where: { and: andConditions },
      limit: 2000,
      sort: '-createdAt',
      depth: 1,
      select: PRODUCT_LIST_SELECT,
    })
    return result.docs as unknown as Record<string, unknown>[]
  },
  ['products-page-list'],
  { revalidate: 60, tags: ['products'] },
)

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

      const tag = typeof params.tag === 'string' ? params.tag : undefined
      const category = typeof params.category === 'string' ? params.category : undefined

      // 全部分類 (nav chip bar) + 上架商品列表 — 都走 60s 快取，避免每次請求
      // 重撈 ~1395 件商品 depth:1（原本 TTFB 16s）。admin 存檔由既有
      // revalidateProduct/revalidateCategory 的 tag 清除，仍即時生效。
      ;[categories, products] = await Promise.all([
        getCachedCategories(),
        getCachedProducts(tag, category, settings.hideOutOfStock ?? false),
      ])
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
