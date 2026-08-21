import { NextRequest, NextResponse } from 'next/server'
import { resolveApiUser } from '@/lib/auth/resolveApiUser'
import { getPublicLeaderboard } from '@/lib/games/leaderboardData'

/**
 * App 排行榜 API（A-1，APP 遷移需求 2026-08-20）
 * GET /api/app/leaderboard?period=all&limit=10
 * Authorization: JWT <token>（Bearer 亦可）
 *
 * 與網站 /games 排行榜同一資料來源（lib/games/leaderboardData.ts）：
 *   game-leaderboard(all_time) 優先，空時 fallback customers.points 排序。
 * 姓名由伺服器端遮罩，不回傳 userId。
 *
 * 期間目前僅支援 all（網站的今日/本週/本月按鈕也只是前端狀態、同一份資料）。
 */
export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await resolveApiUser(req.headers)
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const period = (searchParams.get('period') || 'all').toLowerCase()
    if (period !== 'all' && period !== 'all_time') {
      return NextResponse.json(
        { success: false, error: '目前僅支援 period=all' },
        { status: 400 },
      )
    }
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50)

    const items = await getPublicLeaderboard(payload, limit)

    return NextResponse.json({
      success: true,
      data: { period: 'all', items },
    })
  } catch (error) {
    console.error('[app/leaderboard] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
