import type { BasePayload, Where } from 'payload'

/**
 * 公開排行榜資料（server-only，網站 /games 與 App GET /api/app/leaderboard 共用）
 * ─────────────────────────────────────────────────────────────
 * A-1（APP 遷移需求 2026-08-20）：排行榜原本只存在於 /games server component，
 * App 無對外端點可用。抽成共用 lib 讓兩端永遠同一份資料、同一套遮罩 ——
 * 姓名一律在伺服器端遮罩後才離開後端，且不含 userId（D-3）。
 *
 * 資料優先序（沿用網站既有行為）：
 *   1. game-leaderboard collection（period=all_time，含 cron/admin 維護的 rank）
 *   2. fallback：customers 依現有點數餘額（points）排序
 */

type LooseRecord = Record<string, unknown>

export interface PublicLeaderboardEntry {
  rank: number
  /** 公開暱稱（會員自訂，原樣顯示）；未設定時為已遮罩姓名（如 王*明 / N*****i） */
  name: string
  /** 前台等級稱號（如 曦漾仙子）；資料缺漏時為「會員」 */
  tier: string
  badge: string
  points: number
  gamesPlayed: number
}

export function maskName(name: string | null, email: string | null): string {
  if (name && name.length >= 2) {
    return name[0] + '*'.repeat(Math.max(1, name.length - 2)) + name[name.length - 1]
  }
  if (name) return name + '**'
  if (email) {
    const local = email.split('@')[0]
    return local.length >= 2 ? local[0] + '*'.repeat(local.length - 1) : local + '**'
  }
  return '會員'
}

/** C-2：有公開暱稱顯示暱稱（本人自訂即公開），否則遮罩真名 */
export function publicDisplayName(
  nickname: string | null | undefined,
  name: string | null,
  email: string | null,
): string {
  const nick = typeof nickname === 'string' ? nickname.trim() : ''
  return nick || maskName(name, email)
}

export function tierToBadge(tier: string): string {
  if (tier.includes('璀璨') || tier.includes('天后')) return '👑'
  if (tier.includes('星耀') || tier.includes('皇后')) return '🌟'
  if (tier.includes('金曦') || tier.includes('女王')) return '💎'
  if (tier.includes('優漾') || tier.includes('女神')) return '🌹'
  if (tier.includes('曦漾') || tier.includes('仙子')) return '🦋'
  return '✨'
}

export async function getPublicLeaderboard(
  payload: BasePayload,
  limit = 10,
): Promise<PublicLeaderboardEntry[]> {
  try {
    // 優先查 game-leaderboard（累計 all_time）
    const lbRes = await payload.find({
      collection: 'game-leaderboard',
      where: { period: { equals: 'all_time' } } as Where,
      sort: '-totalPoints',
      limit,
      depth: 1,
      overrideAccess: true,
    })

    if (lbRes.docs.length > 0) {
      return lbRes.docs.map((doc, i) => {
        const d = doc as unknown as LooseRecord
        const player = d.player as LooseRecord | null
        const name = publicDisplayName(
          player?.nickname as string | null | undefined,
          (player?.name as string | null) ?? null,
          (player?.email as string | null) ?? null,
        )
        const tier = (d.playerTier as string | null) ?? '會員'
        return {
          rank: (d.rank as number) ?? i + 1,
          name,
          tier,
          badge: tierToBadge(tier),
          points: (d.totalPoints as number) ?? 0,
          gamesPlayed: (d.gamesPlayed as number) ?? 0,
        }
      })
    }

    // Fallback：以 customers.points 排序（會員積分排行）
    const usersRes = await payload.find({
      collection: 'customers',
      sort: '-points',
      limit,
      depth: 1,
      where: { points: { greater_than: 0 } } as Where,
      overrideAccess: true,
    })

    return usersRes.docs.map((doc, i) => {
      const d = doc as unknown as LooseRecord
      const name = publicDisplayName(
        d.nickname as string | null | undefined,
        (d.name as string | null) ?? null,
        (d.email as string | null) ?? null,
      )
      const tierDoc = (d.memberTier as LooseRecord | null) ?? null
      const tier =
        (tierDoc?.frontName as string | null) ??
        (tierDoc?.name as string | null) ??
        '會員'
      return {
        rank: i + 1,
        name,
        tier,
        badge: tierToBadge(tier),
        points: (d.points as number) ?? 0,
        gamesPlayed: 0,
      }
    })
  } catch {
    return []
  }
}
