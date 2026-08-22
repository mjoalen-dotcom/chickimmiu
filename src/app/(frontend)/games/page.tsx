import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { getPublicLeaderboard } from '@/lib/games/leaderboardData'
import { GamesHub } from '@/components/games/GamesHub'
import type { LeaderboardEntry, UserBadgeLite } from '@/components/games/GamesHub'

export const dynamic = 'force-dynamic'

type LooseRecord = Record<string, unknown>

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

// A-1 refactor：排行榜查詢抽到 lib/games/leaderboardData.ts，
// 與 App 端點 GET /api/app/leaderboard 共用同一份資料與遮罩。
async function getLeaderboardData(
  payload: Awaited<ReturnType<typeof import('payload').getPayload>>,
): Promise<LeaderboardEntry[]> {
  return getPublicLeaderboard(payload, 10)
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

  const userPoints = user
    ? (((user as unknown as LooseRecord).points as number) ?? 0)
    : null

  return (
    <GamesHub
      enabledGames={enabledGames}
      todayGamePoints={stats.todayGamePoints}
      badgeCount={stats.badgeCount}
      userPoints={userPoints}
      leaderboard={leaderboard}
      userBadges={userBadges}
      isLoggedIn={Boolean(user)}
    />
  )
}
