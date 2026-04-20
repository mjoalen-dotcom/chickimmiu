import type { Endpoint, PayloadRequest } from 'payload'
import {
  SHOPLINE_CATEGORIES,
  computeLevel,
  type ShoplineCategoryNode,
} from '../lib/shopline/fullCategoryTree'
import { safeRevalidate } from '../lib/revalidate'

/**
 * POST /api/categories/seed-shopline
 * ─────────────────────────────────────
 * 將 SHOPLINE_CATEGORIES（~140 個 Shopline 分類）upsert 到 categories collection。
 *
 * Query:
 *   dryRun=1  → 只回報會新增/更新哪些；不寫入（預設）
 *   dryRun=0  → 真的寫入
 *   reset=1   → 將「不在 Shopline 清單內」的既有分類設為 isActive=false（標記孤兒，不刪除）
 *
 * 權限：admin only
 *
 * 回傳：JSON { created, updated, deactivated, unchanged, errors[] }
 */
export const seedShoplineCategoriesEndpoint: Endpoint = {
  path: '/seed-shopline',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    const url = new URL(req.url || '', 'http://localhost')
    const dryRun = url.searchParams.get('dryRun') !== '0'
    const resetOrphans = url.searchParams.get('reset') === '1'

    // slug → node 對照（供 parentSlug / level 查詢）
    const bySlug = new Map<string, ShoplineCategoryNode>()
    for (const n of SHOPLINE_CATEGORIES) bySlug.set(n.slug, n)

    // 先撈現有全部 categories
    const existing = await req.payload.find({
      collection: 'categories',
      limit: 500,
      depth: 0,
    })
    const existingBySlug = new Map<
      string,
      { id: number; parent: number | null; name: string; isActive: boolean }
    >()
    for (const doc of existing.docs as unknown as {
      id: number
      slug?: string
      name: string
      parent?: number | null
      isActive?: boolean
    }[]) {
      if (doc.slug) {
        existingBySlug.set(doc.slug, {
          id: doc.id,
          parent: doc.parent ?? null,
          name: doc.name,
          isActive: doc.isActive ?? true,
        })
      }
    }

    const plannedSlugs = new Set(SHOPLINE_CATEGORIES.map((n) => n.slug))

    type Action = 'create' | 'update' | 'unchanged' | 'deactivate' | 'error'
    const results: {
      slug: string
      name: string
      action: Action
      id?: number
      message?: string
    }[] = []

    let created = 0
    let updated = 0
    let unchanged = 0
    let deactivated = 0
    let failed = 0

    /* ─ Pass 1: 頂層（無 parentSlug） ─ */
    /* ─ Pass 2: 子層（有 parentSlug） ─ */
    const passes = [
      SHOPLINE_CATEGORIES.filter((n) => !n.parentSlug),
      SHOPLINE_CATEGORIES.filter((n) => Boolean(n.parentSlug)),
    ]

    for (const pass of passes) {
      for (const node of pass) {
        const level = computeLevel(node, bySlug)
        const parentId = node.parentSlug ? existingBySlug.get(node.parentSlug)?.id ?? null : null
        const isActive = node.isActive ?? true

        const data: Record<string, unknown> = {
          name: node.name,
          slug: node.slug,
          level,
          sortOrder: node.sortOrder ?? 0,
          isActive,
        }
        if (parentId) data.parent = parentId
        if (node.description) data.description = node.description

        const existingDoc = existingBySlug.get(node.slug)

        if (!existingDoc) {
          // CREATE
          if (dryRun) {
            created++
            results.push({ slug: node.slug, name: node.name, action: 'create' })
            // 模擬寫入，讓第二 pass 能找到 parent id
            existingBySlug.set(node.slug, {
              id: -(created + updated + unchanged), // 負值 placeholder
              parent: parentId,
              name: node.name,
              isActive,
            })
            continue
          }
          try {
            const doc = await req.payload.create({
              collection: 'categories',
              data: data as never,
            })
            const id = (doc as unknown as { id: number }).id
            existingBySlug.set(node.slug, { id, parent: parentId, name: node.name, isActive })
            created++
            results.push({ slug: node.slug, name: node.name, action: 'create', id })
          } catch (err) {
            failed++
            results.push({
              slug: node.slug,
              name: node.name,
              action: 'error',
              message: err instanceof Error ? err.message : String(err),
            })
          }
        } else {
          // UPDATE if changed
          const needsUpdate =
            existingDoc.name !== node.name ||
            existingDoc.parent !== parentId ||
            existingDoc.isActive !== isActive
          if (!needsUpdate) {
            unchanged++
            results.push({
              slug: node.slug,
              name: node.name,
              action: 'unchanged',
              id: existingDoc.id,
            })
            continue
          }
          if (dryRun) {
            updated++
            results.push({
              slug: node.slug,
              name: node.name,
              action: 'update',
              id: existingDoc.id,
            })
            continue
          }
          try {
            await req.payload.update({
              collection: 'categories',
              id: existingDoc.id,
              data: data as never,
            })
            existingBySlug.set(node.slug, {
              id: existingDoc.id,
              parent: parentId,
              name: node.name,
              isActive,
            })
            updated++
            results.push({
              slug: node.slug,
              name: node.name,
              action: 'update',
              id: existingDoc.id,
            })
          } catch (err) {
            failed++
            results.push({
              slug: node.slug,
              name: node.name,
              action: 'error',
              message: err instanceof Error ? err.message : String(err),
            })
          }
        }
      }
    }

    /* ─ Pass 3: 孤兒（既有但不在 Shopline 清單內）→ isActive=false（僅 reset=1 時） ─ */
    if (resetOrphans) {
      for (const [slug, doc] of existingBySlug) {
        if (plannedSlugs.has(slug)) continue
        if (doc.id < 0) continue // dryRun placeholder
        if (!doc.isActive) continue // 已停用就跳過
        if (dryRun) {
          deactivated++
          results.push({ slug, name: doc.name, action: 'deactivate', id: doc.id })
          continue
        }
        try {
          await req.payload.update({
            collection: 'categories',
            id: doc.id,
            data: { isActive: false } as never,
          })
          deactivated++
          results.push({ slug, name: doc.name, action: 'deactivate', id: doc.id })
        } catch (err) {
          failed++
          results.push({
            slug,
            name: doc.name,
            action: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    if (!dryRun && (created > 0 || updated > 0 || deactivated > 0)) {
      safeRevalidate(['/', '/products'], ['categories', 'products'])
    }

    return Response.json({
      success: true,
      mode: dryRun ? 'dry-run' : 'commit',
      totalPlanned: SHOPLINE_CATEGORIES.length,
      created,
      updated,
      unchanged,
      deactivated,
      failed,
      results,
    })
  },
}
