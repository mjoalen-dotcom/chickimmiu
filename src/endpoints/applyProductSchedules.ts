import type { Endpoint, PayloadRequest } from 'payload'
import { runApplyProductSchedules } from '../lib/products/applySchedules'

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

    const result = await runApplyProductSchedules(req.payload)

    return Response.json({
      success: true,
      ...result,
    })
  },
}
