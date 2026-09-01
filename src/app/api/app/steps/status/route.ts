import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  tpeToday,
  tpeWeekId,
  datesOfWeek,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'

/**
 * GET /api/app/steps/status
 * ─────────────────────────
 * 工單 2026-08-25 活動三：App 進頁面即需判斷各里程碑按鈕狀態，並畫出每週進度條。
 * 回今日步數、今日已領里程碑清單、本週累計步數、本週是否已領。
 *
 * 週累計即時從當週每日紀錄加總（不另存欄位，避免兩處數字不一致）。
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const settings = await getActivitySettings(payload)
    const today = tpeToday()
    const weekId = tpeWeekId()
    const weekDates = datesOfWeek(weekId)

    const [todayRes, weekRes, weeklyRes] = await Promise.all([
      payload.find({
        collection: 'step-daily-records',
        where: { and: [{ user: { equals: user.id } }, { date: { equals: today } }] } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'step-daily-records',
        where: { and: [{ user: { equals: user.id } }, { date: { in: weekDates } }] } as Where,
        limit: 7,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'step-weekly-records',
        where: { and: [{ user: { equals: user.id } }, { weekId: { equals: weekId } }] } as Where,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const todayDoc = todayRes.docs[0] as unknown as Record<string, unknown> | undefined
    const claimed = Array.isArray(todayDoc?.claimedMilestones)
      ? (todayDoc!.claimedMilestones as unknown[]).map((v) => Number(v)).filter(Number.isFinite)
      : []
    const weekSteps = weekRes.docs.reduce(
      (sum, d) => sum + (Number((d as unknown as Record<string, unknown>).steps ?? 0) || 0),
      0,
    )
    const weeklyDoc = weeklyRes.docs[0] as unknown as Record<string, unknown> | undefined

    return ok({
      isActive: settings.stepChallenge.isActive,
      date: today,
      todaySteps: Number(todayDoc?.steps ?? 0) || 0,
      claimedMilestones: claimed,
      dailyMilestones: settings.stepChallenge.dailyMilestones,
      week: {
        weekId,
        steps: weekSteps,
        claimed: weeklyDoc?.claimed === true,
        milestone: settings.stepChallenge.weeklyMilestone,
      },
    })
  } catch (err) {
    console.error('[app/steps/status] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
