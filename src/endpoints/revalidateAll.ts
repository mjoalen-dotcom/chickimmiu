import type { Endpoint, PayloadRequest } from 'payload'
import { safeRevalidate } from '../lib/revalidate'

/**
 * POST /api/products/revalidate-all
 * ──────────────────────────────────
 * 手動觸發前台快取重建，讓列表與首頁立刻吃到最新資料。
 * 僅 admin 可呼叫。
 *
 * 一般編輯不需要呼叫此 endpoint（Products/Categories/Media 的
 * afterChange hook 已經會自動 revalidate）。此 endpoint 用於：
 *   - 手動 DB 操作後強制刷新
 *   - 批次匯入後整站刷新
 *   - 懷疑快取卡住時的「手動救援」按鈕
 */
export const revalidateAllEndpoint: Endpoint = {
  path: '/revalidate-all',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user || (req.user as unknown as Record<string, unknown>).role !== 'admin') {
      return Response.json({ success: false, message: '權限不足' }, { status: 403 })
    }

    const paths = ['/', '/products', '/collections']
    const tags = ['products', 'categories', 'media', 'size-charts']
    safeRevalidate(paths, tags)

    return Response.json({
      success: true,
      revalidated: { paths, tags },
      timestamp: new Date().toISOString(),
    })
  },
}
