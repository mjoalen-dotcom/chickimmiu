import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/categories/recount
 * ─────────────────────────────
 * Admin-only: recompute productCount for every category from real product rows.
 *
 * Use when increment/decrement hooks have drifted (bulk import / manual DB ops).
 *
 * Response: { ok: true, count: N, changed: [{ id, before, after }] }
 */
export const recountCategoriesEndpoint: Endpoint = {
  path: '/recount',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (
      !req.user ||
      (req.user as unknown as Record<string, unknown>).role !== 'admin'
    ) {
      return Response.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      )
    }

    const { docs: cats } = await req.payload.find({
      collection: 'categories',
      limit: 1000,
      depth: 0,
      pagination: false,
    })

    const results: Array<{ id: number; before: number; after: number }> = []

    for (const cat of cats) {
      const catRecord = cat as unknown as Record<string, unknown>
      const idRaw = catRecord.id
      const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
      if (!Number.isFinite(id)) continue

      const { totalDocs } = await req.payload.count({
        collection: 'products',
        where: { category: { equals: id } },
      })

      const beforeRaw = catRecord.productCount
      const before = typeof beforeRaw === 'number' ? beforeRaw : 0

      if (before !== totalDocs) {
        await req.payload.update({
          collection: 'categories',
          id,
          data: { productCount: totalDocs },
          depth: 0,
        })
      }
      results.push({ id, before, after: totalDocs })
    }

    return Response.json({
      ok: true,
      count: results.length,
      changed: results.filter((r) => r.before !== r.after),
    })
  },
}
