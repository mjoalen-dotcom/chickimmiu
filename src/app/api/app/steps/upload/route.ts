import { NextRequest } from 'next/server'
import type { Where } from 'payload'

import { requireCustomer, tpeToday, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * POST /api/app/steps/upload   body: { date: 'YYYY-MM-DD', steps: number }
 * ──────────────────────────────────────────────────────────────────────
 * 工單 2026-08-25 活動三「上傳當日步數：驗證規則」：
 *   ‧ date 只接受今日（Asia/Taipei，00:00 換日），其餘日期一律**靜默忽略**
 *     （不報錯 —— 避免多裝置競態把 App 洗成錯誤畫面）
 *   ‧ 同日步數只允許遞增，收到比已存值小的數字一律**靜默忽略**
 *   ‧ 不設單日步數上限（獎勵是階段制，步數再高也不會多拿）
 *
 * 活動關閉時步數仍照常接收（避免關閉期間的步數遺失）—— 只有領獎端點會擋。
 * 回傳「伺服器採計後的當日步數」，可能與送出值不同。
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    const body = (await req.json().catch(() => ({}))) as { date?: string; steps?: number }
    const date = (body.date || '').trim()
    const steps = Math.floor(Number(body.steps))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(steps) || steps < 0) {
      return fail(400, CODES.BAD_REQUEST, '參數格式錯誤')
    }

    const today = tpeToday()
    const existing = await payload.find({
      collection: 'step-daily-records',
      where: {
        and: [{ user: { equals: user.id } }, { date: { equals: today } }],
      } as Where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const current = existing.docs[0] as unknown as Record<string, unknown> | undefined
    const currentSteps = Number(current?.steps ?? 0) || 0

    // 非今日 → 靜默忽略（回今日的採計值，不報錯）
    if (date !== today) {
      return ok({ date: today, steps: currentSteps, ignored: 'not_today' })
    }
    // 只允許遞增 → 靜默忽略
    if (current && steps <= currentSteps) {
      return ok({ date: today, steps: currentSteps, ignored: 'not_greater' })
    }

    if (current) {
      await payload.update({
        collection: 'step-daily-records',
        id: current.id as string | number,
        data: { steps } as never,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'step-daily-records',
        data: { user: user.id, date: today, steps, claimedMilestones: [] } as never,
        overrideAccess: true,
      })
    }

    return ok({ date: today, steps })
  } catch (err) {
    console.error('[app/steps/upload] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
