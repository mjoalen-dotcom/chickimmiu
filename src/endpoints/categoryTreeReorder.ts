import type { Endpoint, PayloadRequest } from 'payload'
import { safeRevalidate } from '../lib/revalidate'

/**
 * POST /api/categories/reorder
 * ─────────────────────────────
 * 批次更新分類樹結構（拖曳儲存）。
 *
 * Body: { items: Array<{id: string|number, parent: string|number|null, sortOrder: number, level: '1'|'2'|'3'}> }
 *
 * 驗證：
 *   - admin only
 *   - 阻擋 cycle（item.parent 不能在自己的子孫鏈）
 *   - 阻擋 level 4+（Shopline 維持 3 層）
 *   - level 必須與 parent 鏈深度一致
 *
 * 每筆差異才 update（節流）。
 */
type ReorderItem = {
  id: string | number
  parent: string | number | null
  sortOrder: number
  level: '1' | '2' | '3'
}

export const categoryReorderEndpoint: Endpoint = {
  path: '/reorder',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    let body: { items?: ReorderItem[] } = {}
    try {
      const raw = req.json ? await req.json() : null
      body = (raw as { items?: ReorderItem[] }) || {}
    } catch {
      return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) {
      return Response.json({ success: false, message: '沒有 items' }, { status: 400 })
    }

    // Index by id for fast lookup
    const byId = new Map<string, ReorderItem>()
    for (const it of items) byId.set(String(it.id), it)

    // Cycle + depth check
    const cycleErrors: string[] = []
    for (const it of items) {
      const seen = new Set<string>()
      let cursor: string | null = it.parent ? String(it.parent) : null
      let depth = 0
      while (cursor) {
        if (seen.has(cursor)) {
          cycleErrors.push(`${it.id}: parent chain has cycle at ${cursor}`)
          break
        }
        if (cursor === String(it.id)) {
          cycleErrors.push(`${it.id}: cannot be descendant of itself`)
          break
        }
        seen.add(cursor)
        depth += 1
        if (depth > 10) {
          cycleErrors.push(`${it.id}: depth too deep`)
          break
        }
        const parent = byId.get(cursor)
        cursor = parent?.parent ? String(parent.parent) : null
      }

      const expectedLevel = String(depth + 1)
      if (it.level !== expectedLevel) {
        cycleErrors.push(`${it.id}: level=${it.level} but chain depth=${depth + 1}`)
      }
      if (depth >= 3) {
        cycleErrors.push(`${it.id}: exceeds max 3 levels`)
      }
    }

    if (cycleErrors.length > 0) {
      return Response.json(
        { success: false, message: '結構檢查失敗', errors: cycleErrors },
        { status: 400 },
      )
    }

    // Pull current state for diff
    const currentById = new Map<string, { parent: string | number | null; sortOrder: number; level: string }>()
    try {
      const ids = items.map((i) => i.id)
      const existing = await req.payload.find({
        collection: 'categories',
        where: { id: { in: ids } },
        limit: ids.length + 10,
        depth: 0,
      })
      for (const doc of existing.docs) {
        const d = doc as unknown as Record<string, unknown>
        const parentRaw = d.parent
        const parentId =
          parentRaw && typeof parentRaw === 'object'
            ? ((parentRaw as { id?: string | number }).id ?? null)
            : (parentRaw as string | number | null) ?? null
        currentById.set(String(d.id), {
          parent: parentId,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
          level: (d.level as string) ?? '1',
        })
      }
    } catch (e) {
      return Response.json(
        { success: false, message: 'Failed to read current state', error: String(e) },
        { status: 500 },
      )
    }

    // Diff + update
    let updated = 0
    const errors: { id: string | number; error: string }[] = []
    const touchedSlugs: string[] = []

    for (const it of items) {
      const curr = currentById.get(String(it.id))
      if (!curr) continue
      const newParent = it.parent ? it.parent : null
      const parentChanged = String(curr.parent ?? '') !== String(newParent ?? '')
      const sortChanged = curr.sortOrder !== it.sortOrder
      const levelChanged = curr.level !== it.level
      if (!parentChanged && !sortChanged && !levelChanged) continue

      try {
        const idNum = typeof it.id === 'string' ? Number(it.id) : it.id
        const parentForUpdate =
          newParent === null
            ? null
            : typeof newParent === 'string'
              ? Number(newParent)
              : newParent
        const result = await req.payload.update({
          collection: 'categories',
          id: idNum,
          data: {
            parent: parentForUpdate,
            sortOrder: it.sortOrder,
            level: it.level,
          },
          req,
          overrideAccess: false,
          depth: 0,
        })
        updated += 1
        const slug = (result as unknown as Record<string, unknown>).slug
        if (typeof slug === 'string' && slug) touchedSlugs.push(slug)
      } catch (e) {
        errors.push({ id: it.id, error: String(e) })
      }
    }

    // Revalidate touched frontend paths
    const paths = Array.from(new Set(touchedSlugs.map((s) => `/category/${s}`))).concat(['/categories'])
    safeRevalidate(paths, ['categories', 'products'])

    return Response.json({
      success: errors.length === 0,
      updated,
      errors,
    })
  },
}
