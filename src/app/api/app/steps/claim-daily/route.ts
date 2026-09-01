import { NextRequest } from 'next/server'
import type { PayloadRequest, Where } from 'payload'

import {
  requireCustomer,
  getActivitySettings,
  tpeToday,
  ok,
  fail,
  CODES,
} from '@/lib/app-activities/common'
import { awardActivityPoints } from '@/lib/app-activities/award'

/**
 * POST /api/app/steps/claim-daily   body: { date: 'YYYY-MM-DD', milestone: number }
 * ────────────────────────────────────────────────────────────────────────────────
 * 工單 2026-08-25 活動三：
 *   ‧ App 先上傳步數，後端核對「紀錄中的步數」是否達門檻才發獎（共通規則 #3：
 *     不接受 App 送「我走了一萬步，請給 100 點」）
 *   ‧ 只能領當日的，date 非今日一律拒絕、不開放補領
 *   ‧ milestone 必須存在於後台設定，否則拒絕
 *   ‧ 冪等：已領取的里程碑記在 claimedMilestones，重複領取拒絕
 *   ‧ 加點與更新紀錄同一交易
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const body = (await req.json().catch(() => ({}))) as { date?: string; milestone?: number }
    const date = (body.date || '').trim()
    const milestone = Math.floor(Number(body.milestone))
    if (!date || !Number.isFinite(milestone)) {
      return fail(400, CODES.BAD_REQUEST, '參數格式錯誤')
    }

    const settings = await getActivitySettings(payload)
    if (!settings.stepChallenge.isActive) {
      return fail(403, CODES.ACTIVITY_INACTIVE, '活動未開放')
    }

    const today = tpeToday()
    if (date !== today) {
      return fail(400, CODES.DATE_NOT_TODAY, '只能領取當日獎勵', { today })
    }

    const target = settings.stepChallenge.dailyMilestones.find((m) => m.steps === milestone)
    if (!target) {
      return fail(400, CODES.MILESTONE_NOT_FOUND, '里程碑不存在', {
        milestones: settings.stepChallenge.dailyMilestones,
      })
    }

    const res = await payload.find({
      collection: 'step-daily-records',
      where: { and: [{ user: { equals: user.id } }, { date: { equals: today } }] } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = res.docs[0] as unknown as Record<string, unknown> | undefined
    const steps = Number(doc?.steps ?? 0) || 0

    if (!doc || steps < target.steps) {
      return fail(400, CODES.STEPS_NOT_ENOUGH, '步數尚未達標', {
        steps,
        required: target.steps,
      })
    }

    const claimed = Array.isArray(doc.claimedMilestones)
      ? (doc.claimedMilestones as unknown[]).map((v) => Number(v)).filter(Number.isFinite)
      : []
    if (claimed.includes(target.steps)) {
      return fail(409, CODES.ALREADY_CLAIMED, '這個里程碑已經領過了', { claimedMilestones: claimed })
    }

    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) return fail(503, CODES.INTERNAL_ERROR, '系統忙碌中，請稍後再試')

    try {
      await payload.update({
        collection: 'step-daily-records',
        id: doc.id as string | number,
        data: { claimedMilestones: [...claimed, target.steps] } as never,
        overrideAccess: true,
        req: { transactionID } as PayloadRequest,
      })

      const result = await awardActivityPoints(payload, {
        userId: user.id,
        amount: target.points,
        source: 'step_activity',
        description: `每日步數達成 ${target.steps} 步`,
        existingTransactionID: transactionID,
      })

      await payload.db.commitTransaction(transactionID)
      return ok({
        milestone: target.steps,
        pointsAwarded: result.awarded,
        balance: result.balance,
        claimedMilestones: [...claimed, target.steps],
      })
    } catch (err) {
      await payload.db.rollbackTransaction(transactionID)
      throw err
    }
  } catch (err) {
    console.error('[app/steps/claim-daily] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
