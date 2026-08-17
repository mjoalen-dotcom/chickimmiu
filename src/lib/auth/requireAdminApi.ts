/**
 * 自訂 API route 的 admin 守衛（唯一入口）
 * ─────────────────────────────────────────
 * Payload collection 的 access control 只保護 `/api/<collection>` 這類原生
 * REST；**放在 `src/app/api/**` 的自訂 route handler 完全不受它管**——那是
 * 一般的 Next.js route，不寫驗證就是全世界都能打。
 *
 * 2026-08-17 稽核實測：`/api/marketing/campaigns` 與 `/api/marketing/
 * campaigns/[id]` 的 GET/POST/PATCH/DELETE 五個 handler 全都沒有驗證，
 * 未登入可讀出活動預算/分眾/成效，也能把活動 scheduled→active 或直接
 * cancelled。middleware 只 match `/admin` 與 `/products`，擋不到這裡。
 *
 * 用法：
 *   const guard = await requireAdminApi(req)
 *   if (!guard.ok) return guard.response
 *   // guard.payload / guard.user 可直接用，不必再 getPayload 一次
 */
import { NextResponse } from 'next/server'
import { getPayload, type BasePayload } from 'payload'
import config from '@payload-config'

type Guard =
  | { ok: true; payload: BasePayload; user: Record<string, unknown> }
  | { ok: false; response: NextResponse }

export async function requireAdminApi(req: Request): Promise<Guard> {
  const payload = await getPayload({ config })
  let user: Record<string, unknown> | null = null
  try {
    const auth = await payload.auth({ headers: req.headers })
    user = (auth?.user as unknown as Record<string, unknown>) ?? null
  } catch {
    user = null
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '請先登入', code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    }
  }
  // 顧客帳號（customers collection）沒有 role 欄位，讀不到 'admin' 自然被擋，
  // 不需要另外判斷 principal 來自哪個 collection。
  if ((user as { role?: string }).role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '需要管理員權限', code: 'FORBIDDEN' },
        { status: 403 },
      ),
    }
  }
  return { ok: true, payload, user }
}
