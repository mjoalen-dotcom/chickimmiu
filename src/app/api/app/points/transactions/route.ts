import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import { resolveApiUser } from '@/lib/auth/resolveApiUser'

/**
 * App 點數異動紀錄 API（A-2，APP 遷移需求 2026-08-20）
 * GET /api/app/points/transactions?page=1&limit=20
 * Authorization: JWT <token>（Bearer 亦可）
 *
 * points-transactions collection 的 REST read 是 admin-only（帳本不對外開 where
 * 查詢面），App 走這支專用端點：只回本人資料，欄位比照網站點數中心「紀錄」分頁
 * （{date, desc, points, type}），另附 balance / source / createdAt 供 App 顯示餘額軌跡。
 */

type LooseRecord = Record<string, unknown>

function formatDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(raw as string)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await resolveApiUser(req.headers)
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)

    const result = await payload.find({
      collection: 'points-transactions',
      where: { user: { equals: user.id } } as Where,
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true, // collection read 是 admin-only；where 已鎖本人
    })

    const items = (result.docs as unknown as LooseRecord[]).map((h) => {
      const amount = (h.amount as number) ?? 0
      return {
        id: h.id as string | number,
        date: formatDate(h.createdAt),
        desc: (h.description as string) || (h.source as string) || '—',
        points: amount,
        type: amount >= 0 ? 'earn' : 'spend',
        balance: (h.balance as number | null) ?? null,
        source: (h.source as string) || null,
        createdAt: (h.createdAt as string) || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: { items },
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        limit,
      },
    })
  } catch (error) {
    console.error('[app/points/transactions] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
