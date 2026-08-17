/**
 * Ops Copilot API — 共用 admin 認證
 * ─────────────────────────────────────
 * 整組 /api/ops-copilot/* 都只給 admin。
 * 這裡是唯一的認證入口 —— 新增 route 一定要走 requireAdmin()，不要自己重寫。
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

export interface AdminContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  userId: string | number
  userName: string
}

/**
 * 回傳 admin context，或一個可以直接 return 的 401/403 Response。
 * 用法：
 *   const auth = await requireAdmin(req)
 *   if (auth instanceof NextResponse) return auth
 */
export async function requireAdmin(req: Request): Promise<AdminContext | NextResponse> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: '需要登入' }, { status: 401 })
  }
  if ((user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: '需要管理員權限' }, { status: 403 })
  }

  return {
    payload,
    userId: user.id as string | number,
    userName: (user as { name?: string; email?: string }).name || (user as { email?: string }).email || '',
  }
}
