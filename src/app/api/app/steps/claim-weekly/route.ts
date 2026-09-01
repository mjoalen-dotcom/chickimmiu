import { NextRequest } from 'next/server'
import type { PayloadRequest, Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  tpeWeekId,
  datesOfWeek,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'
import { awardActivityPoints } from '@/lib/app-activities/award'

/**
 * POST /api/app/steps/claim-weekly   （無參數）
 * ────────────────────────────────────────────
 * 工單 2026-08-25 活動三：
 *   ‧ 週次由後端依當下時間（Asia/Taipei）計算，App 不傳入 —— 允許 App 指定週次
 *     會違反共通規則 #3，且使會員可以補領過去任何一週
 *   ‧ 週累計步數於領獎時從當週的每日紀錄加總計算
 *   ‧ 冪等：user + weekId 複合唯一索引 + claimed 旗標
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const settings = await getActivitySettings(payload)
    if (!settings.stepChallenge.isActive) {
      return fail(403, CODES.ACTIVITY_INACTIVE, '活動未開放')
    }

    const milestone = settings.stepChallenge.weeklyMilestone
    if (!milestone.steps) {
      return fail(400, CODES.MILESTONE_NOT_FOUND, '每週里程碑尚未設定')
    }

    const weekId = tpeWeekId()
    const weekDates = datesOfWeek(weekId)

    const [weeklyRes, dailyRes] = await Promise.all([
      payload.find({
        collection: 'step-weekly-records',
        where: { and: [{ user: { equals: user.id } }, { weekId: { equals: weekId } }] } as Where,
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
    ])

    const weeklyDoc = weeklyRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (weeklyDoc?.claimed === true) {
      return fail(409, CODES.ALREADY_CLAIMED, '本週獎勵已經領過了', { weekId })
    }

    const weekSteps = dailyRes.docs.reduce(
      (sum, d) => sum + (Number((d as unknown as Record<string, unknown>).steps ?? 0) || 0),
      0,
    )
    if (weekSteps < milestone.steps) {
      return fail(400, CODES.STEPS_NOT_ENOUGH, '本週步數尚未達標', {
        steps: weekSteps,
        required: milestone.steps,
        weekId,
      })
    }

    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) return fail(503, CODES.INTERNAL_ERROR, '系統忙碌中，請稍後再試')

    try {
      const data = {
        user: user.id,
        weekId,
        claimed: true,
        claimedAt: new Date().toISOString(),
        stepsAtClaim: weekSteps,
      }
      if (weeklyDoc) {
        await payload.update({
          collection: 'step-weekly-records',
          id: weeklyDoc.id as string | number,
          data: data as never,
          overrideAccess: true,
          req: { transactionID } as PayloadRequest,
        })
      } else {
        await payload.create({
          collection: 'step-weekly-records',
          data: data as never,
          overrideAccess: true,
          req: { transactionID } as PayloadRequest,
        })
      }

      const result = await awardActivityPoints(payload, {
        userId: user.id,
        amount: milestone.points,
        source: 'step_activity_weekly',
        description: `本週步數達成 ${milestone.steps} 步`,
        existingTransactionID: transactionID,
      })

      await payload.db.commitTransaction(transactionID)
      return ok({
        weekId,
        steps: weekSteps,
        pointsAwarded: result.awarded,
        balance: result.balance,
      })
    } catch (err) {
      await payload.db.rollbackTransaction(transactionID)
      const msg = err instanceof Error ? err.message : String(err)
      if (/unique|duplicate/i.test(msg)) {
        return fail(409, CODES.ALREADY_CLAIMED, '本週獎勵已經領過了', { weekId })
      }
      throw err
    }
  } catch (err) {
    console.error('[app/steps/claim-weekly] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
