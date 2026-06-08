import type { Payload } from 'payload'

import { safeRevalidate } from '../revalidate'

/**
 * 掃描商品「預定上架 / 下架時間」並依當下時間切換 status：
 *   - status='draft' && publishAt <= now → 'published'
 *   - status='published' && unpublishAt <= now → 'archived'
 *
 * 共用於：
 *   - Payload endpoint POST /api/products/apply-schedules（後台「立刻執行」+ SCHEDULE_APPLY_TOKEN）
 *   - cron POST /api/cron/apply-product-schedules（CRON_SECRET）
 */
export async function runApplyProductSchedules(payload: Payload): Promise<{
  published: number
  archived: number
  scannedAt: string
}> {
  const now = new Date().toISOString()

  /* ── 自動上架：draft + publishAt <= now ── */
  const toPublish = await payload.find({
    collection: 'products',
    where: {
      and: [
        { status: { equals: 'draft' } },
        { publishAt: { less_than_equal: now } },
        { publishAt: { exists: true } },
      ],
    },
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  let published = 0
  for (const doc of toPublish.docs) {
    try {
      await payload.update({
        collection: 'products',
        id: (doc as { id: string | number }).id,
        data: { status: 'published' },
        overrideAccess: true,
      })
      published++
    } catch (e) {
      payload.logger?.error?.(
        `[apply-schedules] publish ${(doc as { id: string | number }).id} failed: ${(e as Error).message}`,
      )
    }
  }

  /* ── 自動下架：published + unpublishAt <= now ── */
  const toArchive = await payload.find({
    collection: 'products',
    where: {
      and: [
        { status: { equals: 'published' } },
        { unpublishAt: { less_than_equal: now } },
        { unpublishAt: { exists: true } },
      ],
    },
    limit: 1000,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })

  let archived = 0
  for (const doc of toArchive.docs) {
    try {
      await payload.update({
        collection: 'products',
        id: (doc as { id: string | number }).id,
        data: { status: 'archived' },
        overrideAccess: true,
      })
      archived++
    } catch (e) {
      payload.logger?.error?.(
        `[apply-schedules] archive ${(doc as { id: string | number }).id} failed: ${(e as Error).message}`,
      )
    }
  }

  /* 有任何狀態變化才打 revalidate（products.afterChange 也會自己跑，但這裡保險） */
  if (published > 0 || archived > 0) {
    safeRevalidate(['/', '/products'], ['products'])
  }

  return { published, archived, scannedAt: now }
}
