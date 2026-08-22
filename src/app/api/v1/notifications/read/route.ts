import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'

import { resolveApiUser } from '@/lib/auth/resolveApiUser'

/**
 * POST /api/v1/notifications/read — 標記已讀（2026-08-22 需求 ③）
 *   body: { ids: Array<string|number> } 指定幾則，或 { all: true } 全部
 *
 * collection 的 update access 是 admin-only；會員標已讀只能走這裡 —
 * server 端強制 where recipient=自己 + 未讀，別人的信與其他欄位都碰不到。
 */
export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await resolveApiUser(req.headers)
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }
    if (user.collection !== 'customers') {
      return NextResponse.json({ success: false, error: '僅限會員帳號' }, { status: 403 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ success: false, error: '無效的請求內容' }, { status: 400 })
    }

    const all = body.all === true
    const rawIds = Array.isArray(body.ids) ? (body.ids as unknown[]) : []
    const ids = rawIds.filter((v): v is string | number =>
      typeof v === 'string' || typeof v === 'number',
    )
    if (!all && ids.length === 0) {
      return NextResponse.json({ success: false, error: '需要 ids 或 all:true' }, { status: 400 })
    }
    if (ids.length > 100) {
      return NextResponse.json({ success: false, error: '一次最多 100 則' }, { status: 400 })
    }

    const and: Where[] = [
      { recipient: { equals: user.id } },
      { readAt: { exists: false } },
    ]
    if (!all) {
      and.push({ id: { in: ids } })
    }

    const result = await payload.update({
      collection: 'notifications',
      where: { and },
      data: { readAt: new Date().toISOString() },
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, updated: result.docs.length })
  } catch (error) {
    console.error('[notifications read] error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
