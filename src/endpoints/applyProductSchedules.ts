import type { Endpoint, PayloadRequest } from 'payload'
import { safeRevalidate } from '../lib/revalidate'

/**
 * POST /api/products/apply-schedules
 * ──────────────────────────────────
 * 掃描所有商品的「預定上架時間 / 預定下架時間」，依照當下時間切換 status：
 *
 *   - status='draft' && publishAt <= now → status='published'
 *   - status='published' && unpublishAt <= now → status='archived'
 *
 * 適合：
 *   - 後台「立刻執行排程」按鈕（手動觸發）
 *   - 外部 cron 每 10 分鐘 curl 一次（無感自動上下架）
 *
 * 權限：admin only（cron 用 Bearer token，預留 env `SCHEDULE_APPLY_TOKEN`）。
 *
 * 不會去呼叫 /revalidate-all — Products.afterChange hook 已經會 revalidate。
 */
export const applyProductSchedulesEndpoint: Endpoint = {
  path: '/apply-schedules',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    // 雙路驗證：admin 登入 OR 帶正確 Bearer token（給外部 cron 用）
    const isAdmin =
      req.user && (req.user as unknown as Record<string, unknown>).role === 'admin'

    const headerToken =
      req.headers?.get?.('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
    const envToken = process.env.SCHEDULE_APPLY_TOKEN || ''
    const tokenValid = Boolean(envToken) && headerToken === envToken

    if (!isAdmin && !tokenValid) {
      return Response.json(
        { success: false, message: '權限不足（需 admin 或正確 SCHEDULE_APPLY_TOKEN）' },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()

    /* ── 自動上架：draft + publishAt <= now ── */
    const toPublish = await req.payload.find({
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

    let publishedCount = 0
    for (const doc of toPublish.docs) {
      try {
        await req.payload.update({
          collection: 'products',
          id: (doc as { id: string | number }).id,
          data: { status: 'published' },
          overrideAccess: true,
        })
        publishedCount++
      } catch (e) {
        req.payload.logger?.error?.(
          `[apply-schedules] publish ${(doc as { id: string | number }).id} failed: ${(e as Error).message}`,
        )
      }
    }

    /* ── 自動下架：published + unpublishAt <= now ── */
    const toArchive = await req.payload.find({
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

    let archivedCount = 0
    for (const doc of toArchive.docs) {
      try {
        await req.payload.update({
          collection: 'products',
          id: (doc as { id: string | number }).id,
          data: { status: 'archived' },
          overrideAccess: true,
        })
        archivedCount++
      } catch (e) {
        req.payload.logger?.error?.(
          `[apply-schedules] archive ${(doc as { id: string | number }).id} failed: ${(e as Error).message}`,
        )
      }
    }

    /* 有任何狀態變化才打 revalidate（products.afterChange 也會自己跑，但這裡保險） */
    if (publishedCount > 0 || archivedCount > 0) {
      safeRevalidate(['/', '/products'], ['products'])
    }

    return Response.json({
      success: true,
      published: publishedCount,
      archived: archivedCount,
      scannedAt: now,
    })
  },
}
