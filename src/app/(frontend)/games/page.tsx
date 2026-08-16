import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { GamesHub } from '@/components/games/GamesHub'
import type { LeaderboardEntry, UserBadgeLite } from '@/components/games/GamesHub'

export const dynamic = 'force-dynamic'

type LooseRecord = Record<string, unknown>

// ── 工具函式 ──────────────────────────────────────────────────

function maskName(name: string | null, email: string | null): string {
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

function tierToBadge(tier: string): string {
  if (tier.includes('璀璨') || tier.includes('天后')) return '👑'
  if (tier.includes('星耀') || tier.includes('皇后')) return '🌟'
  if (tier.includes('金曦') || tier.includes('女王')) return '💎'
  if (tier.includes('優漾') || tier.includes('女神')) return '🌹'
  if (tier.includes('曦漾') || tier.includes('仙子')) return '🦋'
  return '✨'
}

// ── Server 查詢 ──────────────────────────────────────────────

async function getHubStats(payload: Awaited<ReturnType<typeof import('payload').getPayload>>) {
  try {
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return { todayGamePoints: null, badgeCount: null }

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const [pointsRes, badgesRes] = await Promise.all([
      payload.find({
        collection: 'mini-game-records',
        where: {
          and: [
            { player: { equals: user.id } },
            { status: { equals: 'completed' } },
            { 'result.prizeType': { equals: 'points' } },
            { createdAt: { greater_than_equal: start.toISOString() } },
          ],
        } as Where,
        limit: 200,
        depth: 0,
      }),
      payload.find({
        collection: 'mini-game-records',
        where: {
          and: [
            { player: { equals: user.id } },
            { 'result.prizeType': { equals: 'badge' } },
          ],
        } as Where,
        limit: 0,
        depth: 0,
      }),
    ])

    const todayGamePoints = pointsRes.docs.reduce((sum, doc) => {
      const r = (doc as unknown as LooseRecord).result as LooseRecord | undefined
      return sum + ((r?.prizeAmount as number | undefined) ?? 0)
    }, 0)

    return { todayGamePoints, badgeCount: badgesRes.totalDocs }
  } catch {
    return { todayGamePoints: null, badgeCount: null }
  }
}

async function getLeaderboardData(
  payload: Awaited<ReturnType<typeof import('payload').getPayload>>,
): Promise<LeaderboardEntry[]> {
  try {
    // 優先查 game-leaderboard（累計 all_time）
    const lbRes = await payload.find({
      collection: 'game-leaderboard',
      where: { period: { equals: 'all_time' } } as Where,
      sort: '-totalPoints',
      limit: 10,
      depth: 1,
    })

    if (lbRes.docs.length > 0) {
      return lbRes.docs.map((doc, i) => {
        const d = doc as unknown as LooseRecord
        const player = d.player as LooseRecord | null
        const name = maskName(
          (player?.name as string | null) ?? null,
          (player?.email as string | null) ?? null,
        )
        const tier = (d.playerTier as string | null) ?? '會員'
        return {
          rank: (d.rank as number) ?? i + 1,
          name,
          points: (d.totalPoints as number) ?? 0,
          tier,
          badge: tierToBadge(tier),
          gamesPlayed: (d.gamesPlayed as number) ?? 0,
        }
      })
    }

    // Fallback：以 customers.points 排序（會員積分排行）
    const usersRes = await payload.find({
      collection: 'customers',
      sort: '-points',
      limit: 10,
      depth: 1,
      where: { points: { greater_than: 0 } } as Where,
    })

    return usersRes.docs.map((doc, i) => {
      const d = doc as unknown as LooseRecord
      const name = maskName(
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
        points: (d.points as number) ?? 0,
        tier,
        badge: tierToBadge(tier),
        gamesPlayed: 0,
      }
    })
  } catch {
    return []
  }
}

async function getUserBadges(
  payload: Awaited<ReturnType<typeof import('payload').getPayload>>,
  userId: string | null,
): Promise<UserBadgeLite[]> {
  if (!userId) return []
  try {
    const res = await payload.find({
      collection: 'user-rewards',
      where: {
        and: [
          { user: { equals: userId } },
          { rewardType: { equals: 'badge' } },
        ],
      } as Where,
      sort: '-createdAt',
      limit: 50,
      depth: 0,
    })

    return res.docs.map((doc) => {
      const d = doc as unknown as LooseRecord
      return {
        id: String(d.id),
        name: (d.displayName as string) ?? '徽章',
        icon: '🏅',
        desc: (d.redemptionInstructions as string | null) ?? '',
        earnedAt: (d.createdAt as string) ?? '',
      }
    })
  } catch {
    return []
  }
}

// ── Page ─────────────────────────────────────────────────────

export default async function GamesPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList }).catch(() => ({ user: null }))

  const [enabledGames, stats, leaderboard, userBadges] = await Promise.all([
    getEnabledGames(),
    getHubStats(payload),
    getLeaderboardData(payload),
    getUserBadges(payload, user?.id ? String(user.id) : null),
  ])

  return (
    <GamesHub
      enabledGames={enabledGames}
      todayGamePoints={stats.todayGamePoints}
      badgeCount={stats.badgeCount}
      leaderboard={leaderboard}
      userBadges={userBadges}
      isLoggedIn={Boolean(user)}
    />
  )
}
