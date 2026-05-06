import type { CollectionSlug, Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/products/admin/link-integrity/scan
 * -------------------------------------------
 * Wave 1 PR-ζ — admin-only diagnostics scan.
 *
 * 註冊在 Products collection 的 endpoints[]（避免動 payload.config.ts；
 * Wave 1 期間 PR-α/β 也在改 payload.config.ts，conflict 風險集中在那邊）。
 *
 * 6 種檢查（封測公開營運前抓 link 暗坑）：
 *   1. productsWithoutCategory  — products.category 為 null
 *   2. orphanCategoryRefs        — products.category 指向不存在的 category id
 *   3. duplicateSlugs             — products.slug 在多筆出現（unique 應擋，但 legacy data 可能漏）
 *   4. countMismatch              — categories.productCount 與實際 COUNT 不符
 *   5. imageBroken                — sample 100 筆，images 為空 / 第一張 image.url 為 null
 *   6. duplicateAliasSlugs        — PR-δ aliasSlugs 重複指向多 product（PR-δ 未 merge 時回空陣列）
 *
 * 為什麼用 JS aggregate 而非 raw SQL：
 *   - prod 商品數 ~1,224，全載入記憶體無壓力
 *   - 跨 SQLite/Postgres 可移植
 *   - 不需依賴 drizzle 私有 API
 */

type ProductLite = {
  id: number | string
  name?: string | null
  slug?: string | null
  category?: number | string | null
  images?: Array<{
    image?: number | string | { id?: number | string; url?: string | null } | null
  }> | null
  aliasSlugs?: Array<{ slug?: string | null }> | null
}

type CategoryLite = {
  id: number | string
  name?: string | null
  productCount?: number | null
}

const PRODUCTS_SLUG = 'products' as CollectionSlug
const CATEGORIES_SLUG = 'categories' as CollectionSlug

export const linkIntegrityScanEndpoint: Endpoint = {
  path: '/admin/link-integrity/scan',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const role = (req.user as { role?: string } | null)?.role
    if (!req.user || role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    try {
      // 取所有商品（depth:0 → category 是 id 不是 doc）
      const allProductsRes = await req.payload.find({
        collection: PRODUCTS_SLUG,
        limit: 100000,
        pagination: false,
        depth: 0,
      })
      const products = allProductsRes.docs as unknown as ProductLite[]

      // 取所有分類
      const allCatsRes = await req.payload.find({
        collection: CATEGORIES_SLUG,
        limit: 100000,
        pagination: false,
        depth: 0,
      })
      const cats = allCatsRes.docs as unknown as CategoryLite[]
      const catIdSet = new Set(cats.map((c) => String(c.id)))

      // CHECK 1 — products without category
      const productsWithoutCategory = products
        .filter((p) => p.category == null)
        .slice(0, 500)
        .map((p) => ({
          id: Number(p.id),
          name: p.name ?? '(無名)',
          slug: p.slug ?? '',
        }))

      // CHECK 2 — orphan category refs（指向已刪除的 category id）
      const orphanCategoryRefs = products
        .filter((p) => p.category != null && !catIdSet.has(String(p.category)))
        .slice(0, 500)
        .map((p) => ({
          id: Number(p.id),
          name: p.name ?? '(無名)',
          categoryId: Number(p.category),
        }))

      // CHECK 3 — duplicate slugs
      const slugMap = new Map<string, number[]>()
      for (const p of products) {
        const slug = (p.slug ?? '').trim()
        if (!slug) continue
        const arr = slugMap.get(slug) ?? []
        arr.push(Number(p.id))
        slugMap.set(slug, arr)
      }
      const duplicateSlugs = Array.from(slugMap.entries())
        .filter(([, ids]) => ids.length > 1)
        .map(([slug, ids]) => ({ slug, count: ids.length, ids }))

      // CHECK 4 — productCount mismatch（逐 category 對 count）
      const countMismatch: Array<{
        id: number
        name: string
        stored: number
        actual: number
      }> = []
      for (const cat of cats) {
        const stored = Number(cat.productCount ?? 0)
        const countRes = await req.payload.count({
          collection: PRODUCTS_SLUG,
          where: { category: { equals: cat.id } },
        })
        const actual = Number(countRes.totalDocs ?? 0)
        if (stored !== actual) {
          countMismatch.push({
            id: Number(cat.id),
            name: cat.name ?? '(無名)',
            stored,
            actual,
          })
        }
      }

      // CHECK 5 — image broken（sample 100 筆，depth:1 拿到 media doc）
      const sampleRes = await req.payload.find({
        collection: PRODUCTS_SLUG,
        limit: 100,
        pagination: false,
        depth: 1,
      })
      const sample = sampleRes.docs as unknown as ProductLite[]
      const imageBroken: Array<{ id: number; name: string; reason: string }> = []
      for (const doc of sample) {
        const imgs = doc.images ?? []
        if (imgs.length === 0) {
          imageBroken.push({
            id: Number(doc.id),
            name: doc.name ?? '(無名)',
            reason: '商品無圖片',
          })
          continue
        }
        let broken = false
        for (const row of imgs) {
          const img = row?.image
          if (!img) {
            broken = true
            break
          }
          if (typeof img === 'object' && (img as { url?: string | null }).url == null) {
            broken = true
            break
          }
        }
        if (broken) {
          imageBroken.push({
            id: Number(doc.id),
            name: doc.name ?? '(無名)',
            reason: '至少一張圖片 url 為空',
          })
        }
      }

      // CHECK 6 — duplicate alias slugs（PR-δ 未 merge 時 aliasSlugs 不存在 → 空 Map）
      const aliasMap = new Map<string, Array<number | string>>()
      for (const p of products) {
        const aliases = (p as ProductLite).aliasSlugs
        if (!Array.isArray(aliases)) continue
        for (const a of aliases) {
          const s = (a?.slug ?? '').trim()
          if (!s) continue
          const arr = aliasMap.get(s) ?? []
          arr.push(p.id)
          aliasMap.set(s, arr)
        }
      }
      const duplicateAliasSlugs = Array.from(aliasMap.entries())
        .filter(([, ids]) => ids.length > 1)
        .map(([slug, ids]) => ({
          slug,
          productIds: ids.map((i) => Number(i)),
        }))

      return Response.json({
        productsWithoutCategory,
        orphanCategoryRefs,
        duplicateSlugs,
        countMismatch,
        imageBroken,
        duplicateAliasSlugs,
        scannedAt: new Date().toISOString(),
        totalProducts: products.length,
        totalCategories: cats.length,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[linkIntegrityScan] failed:', msg)
      return Response.json({ error: 'server_error', message: msg }, { status: 500 })
    }
  },
}
