import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/products/admin/bulk-fix-links
 * ───────────────────────────────────────
 * Admin-only batch repair for the 3 most urgent link-integrity issues
 * surfaced by /admin/diagnostics/link-integrity (PR-ζ).
 *
 *   action: 'assign-category'
 *     對指定 productIds 把 category 設成 toCategoryId。
 *     用於 ① 沒有分類的商品 + 列表頁 ProductBulkCategoryChanger（PR-θ）。
 *
 *   action: 'replace-orphan'
 *     找所有 category ref 指向不存在 category 的 product，全改成 toCategoryId。
 *     可選 fromCategoryIds 過濾（只動指向某幾個 orphan id 的商品）。
 *     用於 ② Orphan 分類引用。
 *
 *   action: 'dedupe-slug'
 *     對重複 slug 的商品：保留 createdAt 最舊（同 createdAt 取 id 最小）那支
 *     原 slug，其餘自動加 -2 / -3 / -4 … 後綴（會 skip 已存在的 slug）。
 *     可選 slugs 過濾（只處理指定的幾個 slug）。
 *     用於 ③ 重複 slug。
 *
 * 對齊既有 pattern：linkIntegrityScan / recountCategories / customerRegister
 *   - admin role gate
 *   - overrideAccess: true（繞 collection-level access）
 *   - 同步 for-loop（封測量級 < 50 筆 update，不需要 batch / queue）
 *
 * Response：{ ok: true, action, updated, errors?, renamed? }
 */

type AssignCategoryBody = {
  action: 'assign-category'
  productIds: number[]
  toCategoryId: number
}
type ReplaceOrphanBody = {
  action: 'replace-orphan'
  toCategoryId: number
  fromCategoryIds?: string[] // 可選；不傳 = 全部 orphan
}
type DedupeSlugBody = {
  action: 'dedupe-slug'
  slugs?: string[] // 可選；不傳 = 全部重複 slug
}
type Body = AssignCategoryBody | ReplaceOrphanBody | DedupeSlugBody

function pickRefId(ref: unknown): string | null {
  if (ref == null) return null
  if (typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
    const id = (ref as { id?: string | number }).id
    return id != null ? String(id) : null
  }
  return String(ref)
}

export const bulkFixLinksEndpoint: Endpoint = {
  path: '/admin/bulk-fix-links',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    let body: Body
    try {
      body = (await req.json?.()) as Body
      if (!body || !body.action) {
        return Response.json({ error: 'missing action' }, { status: 400 })
      }
    } catch {
      return Response.json({ error: 'invalid json' }, { status: 400 })
    }

    try {
      switch (body.action) {
        case 'assign-category':
          return await handleAssignCategory(req, body)
        case 'replace-orphan':
          return await handleReplaceOrphan(req, body)
        case 'dedupe-slug':
          return await handleDedupeSlug(req, body)
        default:
          return Response.json({ error: 'unknown action' }, { status: 400 })
      }
    } catch (e) {
      req.payload.logger.error({ msg: 'bulk-fix-links failed', err: e })
      return Response.json(
        { error: 'internal', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}

async function verifyCategory(req: PayloadRequest, id: number) {
  try {
    return await req.payload.findByID({
      collection: 'categories',
      id,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

async function handleAssignCategory(req: PayloadRequest, body: AssignCategoryBody) {
  const { productIds, toCategoryId } = body
  if (
    !Array.isArray(productIds) ||
    productIds.length === 0 ||
    typeof toCategoryId !== 'number'
  ) {
    return Response.json({ error: 'invalid params' }, { status: 400 })
  }
  if (!(await verifyCategory(req, toCategoryId))) {
    return Response.json({ error: 'target category not found' }, { status: 404 })
  }

  let updated = 0
  const errors: Array<{ id: number; err: string }> = []
  for (const pid of productIds) {
    try {
      await req.payload.update({
        collection: 'products',
        id: pid,
        data: { category: toCategoryId },
        depth: 0,
        overrideAccess: true,
      })
      updated += 1
    } catch (e) {
      errors.push({ id: pid, err: e instanceof Error ? e.message : String(e) })
    }
  }
  return Response.json({ ok: true, action: 'assign-category', updated, errors })
}

async function handleReplaceOrphan(req: PayloadRequest, body: ReplaceOrphanBody) {
  const { toCategoryId, fromCategoryIds } = body
  if (typeof toCategoryId !== 'number') {
    return Response.json({ error: 'invalid params' }, { status: 400 })
  }
  if (!(await verifyCategory(req, toCategoryId))) {
    return Response.json({ error: 'target category not found' }, { status: 404 })
  }

  const [products, cats] = await Promise.all([
    req.payload.find({
      collection: 'products',
      limit: 10000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
    req.payload.find({
      collection: 'categories',
      limit: 1000,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])
  const validIds = new Set(
    cats.docs.map((c) => String((c as unknown as { id: number | string }).id)),
  )
  const filterSet =
    fromCategoryIds && fromCategoryIds.length > 0 ? new Set(fromCategoryIds) : null

  let updated = 0
  const errors: Array<{ id: number; err: string }> = []
  for (const p of products.docs) {
    const rec = p as unknown as { id: number; category?: unknown }
    const refId = pickRefId(rec.category)
    if (!refId) continue // 沒分類交給 assign-category action 處理
    if (validIds.has(refId)) continue
    if (filterSet && !filterSet.has(refId)) continue
    try {
      await req.payload.update({
        collection: 'products',
        id: rec.id,
        data: { category: toCategoryId },
        depth: 0,
        overrideAccess: true,
      })
      updated += 1
    } catch (e) {
      errors.push({ id: rec.id, err: e instanceof Error ? e.message : String(e) })
    }
  }
  return Response.json({ ok: true, action: 'replace-orphan', updated, errors })
}

async function handleDedupeSlug(req: PayloadRequest, body: DedupeSlugBody) {
  const filterSlugs =
    body.slugs && body.slugs.length > 0 ? new Set(body.slugs) : null

  const products = await req.payload.find({
    collection: 'products',
    limit: 10000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  const slugBuckets = new Map<string, Array<{ id: number; createdAt?: string }>>()
  const allSlugs = new Set<string>()
  for (const p of products.docs) {
    const rec = p as unknown as { id: number; slug?: string; createdAt?: string }
    if (typeof rec.slug !== 'string' || !rec.slug.trim()) continue
    const slug = rec.slug.trim()
    allSlugs.add(slug)
    if (filterSlugs && !filterSlugs.has(slug)) continue
    const arr = slugBuckets.get(slug) || []
    arr.push({ id: rec.id, createdAt: rec.createdAt })
    slugBuckets.set(slug, arr)
  }

  let updated = 0
  const renamed: Array<{ id: number; oldSlug: string; newSlug: string }> = []
  const errors: Array<{ id: number; err: string }> = []

  for (const [slug, ids] of slugBuckets.entries()) {
    if (ids.length < 2) continue
    // 最舊的留原 slug；同 createdAt 取 id 最小
    ids.sort((a, b) => {
      const ca = a.createdAt ? Date.parse(a.createdAt) : 0
      const cb = b.createdAt ? Date.parse(b.createdAt) : 0
      if (ca !== cb) return ca - cb
      return a.id - b.id
    })
    let counter = 2
    for (let i = 1; i < ids.length; i++) {
      let newSlug = `${slug}-${counter}`
      while (allSlugs.has(newSlug)) {
        counter += 1
        newSlug = `${slug}-${counter}`
      }
      try {
        await req.payload.update({
          collection: 'products',
          id: ids[i].id,
          data: { slug: newSlug },
          depth: 0,
          overrideAccess: true,
        })
        allSlugs.add(newSlug)
        renamed.push({ id: ids[i].id, oldSlug: slug, newSlug })
        updated += 1
      } catch (e) {
        errors.push({ id: ids[i].id, err: e instanceof Error ? e.message : String(e) })
      }
      counter += 1
    }
  }

  return Response.json({
    ok: true,
    action: 'dedupe-slug',
    updated,
    renamed,
    errors,
  })
}
