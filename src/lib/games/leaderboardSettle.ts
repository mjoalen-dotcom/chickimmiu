import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { getTpeDateString, recordGamePlay } from './gameEngine'

/**
 * 排行榜結算 — 發放每日 / 每週 / 每月前三名額外獎勵。
 *
 * 資料來源：mini-game-records 的 `leaderboard_<period>` 聚合列
 * （由 gameEngine.updateLeaderboard 累寫，metadata.{periodKey,totalPoints,...}）。
 *
 * 設計：每日跑一次（TPE 00:xx）。
 *   - daily：永遠結算「昨天」的 daily key
 *   - weekly：僅當跨週（今天 vs 昨天的週 key 不同 = 今天是週日）時，結算昨天所屬的週
 *   - monthly：僅當跨月時，結算昨天所屬的月
 * 獎勵金額讀 GameSettings.leaderboard.top3{Daily,Weekly,Monthly}Bonus。
 *
 * 冪等：發完獎在該聚合列 metadata 標 settled=true / finalRank，re-run 會跳過。
 */

type LooseRecord = Record<string, unknown>
type Period = 'daily' | 'weekly' | 'monthly'

const PERIOD_LABEL: Record<Period, string> = {
  daily: '每日',
  weekly: '每週',
  monthly: '每月',
}

/** Asia/Taipei day-of-week (0=Sun … 6=Sat) */
function tpeDayOfWeek(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
}

/** 該 date 所屬週（週日起）的 YYYY-MM-DD key */
function weeklyKeyFor(date: Date): string {
  const todayTpe = getTpeDateString(date)
  const dow = tpeDayOfWeek(date)
  const sundayMs = Date.parse(todayTpe) - dow * 86_400_000
  return new Date(sundayMs).toISOString().slice(0, 10)
}

/** 該 date 所屬月的 YYYY-MM key */
function monthlyKeyFor(date: Date): string {
  return getTpeDateString(date).substring(0, 7)
}

function refId(v: unknown): string | number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object') return (v as LooseRecord).id as string | number | undefined
  return v as string | number
}

interface SettleOneResult {
  period: Period
  periodKey: string
  bonus: number
  awarded: number
  alreadySettled: number
  noData?: boolean
}

/** 結算單一 period+key 的前三名 */
async function settlePeriod(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  period: Period,
  periodKey: string,
  bonus: number,
): Promise<SettleOneResult> {
  const res = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { gameType: { equals: `leaderboard_${period}` } },
        { 'metadata.periodKey': { equals: periodKey } },
      ],
    } as Where,
    limit: 1000,
    depth: 0,
  })

  const rows = (res.docs as LooseRecord[])
    .map((d) => {
      const meta = (d.metadata as LooseRecord) || {}
      return {
        id: d.id as string | number,
        playerId: refId(d.player),
        totalPoints: Number(meta.totalPoints) || 0,
        settled: meta.settled === true,
        meta,
      }
    })
    .filter((r) => r.playerId !== undefined)
    .sort((a, b) => b.totalPoints - a.totalPoints)

  if (rows.length === 0) {
    return { period, periodKey, bonus, awarded: 0, alreadySettled: 0, noData: true }
  }

  const top3 = rows.slice(0, 3)
  let awarded = 0
  let alreadySettled = 0

  for (let i = 0; i < top3.length; i++) {
    const row = top3[i]
    if (row.settled) {
      alreadySettled++
      continue
    }
    // 發獎（有獎金且有積分才發）
    if (bonus > 0 && row.totalPoints > 0 && row.playerId !== undefined) {
      try {
        await recordGamePlay({
          // id 直接傳原型別（SQLite integer PK）；String() 會讓 player relationship 驗證失敗
          userId: row.playerId as unknown as string,
          gameType: `leaderboard_${period}_bonus`,
          outcome: 'win',
          prizeType: 'points',
          prizeAmount: bonus,
          prizeDescription: `排行榜${PERIOD_LABEL[period]}第${i + 1}名`,
          metadata: { periodKey, rank: i + 1 },
        })
        awarded++
      } catch (err) {
        console.error('[leaderboardSettle] award failed', { period, periodKey, rank: i + 1, err })
        continue // 不標 settled，下次 cron 重試
      }
    }
    // 標 settled（冪等）
    try {
      await (payload.update as Function)({
        collection: 'mini-game-records',
        id: row.id,
        data: { metadata: { ...row.meta, periodKey, settled: true, finalRank: i + 1 } } as never,
      })
    } catch {
      // 非關鍵
    }
  }

  return { period, periodKey, bonus, awarded, alreadySettled }
}

/**
 * 結算所有「到期」的排行榜週期（cron 入口）。
 * @param now 注入 now 方便測試；預設 new Date()
 */
export async function settleDueLeaderboards(
  now: Date = new Date(),
): Promise<{ enabled: boolean; results: SettleOneResult[] }> {
  const payload = await getPayload({ config })
  const gs = (await payload.findGlobal({ slug: 'game-settings', depth: 0 })) as unknown as LooseRecord
  const lb = (gs.leaderboard as LooseRecord) || {}

  if (lb.enabled === false) {
    return { enabled: false, results: [] }
  }

  const yesterday = new Date(now.getTime() - 86_400_000)
  const results: SettleOneResult[] = []

  // daily：永遠結算昨天
  results.push(
    await settlePeriod(payload, 'daily', getTpeDateString(yesterday), Number(lb.top3DailyBonus ?? 100)),
  )

  // weekly：跨週才結算（昨天所屬的週）
  if (weeklyKeyFor(now) !== weeklyKeyFor(yesterday)) {
    results.push(
      await settlePeriod(payload, 'weekly', weeklyKeyFor(yesterday), Number(lb.top3WeeklyBonus ?? 500)),
    )
  }

  // monthly：跨月才結算（昨天所屬的月）
  if (monthlyKeyFor(now) !== monthlyKeyFor(yesterday)) {
    results.push(
      await settlePeriod(payload, 'monthly', monthlyKeyFor(yesterday), Number(lb.top3MonthlyBonus ?? 2000)),
    )
  }

  return { enabled: true, results }
}
