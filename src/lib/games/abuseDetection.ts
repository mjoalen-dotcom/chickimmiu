import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * Phase E — 風險控管 helpers
 *
 * 1. checkMonthlyValueCap — 檢查會員當月已中獎金額（NT$）是否超過上限
 *    超過則回傳 { exceeded: true, current, cap }；呼叫端應在抽獎前 short-circuit 改成銘謝惠顧。
 *
 * 2. detectAbuse — 偵測短時間內異常中獎行為（自動腳本 / 多帳號）
 *    每小時中獎超過 abnormalThresholdPerHour → 回傳 abnormal=true，
 *    呼叫端可在 record.metadata 標記 abuseFlag 讓 admin 查核。
 *
 * 兩者皆 fail-open（DB 異常時放行）— 風控不該擋住正常會員的中獎體驗。
 */

const TPE_TZ_OFFSET_MS = 8 * 60 * 60 * 1000

/** Asia/Taipei 當月開始（YYYY-MM-01 00:00 +08:00）的 UTC ISO */
function getMonthStartTpe(): string {
  const now = new Date()
  const tpeNow = new Date(now.getTime() + TPE_TZ_OFFSET_MS)
  const year = tpeNow.getUTCFullYear()
  const month = tpeNow.getUTCMonth()
  return new Date(Date.UTC(year, month, 1) - TPE_TZ_OFFSET_MS).toISOString()
}

/** 近 N 小時前的 UTC ISO */
function getHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

/**
 * 換算獎品為 NT$ 估值。
 * - credit / movie_ticket 可直接用 amount（已是 NT$）
 * - points 用 1 點 ≈ NT$1（依 LoyaltySettings 預設）
 * - coupon 用 amount * 100（折扣%估值，rough）
 * - free_shipping 預設 80（運費通用估值）
 * - physical_gift 用 amount（admin 在 PrizePool.estimatedValue 設）
 * - badge / none 不計
 */
export function estimatePrizeValueTwd(prizeType: string, amount: number): number {
  switch (prizeType) {
    case 'credit':
    case 'movie_ticket':
      return amount
    case 'points':
      return amount * 1
    case 'coupon':
      return Math.min(amount * 100, 5000) // 95 折券估 500 NT，避免無上限
    case 'free_shipping':
      return 80
    case 'physical_gift':
      return amount
    case 'badge':
    case 'none':
    default:
      return 0
  }
}

interface MonthlyCapResult {
  exceeded: boolean
  currentValue: number
  cap: number
  remaining: number
}

export async function checkMonthlyValueCap(
  userId: string | number,
  monthlyMaxValue: number,
): Promise<MonthlyCapResult> {
  if (!monthlyMaxValue || monthlyMaxValue <= 0) {
    return { exceeded: false, currentValue: 0, cap: 0, remaining: Infinity }
  }

  try {
    const payload = await getPayload({ config })
    const monthStart = getMonthStartTpe()

    const res = await payload.find({
      collection: 'mini-game-records',
      where: {
        and: [
          { player: { equals: userId } },
          { 'result.outcome': { equals: 'win' } },
          { createdAt: { greater_than_equal: monthStart } },
        ],
      } as Where,
      limit: 0,
      depth: 0,
    })

    let total = 0
    for (const doc of res.docs) {
      const r = (doc as unknown as Record<string, unknown>).result as Record<string, unknown> | undefined
      if (!r) continue
      const t = (r.prizeType as string) || ''
      const a = Number(r.prizeAmount || 0)
      total += estimatePrizeValueTwd(t, a)
    }

    return {
      exceeded: total >= monthlyMaxValue,
      currentValue: total,
      cap: monthlyMaxValue,
      remaining: Math.max(0, monthlyMaxValue - total),
    }
  } catch {
    return { exceeded: false, currentValue: 0, cap: monthlyMaxValue, remaining: monthlyMaxValue }
  }
}

interface AbuseResult {
  abnormal: boolean
  winsLastHour: number
  threshold: number
}

export async function detectAbuse(
  userId: string | number,
  abnormalThresholdPerHour: number,
): Promise<AbuseResult> {
  if (!abnormalThresholdPerHour || abnormalThresholdPerHour <= 0) {
    return { abnormal: false, winsLastHour: 0, threshold: 0 }
  }

  try {
    const payload = await getPayload({ config })
    const oneHourAgo = getHoursAgo(1)

    const res = await payload.find({
      collection: 'mini-game-records',
      where: {
        and: [
          { player: { equals: userId } },
          { 'result.outcome': { equals: 'win' } },
          { createdAt: { greater_than_equal: oneHourAgo } },
        ],
      } as Where,
      limit: 0,
      depth: 0,
    })

    return {
      abnormal: res.totalDocs >= abnormalThresholdPerHour,
      winsLastHour: res.totalDocs,
      threshold: abnormalThresholdPerHour,
    }
  } catch {
    return { abnormal: false, winsLastHour: 0, threshold: abnormalThresholdPerHour }
  }
}
