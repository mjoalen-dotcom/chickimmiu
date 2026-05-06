import type { Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/products/admin/link-integrity-scan
 * ────────────────────────────────────────────
 * 後台連結完整性診斷（僅 admin）。一次掃 6 種前後台斷鏈狀況：
 *
 *   1. productsWithoutCategory   — Product.category 為空（required 但 legacy 可能漏）
 *   2. orphanCategoryRefs        — Product.category 指向已不存在的 category id
 *   3. duplicateSlugs            — products.slug 重複（PDP 會撞 / 不確定哪支命中）
 *   4. countMismatch             — categories.productCount 與實際 published 計數不符
 *   5. imageBroken               — Product.images[].image 為 null（媒體已刪 / ref 斷）
 *   6. duplicateAliasSlugs       — Product.aliasSlugs 重複指向多個 product（PR-δ 副作用）
 *
 * 註冊：Products.collection.endpoints[]，避開 payload.config.ts globals[]（Wave 1
 * α/β 動到那塊）與 Categories.endpoints[]（Wave 1 γ 會動）。
 *
 * 資料量假設：封測期 prod ~1,224 published / ~7,226 total products + ~80 categories；
 * 全表掃 < 5s。若量爆掉再分頁。
 */

type ProductLite = {
  id: string | number
  name?: string | null
  slug?: string | null
  category?: string | number | { id: string | number } | null
  images?: Array<{ image?: { id: string | number; url?: string } | string | number | null }> | null
  // PR-δ 才有，用 unknown 寬鬆讀
  aliasSlugs?: unknown
}

type CategoryLite = {
  id: string | number
  name?: string | null
  productCount?: number | null
}

function pickRefId(ref: unknown): string | null {
  if (ref == null) return null
  if (typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    const id = (ref as { id?: string | number }).id
    return id != null ? String(id) : null
  }
  return String(ref)
}

function extractAliasSlugs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const row of raw) {
    if (typeof row === 'string') {
      const trimmed = row.trim()
      if (trimmed) out.push(trimmed)
    } else if (row && typeof row === 'object') {
      const slug = (row as { slug?: unknown }).slug
      if (typeof slug === 'string') {
        const trimmed = slug.trim()
        if (trimmed) out.push(trimmed)
      }
    }
  }
  return out
}

export const linkIntegrityScanEndpoint: Endpoint = {
  // 完整 URL：/api/products/admin/link-integrity-scan
  path: '/admin/link-integrity-scan',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    try {
      // ── 1. Pull all products + categories（封測量級可一次拉完）──────────
      const productsResp = await req.payload.find({
        collection: 'products',
        limit: 10000,
        depth: 1, // populate images[].image 才能判 broken ref
        pagination: false,
        overrideAccess: true,
      })
      const products = productsResp.docs as unknown as ProductLite[]

      const categoriesResp = await req.payload.find({
        collection: 'categories',
        limit: 1000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const categories = categoriesResp.docs as unknown as CategoryLite[]

      const validCategoryIds = new Set(categories.map((c) => String(c.id)))
      const categoryNameById = new Map<string, string>()
      for (const c of categories) {
        categoryNameById.set(String(c.id), c.name || `分類 ${c.id}`)
      }

      // ── 2. productsWithoutCategory ──────────────────────────────────────
      const productsWithoutCategory: Array<{ id: number; name: string; slug: string }> = []
      // ── 3. orphanCategoryRefs ───────────────────────────────────────────
      const orphanCategoryRefs: Array<{ id: number; name: string; categoryId: string }> = []
      // ── 4. duplicateSlugs（slug → ids） ─────────────────────────────────
      const slugBuckets = new Map<string, number[]>()
      // ── 5. imageBroken ──────────────────────────────────────────────────
      const imageBroken: Array<{ id: number; name: string; reason: string }> = []
      // ── 6. duplicateAliasSlugs（aliasSlug → product ids） ───────────────
      const aliasBuckets = new Map<string, number[]>()

      for (const p of products) {
        const idNum = typeof p.id === 'number' ? p.id : Number(p.id)
        const name = p.name || `商品 ${p.id}`
        const slug = typeof p.slug === 'string' ? p.slug.trim() : ''

        // 1. without category
        const catId = pickRefId(p.category)
        if (!catId) {
          productsWithoutCategory.push({ id: idNum, name, slug })
        } else if (!validCategoryIds.has(catId)) {
          // 2. orphan ref
          orphanCategoryRefs.push({ id: idNum, name, categoryId: catId })
        }

        // 3. duplicate slug bucket
        if (slug) {
          const arr = slugBuckets.get(slug) || []
          arr.push(idNum)
          slugBuckets.set(slug, arr)
        }

        // 5. image broken — depth:1 已 populate；image 為 null 代表 ref 斷
        if (Array.isArray(p.images)) {
          let brokenCount = 0
          for (const row of p.images) {
            const img = row?.image
            if (img == null) {
              brokenCount += 1
            } else if (typeof img === 'object' && (img as { url?: string }).url == null) {
              brokenCount += 1
            }
          }
          if (brokenCount > 0) {
            imageBroken.push({
              id: idNum,
              name,
              reason: `${brokenCount} / ${p.images.length} 張圖片連結斷裂`,
            })
          }
        }

        // 6. alias slug
        const aliases = extractAliasSlugs(p.aliasSlugs)
        for (const alias of aliases) {
          const arr = aliasBuckets.get(alias) || []
          arr.push(idNum)
          aliasBuckets.set(alias, arr)
        }
      }

      // 3. flatten duplicates
      const duplicateSlugs: Array<{ slug: string; count: number; ids: number[] }> = []
      for (const [slug, ids] of slugBuckets.entries()) {
        if (ids.length > 1) {
          duplicateSlugs.push({ slug, count: ids.length, ids })
        }
      }
      duplicateSlugs.sort((a, b) => b.count - a.count)

      // 6. flatten alias duplicates
      const duplicateAliasSlugs: Array<{ slug: string; productIds: number[] }> = []
      for (const [alias, ids] of aliasBuckets.entries()) {
        if (ids.length > 1) {
          duplicateAliasSlugs.push({ slug: alias, productIds: ids })
        }
      }
      duplicateAliasSlugs.sort((a, b) => b.productIds.length - a.productIds.length)

      // ── 4. countMismatch ────────────────────────────────────────────────
      // 對每個 category 跑 payload.count(only published)，與 stored productCount 比。
      const countMismatch: Array<{
        id: number
        name: string
        stored: number
        actual: number
      }> = []

      for (const c of categories) {
        const idNum = typeof c.id === 'number' ? c.id : Number(c.id)
        const stored = typeof c.productCount === 'number' ? c.productCount : 0
        try {
          const actualResp = await req.payload.count({
            collection: 'products',
            where: {
              and: [
                { category: { equals: c.id } },
                { status: { equals: 'published' } },
              ],
            },
            overrideAccess: true,
          })
          const actual = actualResp.totalDocs || 0
          if (stored !== actual) {
            countMismatch.push({
              id: idNum,
              name: c.name || `分類 ${c.id}`,
              stored,
              actual,
            })
          }
        } catch {
          // ignore individual count failure
        }
      }

      return Response.json({
        generatedAt: new Date().toISOString(),
        totals: {
          products: products.length,
          categories: categories.length,
        },
        productsWithoutCategory,
        orphanCategoryRefs,
        duplicateSlugs,
        countMismatch,
        imageBroken,
        duplicateAliasSlugs,
      })
    } catch (e) {
      req.payload.logger.error({ msg: 'link-integrity-scan failed', err: e })
      return Response.json(
        { error: 'Internal error', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}
