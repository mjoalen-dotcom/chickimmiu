import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { ProductListClient } from './ProductListClient'

/**
 * Server-side 真分頁（2026-06-18 重寫）
 * ────────────────────────────────────
 * 舊版把全部 ~1395 件上架商品 depth:1 一次撈進 client 做記憶體篩選/排序/分頁，
 * 光是 populate 兩萬多張相簿圖就要 TTFB ~16s，且 HTML payload 2.7MB（超過
 * Next data-cache 2MB 上限故無法 unstable_cache）。
 *
 * 新版：tag / category / price / colors / sizes / sort / page 全部走 URL
 * searchParams → server 端建 where 只撈「當前這一頁」(預設 24 件) depth:1，
 * 一頁 24 件約 24×15=360 次 populate → TTFB <1s。filter chip 用的色/尺寸選項
 * 與分類另以 60s 快取查詢提供。QuickView 因每件商品仍 depth:1 帶完整 images，
 * 不需 client 端 lazy fetch。
 */
export const metadata: Metadata = {
  title: '全部商品',
  description: '探索 CHIC KIM & MIU 全系列商品，找到屬於你的優雅與可愛。',
}

// 此頁讀 searchParams → 動態渲染；快取只用在分類 / filter 選項兩個共用查詢。
export const dynamic = 'force-dynamic'

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
 * 排除每件商品的 description(richText)/sourcing/ads/seo 等大欄位。
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

const SORT_MAP: Record<string, string> = {
  newest: '-createdAt',
  'price-asc': 'price',
  'price-desc': '-price',
  popular: '-totalSold',
}

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

export type ColorOption = { name: string; code: string }

/**
 * filter chip 用的「全站可選色 + 尺寸」。只 select variants（不 populate 圖），
 * payload 很小 → 可安全快取。60s + 'products' tag。
 */
const getCachedFilterOptions = unstable_cache(
  async (): Promise<{ colors: ColorOption[]; sizes: string[] }> => {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: 5000,
      depth: 0,
      pagination: false,
      select: { variants: true },
    })
    const colorMap = new Map<string, string>()
    const sizeSet = new Set<string>()
    for (const p of res.docs as unknown as { variants?: { colorName?: string; colorCode?: string; size?: string }[] }[]) {
      for (const v of p.variants ?? []) {
        if (v.colorName && v.colorCode) colorMap.set(v.colorName, v.colorCode)
        if (v.size) sizeSet.add(v.size)
      }
    }
    return {
      colors: [...colorMap.entries()].map(([name, code]) => ({ name, code })),
      sizes: [...sizeSet],
    }
  },
  ['products-page-filter-options'],
  { revalidate: 60, tags: ['products'] },
)

/** 把點到的分類展開成 family（該分類 + 子分類 id）。 */
async function categoryFamily(
  payload: Awaited<ReturnType<typeof getPayload>>,
  category: string,
): Promise<(string | number)[]> {
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
  return familyIds
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}
function csv(v: string | string[] | undefined): string[] {
  const s = str(v)
  return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  let products: Record<string, unknown>[] = []
  let categories: Record<string, unknown>[] = []
  let colorOptions: ColorOption[] = []
  let sizeOptions: string[] = []
  let totalDocs = 0
  let totalPages = 1
  let settings: PLSDoc = DEFAULT_SETTINGS

  // 解析篩選 / 分頁參數（settings 先用預設，下方拿到 global 後再校正 pageSize 上下界）
  const tag = str(params.tag)
  const category = str(params.category)
  const sort = str(params.sort) ?? DEFAULT_SETTINGS.defaultSort!
  const colors = csv(params.colors)
  const sizes = csv(params.sizes)
  const minPrice = str(params.minPrice) ? Number(params.minPrice) : undefined
  const maxPrice = str(params.maxPrice) ? Number(params.maxPrice) : undefined
  const pageNum = Math.max(1, Number(str(params.page)) || 1)

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      try {
        const pls = await payload.findGlobal({ slug: 'product-list-settings' })
        settings = (pls as unknown as PLSDoc) ?? DEFAULT_SETTINGS
      } catch {
        // global may not be initialised yet
      }

      const pageSize = Number(str(params.pageSize)) || settings.pageSize || 24

      // 組 where（status + tag + 分類 family + 價格 + 色 + 尺寸 + 缺貨）
      const andConditions: Where[] = [{ status: { equals: 'published' } }]
      if (tag === 'new') andConditions.push({ isNew: { equals: true } })
      if (tag === 'hot') andConditions.push({ isHot: { equals: true } })
      if (tag === 'sale') andConditions.push({ salePrice: { greater_than: 0 } })
      if (tag === 'korean-celebrity')
        andConditions.push({ collectionTags: { in: ['korean-celebrity', 'celebrity-style'] } })
      if (tag === 'jin-style')
        andConditions.push({ collectionTags: { in: ['jin-style', 'jin-live'] } })

      if (category) {
        const familyIds = await categoryFamily(payload, category)
        andConditions.push({
          or: [{ category: { in: familyIds } }, { additionalCategories: { in: familyIds } }],
        })
      }

      if (minPrice != null && Number.isFinite(minPrice) && minPrice > 0)
        andConditions.push({ price: { greater_than_equal: minPrice } })
      if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice < (settings.maxPriceCap ?? 10000))
        andConditions.push({ price: { less_than_equal: maxPrice } })
      if (colors.length) andConditions.push({ 'variants.colorName': { in: colors } })
      if (sizes.length) andConditions.push({ 'variants.size': { in: sizes } })
      if (settings.hideOutOfStock) andConditions.push({ stock: { greater_than: 0 } })

      // 並行：當前頁商品 + 分類 + filter 選項
      const [pageResult, cats, opts] = await Promise.all([
        payload.find({
          collection: 'products',
          where: { and: andConditions },
          limit: pageSize,
          page: pageNum,
          sort: SORT_MAP[sort] ?? SORT_MAP.newest,
          depth: 1,
          select: PRODUCT_LIST_SELECT,
        }),
        getCachedCategories(),
        getCachedFilterOptions(),
      ])

      products = pageResult.docs as unknown as Record<string, unknown>[]
      totalDocs = pageResult.totalDocs
      totalPages = pageResult.totalPages
      categories = cats
      colorOptions = opts.colors
      sizeOptions = opts.sizes
    } catch {
      // DB not ready
    }
  }

  const pageSizeOptions = (settings.pageSizeOptions ?? DEFAULT_SETTINGS.pageSizeOptions)!.map(
    (o) => o.value,
  )
  const effectivePageSize = Number(str(params.pageSize)) || settings.pageSize || 24

  return (
    <ProductListClient
      products={products}
      categories={categories}
      colorOptions={colorOptions}
      sizeOptions={sizeOptions}
      totalDocs={totalDocs}
      totalPages={totalPages}
      currentPage={pageNum}
      pageSize={effectivePageSize}
      pageSizeOptions={pageSizeOptions}
      activeTag={tag ?? ''}
      activeCategory={category ?? ''}
      sortBy={sort}
      minPrice={minPrice ?? 0}
      maxPrice={maxPrice ?? (settings.maxPriceCap ?? 10000)}
      selectedColors={colors}
      selectedSizes={sizes}
      maxPriceCap={settings.maxPriceCap ?? 10000}
      showSizeFilter={settings.showSizeFilter ?? true}
    />
  )
}
